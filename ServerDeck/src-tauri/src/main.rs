use dirs::home_dir;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

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
        let mut sshpass = Command::new("sshpass");
        sshpass.arg("-p").arg(host.password.clone().unwrap_or_default());
        sshpass.arg("ssh");
        sshpass
    } else {
        Command::new("ssh")
    };

    append_ssh_options(&mut command, host);
    command.arg(destination);
    command
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
    let remote_path = if path.trim().is_empty() { "~" } else { path.trim() };
    let command = format!("python3 -c \"import os,json,stat; p=os.path.expanduser(r'{}'); items=[]; \
for name in sorted(os.listdir(p), key=str.lower): \
 fp=os.path.join(p,name); st=os.stat(fp); items.append({{'name':name,'path':fp,'is_dir':stat.S_ISDIR(st.st_mode),'size':st.st_size,'modified':str(int(st.st_mtime))}}); \
print(json.dumps(items))\"", remote_path.replace('\\', "\\\\").replace('\'', "\\'"));

    let output = build_ssh_command(&host)
        .arg(command)
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    serde_json::from_slice::<Vec<FileEntry>>(&output.stdout).map_err(|error| error.to_string())
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
    let mut cmd = if host.auth_type == "password" && host.password.clone().unwrap_or_default() != ""
    {
        eprintln!("[DEBUG] Using sshpass for password auth");
        let mut c = CommandBuilder::new("sshpass");
        c.arg("-p");
        c.arg(host.password.clone().unwrap_or_default());
        c.arg("ssh");
        c
    } else {
        eprintln!("[DEBUG] Using direct SSH (key auth or no password)");
        CommandBuilder::new("ssh")
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
            save_host,
            delete_host,
            test_connection,
            list_local_directory,
            list_remote_directory,
            start_terminal_session,
            write_terminal_input,
            close_terminal_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running ServerDeck");
}
