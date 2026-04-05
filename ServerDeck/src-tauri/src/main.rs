use dirs::home_dir;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HostRecord {
    id: String,
    label: String,
    #[serde(default = "default_project_id")]
    project_id: String,
    address: String,
    port: u16,
    username: String,
    auth_type: String,
    password: Option<String>,
    private_key_path: Option<String>,
}

fn default_project_id() -> String {
    "default".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshConnectionOptions {
    connect_timeout_seconds: u16,
    server_alive_interval_seconds: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ServerObservation {
    hostname: String,
    operating_system: String,
    uptime: String,
    load_average: String,
    cpu_cores: String,
    cpu_usage: String,
    memory_usage: String,
    memory_percent: String,
    disk_usage: String,
    disk_percent: String,
    network_usage: String,
    top_processes: Vec<ProcessObservation>,
    captured_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessObservation {
    pid: String,
    command: String,
    cpu_percent: f64,
    memory_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    modified: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalFilePreviewPayload {
    path: String,
    name: String,
    kind: String,
    size: u64,
    mime_type: Option<String>,
    text: Option<String>,
    bytes: Option<Vec<u8>>,
    archive_entries: Option<Vec<String>>,
    truncated: bool,
    detail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalOutputPayload {
    session_id: String,
    data: Option<String>,
    bytes: Option<Vec<u8>>,
    stream: String,
}

struct TerminalSession {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
}

struct AppState {
    terminal_sessions: Mutex<HashMap<String, TerminalSession>>,
}

fn storage_dir() -> Result<PathBuf, String> {
    let home = home_dir().ok_or_else(|| "Cannot resolve home directory".to_string())?;
    let dir = home.join(".serverdeck");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn hosts_file() -> Result<PathBuf, String> {
    Ok(storage_dir()?.join("hosts.json"))
}

#[tauri::command]
fn clear_app_data() -> Result<bool, String> {
    let dir = storage_dir()?;
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|error| error.to_string())?;
    }
    Ok(true)
}

fn now_millis() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".into())
}

fn read_hosts() -> Result<Vec<HostRecord>, String> {
    let path = hosts_file()?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&content).map_err(|error| error.to_string())
}

fn write_hosts(hosts: &[HostRecord]) -> Result<(), String> {
    let path = hosts_file()?;
    let content = serde_json::to_string_pretty(hosts).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

fn expand_path(path: &str) -> PathBuf {
    if path == "~" {
        return home_dir().unwrap_or_else(|| PathBuf::from("/"));
    }

    if let Some(rest) = path.strip_prefix("~/") {
        return home_dir()
            .unwrap_or_else(|| PathBuf::from("/"))
            .join(rest);
    }

    PathBuf::from(path)
}

fn resolve_binary(name: &str) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();

    if let Some(path) = env::var_os("PATH") {
        candidates.extend(env::split_paths(&path).map(|dir| dir.join(name)));
    }

    match name {
        "ssh" => {
            candidates.push(PathBuf::from("/usr/bin/ssh"));
            candidates.push(PathBuf::from("/opt/homebrew/bin/ssh"));
            candidates.push(PathBuf::from("/usr/local/bin/ssh"));
        }
        "sftp" => {
            candidates.push(PathBuf::from("/usr/bin/sftp"));
            candidates.push(PathBuf::from("/opt/homebrew/bin/sftp"));
            candidates.push(PathBuf::from("/usr/local/bin/sftp"));
        }
        "sshpass" => {
            candidates.push(PathBuf::from("/opt/homebrew/bin/sshpass"));
            candidates.push(PathBuf::from("/usr/local/bin/sshpass"));
            candidates.push(PathBuf::from("/usr/bin/sshpass"));
        }
        "curl" => {
            candidates.push(PathBuf::from("/usr/bin/curl"));
            candidates.push(PathBuf::from("/opt/homebrew/bin/curl"));
            candidates.push(PathBuf::from("/usr/local/bin/curl"));
        }
        _ => {}
    }

    candidates
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| format!("Required executable not found: {}", name))
}

fn resolve_local_shell() -> Result<PathBuf, String> {
    let mut candidates = Vec::new();

    if let Some(shell) = env::var_os("SHELL") {
        candidates.push(PathBuf::from(shell));
    }

    candidates.push(PathBuf::from("/bin/zsh"));
    candidates.push(PathBuf::from("/bin/bash"));
    candidates.push(PathBuf::from("/bin/sh"));

    candidates
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| "Local shell not found".to_string())
}

