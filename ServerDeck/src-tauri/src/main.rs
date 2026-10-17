use dirs::home_dir;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{async_runtime, AppHandle, Emitter, Manager, State};
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
    // author: BrianXiong
    // time: 2026/10/17/23:55:00
    // Optional jump host: the connection reaches this host through it (`-J`).
    #[serde(default)]
    jump_host_id: Option<String>,
    // author: BrianXiong
    // time: 2026/07/21/00:00:00
    // True when a password for this host is stored in the system keychain.
    // Passwords themselves are never sent to the UI anymore.
    #[serde(default)]
    has_password: bool,
}

// author: BrianXiong
// time: 2026/07/21/00:00:00
// Passwords live in the macOS Keychain. The hosts table only stores this
// marker so we can tell "password saved in keychain" apart from "no password"
// without touching the keychain on every host listing.
const KEYCHAIN_SERVICE: &str = "ServerDeck";
const KEYCHAIN_PASSWORD_MARKER: &str = "__serverdeck_keychain__";

fn keychain_entry(host_id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, host_id).map_err(|error| error.to_string())
}

fn keychain_set_password(host_id: &str, password: &str) -> Result<(), String> {
    keychain_entry(host_id)?
        .set_password(password)
        .map_err(|error| error.to_string())
}

fn keychain_get_password(host_id: &str) -> Option<String> {
    let entry = match keychain_entry(host_id) {
        Ok(entry) => entry,
        Err(error) => {
            eprintln!("[keychain] failed to build entry for host {host_id}: {error}");
            return None;
        }
    };

    match entry.get_password() {
        Ok(value) if !value.is_empty() => Some(value),
        Ok(_) => {
            eprintln!("[keychain] empty password stored for host {host_id}");
            None
        }
        Err(error) => {
            eprintln!("[keychain] read failed for host {host_id}: {error}");
            None
        }
    }
}

fn keychain_delete_password(host_id: &str) {
    if let Ok(entry) = keychain_entry(host_id) {
        let _ = entry.delete_credential();
    }
}

