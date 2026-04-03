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

const GITHUB_RELEASE_API: &str = "https://api.github.com/repos/qfxiongbinbin/serverdeck/releases/latest";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HostRecord {
    id: String,
    label: String,
    address: String,
    port: u16,
    username: String,
    auth_type: String,
    password: Option<String>,
    private_key_path: Option<String>,
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
struct TerminalOutputPayload {
    session_id: String,
    data: String,
    stream: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateInfo {
    current_version: String,
    latest_version: String,
    has_update: bool,
    download_url: Option<String>,
    asset_name: Option<String>,
    release_page_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: Option<String>,
    assets: Vec<GithubAsset>,
}

#[derive(Debug, Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
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

fn downloads_dir() -> Result<PathBuf, String> {
    dirs::download_dir()
        .or_else(home_dir)
        .ok_or_else(|| "Cannot resolve downloads directory".to_string())
}

fn hosts_file() -> Result<PathBuf, String> {
    Ok(storage_dir()?.join("hosts.json"))
}

fn now_millis() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".into())
}

fn normalize_version(version: &str) -> String {
    version.trim_start_matches('v').to_string()
}

fn compare_versions(left: &str, right: &str) -> std::cmp::Ordering {
    let parse = |value: &str| {
        normalize_version(value)
            .split('.')
            .map(|part| part.parse::<u64>().unwrap_or(0))
            .collect::<Vec<_>>()
    };

    let left_parts = parse(left);
    let right_parts = parse(right);
    let max_len = left_parts.len().max(right_parts.len());

    for index in 0..max_len {
        let a = *left_parts.get(index).unwrap_or(&0);
        let b = *right_parts.get(index).unwrap_or(&0);
        match a.cmp(&b) {
            std::cmp::Ordering::Equal => continue,
            ordering => return ordering,
        }
    }

    std::cmp::Ordering::Equal
}

fn fetch_latest_release() -> Result<GithubRelease, String> {
    let output = Command::new(resolve_binary("curl").unwrap_or_else(|_| PathBuf::from("curl")))
        .arg("-L")
        .arg("-sS")
        .arg("-H")
        .arg("Accept: application/vnd.github+json")
        .arg("-H")
        .arg("User-Agent: ServerDeck")
        .arg(GITHUB_RELEASE_API)
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    serde_json::from_slice::<GithubRelease>(&output.stdout).map_err(|error| error.to_string())
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

fn append_ssh_options(command: &mut Command, host: &HostRecord) {
    command
        .arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg("ServerAliveInterval=30")
        .arg("-o")
        .arg("ConnectTimeout=5")
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

fn build_ssh_command(host: &HostRecord) -> Command {
    let destination = format!("{}@{}", host.username, host.address);
    let mut command = if host.auth_type == "password" && host.password.clone().unwrap_or_default() != "" {
        let mut sshpass = Command::new(resolve_binary("sshpass").unwrap_or_else(|_| PathBuf::from("sshpass")));
        sshpass.arg("-p").arg(host.password.clone().unwrap_or_default());
        sshpass.arg(resolve_binary("ssh").unwrap_or_else(|_| PathBuf::from("ssh")));
        sshpass
    } else {
        Command::new(resolve_binary("ssh").unwrap_or_else(|_| PathBuf::from("ssh")))
    };

    append_ssh_options(&mut command, host);
    command.arg(destination);
    command
}

fn build_sftp_command(host: &HostRecord) -> Command {
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
        .arg("ServerAliveInterval=30")
        .arg("-o")
        .arg("ConnectTimeout=5")
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

fn run_sftp_batch(host: &HostRecord, batch: &str) -> Result<std::process::Output, String> {
    let destination = format!("{}@{}", host.username, host.address);
    let mut child = build_sftp_command(host)
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

fn emit_terminal_output(app: &AppHandle, session_id: &str, data: String, stream: &str) {
    eprintln!("[DEBUG] Emitting terminal-output event, stream: {}, data_len: {}", stream, data.len());
    let result = app.emit(
        "terminal-output",
        TerminalOutputPayload {
            session_id: session_id.to_string(),
            data,
            stream: stream.to_string(),
        },
    );
    if let Err(e) = result {
        eprintln!("[DEBUG] Failed to emit terminal-output: {}", e);
    }
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
                    let chunk = String::from_utf8_lossy(&buffer[..n]).to_string();
                    emit_terminal_output(&app, &session_id, chunk, "stdout");
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
fn check_for_update() -> Result<UpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let release = fetch_latest_release()?;
    let latest_version = normalize_version(&release.tag_name);
    let has_update = compare_versions(&latest_version, &current_version).is_gt();
    let asset = release
        .assets
        .iter()
        .find(|asset| asset.name.ends_with(".dmg") || asset.name.ends_with(".app.tar.gz"));

    Ok(UpdateInfo {
        current_version,
        latest_version,
        has_update,
        download_url: asset.map(|item| item.browser_download_url.clone()),
        asset_name: asset.map(|item| item.name.clone()),
        release_page_url: release.html_url,
    })
}

#[tauri::command]
fn download_and_open_update(download_url: String, asset_name: String) -> Result<String, String> {
    let target_path = downloads_dir()?.join(asset_name);
    let curl_output = Command::new(resolve_binary("curl").unwrap_or_else(|_| PathBuf::from("curl")))
        .arg("-L")
        .arg("-o")
        .arg(&target_path)
        .arg(&download_url)
        .output()
        .map_err(|error| error.to_string())?;

    if !curl_output.status.success() {
        return Err(String::from_utf8_lossy(&curl_output.stderr).trim().to_string());
    }

    let open_output = Command::new("open")
        .arg(&target_path)
        .output()
        .map_err(|error| error.to_string())?;

    if !open_output.status.success() {
        return Err(String::from_utf8_lossy(&open_output.stderr).trim().to_string());
    }

    Ok(target_path.display().to_string())
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
fn test_connection(host: HostRecord) -> Result<String, String> {
    let output = build_ssh_command(&host)
        .arg("echo serverdeck-connected")
        .output()
        .map_err(|error| error.to_string())?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }

    Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
}

#[tauri::command]
fn list_local_directory(path: String) -> Result<Vec<FileEntry>, String> {
    file_entries_from_dir(&expand_path(&path))
}

#[tauri::command]
fn list_remote_directory(host: HostRecord, path: String) -> Result<Vec<FileEntry>, String> {
    let remote_path = if path.trim().is_empty() || path.trim() == "~" {
        "."
    } else {
        path.trim()
    };
    let batch = format!("cd {}\nls -la\nbye\n", escape_sftp_path(remote_path));
    let output = run_sftp_batch(&host, &batch)?;

    ensure_sftp_success(&output, "Remote SFTP command failed")?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut entries = stdout.lines().filter_map(parse_sftp_ls_line).collect::<Vec<_>>();
    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(entries)
}

#[tauri::command]
fn upload_to_remote(host: HostRecord, local_path: String, remote_dir: String) -> Result<bool, String> {
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

    let output = run_sftp_batch(&host, &batch)?;
    ensure_sftp_success(&output, "Upload failed")?;
    Ok(true)
}

#[tauri::command]
fn download_from_remote(
    host: HostRecord,
    remote_path: String,
    local_dir: String,
    is_dir: bool,
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

    let output = run_sftp_batch(&host, &batch)?;
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
fn delete_remote_entry(host: HostRecord, remote_path: String, is_dir: bool) -> Result<bool, String> {
    let batch = if is_dir {
        format!("rmdir {}\nbye\n", escape_sftp_path(&remote_path))
    } else {
        format!("rm {}\nbye\n", escape_sftp_path(&remote_path))
    };

    let output = run_sftp_batch(&host, &batch)?;
    ensure_sftp_success(&output, "Delete failed")?;
    Ok(true)
}

#[tauri::command]
fn start_terminal_session(
    app: AppHandle,
    state: State<AppState>,
    host: HostRecord,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    eprintln!("[DEBUG] Starting terminal session: {}", session_id);
    eprintln!("[DEBUG] Host: {}@{}:{}", host.username, host.address, host.port);
    eprintln!("[DEBUG] Auth type: {}", host.auth_type);

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
    cmd.arg("ServerAliveInterval=30");
    cmd.arg("-o");
    cmd.arg("ConnectTimeout=5");
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

    emit_terminal_output(
        &app,
        &session_id,
        format!(
            "\r\n[serverdeck] opening shell for {}@{}:{}\r\n",
            host.username, host.address, host.port
        ),
        "system",
    );

    Ok(session_id)
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
        .manage(AppState {
            terminal_sessions: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            list_hosts,
            check_for_update,
            download_and_open_update,
            save_host,
            delete_host,
            test_connection,
            list_local_directory,
            list_remote_directory,
            upload_to_remote,
            download_from_remote,
            delete_local_entry,
            delete_remote_entry,
            start_terminal_session,
            write_terminal_input,
            close_terminal_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running ServerDeck");
}