fn file_entries_from_dir(path: &Path) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    let read_dir = fs::read_dir(path).map_err(|error| error.to_string())?;

    for item in read_dir {
        let item = item.map_err(|error| error.to_string())?;
        let metadata = item.metadata().map_err(|error| error.to_string())?;
        let modified = metadata
            .modified()
            .ok()
            .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
            .map(|value| value.as_secs().to_string())
            .unwrap_or_default();

        entries.push(FileEntry {
            name: item.file_name().to_string_lossy().into_owned(),
            path: item.path().display().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified,
        });
    }

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(entries)
}

// author: BrianXiong
// time: 2026/04/05/12:19:04
fn preview_kind_and_mime(path: &Path) -> (String, Option<String>) {
    let lower_name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let ext = path
        .extension()
        .map(|value| value.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    if [
        "txt", "md", "log", "json", "js", "jsx", "ts", "tsx", "py", "rs", "go", "java", "c", "cpp", "css", "html", "yml", "yaml", "sh", "zsh", "toml", "xml", "env", "sql",
    ]
    .contains(&ext.as_str())
    {
        return ("text".to_string(), Some("text/plain; charset=utf-8".to_string()));
    }

    if ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"].contains(&ext.as_str()) {
        let mime = match ext.as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "svg" => "image/svg+xml",
            "webp" => "image/webp",
            "bmp" => "image/bmp",
            "ico" => "image/x-icon",
            _ => "application/octet-stream",
        };
        return ("image".to_string(), Some(mime.to_string()));
    }

    if ext == "pdf" {
        return ("pdf".to_string(), Some("application/pdf".to_string()));
    }

    if ext == "zip"
        || ext == "tar"
        || ext == "tgz"
        || lower_name.ends_with(".tar.gz")
        || lower_name.ends_with(".tar.bz2")
    {
        return ("archive".to_string(), Some("application/x-archive".to_string()));
    }

    ("unsupported".to_string(), None)
}

// author: BrianXiong
// time: 2026/04/05/12:19:04
fn read_text_preview(path: &Path, size: u64) -> Result<(String, bool), String> {
    const MAX_TEXT_PREVIEW_BYTES: usize = 256 * 1024;
    let mut file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut buffer = vec![0_u8; size.min(MAX_TEXT_PREVIEW_BYTES as u64) as usize];
    file.read_exact(&mut buffer).map_err(|error| error.to_string())?;
    let truncated = size > MAX_TEXT_PREVIEW_BYTES as u64;
    Ok((String::from_utf8_lossy(&buffer).into_owned(), truncated))
}

// author: BrianXiong
// time: 2026/04/05/12:19:04
fn read_binary_preview(path: &Path, size: u64) -> Result<Vec<u8>, String> {
    const MAX_BINARY_PREVIEW_BYTES: u64 = 10 * 1024 * 1024;
    if size > MAX_BINARY_PREVIEW_BYTES {
        return Err(format!(
            "Preview is limited to files under {} MB",
            MAX_BINARY_PREVIEW_BYTES / 1024 / 1024
        ));
    }

    fs::read(path).map_err(|error| error.to_string())
}