// Resolve the password to use for a connection: an explicit password on the
// record wins (e.g. a value the user just typed but has not saved), otherwise
// fall back to the keychain entry for this host.
fn resolve_host_password(host: &HostRecord) -> String {
    if host.auth_type != "password" {
        return String::new();
    }

    if let Some(password) = &host.password {
        if !password.is_empty() && password != KEYCHAIN_PASSWORD_MARKER {
            return password.clone();
        }
    }

    if let Some(password) = keychain_get_password(&host.id) {
        return password;
    }

    // Last resort: legacy plaintext still in the DB because a keychain write
    // failed. Keeps existing setups working until migration succeeds.
    if let Ok(conn) = open_db() {
        if let Ok(stored) = conn.query_row(
            "SELECT password FROM hosts WHERE id = ?1",
            params![host.id],
            |row| row.get::<_, Option<String>>(0),
        ) {
            if let Some(value) = stored {
                if !value.is_empty() && value != KEYCHAIN_PASSWORD_MARKER {
                    return value;
                }
            }
        }
    }

    String::new()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManagedProjectRecord {
    id: String,
    name: String,
    namespace: String,
    path: String,
    project_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppPreferencesPayload {
    settings: AppSettingsRecord,
    recent_project_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettingsRecord {
    app_theme: String,
    language: String,
    projects: Vec<ManagedProjectRecord>,
    local_terminal_default_path: String,
    ssh_connect_timeout_seconds: u16,
    ssh_server_alive_interval_seconds: u16,
    terminal_theme_id: String,
    terminal_font_size: u16,
    terminal_charset: String,
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
pub(crate) struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    #[serde(default)]
    is_symlink: bool,
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

// author: BrianXiong
// time: 2026/07/21/00:00:00
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalExitPayload {
    session_id: String,
    exit_code: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TransferUpdatePayload {
    job_id: String,
    direction: String,
    name: String,
    status: String,
    detail: String,
    progress_percent: Option<f64>,
    transferred_bytes: Option<u64>,
    total_bytes: Option<u64>,
}

struct TerminalSession {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pty: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
}

struct AppState {
    terminal_sessions: Mutex<HashMap<String, TerminalSession>>,
    // author: BrianXiong
    // time: 2026/10/18/00:10:00
    // One long-lived `ssh -N` child per running port forward, keyed by forward id.
    forward_processes: Mutex<HashMap<String, Arc<Mutex<std::process::Child>>>>,
    upload_processes: Mutex<HashMap<String, Arc<Mutex<std::process::Child>>>>,
    cancelled_uploads: Mutex<HashSet<String>>,
    download_processes: Mutex<HashMap<String, Arc<Mutex<std::process::Child>>>>,
    cancelled_downloads: Mutex<HashSet<String>>,
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

fn db_file() -> Result<PathBuf, String> {
    Ok(storage_dir()?.join("serverdeck.db"))
}

// author: BrianXiong
// time: 2026/04/06/11:42:03
fn default_app_settings_record() -> AppSettingsRecord {
    AppSettingsRecord {
        app_theme: "dark".to_string(),
        language: "en".to_string(),
        projects: Vec::new(),
        local_terminal_default_path: String::new(),
        ssh_connect_timeout_seconds: 5,
        ssh_server_alive_interval_seconds: 30,
        terminal_theme_id: "midnight-operator".to_string(),
        terminal_font_size: 14,
        terminal_charset: "utf-8".to_string(),
    }
}

// author: BrianXiong
// time: 2026/04/06/11:42:03
pub(crate) fn open_db() -> Result<Connection, String> {
    let path = db_file()?;
    let conn = Connection::open(path).map_err(|error| error.to_string())?;
    init_db(&conn)?;
    migrate_legacy_hosts_if_needed(&conn)?;
    migrate_plaintext_passwords_to_keychain(&conn)?;
    Ok(conn)
}

// author: BrianXiong
// time: 2026/07/21/00:00:00
// One-time (idempotent) migration: move any plaintext password still sitting
// in the hosts table into the macOS Keychain and replace it with the marker.
// If the keychain write fails the plaintext row is left untouched so the app
// keeps working; the migration retries on the next database open.
fn migrate_plaintext_passwords_to_keychain(conn: &Connection) -> Result<(), String> {
    let mut stmt = conn
        .prepare("SELECT id, password FROM hosts WHERE password IS NOT NULL AND password != '' AND password != ?1")
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map(params![KEYCHAIN_PASSWORD_MARKER], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    for (id, password) in rows {
        if keychain_set_password(&id, &password).is_ok() {
            conn.execute(
                "UPDATE hosts SET password = ?1 WHERE id = ?2",
                params![KEYCHAIN_PASSWORD_MARKER, id],
            )
            .map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

// author: BrianXiong
// time: 2026/04/06/11:42:03
fn init_db(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS hosts (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL DEFAULT '',
          project_id TEXT NOT NULL DEFAULT 'default',
          address TEXT NOT NULL,
          port INTEGER NOT NULL,
          username TEXT NOT NULL,
          auth_type TEXT NOT NULL,
          password TEXT,
          private_key_path TEXT,
          jump_host_id TEXT
        );

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          namespace TEXT NOT NULL DEFAULT '',
          path TEXT NOT NULL DEFAULT '',
          project_type TEXT NOT NULL DEFAULT 'local'
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS local_terminal_recent_projects (
          project_id TEXT PRIMARY KEY,
          used_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS port_forwards (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL DEFAULT '',
          kind TEXT NOT NULL DEFAULT 'local',
          bind_host TEXT NOT NULL DEFAULT '127.0.0.1',
          bind_port INTEGER NOT NULL,
          target_host TEXT NOT NULL DEFAULT '',
          target_port INTEGER NOT NULL DEFAULT 0,
          host_id TEXT NOT NULL,
          auto_start INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS ssh_config_links (
          alias TEXT PRIMARY KEY,
          host_id TEXT NOT NULL
        );
        "#,
    )
    .map_err(|error| error.to_string())?;

    // author: BrianXiong
    // time: 2026/08/19/21:00:00
    // The agent workspace and AI provider settings were removed in 0.0.37.
    // Drop their tables so upgrading machines do not keep leftover agent
    // conversations or plaintext provider API keys around.
    conn.execute_batch(
        r#"
        DROP TABLE IF EXISTS ai_providers;
        DROP TABLE IF EXISTS agent_sessions;
        DROP TABLE IF EXISTS agent_messages;
        DROP TABLE IF EXISTS agent_plan_items;
        DROP TABLE IF EXISTS agent_tool_calls;
        "#,
    )
    .map_err(|error| error.to_string())?;

    ensure_hosts_jump_host_column(conn)?;

    Ok(())
}

// author: BrianXiong
// time: 2026/10/17/23:55:00
// SQLite has no "ADD COLUMN IF NOT EXISTS", so databases created before jump
// host support need an explicit, idempotent column check.
fn ensure_hosts_jump_host_column(conn: &Connection) -> Result<(), String> {
    let mut stmt = conn.prepare("PRAGMA table_info(hosts)").map_err(|error| error.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    if columns.iter().any(|name| name == "jump_host_id") {
        return Ok(());
    }

    conn.execute("ALTER TABLE hosts ADD COLUMN jump_host_id TEXT", [])
        .map_err(|error| error.to_string())?;
    Ok(())
}

// author: BrianXiong
// time: 2026/04/06/11:42:03
fn migrate_legacy_hosts_if_needed(conn: &Connection) -> Result<(), String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM hosts", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if count > 0 {
        return Ok(());
    }

    let legacy_hosts = read_hosts()?;
    if legacy_hosts.is_empty() {
        return Ok(());
    }

    save_hosts_to_db(conn, &legacy_hosts)
}

#[tauri::command]
fn clear_app_data() -> Result<bool, String> {
    let dir = storage_dir()?;
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|error| error.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
// author: BrianXiong
// time: 2026/04/06/11:42:03
fn load_app_preferences() -> Result<AppPreferencesPayload, String> {
    let conn = open_db()?;
    let mut settings = default_app_settings_record();

    settings.projects = load_projects_from_db(&conn)?;
    settings.app_theme = get_setting(&conn, "appTheme")?.unwrap_or(settings.app_theme);
    settings.language = get_setting(&conn, "language")?.unwrap_or(settings.language);
    settings.local_terminal_default_path = get_setting(&conn, "localTerminalDefaultPath")?.unwrap_or(settings.local_terminal_default_path);
    settings.ssh_connect_timeout_seconds = get_setting(&conn, "sshConnectTimeoutSeconds")?
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(settings.ssh_connect_timeout_seconds);
    settings.ssh_server_alive_interval_seconds = get_setting(&conn, "sshServerAliveIntervalSeconds")?
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(settings.ssh_server_alive_interval_seconds);
    settings.terminal_theme_id = get_setting(&conn, "terminalThemeId")?.unwrap_or(settings.terminal_theme_id);
    settings.terminal_font_size = get_setting(&conn, "terminalFontSize")?
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(settings.terminal_font_size);
    settings.terminal_charset = get_setting(&conn, "terminalCharset")?.unwrap_or(settings.terminal_charset);

    Ok(AppPreferencesPayload {
        settings,
        recent_project_ids: load_recent_projects_from_db(&conn)?,
    })
}

#[tauri::command]
// author: BrianXiong
// time: 2026/04/06/11:42:03
fn save_app_preferences(payload: AppPreferencesPayload) -> Result<bool, String> {
    let mut conn = open_db()?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;

    tx.execute("DELETE FROM projects", []).map_err(|error| error.to_string())?;
    for project in &payload.settings.projects {
        tx.execute(
            "INSERT INTO projects (id, name, namespace, path, project_type) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![project.id, project.name, project.namespace, project.path, project.project_type],
        )
        .map_err(|error| error.to_string())?;
    }

    set_setting(&tx, "appTheme", &payload.settings.app_theme)?;
    set_setting(&tx, "language", &payload.settings.language)?;
    set_setting(&tx, "localTerminalDefaultPath", &payload.settings.local_terminal_default_path)?;
    set_setting(&tx, "sshConnectTimeoutSeconds", &payload.settings.ssh_connect_timeout_seconds.to_string())?;
    set_setting(&tx, "sshServerAliveIntervalSeconds", &payload.settings.ssh_server_alive_interval_seconds.to_string())?;
    set_setting(&tx, "terminalThemeId", &payload.settings.terminal_theme_id)?;
    set_setting(&tx, "terminalFontSize", &payload.settings.terminal_font_size.to_string())?;
    set_setting(&tx, "terminalCharset", &payload.settings.terminal_charset)?;

    tx.execute("DELETE FROM local_terminal_recent_projects", [])
        .map_err(|error| error.to_string())?;
    for (index, project_id) in payload.recent_project_ids.iter().enumerate() {
        tx.execute(
            "INSERT INTO local_terminal_recent_projects (project_id, used_at) VALUES (?1, ?2)",
            params![project_id, (payload.recent_project_ids.len() - index) as i64],
        )
        .map_err(|error| error.to_string())?;
    }

    tx.commit().map_err(|error| error.to_string())?;
    Ok(true)
}

fn now_millis() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".into())
}

// author: BrianXiong
// time: 2026/04/08/16:24:00
fn read_hosts() -> Result<Vec<HostRecord>, String> {
    let path = hosts_file()?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&content).map_err(|error| error.to_string())
}

// author: BrianXiong
// time: 2026/04/06/11:42:03
fn load_hosts_from_db(conn: &Connection) -> Result<Vec<HostRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, label, project_id, address, port, username, auth_type, password, private_key_path, jump_host_id FROM hosts ORDER BY label, address",
        )
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let stored_password: Option<String> = row.get(7)?;
            // author: BrianXiong
            // time: 2026/07/21/00:00:00
            // Never hand passwords (or the keychain marker) to the UI — only
            // a boolean that says whether one is stored.
            let has_password = matches!(&stored_password, Some(value) if !value.is_empty());

            Ok(HostRecord {
                id: row.get(0)?,
                label: row.get(1)?,
                project_id: row.get(2)?,
                address: row.get(3)?,
                port: row.get(4)?,
                username: row.get(5)?,
                auth_type: row.get(6)?,
                password: None,
                private_key_path: row.get(8)?,
                jump_host_id: row.get(9)?,
                has_password,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

// author: BrianXiong
// time: 2026/04/06/11:42:03
fn save_hosts_to_db(conn: &Connection, hosts: &[HostRecord]) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|error| error.to_string())?;
    for host in hosts {
        tx.execute(
            r#"
            INSERT INTO hosts (id, label, project_id, address, port, username, auth_type, password, private_key_path, jump_host_id)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(id) DO UPDATE SET
              label=excluded.label,
              project_id=excluded.project_id,
              address=excluded.address,
              port=excluded.port,
              username=excluded.username,
              auth_type=excluded.auth_type,
              password=excluded.password,
              private_key_path=excluded.private_key_path,
              jump_host_id=excluded.jump_host_id
            "#,
            params![
                host.id,
                host.label,
                host.project_id,
                host.address,
                host.port,
                host.username,
                host.auth_type,
                host.password,
                host.private_key_path,
                host.jump_host_id,
            ],
        )
        .map_err(|error| error.to_string())?;
    }
    tx.commit().map_err(|error| error.to_string())
}

// author: BrianXiong
// time: 2026/04/06/11:42:03
fn load_projects_from_db(conn: &Connection) -> Result<Vec<ManagedProjectRecord>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, namespace, path, project_type FROM projects ORDER BY name")
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ManagedProjectRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                namespace: row.get(2)?,
                path: row.get(3)?,
                project_type: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![key, value],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    conn.query_row("SELECT value FROM app_settings WHERE key = ?1", params![key], |row| row.get(0))
        .optional()
        .map_err(|error| error.to_string())
}

fn load_recent_projects_from_db(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT project_id FROM local_terminal_recent_projects ORDER BY used_at DESC")
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

pub(crate) fn expand_path(path: &str) -> PathBuf {
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

pub(crate) fn resolve_binary(name: &str) -> Result<PathBuf, String> {
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
        "lsof" => {
            candidates.push(PathBuf::from("/usr/sbin/lsof"));
            candidates.push(PathBuf::from("/usr/bin/lsof"));
            candidates.push(PathBuf::from("/opt/homebrew/bin/lsof"));
            candidates.push(PathBuf::from("/usr/local/bin/lsof"));
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

// author: BrianXiong
// time: 2026/04/05/16:45:00
fn apply_local_terminal_utf8_env(cmd: &mut CommandBuilder) {
    let preferred_utf8_locale = "en_US.UTF-8";

    let needs_utf8_locale = cmd
        .get_env("LANG")
        .and_then(|value| value.to_str())
        .map(|value| !value.to_ascii_uppercase().contains("UTF-8"))
        .unwrap_or(true);

    if needs_utf8_locale {
        cmd.env("LANG", preferred_utf8_locale);
    }

    let needs_utf8_ctype = cmd
        .get_env("LC_CTYPE")
        .and_then(|value| value.to_str())
        .map(|value| !value.to_ascii_uppercase().contains("UTF-8"))
        .unwrap_or(true);

    if needs_utf8_ctype {
        cmd.env("LC_CTYPE", preferred_utf8_locale);
    }

    let needs_utf8_all = cmd
        .get_env("LC_ALL")
        .and_then(|value| value.to_str())
        .map(|value| !value.to_ascii_uppercase().contains("UTF-8"))
        .unwrap_or(true);

    if needs_utf8_all {
        cmd.env("LC_ALL", preferred_utf8_locale);
    }

    if cmd.get_env("TERM").is_none() {
        cmd.env("TERM", "xterm-256color");
    }

    if cmd.get_env("COLORTERM").is_none() {
        cmd.env("COLORTERM", "truecolor");
    }
}

pub(crate) fn file_entries_from_dir(path: &Path) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    let read_dir = fs::read_dir(path).map_err(|error| error.to_string())?;

    for item in read_dir {
        let item = item.map_err(|error| error.to_string())?;
        let metadata = item.metadata().map_err(|error| error.to_string())?;
        let is_symlink = item
            .file_type()
            .map(|file_type| file_type.is_symlink())
            .unwrap_or(false);
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
            is_symlink,
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

// author: BrianXiong
// time: 2026/07/21/00:00:00
// OpenSSH connection multiplexing: reuse one authenticated connection per
// host across terminal/SFTP/monitor commands. The first connection becomes a
// background master (kept alive 60s after the last client), subsequent ssh
// and sftp invocations attach to its socket and skip TCP+auth entirely.
fn control_master_options() -> Vec<String> {
    let Some(home) = home_dir() else {
        return Vec::new();
    };

    let socket_dir = home.join(".serverdeck").join("cm");
    if fs::create_dir_all(&socket_dir).is_err() {
        return Vec::new();
    }

    vec![
        "-o".to_string(),
        "ControlMaster=auto".to_string(),
        "-o".to_string(),
        format!("ControlPath={}/%C", socket_dir.display()),
        "-o".to_string(),
        "ControlPersist=60".to_string(),
    ]
}

// author: BrianXiong
// time: 2026/10/17/23:55:00
// Guards against a jump host chain that loops back on itself or grows past a
// reasonable depth; both would otherwise spawn a doomed ssh process.
const MAX_JUMP_HOPS: usize = 5;

// author: BrianXiong
// time: 2026/10/17/23:55:00
// Walks `jump_host_id` links and returns the hop list in the order OpenSSH
// expects for `-J`: the outermost hop first, the direct jump host last.
fn resolve_jump_chain(conn: &Connection, host: &HostRecord) -> Result<Vec<String>, String> {
    let hosts = load_hosts_from_db(conn)?;
    let mut chain: Vec<String> = Vec::new();
    let mut visited: Vec<String> = Vec::new();
    let mut next_id = host.jump_host_id.clone();

    while let Some(jump_id) = next_id {
        if visited.iter().any(|visited_id| visited_id == &jump_id) {
            return Err(format!(
                "Jump host loop detected: {} -> {}",
                visited.join(" -> "),
                jump_id
            ));
        }

        if chain.len() >= MAX_JUMP_HOPS {
            return Err(format!("Jump host chain is limited to {} hops", MAX_JUMP_HOPS));
        }

        let jump = hosts
            .iter()
            .find(|candidate| candidate.id == jump_id)
            .ok_or_else(|| format!("Jump host not found: {}", jump_id))?;

        visited.push(jump_id);
        chain.push(format!("{}@{}:{}", jump.username, jump.address, jump.port));
        next_id = jump.jump_host_id.clone();
    }

    chain.reverse();
    Ok(chain)
}

fn append_ssh_options(
    command: &mut Command,
    host: &HostRecord,
    ssh_options: &SshConnectionOptions,
    jump_chain: &[String],
) {
    for option in control_master_options() {
        command.arg(option);
    }

    command
        .arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg(format!("ServerAliveInterval={}", ssh_options.server_alive_interval_seconds))
        .arg("-o")
        .arg(format!("ConnectTimeout={}", ssh_options.connect_timeout_seconds))
        .arg("-p")
        .arg(host.port.to_string());

    if !jump_chain.is_empty() {
        command.arg("-J").arg(jump_chain.join(","));
    }

    if host.auth_type == "key" {
        if let Some(key_path) = &host.private_key_path {
            if !key_path.trim().is_empty() {
                command.arg("-i").arg(expand_path(key_path));
            }
        }
    }
}

fn build_ssh_command(host: &HostRecord, ssh_options: &SshConnectionOptions) -> Result<Command, String> {
    build_ssh_command_with_args(host, ssh_options, &[])
}

// author: BrianXiong
// time: 2026/10/18/00:10:00
// ssh requires its options before the destination, so port forwards pass their
// -N / -L flags through here instead of appending them afterwards.
fn build_ssh_command_with_args(
    host: &HostRecord,
    ssh_options: &SshConnectionOptions,
    extra_args: &[String],
) -> Result<Command, String> {
    let jump_chain = resolve_jump_chain(&open_db()?, host)?;
    let destination = format!("{}@{}", host.username, host.address);
    let password = resolve_host_password(host);
    let mut command = if host.auth_type == "password" && !password.is_empty() {
        let mut sshpass = Command::new(resolve_binary("sshpass").unwrap_or_else(|_| PathBuf::from("sshpass")));
        sshpass.arg("-p").arg(&password);
        sshpass.arg(resolve_binary("ssh").unwrap_or_else(|_| PathBuf::from("ssh")));
        sshpass
    } else {
        Command::new(resolve_binary("ssh").unwrap_or_else(|_| PathBuf::from("ssh")))
    };

    append_ssh_options(&mut command, host, ssh_options, &jump_chain);
    for arg in extra_args {
        command.arg(arg);
    }
    command.arg(destination);
    Ok(command)
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

// author: BrianXiong
// time: 2026/08/19/17:30:00
// Batch-mode SFTP sessions cannot prompt for a password: when a password-auth
// host has no resolvable password (its keychain entry is gone and no stored
// fallback exists) the connection can only fail with a cryptic
// "Permission denied" in the file panel. Fail fast with an actionable
// message instead so the user knows to re-enter the password once.
fn ensure_sftp_password_available(host: &HostRecord) -> Result<(), String> {
    if host.auth_type == "password" && resolve_host_password(host).is_empty() {
        let display = if host.label.trim().is_empty() { &host.address } else { &host.label };
        return Err(format!(
            "No password available for host {display}: its keychain entry is missing. \
             Open the host settings and re-enter the password once to restore access."
        ));
    }

    Ok(())
}

fn build_sftp_command(host: &HostRecord, ssh_options: &SshConnectionOptions) -> Command {
    let password = resolve_host_password(host);
    let mut command = if host.auth_type == "password" && !password.is_empty() {
        let mut sshpass = Command::new(resolve_binary("sshpass").unwrap_or_else(|_| PathBuf::from("sshpass")));
        sshpass.arg("-p").arg(&password);
        sshpass.arg(resolve_binary("sftp").unwrap_or_else(|_| PathBuf::from("sftp")));
        sshpass
    } else {
        Command::new(resolve_binary("sftp").unwrap_or_else(|_| PathBuf::from("sftp")))
    };

    for option in control_master_options() {
        command.arg(option);
    }

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
    // author: BrianXiong
    // time: 2026/07/21/00:00:00
    // Symlinks come through as `lrwxrwxrwx ... name -> target`; mark them and
    // strip the arrow suffix so the entry name (used for download/delete
    // paths) is the link itself, not "name -> target".
    let is_symlink = mode.starts_with('l');
    let size = parts[4].parse::<u64>().unwrap_or(0);
    let modified = format!("{} {} {}", parts[5], parts[6], parts[7]);
    let mut name = parts[8..].join(" ");

    if is_symlink {
        if let Some(arrow_index) = name.find(" -> ") {
            name.truncate(arrow_index);
        }
    }

    if name == "." || name == ".." || name.is_empty() {
        return None;
    }

    Some(FileEntry {
        name: name.clone(),
        path: name,
        is_dir,
        is_symlink,
        size,
        modified,
    })
}

fn run_sftp_batch(
    host: &HostRecord,
    ssh_options: &SshConnectionOptions,
    batch: &str,
) -> Result<std::process::Output, String> {
    ensure_sftp_password_available(host)?;

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

    drop(child.stdin.take());

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
// time: 2026/04/08/10:26:00
fn run_sftp_batch_with_job(
    state: &AppState,
    job_id: &str,
    host: &HostRecord,
    ssh_options: &SshConnectionOptions,
    batch: &str,
) -> Result<std::process::Output, String> {
    ensure_sftp_password_available(host)?;

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

    drop(child.stdin.take());

    let stdout = child.stdout.take().ok_or_else(|| "Cannot capture upload stdout".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "Cannot capture upload stderr".to_string())?;
    let child_handle = Arc::new(Mutex::new(child));

    state
        .upload_processes
        .lock()
        .map_err(|_| "Upload process state lock poisoned".to_string())?
        .insert(job_id.to_string(), child_handle.clone());

    let stdout_reader = std::thread::spawn(move || -> Result<Vec<u8>, String> {
        let mut reader = stdout;
        let mut buffer = Vec::new();
        reader.read_to_end(&mut buffer).map_err(|error| error.to_string())?;
        Ok(buffer)
    });

    let stderr_reader = std::thread::spawn(move || -> Result<Vec<u8>, String> {
        let mut reader = stderr;
        let mut buffer = Vec::new();
        reader.read_to_end(&mut buffer).map_err(|error| error.to_string())?;
        Ok(buffer)
    });

    let exit_status = loop {
        let status = {
            let mut child = child_handle
                .lock()
                .map_err(|_| "Upload process lock poisoned".to_string())?;
            child.try_wait().map_err(|error| error.to_string())?
        };

        if let Some(status) = status {
            break status;
        }

        std::thread::sleep(std::time::Duration::from_millis(120));
    };

    state
        .upload_processes
        .lock()
        .map_err(|_| "Upload process state lock poisoned".to_string())?
        .remove(job_id);

    let stdout = stdout_reader
        .join()
        .map_err(|_| "Failed to join upload stdout reader".to_string())??;
    let stderr = stderr_reader
        .join()
        .map_err(|_| "Failed to join upload stderr reader".to_string())??;

    Ok(std::process::Output {
        status: exit_status,
        stdout,
        stderr,
    })
}

// author: BrianXiong
// time: 2026/04/08/09:58:00
fn upload_to_remote_blocking(
    host: &HostRecord,
    local_path: &str,
    remote_dir: &str,
    ssh_options: &SshConnectionOptions,
) -> Result<bool, String> {
    let local_path_buf = expand_path(local_path);
    let local_path_str = local_path_buf.to_string_lossy().into_owned();
    let is_dir = local_path_buf.is_dir();
    let remote_target = if remote_dir.trim().is_empty() {
        "."
    } else {
        remote_dir.trim()
    };
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

    let output = run_sftp_batch(host, ssh_options, &batch)?;
    ensure_sftp_success(&output, "Upload failed")?;
    Ok(true)
}

// author: BrianXiong
// time: 2026/04/08/10:26:00
fn upload_to_remote_with_job(
    state: &AppState,
    job_id: &str,
    host: &HostRecord,
    local_path: &str,
    remote_dir: &str,
    ssh_options: &SshConnectionOptions,
) -> Result<bool, String> {
    let local_path_buf = expand_path(local_path);
    let local_path_str = local_path_buf.to_string_lossy().into_owned();
    let is_dir = local_path_buf.is_dir();
    let remote_target = if remote_dir.trim().is_empty() {
        "."
    } else {
        remote_dir.trim()
    };
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

    let output = run_sftp_batch_with_job(state, job_id, host, ssh_options, &batch)?;
    ensure_sftp_success(&output, "Upload failed")?;
    Ok(true)
}

// author: BrianXiong
// time: 2026/04/07/22:28:00
fn emit_transfer_update(app: &AppHandle, payload: TransferUpdatePayload) {
    let _ = app.emit("transfer-update", payload);
}

// author: BrianXiong
// time: 2026/04/08/10:26:00
fn take_cancelled_upload(state: &AppState, job_id: &str) -> Result<bool, String> {
    Ok(state
        .cancelled_uploads
        .lock()
        .map_err(|_| "Cancelled upload state lock poisoned".to_string())?
        .remove(job_id))
}

// author: BrianXiong
// time: 2026/04/08/11:42:00
fn run_sftp_batch_with_download_job(
    state: &AppState,
    job_id: &str,
    host: &HostRecord,
    ssh_options: &SshConnectionOptions,
    batch: &str,
) -> Result<std::process::Output, String> {
    ensure_sftp_password_available(host)?;

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

    drop(child.stdin.take());

    let stdout = child.stdout.take().ok_or_else(|| "Cannot capture download stdout".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "Cannot capture download stderr".to_string())?;
    let child_handle = Arc::new(Mutex::new(child));

    state
        .download_processes
        .lock()
        .map_err(|_| "Download process state lock poisoned".to_string())?
        .insert(job_id.to_string(), child_handle.clone());

    let stdout_reader = std::thread::spawn(move || -> Result<Vec<u8>, String> {
        let mut reader = stdout;
        let mut buffer = Vec::new();
        reader.read_to_end(&mut buffer).map_err(|error| error.to_string())?;
        Ok(buffer)
    });

    let stderr_reader = std::thread::spawn(move || -> Result<Vec<u8>, String> {
        let mut reader = stderr;
        let mut buffer = Vec::new();
        reader.read_to_end(&mut buffer).map_err(|error| error.to_string())?;
        Ok(buffer)
    });

    let exit_status = loop {
        let status = {
            let mut child = child_handle
                .lock()
                .map_err(|_| "Download process lock poisoned".to_string())?;
            child.try_wait().map_err(|error| error.to_string())?
        };

        if let Some(status) = status {
            break status;
        }

        std::thread::sleep(std::time::Duration::from_millis(120));
    };

    state
        .download_processes
        .lock()
        .map_err(|_| "Download process state lock poisoned".to_string())?
        .remove(job_id);

    let stdout = stdout_reader
        .join()
        .map_err(|_| "Failed to join download stdout reader".to_string())??;
    let stderr = stderr_reader
        .join()
        .map_err(|_| "Failed to join download stderr reader".to_string())??;

    Ok(std::process::Output {
        status: exit_status,
        stdout,
        stderr,
    })
}

// author: BrianXiong
// time: 2026/04/08/11:42:00
fn take_cancelled_download(state: &AppState, job_id: &str) -> Result<bool, String> {
    Ok(state
        .cancelled_downloads
        .lock()
        .map_err(|_| "Cancelled download state lock poisoned".to_string())?
        .remove(job_id))
}

// author: BrianXiong
// time: 2026/04/08/11:42:00
fn query_local_entry_size_internal(path: &Path) -> Result<u64, String> {
    collect_local_transfer_size(path)
}

// author: BrianXiong
// time: 2026/04/08/11:42:00
fn download_from_remote_with_job(
    state: &AppState,
    job_id: &str,
    host: &HostRecord,
    remote_path: &str,
    local_dir: &str,
    is_dir: bool,
    ssh_options: &SshConnectionOptions,
) -> Result<bool, String> {
    let local_dir_buf = expand_path(local_dir);
    let local_dir_str = local_dir_buf.to_string_lossy().into_owned();
    let batch = if is_dir {
        format!(
            "lcd {}\nget -r {}\nbye\n",
            escape_sftp_path(&local_dir_str),
            escape_sftp_path(remote_path)
        )
    } else {
        format!(
            "lcd {}\nget {}\nbye\n",
            escape_sftp_path(&local_dir_str),
            escape_sftp_path(remote_path)
        )
    };

    let output = run_sftp_batch_with_download_job(state, job_id, host, ssh_options, &batch)?;
    ensure_sftp_success(&output, "Download failed")?;
    Ok(true)
}

// author: BrianXiong
// time: 2026/04/07/23:02:00
fn collect_local_transfer_size(path: &Path) -> Result<u64, String> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    if metadata.is_file() {
        return Ok(metadata.len());
    }

    let mut total_size = 0_u64;
    let read_dir = fs::read_dir(path).map_err(|error| error.to_string())?;
    for entry in read_dir {
        let entry = entry.map_err(|error| error.to_string())?;
        total_size = total_size.saturating_add(collect_local_transfer_size(&entry.path())?);
    }
    Ok(total_size)
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
    let pty = Arc::new(Mutex::new(pair.master));

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
                pty,
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
                    // author: BrianXiong
                    // time: 2026/07/21/00:00:00
                    // Structured exit event so the UI can flip the tab into a
                    // disconnected state and offer a reconnect action.
                    let _ = app.emit(
                        "terminal-exit",
                        TerminalExitPayload {
                            session_id: session_id.clone(),
                            exit_code: Some(exit_status.exit_code()),
                        },
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
                    let _ = app.emit(
                        "terminal-exit",
                        TerminalExitPayload {
                            session_id: session_id.clone(),
                            exit_code: None,
                        },
                    );
                    break;
                }
            }
        }
    });
}

#[tauri::command]
fn list_hosts() -> Result<Vec<HostRecord>, String> {
    let conn = open_db()?;
    load_hosts_from_db(&conn)
}

#[tauri::command]
// author: BrianXiong
// time: 2026/07/21/00:00:00
// Passwords are written to the macOS Keychain; the DB only stores a marker.
// An empty password on save means "keep the stored one" so editing a host
// never requires re-typing its password.
fn save_host(mut host: HostRecord) -> Result<HostRecord, String> {
    if host.id.trim().is_empty() {
        host.id = now_millis();
    }

    let conn = open_db()?;

    // author: BrianXiong
    // time: 2026/10/17/23:55:00
    // Normalize the jump host and reject configurations ssh cannot use (a
    // missing target or a loop) before they are persisted.
    host.jump_host_id = host
        .jump_host_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if host.jump_host_id.as_deref() == Some(host.id.as_str()) {
        return Err("A host cannot use itself as its jump host".to_string());
    }

    resolve_jump_chain(&conn, &host)?;

    if host.auth_type == "password" {
        let provided = host.password.clone().unwrap_or_default();
        if !provided.is_empty() && provided != KEYCHAIN_PASSWORD_MARKER {
            keychain_set_password(&host.id, &provided)?;
            host.password = Some(KEYCHAIN_PASSWORD_MARKER.to_string());
        } else {
            // Keep whatever is currently stored for this host (marker or legacy value).
            let existing: Option<String> = conn
                .query_row(
                    "SELECT password FROM hosts WHERE id = ?1",
                    params![host.id],
                    |row| row.get::<_, Option<String>>(0),
                )
                .unwrap_or(None);
            host.password = existing;
        }
    } else {
        keychain_delete_password(&host.id);
        host.password = None;
    }

    save_hosts_to_db(&conn, &[host.clone()])?;

    host.has_password = matches!(&host.password, Some(value) if !value.is_empty());
    host.password = None;
    Ok(host)
}

#[tauri::command]
fn delete_host(id: String) -> Result<bool, String> {
    let conn = open_db()?;
    conn.execute("DELETE FROM hosts WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;
    // author: BrianXiong
    // time: 2026/10/17/23:55:00
    // Hosts that jumped through the deleted host fall back to a direct
    // connection instead of failing with "jump host not found".
    conn.execute("UPDATE hosts SET jump_host_id = NULL WHERE jump_host_id = ?1", params![id])
        .map_err(|error| error.to_string())?;
    // author: BrianXiong
    // time: 2026/10/18/00:10:00
    // Tunnels cannot outlive their host: drop its forward rules with it.
    conn.execute("DELETE FROM port_forwards WHERE host_id = ?1", params![id])
        .map_err(|error| error.to_string())?;
    conn.execute("DELETE FROM ssh_config_links WHERE host_id = ?1", params![id])
        .map_err(|error| error.to_string())?;
    keychain_delete_password(&id);
    Ok(true)
}

// author: BrianXiong
// time: 2026/07/21/00:00:00
// Duplicate a host including its keychain-stored password, so copies of
// password-auth hosts stay connectable without re-typing the password.
#[tauri::command]
fn duplicate_host(id: String, label: String) -> Result<HostRecord, String> {
    let conn = open_db()?;
    let hosts = load_hosts_from_db(&conn)?;
    let source = hosts
        .into_iter()
        .find(|host| host.id == id)
        .ok_or_else(|| "Host not found".to_string())?;

    let mut duplicated = source.clone();
    duplicated.id = now_millis();
    duplicated.label = label;

    if duplicated.auth_type == "password" {
        if let Some(password) = keychain_get_password(&id) {
            keychain_set_password(&duplicated.id, &password)?;
            duplicated.password = Some(KEYCHAIN_PASSWORD_MARKER.to_string());
        }
    }

    save_hosts_to_db(&conn, &[duplicated.clone()])?;

    duplicated.has_password = matches!(&duplicated.password, Some(value) if !value.is_empty());
    duplicated.password = None;
    Ok(duplicated)
}

#[tauri::command]
fn test_connection(host: HostRecord, ssh_options: SshConnectionOptions) -> Result<String, String> {
    ensure_sftp_password_available(&host)?;

    let output = build_ssh_command(&host, &ssh_options)?
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

    let output = build_ssh_command(&host, &ssh_options)?
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

// author: BrianXiong
// time: 2026/04/07/22:11:00
#[tauri::command]
async fn list_remote_directory(
    host: HostRecord,
    path: String,
    ssh_options: SshConnectionOptions,
) -> Result<Vec<FileEntry>, String> {
    async_runtime::spawn_blocking(move || {
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
    })
    .await
    .map_err(|error| error.to_string())?
}

// author: BrianXiong
// time: 2026/04/07/22:11:00
#[tauri::command]
async fn upload_to_remote(
    host: HostRecord,
    local_path: String,
    remote_dir: String,
    ssh_options: SshConnectionOptions,
) -> Result<bool, String> {
    async_runtime::spawn_blocking(move || upload_to_remote_blocking(&host, &local_path, &remote_dir, &ssh_options))
    .await
    .map_err(|error| error.to_string())?
}

// author: BrianXiong
// time: 2026/04/07/22:28:00
#[tauri::command]
fn start_upload_to_remote(
    app: AppHandle,
    job_id: String,
    host: HostRecord,
    local_path: String,
    remote_dir: String,
    ssh_options: SshConnectionOptions,
) -> Result<bool, String> {
    let name = Path::new(&local_path)
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| local_path.clone());
    let total_bytes = collect_local_transfer_size(&expand_path(&local_path)).ok();

    let app_handle = app.clone();
    async_runtime::spawn(async move {
        let remote_dir_for_upload = remote_dir.clone();
        let app_for_upload = app_handle.clone();
        let job_id_for_upload = job_id.clone();
        let result = async_runtime::spawn_blocking(move || {
            let state = app_for_upload.state::<AppState>();
            upload_to_remote_with_job(&state, &job_id_for_upload, &host, &local_path, &remote_dir_for_upload, &ssh_options)
        })
            .await
            .map_err(|error| error.to_string())
            .and_then(|value| value);

        let state = app_handle.state::<AppState>();
        let is_cancelled = take_cancelled_upload(&state, &job_id).unwrap_or(false);

        match result {
            Ok(_) => emit_transfer_update(
                &app_handle,
                TransferUpdatePayload {
                    job_id,
                    direction: "upload".to_string(),
                    name,
                    status: "success".to_string(),
                    detail: remote_dir,
                    progress_percent: Some(100.0),
                    transferred_bytes: total_bytes,
                    total_bytes,
                },
            ),
            Err(error) => {
                let status = if is_cancelled { "cancelled" } else { "error" };
                let detail = if is_cancelled {
                    "Upload cancelled".to_string()
                } else {
                    error
                };

                emit_transfer_update(
                    &app_handle,
                    TransferUpdatePayload {
                        job_id,
                        direction: "upload".to_string(),
                        name,
                        status: status.to_string(),
                        detail,
                        progress_percent: None,
                        transferred_bytes: None,
                        total_bytes: None,
                    },
                )
            }
        }
    });

    Ok(true)
}

// author: BrianXiong
// time: 2026/04/08/10:26:00
#[tauri::command]
fn cancel_upload_to_remote(state: State<AppState>, job_id: String) -> Result<bool, String> {
    let child = {
        let processes = state
            .upload_processes
            .lock()
            .map_err(|_| "Upload process state lock poisoned".to_string())?;
        processes.get(&job_id).cloned()
    };

    let Some(child) = child else {
        return Ok(false);
    };

    state
        .cancelled_uploads
        .lock()
        .map_err(|_| "Cancelled upload state lock poisoned".to_string())?
        .insert(job_id);

    child
        .lock()
        .map_err(|_| "Upload process lock poisoned".to_string())?
        .kill()
        .map_err(|error| error.to_string())?;

    Ok(true)
}

// author: BrianXiong
// time: 2026/04/07/22:11:00
#[tauri::command]
async fn download_from_remote(
    host: HostRecord,
    remote_path: String,
    local_dir: String,
    is_dir: bool,
    ssh_options: SshConnectionOptions,
) -> Result<bool, String> {
    async_runtime::spawn_blocking(move || {
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
    })
    .await
    .map_err(|error| error.to_string())?
}

// author: BrianXiong
// time: 2026/04/08/11:42:00
#[tauri::command]
fn start_download_from_remote(
    app: AppHandle,
    job_id: String,
    host: HostRecord,
    remote_path: String,
    local_dir: String,
    is_dir: bool,
    ssh_options: SshConnectionOptions,
) -> Result<bool, String> {
    let name = Path::new(&remote_path)
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| remote_path.clone());

    let app_handle = app.clone();
    async_runtime::spawn(async move {
        let remote_path_for_download = remote_path.clone();
        let local_dir_for_download = local_dir.clone();
        let app_for_download = app_handle.clone();
        let job_id_for_download = job_id.clone();
        let result = async_runtime::spawn_blocking(move || {
            let state = app_for_download.state::<AppState>();
            download_from_remote_with_job(
                &state,
                &job_id_for_download,
                &host,
                &remote_path_for_download,
                &local_dir_for_download,
                is_dir,
                &ssh_options,
            )
        })
            .await
            .map_err(|error| error.to_string())
            .and_then(|value| value);

        let state = app_handle.state::<AppState>();
        let is_cancelled = take_cancelled_download(&state, &job_id).unwrap_or(false);

        match result {
            Ok(_) => emit_transfer_update(
                &app_handle,
                TransferUpdatePayload {
                    job_id,
                    direction: "download".to_string(),
                    name,
                    status: "success".to_string(),
                    detail: local_dir,
                    progress_percent: Some(100.0),
                    transferred_bytes: None,
                    total_bytes: None,
                },
            ),
            Err(error) => {
                let status = if is_cancelled { "cancelled" } else { "error" };
                let detail = if is_cancelled {
                    "Download cancelled".to_string()
                } else {
                    error
                };

                emit_transfer_update(
                    &app_handle,
                    TransferUpdatePayload {
                        job_id,
                        direction: "download".to_string(),
                        name,
                        status: status.to_string(),
                        detail,
                        progress_percent: None,
                        transferred_bytes: None,
                        total_bytes: None,
                    },
                )
            }
        }
    });

    Ok(true)
}

// author: BrianXiong
// time: 2026/04/08/11:42:00
#[tauri::command]
fn cancel_download_from_remote(state: State<AppState>, job_id: String) -> Result<bool, String> {
    let child = {
        let processes = state
            .download_processes
            .lock()
            .map_err(|_| "Download process state lock poisoned".to_string())?;
        processes.get(&job_id).cloned()
    };

    let Some(child) = child else {
        return Ok(false);
    };

    state
        .cancelled_downloads
        .lock()
        .map_err(|_| "Cancelled download state lock poisoned".to_string())?
        .insert(job_id);

    child
        .lock()
        .map_err(|_| "Download process lock poisoned".to_string())?
        .kill()
        .map_err(|error| error.to_string())?;

    Ok(true)
}

// author: BrianXiong
// time: 2026/04/08/11:42:00
#[tauri::command]
fn query_local_entry_size(path: String) -> Result<u64, String> {
    query_local_entry_size_internal(&expand_path(&path))
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

// author: BrianXiong
// time: 2026/07/21/00:00:00
// Quote a path for use inside a remote shell command line.
fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

// author: BrianXiong
// time: 2026/04/07/22:11:00
#[tauri::command]
async fn delete_remote_entry(
    host: HostRecord,
    remote_path: String,
    is_dir: bool,
    ssh_options: SshConnectionOptions,
) -> Result<bool, String> {
    async_runtime::spawn_blocking(move || {
        // author: BrianXiong
        // time: 2026/07/21/00:00:00
        // sftp `rmdir` only removes empty directories, so directories go
        // through `rm -rf` over ssh (the UI always confirms deletes first).
        if is_dir {
            let output = build_ssh_command(&host, &ssh_options)?
                .arg(format!("rm -rf -- {}", shell_single_quote(&remote_path)))
                .output()
                .map_err(|error| error.to_string())?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                return Err(if stderr.is_empty() {
                    "Delete failed".to_string()
                } else {
                    stderr
                });
            }

            return Ok(true);
        }

        let batch = format!("rm {}\nbye\n", escape_sftp_path(&remote_path));
        let output = run_sftp_batch(&host, &ssh_options, &batch)?;
        ensure_sftp_success(&output, "Delete failed")?;
        Ok(true)
    })
    .await
    .map_err(|error| error.to_string())?
}

// author: BrianXiong
// time: 2026/07/21/00:00:00
// Resolve a remote path (".", "~" or relative) to the absolute path reported
// by the SFTP server, so the UI path bar can show something meaningful.
#[tauri::command]
async fn resolve_remote_path(
    host: HostRecord,
    path: String,
    ssh_options: SshConnectionOptions,
) -> Result<String, String> {
    async_runtime::spawn_blocking(move || {
        let remote_path = if path.trim().is_empty() || path.trim() == "~" {
            "."
        } else {
            path.trim()
        };

        let batch = format!("cd {}\npwd\nbye\n", escape_sftp_path(remote_path));
        let output = run_sftp_batch(&host, &ssh_options, &batch)?;
        ensure_sftp_success(&output, "Failed to resolve remote path")?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout
            .lines()
            .find_map(|line| {
                line.trim()
                    .strip_prefix("Remote working directory:")
                    .map(|value| value.trim().to_string())
            })
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "Remote working directory not reported".to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

// author: BrianXiong
// time: 2026/07/21/00:00:00
// Open a link from the terminal in the system browser (macOS `open`).
#[tauri::command]
fn open_external_url(url: String) -> Result<bool, String> {
    let trimmed = url.trim();
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err("Only http/https links can be opened".to_string());
    }

    let status = Command::new("open")
        .arg(trimmed)
        .status()
        .map_err(|error| error.to_string())?;

    if !status.success() {
        return Err("Failed to open link".to_string());
    }

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
    let password = resolve_host_password(&host);
    let mut cmd = if host.auth_type == "password" && !password.is_empty() {
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
        c.arg(&password);
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
    for option in control_master_options() {
        cmd.arg(option);
    }
    cmd.arg("-o");
    cmd.arg("StrictHostKeyChecking=accept-new");
    cmd.arg("-o");
    cmd.arg(format!("ServerAliveInterval={}", ssh_options.server_alive_interval_seconds));
    cmd.arg("-o");
    cmd.arg(format!("ConnectTimeout={}", ssh_options.connect_timeout_seconds));
    cmd.arg("-p");
    cmd.arg(host.port.to_string());

    let jump_chain = resolve_jump_chain(&open_db()?, &host)?;
    if !jump_chain.is_empty() {
        cmd.arg("-J");
        cmd.arg(jump_chain.join(","));
    }

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
    apply_local_terminal_utf8_env(&mut cmd);

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
// author: BrianXiong
// time: 2026/04/05/17:12:08
fn pick_local_directory() -> Result<Option<String>, String> {
    let output = Command::new("osascript")
        .arg("-e")
        .arg("POSIX path of (choose folder with prompt \"Select a local project directory\")")
        .output()
        .map_err(|error| error.to_string())?;

    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            return Ok(None);
        }
        return Ok(Some(path.trim_end_matches('/').to_string()));
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.contains("User canceled") || stderr.contains("(-128)") {
        return Ok(None);
    }

    Err(if stderr.is_empty() {
        "Failed to choose local directory".to_string()
    } else {
        stderr
    })
}

#[tauri::command]
// author: BrianXiong
// time: 2026/04/05/16:20:45
fn get_terminal_session_cwd(state: State<AppState>, session_id: String) -> Result<String, String> {
    let sessions = state
        .terminal_sessions
        .lock()
        .map_err(|_| "Lock poisoned".to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| "Terminal session not found".to_string())?;
    let child = session.child.lock().map_err(|_| "Lock poisoned".to_string())?;
    let pid = child
        .process_id()
        .ok_or_else(|| "Cannot resolve terminal process id".to_string())?;

    let output = Command::new(
        resolve_binary("lsof")
            .map(|path| path.to_string_lossy().into_owned())
            .map_err(|error| error.to_string())?,
    )
    .arg("-a")
    .arg("-p")
    .arg(pid.to_string())
    .arg("-d")
    .arg("cwd")
    .arg("-Fn")
    .output()
    .map_err(|error| error.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Failed to resolve terminal cwd".to_string()
        } else {
            stderr
        });
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .find_map(|line| line.strip_prefix('n').map(|value| value.to_string()))
        .ok_or_else(|| "Terminal cwd not available".to_string())
}

#[tauri::command]
fn resize_terminal_session(
    state: State<AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<bool, String> {
    let sessions = state
        .terminal_sessions
        .lock()
        .map_err(|_| "Lock poisoned".to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| "Terminal session not found".to_string())?;
    let pty = session.pty.lock().map_err(|_| "Lock poisoned".to_string())?;

    pty.resize(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })
    .map_err(|error| error.to_string())?;

    Ok(true)
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

// author: BrianXiong
// time: 2026/10/18/00:10:00
// Port forwards are persistent rules ("tunnels"): the record lives in SQLite,
// while the running `ssh -N` process lives in AppState.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PortForwardRecord {
    id: String,
    label: String,
    kind: String,
    bind_host: String,
    bind_port: u16,
    target_host: String,
    target_port: u16,
    host_id: String,
    auto_start: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PortForwardStatusPayload {
    forward: PortForwardRecord,
    running: bool,
}

fn load_port_forwards_from_db(conn: &Connection) -> Result<Vec<PortForwardRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, label, kind, bind_host, bind_port, target_host, target_port, host_id, auto_start FROM port_forwards ORDER BY label, bind_port",
        )
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(PortForwardRecord {
                id: row.get(0)?,
                label: row.get(1)?,
                kind: row.get(2)?,
                bind_host: row.get(3)?,
                bind_port: row.get(4)?,
                target_host: row.get(5)?,
                target_port: row.get(6)?,
                host_id: row.get(7)?,
                auto_start: row.get::<_, i64>(8)? != 0,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn save_port_forwards_to_db(conn: &Connection, forwards: &[PortForwardRecord]) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|error| error.to_string())?;
    for forward in forwards {
        tx.execute(
            r#"
            INSERT INTO port_forwards (id, label, kind, bind_host, bind_port, target_host, target_port, host_id, auto_start)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(id) DO UPDATE SET
              label=excluded.label,
              kind=excluded.kind,
              bind_host=excluded.bind_host,
              bind_port=excluded.bind_port,
              target_host=excluded.target_host,
              target_port=excluded.target_port,
              host_id=excluded.host_id,
              auto_start=excluded.auto_start
            "#,
            params![
                forward.id,
                forward.label,
                forward.kind,
                forward.bind_host,
                forward.bind_port,
                forward.target_host,
                forward.target_port,
                forward.host_id,
                if forward.auto_start { 1i64 } else { 0i64 },
            ],
        )
        .map_err(|error| error.to_string())?;
    }
    tx.commit().map_err(|error| error.to_string())
}

// author: BrianXiong
// time: 2026/10/18/00:10:00
// Translates a forward rule into the ssh flags that create the tunnel.
fn forward_argument(forward: &PortForwardRecord) -> Result<Vec<String>, String> {
    let bind_host = if forward.bind_host.trim().is_empty() {
        "127.0.0.1"
    } else {
        forward.bind_host.trim()
    };

    match forward.kind.as_str() {
        "local" | "remote" => {
            if forward.target_host.trim().is_empty() || forward.target_port == 0 {
                return Err("A target host and port are required for local and remote forwards".to_string());
            }

            let flag = if forward.kind == "local" { "-L" } else { "-R" };
            Ok(vec![
                flag.to_string(),
                format!(
                    "{}:{}:{}:{}",
                    bind_host,
                    forward.bind_port,
                    forward.target_host.trim(),
                    forward.target_port
                ),
            ])
        }
        "dynamic" => Ok(vec!["-D".to_string(), format!("{}:{}", bind_host, forward.bind_port)]),
        other => Err(format!("Unsupported forward type: {other}")),
    }
}

fn default_ssh_connection_options() -> SshConnectionOptions {
    SshConnectionOptions {
        connect_timeout_seconds: 5,
        server_alive_interval_seconds: 30,
    }
}

fn spawn_port_forward(
    state: &AppState,
    forward: &PortForwardRecord,
    ssh_options: &SshConnectionOptions,
) -> Result<(), String> {
    {
        let processes = state
            .forward_processes
            .lock()
            .map_err(|_| "Lock poisoned".to_string())?;
        if processes.contains_key(&forward.id) {
            return Ok(());
        }
    }

    let conn = open_db()?;
    let hosts = load_hosts_from_db(&conn)?;
    let host = hosts
        .iter()
        .find(|candidate| candidate.id == forward.host_id)
        .ok_or_else(|| format!("Host not found for forward: {}", forward.host_id))?;

    let mut extra_args = vec![
        "-N".to_string(),
        "-o".to_string(),
        "ExitOnForwardFailure=yes".to_string(),
    ];
    extra_args.extend(forward_argument(forward)?);

    let mut command = build_ssh_command_with_args(host, ssh_options, &extra_args)?;
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Failed to start tunnel: {error}"))?;

    // Give ssh a moment to fail fast (port already bound, auth rejected, bad
    // host) so the UI reports a real error instead of a tunnel that already died.
    std::thread::sleep(std::time::Duration::from_millis(400));
    if let Ok(Some(status)) = child.try_wait() {
        let mut stderr = String::new();
        if let Some(mut pipe) = child.stderr.take() {
            let _ = pipe.read_to_string(&mut stderr);
        }
        let detail = stderr.trim().to_string();
        return Err(if detail.is_empty() {
            format!("Tunnel exited with status {status}")
        } else {
            detail
        });
    }

    state
        .forward_processes
        .lock()
        .map_err(|_| "Lock poisoned".to_string())?
        .insert(forward.id.clone(), Arc::new(Mutex::new(child)));
    Ok(())
}

fn stop_port_forward_process(state: &AppState, id: &str) -> Result<(), String> {
    let child = state
        .forward_processes
        .lock()
        .map_err(|_| "Lock poisoned".to_string())?
        .remove(id);

    if let Some(child) = child {
        let mut child = child.lock().map_err(|_| "Lock poisoned".to_string())?;
        child.kill().ok();
        child.wait().ok();
    }

    Ok(())
}

fn stop_all_port_forwards(state: &AppState) {
    let Ok(mut processes) = state.forward_processes.lock() else {
        return;
    };

    for (_, child) in processes.drain() {
        if let Ok(mut child) = child.lock() {
            child.kill().ok();
            child.wait().ok();
        }
    }
}

fn auto_start_port_forwards(app: &tauri::AppHandle) {
    let Ok(conn) = open_db() else {
        return;
    };
    let Ok(forwards) = load_port_forwards_from_db(&conn) else {
        return;
    };

    let state = app.state::<AppState>();
    for forward in forwards.iter().filter(|item| item.auto_start) {
        if let Err(error) = spawn_port_forward(state.inner(), forward, &default_ssh_connection_options()) {
            eprintln!("[forward] auto start failed for {}: {}", forward.id, error);
        }
    }
}

#[tauri::command]
fn list_port_forwards(state: State<AppState>) -> Result<Vec<PortForwardStatusPayload>, String> {
    let conn = open_db()?;
    let forwards = load_port_forwards_from_db(&conn)?;
    let processes = state
        .forward_processes
        .lock()
        .map_err(|_| "Lock poisoned".to_string())?;

    Ok(forwards
        .into_iter()
        .map(|forward| PortForwardStatusPayload {
            running: processes.contains_key(&forward.id),
            forward,
        })
        .collect())
}

#[tauri::command]
fn save_port_forward(mut forward: PortForwardRecord) -> Result<PortForwardRecord, String> {
    if forward.id.trim().is_empty() {
        forward.id = now_millis();
    }

    forward.label = forward.label.trim().to_string();
    forward.kind = forward.kind.trim().to_string();
    forward.bind_host = {
        let trimmed = forward.bind_host.trim();
        if trimmed.is_empty() {
            "127.0.0.1".to_string()
        } else {
            trimmed.to_string()
        }
    };
    forward.target_host = forward.target_host.trim().to_string();

    if forward.kind != "local" && forward.kind != "remote" && forward.kind != "dynamic" {
        return Err(format!("Unsupported forward type: {}", forward.kind));
    }
    if forward.host_id.trim().is_empty() {
        return Err("Choose a host for this forward".to_string());
    }
    if forward.bind_port == 0 {
        return Err("Bind port is required".to_string());
    }
    forward_argument(&forward)?;

    let conn = open_db()?;
    save_port_forwards_to_db(&conn, &[forward.clone()])?;
    Ok(forward)
}

#[tauri::command]
fn delete_port_forward(state: State<AppState>, id: String) -> Result<bool, String> {
    stop_port_forward_process(&state, &id)?;
    let conn = open_db()?;
    conn.execute("DELETE FROM port_forwards WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
fn start_port_forward(
    state: State<AppState>,
    id: String,
    ssh_options: SshConnectionOptions,
) -> Result<bool, String> {
    let conn = open_db()?;
    let forwards = load_port_forwards_from_db(&conn)?;
    let forward = forwards
        .into_iter()
        .find(|item| item.id == id)
        .ok_or_else(|| "Port forward not found".to_string())?;

    spawn_port_forward(&state, &forward, &ssh_options)?;
    Ok(true)
}

#[tauri::command]
fn stop_port_forward(state: State<AppState>, id: String) -> Result<bool, String> {
    stop_port_forward_process(&state, &id)?;
    Ok(true)
}

// author: BrianXiong
// time: 2026/10/18/00:35:00
// `~/.ssh/config` is treated as a live data source instead of a one-time
// import: every preview re-reads the file, and hosts keep a link to the alias
// they came from so later edits can be synced back.
#[derive(Debug, Clone, PartialEq)]
struct SshConfigHostEntry {
    alias: String,
    host_name: String,
    user: String,
    port: u16,
    identity_file: Option<String>,
    proxy_jump: Option<String>,
}

#[derive(Debug, Default, Clone)]
struct SshConfigBlock {
    patterns: Vec<String>,
    host_name: Option<String>,
    user: Option<String>,
    port: Option<u16>,
    identity_file: Option<String>,
    proxy_jump: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SshConfigEntryPayload {
    alias: String,
    host_name: String,
    user: String,
    port: u16,
    identity_file: Option<String>,
    proxy_jump: Option<String>,
    // "new" | "updated" | "unchanged"
    state: String,
    host_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SshConfigPreviewPayload {
    config_path: String,
    exists: bool,
    entries: Vec<SshConfigEntryPayload>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SshConfigImportReport {
    imported: usize,
    updated: usize,
    skipped: usize,
}

fn ssh_config_path() -> Option<PathBuf> {
    home_dir().map(|home| home.join(".ssh").join("config"))
}

// author: BrianXiong
// time: 2026/10/18/00:35:00
fn wildcard_match(pattern: &str, value: &str) -> bool {
    let pattern: Vec<char> = pattern.chars().collect();
    let value: Vec<char> = value.chars().collect();
    let (mut pattern_index, mut value_index) = (0usize, 0usize);
    let mut star: Option<usize> = None;
    let mut mark = 0usize;

    while value_index < value.len() {
        if pattern_index < pattern.len() && (pattern[pattern_index] == '?' || pattern[pattern_index] == value[value_index]) {
            pattern_index += 1;
            value_index += 1;
        } else if pattern_index < pattern.len() && pattern[pattern_index] == '*' {
            star = Some(pattern_index);
            mark = value_index;
            pattern_index += 1;
        } else if let Some(star_index) = star {
            pattern_index = star_index + 1;
            mark += 1;
            value_index = mark;
        } else {
            return false;
        }
    }

    while pattern_index < pattern.len() && pattern[pattern_index] == '*' {
        pattern_index += 1;
    }

    pattern_index == pattern.len()
}

// author: BrianXiong
// time: 2026/10/18/00:35:00
// Resolves `Include` values, including globs such as `config.d/*`.
fn collect_ssh_config_include_files(base_dir: &Path, raw_value: &str) -> Vec<PathBuf> {
    let value = raw_value.trim();
    if value.is_empty() {
        return Vec::new();
    }

    let expanded = expand_path(value);
    let candidate = if expanded.is_absolute() {
        expanded
    } else {
        base_dir.join(expanded)
    };

    let candidate_text = candidate.to_string_lossy().to_string();
    if !candidate_text.contains('*') && !candidate_text.contains('?') {
        return if candidate.exists() { vec![candidate] } else { Vec::new() };
    }

    let dir = candidate
        .parent()
        .map(|parent| parent.to_path_buf())
        .unwrap_or_else(|| base_dir.to_path_buf());
    let file_pattern = candidate
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default();

    let Ok(entries) = fs::read_dir(&dir) else {
        return Vec::new();
    };

    let mut files: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.is_file())
        .filter(|path| {
            path.file_name()
                .map(|name| wildcard_match(&file_pattern, &name.to_string_lossy()))
                .unwrap_or(false)
        })
        .collect();
    files.sort();
    files
}

fn finish_ssh_config_block(mut block: SshConfigBlock, default_user: &str, entries: &mut Vec<SshConfigHostEntry>) {
    let Some(host_name) = block.host_name.take() else {
        return;
    };
    let host_name = host_name.trim().to_string();
    if host_name.is_empty() {
        return;
    }

    for pattern in block.patterns.drain(..) {
        // Wildcard hosts are pattern rules, not real machines.
        if pattern.contains('*') || pattern.contains('?') {
            continue;
        }

        entries.push(SshConfigHostEntry {
            alias: pattern,
            host_name: host_name.clone(),
            user: block
                .user
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or(default_user)
                .to_string(),
            port: block.port.unwrap_or(22),
            identity_file: block
                .identity_file
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(|value| value.to_string()),
            proxy_jump: block
                .proxy_jump
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty() && *value != "none")
                .map(|value| value.to_string()),
        });
    }
}

// author: BrianXiong
// time: 2026/10/18/00:35:00
fn parse_ssh_config_file(path: &Path, depth: usize, entries: &mut Vec<SshConfigHostEntry>) -> Result<(), String> {
    if depth > 5 {
        return Ok(());
    }

    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let base_dir = path.parent().map(|parent| parent.to_path_buf()).unwrap_or_else(|| PathBuf::from("."));
    let default_user = env::var("USER").unwrap_or_else(|_| "root".to_string());
    let mut current: Option<SshConfigBlock> = None;

    for raw_line in content.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let (key, value) = match line.split_once(|character: char| character.is_whitespace() || character == '=') {
            Some((key, value)) => (key.trim().to_ascii_lowercase(), value.trim()),
            None => (line.to_ascii_lowercase(), ""),
        };

        match key.as_str() {
            "host" => {
                if let Some(block) = current.take() {
                    finish_ssh_config_block(block, &default_user, entries);
                }
                let block = SshConfigBlock {
                    patterns: value.split_whitespace().map(|item| item.to_string()).collect(),
                    ..SshConfigBlock::default()
                };
                current = Some(block);
            }
            "match" => {
                if let Some(block) = current.take() {
                    finish_ssh_config_block(block, &default_user, entries);
                }
            }
            "include" => {
                // Includes are only expanded at the top level; inside a Host
                // block ssh's scoping rules make them ambiguous for our model.
                if current.is_none() {
                    for included in collect_ssh_config_include_files(&base_dir, value) {
                        parse_ssh_config_file(&included, depth + 1, entries)?;
                    }
                }
            }
            "hostname" => {
                if let Some(block) = current.as_mut() {
                    block.host_name = Some(value.to_string());
                }
            }
            "user" => {
                if let Some(block) = current.as_mut() {
                    block.user = Some(value.to_string());
                }
            }
            "port" => {
                if let Some(block) = current.as_mut() {
                    if let Ok(port) = value.parse::<u16>() {
                        block.port = Some(port);
                    }
                }
            }
            "identityfile" => {
                if let Some(block) = current.as_mut() {
                    block.identity_file = Some(value.to_string());
                }
            }
            "proxyjump" => {
                if let Some(block) = current.as_mut() {
                    block.proxy_jump = Some(value.to_string());
                }
            }
            _ => {}
        }
    }

    if let Some(block) = current.take() {
        finish_ssh_config_block(block, &default_user, entries);
    }

    Ok(())
}

fn load_ssh_config_links(conn: &Connection) -> Result<HashMap<String, String>, String> {
    let mut stmt = conn
        .prepare("SELECT alias, host_id FROM ssh_config_links")
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|error| error.to_string())?;

    let mut links = HashMap::new();
    for row in rows {
        let (alias, host_id) = row.map_err(|error| error.to_string())?;
        links.insert(alias, host_id);
    }
    Ok(links)
}

fn save_ssh_config_link(conn: &Connection, alias: &str, host_id: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO ssh_config_links (alias, host_id) VALUES (?1, ?2) ON CONFLICT(alias) DO UPDATE SET host_id=excluded.host_id",
        params![alias, host_id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn ssh_config_identity_matches(entry: &SshConfigHostEntry, host: &HostRecord) -> bool {
    match (&entry.identity_file, &host.private_key_path) {
        (Some(config_path), Some(host_path)) => expand_path(config_path) == expand_path(host_path),
        (None, None) => true,
        (None, Some(host_path)) => host_path.trim().is_empty(),
        (Some(_), None) => false,
    }
}

fn ssh_config_entry_unchanged(entry: &SshConfigHostEntry, host: &HostRecord) -> bool {
    host.address == entry.host_name
        && host.port == entry.port
        && host.username == entry.user
        && ssh_config_identity_matches(entry, host)
}

fn parse_ssh_config_entries(path: &Path) -> Result<Vec<SshConfigHostEntry>, String> {
    let mut parsed = Vec::new();
    if path.exists() {
        parse_ssh_config_file(path, 0, &mut parsed)?;
    }

    // Duplicate aliases: first definition wins, like ssh itself.
    let mut seen: HashSet<String> = HashSet::new();
    parsed.retain(|entry| seen.insert(entry.alias.clone()));
    Ok(parsed)
}

fn build_ssh_config_preview(conn: &Connection, path: &Path) -> Result<SshConfigPreviewPayload, String> {
    let exists = path.exists();
    let parsed = parse_ssh_config_entries(path)?;
    let links = load_ssh_config_links(conn)?;
    let hosts = load_hosts_from_db(conn)?;

    let entries = parsed
        .into_iter()
        .map(|entry| {
            let linked_host = links
                .get(&entry.alias)
                .and_then(|host_id| hosts.iter().find(|host| &host.id == host_id));

            let (state, host_id) = match linked_host {
                None => ("new".to_string(), None),
                Some(host) => {
                    let state = if ssh_config_entry_unchanged(&entry, host) { "unchanged" } else { "updated" };
                    (state.to_string(), Some(host.id.clone()))
                }
            };

            SshConfigEntryPayload {
                alias: entry.alias,
                host_name: entry.host_name,
                user: entry.user,
                port: entry.port,
                identity_file: entry.identity_file,
                proxy_jump: entry.proxy_jump,
                state,
                host_id,
            }
        })
        .collect();

    Ok(SshConfigPreviewPayload {
        config_path: path.to_string_lossy().to_string(),
        exists,
        entries,
    })
}

// author: BrianXiong
// time: 2026/10/18/00:35:00
// Importing never touches credentials: existing hosts get only the config-owned
// columns updated, so a keychain password survives a config sync.
fn import_ssh_config_entries(
    conn: &Connection,
    path: &Path,
    aliases: &[String],
) -> Result<SshConfigImportReport, String> {
    let wanted: HashSet<&str> = aliases.iter().map(String::as_str).collect();
    let parsed: Vec<SshConfigHostEntry> = parse_ssh_config_entries(path)?
        .into_iter()
        .filter(|entry| wanted.contains(entry.alias.as_str()))
        .collect();

    let links = load_ssh_config_links(conn)?;
    let hosts = load_hosts_from_db(conn)?;
    let mut alias_to_host_id: HashMap<String, String> = links.clone();
    let mut report = SshConfigImportReport {
        imported: 0,
        updated: 0,
        skipped: 0,
    };

    for entry in &parsed {
        match links.get(&entry.alias) {
            Some(host_id) if hosts.iter().any(|host| &host.id == host_id) => {
                let host = hosts.iter().find(|host| &host.id == host_id).expect("checked above");
                if ssh_config_entry_unchanged(entry, host) {
                    report.skipped += 1;
                    continue;
                }

                conn.execute(
                    "UPDATE hosts SET address = ?2, port = ?3, username = ?4, private_key_path = ?5 WHERE id = ?1",
                    params![host_id, entry.host_name, entry.port, entry.user, entry.identity_file],
                )
                .map_err(|error| error.to_string())?;
                report.updated += 1;
            }
            _ => {
                let host_id = Uuid::new_v4().to_string();
                alias_to_host_id.insert(entry.alias.clone(), host_id.clone());
                let host = HostRecord {
                    id: host_id.clone(),
                    label: entry.alias.clone(),
                    project_id: default_project_id(),
                    address: entry.host_name.clone(),
                    port: entry.port,
                    username: entry.user.clone(),
                    auth_type: if entry.identity_file.is_some() { "key".to_string() } else { "password".to_string() },
                    password: None,
                    private_key_path: entry.identity_file.clone(),
                    jump_host_id: None,
                    has_password: false,
                };
                save_hosts_to_db(conn, &[host])?;
                report.imported += 1;
            }
        }
    }

    // Second pass: wire ProxyJump aliases to the hosts they point at.
    for entry in &parsed {
        let Some(host_id) = alias_to_host_id.get(&entry.alias) else {
            continue;
        };
        let Some(jump_alias) = entry.proxy_jump.as_deref() else {
            continue;
        };
        let Some(jump_host_id) = alias_to_host_id.get(jump_alias) else {
            continue;
        };
        if jump_host_id == host_id {
            continue;
        }

        conn.execute(
            "UPDATE hosts SET jump_host_id = ?2 WHERE id = ?1",
            params![host_id, jump_host_id],
        )
        .map_err(|error| error.to_string())?;
    }

    for entry in &parsed {
        if let Some(host_id) = alias_to_host_id.get(&entry.alias) {
            save_ssh_config_link(conn, &entry.alias, host_id)?;
        }
    }

    Ok(report)
}

#[tauri::command]
fn preview_ssh_config() -> Result<SshConfigPreviewPayload, String> {
    let path = ssh_config_path().ok_or_else(|| "Cannot resolve home directory".to_string())?;
    build_ssh_config_preview(&open_db()?, &path)
}

#[tauri::command]
fn import_ssh_config(aliases: Vec<String>) -> Result<SshConfigImportReport, String> {
    let path = ssh_config_path().ok_or_else(|| "Cannot resolve home directory".to_string())?;
    import_ssh_config_entries(&open_db()?, &path, &aliases)
}

// author: BrianXiong
// time: 2026/10/18/01:00:00
// Known hosts are listed through `ssh-keygen -l` so hashed entries, key types
// and fingerprints come straight from OpenSSH instead of a hand-rolled parser.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct KnownHostRecord {
    host: String,
    key_type: String,
    fingerprint: String,
    bits: String,
}

fn known_hosts_path() -> Option<PathBuf> {
    home_dir().map(|home| home.join(".ssh").join("known_hosts"))
}

// author: BrianXiong
// time: 2026/10/18/01:00:00
// `ssh-keygen -l -f known_hosts` prints "<bits> <fingerprint> <host...> (<TYPE>)".
fn parse_known_hosts_listing(stdout: &str) -> Vec<KnownHostRecord> {
    stdout
        .lines()
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let bits = parts.next()?.to_string();
            let fingerprint = parts.next()?.to_string();
            let rest: Vec<&str> = parts.collect();
            if rest.is_empty() {
                return None;
            }

            let last = rest[rest.len() - 1];
            let key_type = if last.starts_with('(') && last.ends_with(')') {
                last.trim_matches(|character| character == '(' || character == ')').to_string()
            } else {
                String::new()
            };
            let host_end = if key_type.is_empty() { rest.len() } else { rest.len() - 1 };
            let host = rest[..host_end].join(" ");
            if host.is_empty() {
                return None;
            }

            Some(KnownHostRecord {
                host,
                key_type,
                fingerprint,
                bits,
            })
        })
        .collect()
}

// author: BrianXiong
// time: 2026/10/18/01:00:00
// Rewrites known_hosts without the matching entries. Matching by raw first field
// keeps hashed entries (`|1|salt|hash`) removable from the UI as well.
fn remove_known_host_entries(path: &Path, host: &str) -> Result<bool, String> {
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut removed = false;

    let remaining: Vec<&str> = content
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return true;
            }

            let Some(first_field) = trimmed.split_whitespace().next() else {
                return true;
            };
            let matches = first_field.split(',').any(|candidate| candidate == host);
            if matches {
                removed = true;
            }
            !matches
        })
        .collect();

    if removed {
        let mut next = remaining.join("\n");
        if !next.is_empty() {
            next.push('\n');
        }
        fs::write(path, next).map_err(|error| error.to_string())?;
    }

    Ok(removed)
}

#[tauri::command]
fn list_known_hosts() -> Result<Vec<KnownHostRecord>, String> {
    let path = known_hosts_path().ok_or_else(|| "Cannot resolve home directory".to_string())?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let output = Command::new(resolve_binary("ssh-keygen")?)
        .arg("-l")
        .arg("-f")
        .arg(&path)
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Failed to read known_hosts".to_string()
        } else {
            stderr
        });
    }

    Ok(parse_known_hosts_listing(&String::from_utf8_lossy(&output.stdout)))
}

#[tauri::command]
fn remove_known_host(host: String) -> Result<bool, String> {
    let target = host.trim();
    if target.is_empty() {
        return Err("Host is required".to_string());
    }

    let path = known_hosts_path().ok_or_else(|| "Cannot resolve home directory".to_string())?;
    if !path.exists() {
        return Ok(false);
    }

    remove_known_host_entries(&path, target)
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            auto_start_port_forwards(app.handle());
            Ok(())
        })
        .manage(AppState {
            terminal_sessions: Mutex::new(HashMap::new()),
            forward_processes: Mutex::new(HashMap::new()),
            upload_processes: Mutex::new(HashMap::new()),
            cancelled_uploads: Mutex::new(HashSet::new()),
            download_processes: Mutex::new(HashMap::new()),
            cancelled_downloads: Mutex::new(HashSet::new()),
        })
        .invoke_handler(tauri::generate_handler![
            clear_app_data,
            load_app_preferences,
            save_app_preferences,
            list_hosts,
            save_host,
            delete_host,
            duplicate_host,
            test_connection,
            observe_server,
            list_local_directory,
            read_local_file_preview,
            list_remote_directory,
            upload_to_remote,
            start_upload_to_remote,
            cancel_upload_to_remote,
            download_from_remote,
            start_download_from_remote,
            cancel_download_from_remote,
            query_local_entry_size,
            delete_local_entry,
            delete_remote_entry,
            resolve_remote_path,
            open_external_url,
            start_terminal_session,
            start_local_terminal_session,
            pick_local_directory,
            get_terminal_session_cwd,
            resize_terminal_session,
            write_terminal_input,
            close_terminal_session,
            list_port_forwards,
            save_port_forward,
            delete_port_forward,
            start_port_forward,
            stop_port_forward,
            preview_ssh_config,
            import_ssh_config,
            list_known_hosts,
            remove_known_host
        ])
        .build(tauri::generate_context!())
        .expect("error while building ServerDeck");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(state) = app_handle.try_state::<AppState>() {
                stop_all_port_forwards(state.inner());
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    // author: BrianXiong
    // time: 2026/08/19/17:40:00
    // A password-auth host whose keychain entry does not exist must fail fast
    // with the actionable message instead of silently degrading into a doomed
    // batch-mode sftp attempt. The random id guarantees the entry is missing.
    #[test]
    fn password_host_without_keychain_entry_fails_fast() {
        let host = HostRecord {
            id: "00000000-0000-4000-8000-000000000000".to_string(),
            label: "Probe Host".to_string(),
            project_id: "default".to_string(),
            address: "203.0.113.10".to_string(),
            port: 22,
            username: "root".to_string(),
            auth_type: "password".to_string(),
            password: None,
            private_key_path: None,
            jump_host_id: None,
            has_password: true,
        };

        let result = ensure_sftp_password_available(&host);
        assert!(result.is_err());
        let message = result.unwrap_err();
        assert!(message.contains("Probe Host"), "message should name the host: {message}");
        assert!(message.contains("keychain"), "message should mention the keychain: {message}");
    }

    // author: BrianXiong
    // time: 2026/08/19/21:10:00
    // Version 0.0.37 removed the agent workspace: init_db must drop the
    // leftover agent tables (they stored conversations and plaintext provider
    // API keys) while keeping every core table the app still relies on.
    #[test]
    fn init_db_drops_legacy_agent_tables() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            r#"
            CREATE TABLE ai_providers (id TEXT PRIMARY KEY);
            CREATE TABLE agent_sessions (id TEXT PRIMARY KEY);
            CREATE TABLE agent_messages (id TEXT PRIMARY KEY);
            CREATE TABLE agent_plan_items (id TEXT PRIMARY KEY);
            CREATE TABLE agent_tool_calls (id TEXT PRIMARY KEY);
            "#,
        )
        .expect("seed legacy agent tables");

        init_db(&conn).expect("init db");

        let legacy: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN \
                 ('ai_providers', 'agent_sessions', 'agent_messages', 'agent_plan_items', 'agent_tool_calls')",
                [],
                |row| row.get(0),
            )
            .expect("count legacy tables");
        assert_eq!(legacy, 0, "legacy agent tables must be dropped");

        let core: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN \
                 ('hosts', 'projects', 'app_settings', 'local_terminal_recent_projects')",
                [],
                |row| row.get(0),
            )
            .expect("count core tables");
        assert_eq!(core, 4, "core tables must still exist");
    }

    // author: BrianXiong
    // time: 2026/08/19/17:40:00
    // An explicit password (e.g. just typed in the editor, not saved yet)
    // must always pass the guard, and key-auth hosts never need one.
    #[test]
    fn explicit_password_and_key_auth_pass_guard() {
        let mut host = HostRecord {
            id: "00000000-0000-4000-8000-000000000001".to_string(),
            label: String::new(),
            project_id: "default".to_string(),
            address: "203.0.113.11".to_string(),
            port: 22,
            username: "root".to_string(),
            auth_type: "password".to_string(),
            password: Some("typed-in-editor".to_string()),
            private_key_path: None,
            jump_host_id: None,
            has_password: false,
        };
        assert!(ensure_sftp_password_available(&host).is_ok());

        host.auth_type = "key".to_string();
        host.password = None;
        assert!(ensure_sftp_password_available(&host).is_ok());
    }

    // author: BrianXiong
    // time: 2026/10/17/23:55:00
    fn test_host(id: &str, label: &str, address: &str, jump_host_id: Option<&str>) -> HostRecord {
        HostRecord {
            id: id.to_string(),
            label: label.to_string(),
            project_id: "default".to_string(),
            address: address.to_string(),
            port: 22,
            username: "root".to_string(),
            auth_type: "key".to_string(),
            password: None,
            private_key_path: Some("~/.ssh/id_ed25519".to_string()),
            jump_host_id: jump_host_id.map(|value| value.to_string()),
            has_password: false,
        }
    }

    // A chain of target -> bastion-b -> bastion-a must be handed to ssh as
    // "bastion-a,bastion-b" because -J expects the outermost hop first.
    #[test]
    fn jump_chain_orders_hops_from_outermost() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        init_db(&conn).expect("init db");
        save_hosts_to_db(
            &conn,
            &[
                test_host("bastion-a", "Bastion A", "10.0.0.1", None),
                test_host("bastion-b", "Bastion B", "10.0.0.2", Some("bastion-a")),
                test_host("target", "Target", "10.0.0.9", Some("bastion-b")),
            ],
        )
        .expect("seed hosts");

        let hosts = load_hosts_from_db(&conn).expect("load hosts");
        let target = hosts.iter().find(|host| host.id == "target").expect("target host");
        let chain = resolve_jump_chain(&conn, target).expect("jump chain");

        assert_eq!(
            chain,
            vec!["root@10.0.0.1:22".to_string(), "root@10.0.0.2:22".to_string()]
        );
    }

    #[test]
    fn jump_chain_rejects_loops_and_missing_hosts() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        init_db(&conn).expect("init db");
        save_hosts_to_db(
            &conn,
            &[
                test_host("first", "First", "10.1.0.1", Some("second")),
                test_host("second", "Second", "10.1.0.2", Some("first")),
            ],
        )
        .expect("seed hosts");

        let hosts = load_hosts_from_db(&conn).expect("load hosts");
        let first = hosts.iter().find(|host| host.id == "first").expect("first host");
        let loop_error = resolve_jump_chain(&conn, first).expect_err("loop must fail");
        assert!(loop_error.contains("loop"), "unexpected error: {loop_error}");

        let orphan = test_host("orphan", "Orphan", "10.1.0.3", Some("missing-id"));
        let missing_error = resolve_jump_chain(&conn, &orphan).expect_err("missing jump must fail");
        assert!(missing_error.contains("not found"), "unexpected error: {missing_error}");
    }

    #[test]
    fn jump_host_id_roundtrips_and_clears() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        init_db(&conn).expect("init db");
        save_hosts_to_db(
            &conn,
            &[
                test_host("bastion", "Bastion", "10.2.0.1", None),
                test_host("target", "Target", "10.2.0.9", Some("bastion")),
            ],
        )
        .expect("seed hosts");

        let loaded = load_hosts_from_db(&conn).expect("load hosts");
        let target = loaded.iter().find(|host| host.id == "target").expect("target host");
        assert_eq!(target.jump_host_id.as_deref(), Some("bastion"));

        let mut cleared = target.clone();
        cleared.jump_host_id = None;
        save_hosts_to_db(&conn, &[cleared]).expect("clear jump host");

        let loaded = load_hosts_from_db(&conn).expect("load hosts");
        let target = loaded.iter().find(|host| host.id == "target").expect("target host");
        assert_eq!(target.jump_host_id, None);
    }

    // author: BrianXiong
    // time: 2026/10/18/00:10:00
    fn test_forward(kind: &str) -> PortForwardRecord {
        PortForwardRecord {
            id: "fwd-1".to_string(),
            label: "local db".to_string(),
            kind: kind.to_string(),
            bind_host: "127.0.0.1".to_string(),
            bind_port: 15432,
            target_host: "10.0.0.5".to_string(),
            target_port: 5432,
            host_id: "host-1".to_string(),
            auto_start: true,
        }
    }

    #[test]
    fn forward_argument_builds_ssh_flags() {
        assert_eq!(
            forward_argument(&test_forward("local")).expect("local"),
            vec!["-L".to_string(), "127.0.0.1:15432:10.0.0.5:5432".to_string()]
        );
        assert_eq!(
            forward_argument(&test_forward("remote")).expect("remote"),
            vec!["-R".to_string(), "127.0.0.1:15432:10.0.0.5:5432".to_string()]
        );

        let dynamic = PortForwardRecord {
            kind: "dynamic".to_string(),
            ..test_forward("dynamic")
        };
        assert_eq!(
            forward_argument(&dynamic).expect("dynamic"),
            vec!["-D".to_string(), "127.0.0.1:15432".to_string()]
        );

        let broken = PortForwardRecord {
            target_host: String::new(),
            ..test_forward("local")
        };
        assert!(forward_argument(&broken).is_err(), "missing target must be rejected");
    }

    #[test]
    fn port_forwards_roundtrip_through_db() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        init_db(&conn).expect("init db");

        save_port_forwards_to_db(&conn, &[test_forward("local")]).expect("save forward");
        let loaded = load_port_forwards_from_db(&conn).expect("load forwards");
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].bind_port, 15432);
        assert_eq!(loaded[0].target_port, 5432);
        assert!(loaded[0].auto_start);

        conn.execute("DELETE FROM port_forwards WHERE id = ?1", params!["fwd-1"])
            .expect("delete forward");
        assert!(load_port_forwards_from_db(&conn).expect("reload").is_empty());
    }

    // author: BrianXiong
    // time: 2026/10/18/00:35:00
    fn write_temp_ssh_config(content: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("serverdeck-ssh-config-{}.conf", Uuid::new_v4()));
        fs::write(&path, content).expect("write temp ssh config");
        path
    }

    #[test]
    fn parse_ssh_config_reads_hosts_and_skips_wildcards() {
        let path = write_temp_ssh_config(
            "Host bastion
  HostName 10.0.0.1
  User ops
  Port 2222

Host target web-alias
  HostName 10.0.0.9
  User root
  ProxyJump bastion

Host *.internal
  HostName 10.0.0.20
  User root
",
        );

        let entries = parse_ssh_config_entries(&path).expect("parse config");
        fs::remove_file(&path).ok();

        let aliases: Vec<&str> = entries.iter().map(|entry| entry.alias.as_str()).collect();
        assert_eq!(aliases, vec!["bastion", "target", "web-alias"]);

        let bastion = entries.iter().find(|entry| entry.alias == "bastion").expect("bastion");
        assert_eq!(bastion.host_name, "10.0.0.1");
        assert_eq!(bastion.user, "ops");
        assert_eq!(bastion.port, 2222);

        let target = entries.iter().find(|entry| entry.alias == "target").expect("target");
        assert_eq!(target.proxy_jump.as_deref(), Some("bastion"));
    }

    #[test]
    fn ssh_config_import_creates_updates_and_links_jump_hosts() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        init_db(&conn).expect("init db");
        let path = write_temp_ssh_config(
            "Host bastion
  HostName 10.0.0.1
  User ops

Host target
  HostName 10.0.0.9
  User root
  ProxyJump bastion
",
        );

        let preview = build_ssh_config_preview(&conn, &path).expect("preview");
        assert!(preview.entries.iter().all(|entry| entry.state == "new"));

        let report = import_ssh_config_entries(
            &conn,
            &path,
            &["bastion".to_string(), "target".to_string()],
        )
        .expect("import");
        assert_eq!(report.imported, 2);

        let hosts = load_hosts_from_db(&conn).expect("load hosts");
        let bastion = hosts.iter().find(|host| host.label == "bastion").expect("bastion host");
        let target = hosts.iter().find(|host| host.label == "target").expect("target host");
        assert_eq!(target.jump_host_id.as_deref(), Some(bastion.id.as_str()));

        let preview = build_ssh_config_preview(&conn, &path).expect("preview after import");
        assert!(
            preview.entries.iter().all(|entry| entry.state == "unchanged"),
            "unexpected preview: {preview:?}"
        );

        fs::write(
            &path,
            "Host bastion
  HostName 10.0.0.1
  User ops

Host target
  HostName 10.0.0.42
  User root
  ProxyJump bastion
",
        )
        .expect("rewrite config");
        let preview = build_ssh_config_preview(&conn, &path).expect("preview after edit");
        let target_entry = preview.entries.iter().find(|entry| entry.alias == "target").expect("target entry");
        assert_eq!(target_entry.state, "updated");

        let report = import_ssh_config_entries(&conn, &path, &["target".to_string()]).expect("second import");
        assert_eq!(report.updated, 1);

        let hosts = load_hosts_from_db(&conn).expect("load hosts");
        let target = hosts.iter().find(|host| host.label == "target").expect("target host");
        assert_eq!(target.address, "10.0.0.42");

        fs::remove_file(&path).ok();
    }

    // author: BrianXiong
    // time: 2026/10/18/01:00:00
    #[test]
    fn parse_known_hosts_listing_reads_entries() {
        let listing = "2048 SHA256:abc123 1.2.3.4,5.6.7.8 (RSA)\n256 SHA256:def456 [10.0.0.9]:2222 (ED25519)\n|1|salt|hash SHA256:ghi789 |1|salt|hash (ED25519)\n";
        let entries = parse_known_hosts_listing(listing);

        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].host, "1.2.3.4,5.6.7.8");
        assert_eq!(entries[0].fingerprint, "SHA256:abc123");
        assert_eq!(entries[0].bits, "2048");
        assert_eq!(entries[0].key_type, "RSA");
        assert_eq!(entries[1].host, "[10.0.0.9]:2222");
        assert_eq!(entries[2].host, "|1|salt|hash");
    }

    #[test]
    fn remove_known_host_entries_drops_matching_lines() {
        let path = std::env::temp_dir().join(format!("serverdeck-known-hosts-{}", Uuid::new_v4()));
        fs::write(
            &path,
            "1.2.3.4 ssh-rsa AAAA\n[10.0.0.9]:2222 ssh-ed25519 BBBB\n|1|salt|hash ssh-ed25519 CCCC\n",
        )
        .expect("write known hosts");

        assert!(remove_known_host_entries(&path, "1.2.3.4").expect("remove plain"));
        assert!(remove_known_host_entries(&path, "|1|salt|hash").expect("remove hashed"));
        assert!(!remove_known_host_entries(&path, "9.9.9.9").expect("no match"));

        let remaining = fs::read_to_string(&path).expect("read known hosts");
        assert!(!remaining.contains("1.2.3.4"));
        assert!(!remaining.contains("|1|salt|hash"));
        assert!(remaining.contains("[10.0.0.9]:2222"));

        fs::remove_file(&path).ok();
    }
}