// author: BrianXiong
// time: 2026/04/05/12:19:04
fn list_archive_entries(path: &Path) -> Result<Vec<String>, String> {
    let lower_name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let ext = path
        .extension()
        .map(|value| value.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let output = if ext == "zip" {
        Command::new("unzip")
            .arg("-Z1")
            .arg(path)
            .output()
            .map_err(|error| error.to_string())?
    } else if ext == "tar" {
        Command::new("tar")
            .arg("-tf")
            .arg(path)
            .output()
            .map_err(|error| error.to_string())?
    } else if ext == "tgz" || lower_name.ends_with(".tar.gz") {
        Command::new("tar")
            .arg("-tzf")
            .arg(path)
            .output()
            .map_err(|error| error.to_string())?
    } else if lower_name.ends_with(".tar.bz2") {
        Command::new("tar")
            .arg("-tjf")
            .arg(path)
            .output()
            .map_err(|error| error.to_string())?
    } else {
        return Err("Archive preview currently supports zip/tar/tgz files".to_string());
    };

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if error.is_empty() {
            "Failed to read archive entries".to_string()
        } else {
            error
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(|line| line.to_string())
        .collect())
}

fn append_ssh_options(command: &mut Command, host: &HostRecord, ssh_options: &SshConnectionOptions) {
    command
        .arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg(format!("ServerAliveInterval={}", ssh_options.server_alive_interval_seconds))
        .arg("-o")
        .arg(format!("ConnectTimeout={}", ssh_options.connect_timeout_seconds))
        .arg("-p")
        .arg(host.port.to_string());

    if host.auth_type == "key" {
        if let Some(key_path) = &host.private_key_path {
            if !key_path.trim().is_empty() {
                command.arg("-i").arg(expand_path(key_path));
            }
        }
    }
}

fn build_ssh_command(host: &HostRecord, ssh_options: &SshConnectionOptions) -> Command {
    let destination = format!("{}@{}", host.username, host.address);
    let mut command = if host.auth_type == "password" && host.password.clone().unwrap_or_default() != "" {
        let mut sshpass = Command::new(resolve_binary("sshpass").unwrap_or_else(|_| PathBuf::from("sshpass")));
        sshpass.arg("-p").arg(host.password.clone().unwrap_or_default());
        sshpass.arg(resolve_binary("ssh").unwrap_or_else(|_| PathBuf::from("ssh")));
        sshpass
    } else {
        Command::new(resolve_binary("ssh").unwrap_or_else(|_| PathBuf::from("ssh")))
    };

    append_ssh_options(&mut command, host, ssh_options);
    command.arg(destination);
    command
}

fn parse_observation_value(output: &str, key: &str) -> String {
    output
        .lines()
        .find_map(|line| {
            line.strip_prefix(&format!("{}=", key))
                .map(|value| value.trim().to_string())
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Unknown".to_string())
}

fn parse_observation_list(output: &str, key: &str) -> Vec<String> {
    parse_observation_value(output, key)
        .split("||")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty() && value != "Unknown")
        .collect()
}

fn parse_process_observations(output: &str, key: &str) -> Vec<ProcessObservation> {
    parse_observation_list(output, key)
        .into_iter()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 4 {
                return None;
            }

            Some(ProcessObservation {
                pid: parts[0].to_string(),
                command: parts[1].to_string(),
                cpu_percent: parts[2].parse::<f64>().unwrap_or(0.0),
                memory_percent: parts[3].parse::<f64>().unwrap_or(0.0),
            })
        })
        .collect()
}

fn build_sftp_command(host: &HostRecord, ssh_options: &SshConnectionOptions) -> Command {
    let mut command = if host.auth_type == "password" && host.password.clone().unwrap_or_default() != "" {
        let mut sshpass = Command::new(resolve_binary("sshpass").unwrap_or_else(|_| PathBuf::from("sshpass")));
        sshpass.arg("-p").arg(host.password.clone().unwrap_or_default());
        sshpass.arg(resolve_binary("sftp").unwrap_or_else(|_| PathBuf::from("sftp")));
        sshpass
    } else {
        Command::new(resolve_binary("sftp").unwrap_or_else(|_| PathBuf::from("sftp")))
    };

    command
        .arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg("BatchMode=no")
        .arg("-o")
        .arg(format!("ServerAliveInterval={}", ssh_options.server_alive_interval_seconds))
        .arg("-o")
        .arg(format!("ConnectTimeout={}", ssh_options.connect_timeout_seconds))
        .arg("-P")
        .arg(host.port.to_string());

    if host.auth_type == "key" {
        if let Some(key_path) = &host.private_key_path {
            if !key_path.trim().is_empty() {
                command.arg("-i").arg(expand_path(key_path));
            }
        }
    }

    command
}

fn escape_sftp_path(path: &str) -> String {
    if path.contains(' ') || path.contains('"') {
        format!("\"{}\"", path.replace('\\', "\\\\").replace('"', "\\\""))
    } else {
        path.to_string()
    }
}

fn parse_sftp_ls_line(line: &str) -> Option<FileEntry> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    if parts.len() < 9 {
        return None;
    }

    let mode = parts[0];
    let is_dir = mode.starts_with('d');
    let size = parts[4].parse::<u64>().unwrap_or(0);
    let modified = format!("{} {} {}", parts[5], parts[6], parts[7]);
    let name = parts[8..].join(" ");

    if name == "." || name == ".." {
        return None;
    }

    Some(FileEntry {
        name: name.clone(),
        path: name,
        is_dir,
        size,
        modified,
    })
}

fn run_sftp_batch(
    host: &HostRecord,
    ssh_options: &SshConnectionOptions,
    batch: &str,
) -> Result<std::process::Output, String> {
    let destination = format!("{}@{}", host.username, host.address);
    let mut child = build_sftp_command(host, ssh_options)
        .arg("-b")
        .arg("-")
        .arg(destination)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| error.to_string())?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(batch.as_bytes())
            .and_then(|_| stdin.flush())
            .map_err(|error| error.to_string())?;
    }

    child.wait_with_output().map_err(|error| error.to_string())
}

fn ensure_sftp_success(output: &std::process::Output, fallback: &str) -> Result<(), String> {
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        fallback.to_string()
    } else {
        stderr
    })
}

// author: BrianXiong
// time: 2026/04/05/11:21:34
fn emit_terminal_output(app: &AppHandle, session_id: &str, data: String, stream: &str) {
    eprintln!("[DEBUG] Emitting terminal-output event, stream: {}, data_len: {}", stream, data.len());
    let result = app.emit(
        "terminal-output",
        TerminalOutputPayload {
            session_id: session_id.to_string(),
            data: Some(data),
            bytes: None,
            stream: stream.to_string(),
        },
    );
    if let Err(e) = result {
        eprintln!("[DEBUG] Failed to emit terminal-output: {}", e);
    }
}

// author: BrianXiong
// time: 2026/04/05/11:21:34
fn emit_terminal_bytes(app: &AppHandle, session_id: &str, bytes: Vec<u8>, stream: &str) {
    eprintln!("[DEBUG] Emitting terminal-output bytes, stream: {}, byte_len: {}", stream, bytes.len());
    let result = app.emit(
        "terminal-output",
        TerminalOutputPayload {
            session_id: session_id.to_string(),
            data: None,
            bytes: Some(bytes),
            stream: stream.to_string(),
        },
    );
    if let Err(e) = result {
        eprintln!("[DEBUG] Failed to emit terminal-output bytes: {}", e);
    }
}

fn spawn_terminal_command(
    app: AppHandle,
    state: State<AppState>,
    session_id: String,
    cmd: CommandBuilder,
    opening_message: String,
) -> Result<String, String> {
    let pty_system = native_pty_system();
    eprintln!("[DEBUG] PTY system created");

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| {
            eprintln!("[DEBUG] Failed to open PTY: {}", e);
            e.to_string()
        })?;
    eprintln!("[DEBUG] PTY opened successfully");

    eprintln!("[DEBUG] Spawning command...");
    let child = pair.slave.spawn_command(cmd).map_err(|e| {
        eprintln!("[DEBUG] Failed to spawn command: {}", e);
        e.to_string()
    })?;
    eprintln!("[DEBUG] Command spawned successfully");
    drop(pair.slave);

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    wire_terminal_pty_stream(app.clone(), session_id.clone(), reader);

    let child = Arc::new(Mutex::new(child));
    wire_terminal_pty_exit(app.clone(), session_id.clone(), child.clone());

    state
        .terminal_sessions
        .lock()
        .map_err(|_| "Lock poisoned".to_string())?
        .insert(
            session_id.clone(),
            TerminalSession {
                writer: Arc::new(Mutex::new(writer)),
                child,
            },
        );

    emit_terminal_output(&app, &session_id, opening_message, "system");

    Ok(session_id)
}

fn wire_terminal_pty_stream<R: Read + Send + 'static>(
    app: AppHandle,
    session_id: String,
    mut reader: R,
) {
    eprintln!("[DEBUG] Starting PTY stream reader for session: {}", session_id);
    std::thread::spawn(move || {
        eprintln!("[DEBUG] PTY reader thread started");
        let mut buffer = [0_u8; 2048];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    eprintln!("[DEBUG] PTY reader got EOF");
                    break;
                }
                Ok(n) => {
                    eprintln!("[DEBUG] PTY reader got {} bytes", n);
                    emit_terminal_bytes(&app, &session_id, buffer[..n].to_vec(), "stdout");
                }
                Err(error) => {
                    eprintln!("[DEBUG] PTY reader error: {:?}", error);
                    if error.kind() != std::io::ErrorKind::WouldBlock {
                        emit_terminal_output(
                            &app,
                            &session_id,
                            format!("\r\n[pty read error] {}\r\n", error),
                            "system",
                        );
                    }
                    break;
                }
            }
        }
        eprintln!("[DEBUG] PTY reader thread exiting");
    });
}

fn wire_terminal_pty_exit(
    app: AppHandle,
    session_id: String,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(500));
            let status = {
                let mut guard = match child.lock() {
                    Ok(g) => g,
                    Err(_) => break,
                };
                guard.try_wait()
            };
            match status {
                Ok(Some(exit_status)) => {
                    emit_terminal_output(
                        &app,
                        &session_id,
                        format!(
                            "\r\n[serverdeck] session exited with status: {:?}\r\n",
                            exit_status
                        ),
                        "system",
                    );
                    break;
                }
                Ok(None) => continue,
                Err(error) => {
                    emit_terminal_output(
                        &app,
                        &session_id,
                        format!("\r\n[serverdeck] session wait failed: {}\r\n", error),
                        "system",
                    );
                    break;
                }
            }
        }
    });
}

#[tauri::command]
fn list_hosts() -> Result<Vec<HostRecord>, String> {
    read_hosts()
}

#[tauri::command]
fn save_host(mut host: HostRecord) -> Result<HostRecord, String> {
    let mut hosts = read_hosts()?;
    if host.id.trim().is_empty() {
        host.id = now_millis();
    }

    if let Some(index) = hosts.iter().position(|item| item.id == host.id) {
        hosts[index] = host.clone();
    } else {
        hosts.push(host.clone());
    }

    write_hosts(&hosts)?;
    Ok(host)
}

#[tauri::command]
fn delete_host(id: String) -> Result<bool, String> {
    let mut hosts = read_hosts()?;
    hosts.retain(|item| item.id != id);
    write_hosts(&hosts)?;
    Ok(true)
}

#[tauri::command]
fn test_connection(host: HostRecord, ssh_options: SshConnectionOptions) -> Result<String, String> {
    let output = build_ssh_command(&host, &ssh_options)
        .arg("echo serverdeck-connected")
        .output()
        .map_err(|error| error.to_string())?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }

    Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
}

#[tauri::command]
fn observe_server(host: HostRecord, ssh_options: SshConnectionOptions) -> Result<ServerObservation, String> {
    let script = r#"
HOSTNAME=$(hostname 2>/dev/null || echo Unknown)
OS=$(uname -srmo 2>/dev/null || uname -a 2>/dev/null || echo Unknown)
UPTIME=$(uptime -p 2>/dev/null || uptime 2>/dev/null || echo Unknown)
LOAD=$(cat /proc/loadavg 2>/dev/null | awk '{print $1" "$2" "$3}' || uptime 2>/dev/null | sed 's/.*load averages*: //' || echo Unknown)
CPU_CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo Unknown)
CPU_USAGE=$(top -bn1 2>/dev/null | awk -F'id,' '/Cpu\(s\)/ {split($1,a,","); split(a[length(a)],b," "); print 100-b[length(b)] "%"}' || top -l 1 -n 0 2>/dev/null | awk '/CPU usage:/ {print $3}' || echo Unknown)
MEMORY_USAGE=$(free -h 2>/dev/null | awk '/^Mem:/ {print $3 " / " $2}' || echo Unknown)
MEMORY_PERCENT=$(free 2>/dev/null | awk '/^Mem:/ {printf "%.0f%%", ($3/$2)*100}' || echo Unknown)
DISK_USAGE=$(df -h / 2>/dev/null | awk 'NR==2 {print $3 " / " $2}' || echo Unknown)
DISK_PERCENT=$(df -h / 2>/dev/null | awk 'NR==2 {print $5}' || echo Unknown)
NET_LINUX=$(cat /proc/net/dev 2>/dev/null | awk 'NR>2 {gsub(":","",$1); if ($1!="lo") {rx+=$2; tx+=$10}} END {if (rx>0 || tx>0) printf "RX %.1f MB / TX %.1f MB", rx/1024/1024, tx/1024/1024}')
NET_MAC=$(netstat -ib 2>/dev/null | awk 'NR>1 && $1 !~ /lo0/ && $7 ~ /^[0-9]+$/ && $10 ~ /^[0-9]+$/ {rx+=$7; tx+=$10} END {if (rx>0 || tx>0) printf "RX %.1f MB / TX %.1f MB", rx/1024/1024, tx/1024/1024}')
NETWORK_USAGE=${NET_LINUX:-$NET_MAC}
if [ -z "$NETWORK_USAGE" ]; then NETWORK_USAGE=Unknown; fi
TOP_PROCESSES=$(ps -eo pid,comm,%cpu,%mem --sort=-%cpu 2>/dev/null | sed -n '2,6p' | awk '{$1=$1; print}' | paste -sd '||' -)
if [ -z "$TOP_PROCESSES" ]; then TOP_PROCESSES=$(ps -Ao pid,comm,%cpu,%mem -r 2>/dev/null | sed -n '2,6p' | awk '{$1=$1; print}' | paste -sd '||' -); fi
printf 'hostname=%s\n' "$HOSTNAME"
printf 'operating_system=%s\n' "$OS"
printf 'uptime=%s\n' "$UPTIME"
printf 'load_average=%s\n' "$LOAD"
printf 'cpu_cores=%s\n' "$CPU_CORES"
printf 'cpu_usage=%s\n' "$CPU_USAGE"
printf 'memory_usage=%s\n' "$MEMORY_USAGE"
printf 'memory_percent=%s\n' "$MEMORY_PERCENT"
printf 'disk_usage=%s\n' "$DISK_USAGE"
printf 'disk_percent=%s\n' "$DISK_PERCENT"
printf 'network_usage=%s\n' "$NETWORK_USAGE"
printf 'top_processes=%s\n' "$TOP_PROCESSES"
"#;

    let output = build_ssh_command(&host, &ssh_options)
        .arg("sh")
        .arg("-lc")
        .arg(script)
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Server observation failed".to_string()
        } else {
            stderr
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    Ok(ServerObservation {
        hostname: parse_observation_value(&stdout, "hostname"),
        operating_system: parse_observation_value(&stdout, "operating_system"),
        uptime: parse_observation_value(&stdout, "uptime"),
        load_average: parse_observation_value(&stdout, "load_average"),
        cpu_cores: parse_observation_value(&stdout, "cpu_cores"),
        cpu_usage: parse_observation_value(&stdout, "cpu_usage"),
        memory_usage: parse_observation_value(&stdout, "memory_usage"),
        memory_percent: parse_observation_value(&stdout, "memory_percent"),
        disk_usage: parse_observation_value(&stdout, "disk_usage"),
        disk_percent: parse_observation_value(&stdout, "disk_percent"),
        network_usage: parse_observation_value(&stdout, "network_usage"),
        top_processes: parse_process_observations(&stdout, "top_processes"),
        captured_at: now_millis(),
    })
}

#[tauri::command]
fn list_local_directory(path: String) -> Result<Vec<FileEntry>, String> {
    file_entries_from_dir(&expand_path(&path))
}

#[tauri::command]
// author: BrianXiong
// time: 2026/04/05/12:19:04
fn read_local_file_preview(path: String) -> Result<LocalFilePreviewPayload, String> {
    let expanded = expand_path(&path);
    let metadata = fs::metadata(&expanded).map_err(|error| error.to_string())?;

    if metadata.is_dir() {
        return Err(format!("Preview expects a file, got directory: {}", expanded.display()));
    }

    let name = expanded
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| expanded.display().to_string());
    let size = metadata.len();
    let (kind, mime_type) = preview_kind_and_mime(&expanded);

    match kind.as_str() {
        "text" => {
            let (text, truncated) = read_text_preview(&expanded, size)?;
            Ok(LocalFilePreviewPayload {
                path: expanded.display().to_string(),
                name,
                kind,
                size,
                mime_type,
                text: Some(text),
                bytes: None,
                archive_entries: None,
                truncated,
                detail: None,
            })
        }
        "image" | "pdf" => {
            let bytes = read_binary_preview(&expanded, size)?;
            Ok(LocalFilePreviewPayload {
                path: expanded.display().to_string(),
                name,
                kind,
                size,
                mime_type,
                text: None,
                bytes: Some(bytes),
                archive_entries: None,
                truncated: false,
                detail: None,
            })
        }
        "archive" => {
            let archive_entries = list_archive_entries(&expanded)?;
            Ok(LocalFilePreviewPayload {
                path: expanded.display().to_string(),
                name,
                kind,
                size,
                mime_type,
                text: None,
                bytes: None,
                archive_entries: Some(archive_entries),
                truncated: false,
                detail: None,
            })
        }
        _ => Ok(LocalFilePreviewPayload {
            path: expanded.display().to_string(),
            name,
            kind: "unsupported".to_string(),
            size,
            mime_type,
            text: None,
            bytes: None,
            archive_entries: None,
            truncated: false,
            detail: Some("Preview is not yet supported for this file type".to_string()),
        }),
    }
}

#[tauri::command]
fn list_remote_directory(
    host: HostRecord,
    path: String,
    ssh_options: SshConnectionOptions,
) -> Result<Vec<FileEntry>, String> {
    let remote_path = if path.trim().is_empty() || path.trim() == "~" {
        "."
    } else {
        path.trim()
    };
    let batch = format!("cd {}\nls -la\nbye\n", escape_sftp_path(remote_path));
    let output = run_sftp_batch(&host, &ssh_options, &batch)?;

    ensure_sftp_success(&output, "Remote SFTP command failed")?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut entries = stdout.lines().filter_map(parse_sftp_ls_line).collect::<Vec<_>>();
    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(entries)
}

#[tauri::command]
fn upload_to_remote(
    host: HostRecord,
    local_path: String,
    remote_dir: String,
    ssh_options: SshConnectionOptions,
) -> Result<bool, String> {
    let local_path_buf = expand_path(&local_path);
    let local_path_str = local_path_buf.to_string_lossy().into_owned();
    let is_dir = local_path_buf.is_dir();
    let remote_target = if remote_dir.trim().is_empty() { "." } else { remote_dir.trim() };
    let batch = if is_dir {
        format!(
            "cd {}\nput -r {}\nbye\n",
            escape_sftp_path(remote_target),
            escape_sftp_path(&local_path_str)
        )
    } else {
        format!(
            "cd {}\nput {}\nbye\n",
            escape_sftp_path(remote_target),
            escape_sftp_path(&local_path_str)
        )
    };

    let output = run_sftp_batch(&host, &ssh_options, &batch)?;
    ensure_sftp_success(&output, "Upload failed")?;
    Ok(true)
}

#[tauri::command]
fn download_from_remote(
    host: HostRecord,
    remote_path: String,
    local_dir: String,
    is_dir: bool,
    ssh_options: SshConnectionOptions,
) -> Result<bool, String> {
    let local_dir_buf = expand_path(&local_dir);
    let local_dir_str = local_dir_buf.to_string_lossy().into_owned();
    let batch = if is_dir {
        format!(
            "lcd {}\nget -r {}\nbye\n",
            escape_sftp_path(&local_dir_str),
            escape_sftp_path(&remote_path)
        )
    } else {
        format!(
            "lcd {}\nget {}\nbye\n",
            escape_sftp_path(&local_dir_str),
            escape_sftp_path(&remote_path)
        )
    };

    let output = run_sftp_batch(&host, &ssh_options, &batch)?;
    ensure_sftp_success(&output, "Download failed")?;
    Ok(true)
}

#[tauri::command]
fn delete_local_entry(path: String, is_dir: bool) -> Result<bool, String> {
    let expanded = expand_path(&path);
    if is_dir {
        fs::remove_dir_all(&expanded).map_err(|error| error.to_string())?;
    } else {
        fs::remove_file(&expanded).map_err(|error| error.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
fn delete_remote_entry(
    host: HostRecord,
    remote_path: String,
    is_dir: bool,
    ssh_options: SshConnectionOptions,
) -> Result<bool, String> {
    let batch = if is_dir {
        format!("rmdir {}\nbye\n", escape_sftp_path(&remote_path))
    } else {
        format!("rm {}\nbye\n", escape_sftp_path(&remote_path))
    };

    let output = run_sftp_batch(&host, &ssh_options, &batch)?;
    ensure_sftp_success(&output, "Delete failed")?;
    Ok(true)
}

#[tauri::command]
fn start_terminal_session(
    app: AppHandle,
    state: State<AppState>,
    host: HostRecord,
    ssh_options: SshConnectionOptions,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    eprintln!("[DEBUG] Starting terminal session: {}", session_id);
    eprintln!("[DEBUG] Host: {}@{}:{}", host.username, host.address, host.port);
    eprintln!("[DEBUG] Auth type: {}", host.auth_type);

    let destination = format!("{}@{}", host.username, host.address);
    let mut cmd = if host.auth_type == "password" && host.password.clone().unwrap_or_default() != "" {
        eprintln!("[DEBUG] Using sshpass for password auth");
        let mut c = CommandBuilder::new(
            resolve_binary("sshpass")
                .map(|path| path.to_string_lossy().into_owned())
                .map_err(|error| {
                    eprintln!("[DEBUG] {}", error);
                    error
                })?,
        );
        c.arg("-p");
        c.arg(host.password.clone().unwrap_or_default());
        c.arg(
            resolve_binary("ssh")
                .map(|path| path.to_string_lossy().into_owned())
                .map_err(|error| {
                    eprintln!("[DEBUG] {}", error);
                    error
                })?,
        );
        c
    } else {
        eprintln!("[DEBUG] Using direct SSH (key auth or no password)");
        CommandBuilder::new(
            resolve_binary("ssh")
                .map(|path| path.to_string_lossy().into_owned())
                .map_err(|error| {
                    eprintln!("[DEBUG] {}", error);
                    error
                })?,
        )
    };

    cmd.arg("-tt");
    cmd.arg("-o");
    cmd.arg("StrictHostKeyChecking=accept-new");
    cmd.arg("-o");
    cmd.arg(format!("ServerAliveInterval={}", ssh_options.server_alive_interval_seconds));
    cmd.arg("-o");
    cmd.arg(format!("ConnectTimeout={}", ssh_options.connect_timeout_seconds));
    cmd.arg("-p");
    cmd.arg(host.port.to_string());

    if host.auth_type == "key" {
        if let Some(key_path) = &host.private_key_path {
            if !key_path.trim().is_empty() {
                eprintln!("[DEBUG] Using key file: {}", key_path);
                cmd.arg("-i");
                cmd.arg(expand_path(key_path));
            }
        }
    }

    cmd.arg(&destination);
    eprintln!("[DEBUG] SSH command configured for: {}", destination);

    spawn_terminal_command(
        app,
        state,
        session_id,
        cmd,
        format!(
            "\r\n[serverdeck] opening shell for {}@{}:{}\r\n",
            host.username, host.address, host.port
        ),
    )
}

#[tauri::command]
fn start_local_terminal_session(
    app: AppHandle,
    state: State<AppState>,
    cwd: Option<String>,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    eprintln!("[DEBUG] Starting local terminal session: {}", session_id);

    let shell = resolve_local_shell()?;
    let mut cmd = CommandBuilder::new(shell.to_string_lossy().into_owned());

    if let Some(path) = cwd {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            let expanded = expand_path(trimmed);
            if !expanded.is_dir() {
                return Err(format!("Local terminal directory not found: {}", expanded.display()));
            }
            cmd.cwd(expanded.as_os_str());
        }
    }

    spawn_terminal_command(
        app,
        state,
        session_id,
        cmd,
        "\r\n[serverdeck] opening local shell\r\n".to_string(),
    )
}

#[tauri::command]
fn write_terminal_input(
    state: State<AppState>,
    session_id: String,
    data: String,
) -> Result<bool, String> {
    let sessions = state
        .terminal_sessions
        .lock()
        .map_err(|_| "Lock poisoned".to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| "Terminal session not found".to_string())?;
    let mut writer = session.writer.lock().map_err(|_| "Lock poisoned".to_string())?;
    writer
        .write_all(data.as_bytes())
        .and_then(|_| writer.flush())
        .map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
fn close_terminal_session(
    state: State<AppState>,
    session_id: String,
) -> Result<bool, String> {
    let session = state
        .terminal_sessions
        .lock()
        .map_err(|_| "Lock poisoned".to_string())?
        .remove(&session_id)
        .ok_or_else(|| "Terminal session not found".to_string())?;

    let mut child = session.child.lock().map_err(|_| "Lock poisoned".to_string())?;
    child.kill().ok();
    child.wait().ok();
    Ok(true)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .manage(AppState {
            terminal_sessions: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            clear_app_data,
            list_hosts,
            save_host,
            delete_host,
            test_connection,
            observe_server,
            list_local_directory,
            read_local_file_preview,
            list_remote_directory,
            upload_to_remote,
            download_from_remote,
            delete_local_entry,
            delete_remote_entry,
            start_terminal_session,
            start_local_terminal_session,
            write_terminal_input,
            close_terminal_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running ServerDeck");
}
