use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::{
    expand_path, file_entries_from_dir, now_millis_i64, open_db, AiProviderRecord, FileEntry,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSessionRecord {
    id: String,
    project_id: String,
    title: String,
    goal: String,
    status: String,
    provider_id: String,
    model: String,
    root_path: String,
    created_at: i64,
    updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentMessageRecord {
    id: String,
    session_id: String,
    role: String,
    content: String,
    created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSessionCreateRequest {
    project_id: String,
    root_path: String,
    provider_id: String,
    model: String,
    goal: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentTurnRequest {
    session_id: String,
    provider_id: Option<String>,
    model: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSessionDetailPayload {
    session: AgentSessionRecord,
    messages: Vec<AgentMessageRecord>,
    plan_items: Vec<AgentPlanItemRecord>,
    tool_calls: Vec<AgentToolCallRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentPlanItemRecord {
    id: String,
    session_id: String,
    title: String,
    status: String,
    position: i64,
    created_at: i64,
    updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentToolCallRecord {
    id: String,
    session_id: String,
    tool_name: String,
    arguments_summary: String,
    result_summary: String,
    status: String,
    created_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentStreamEventPayload {
    session_id: String,
    phase: String,
    message_id: String,
    created_at: i64,
    delta: Option<String>,
    content: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentListDirRequest {
    session_id: String,
    path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSearchRequest {
    session_id: String,
    query: String,
    path: Option<String>,
    max_results: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentReadFileRequest {
    session_id: String,
    path: String,
    start_line: Option<usize>,
    line_count: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentProjectContextPayload {
    root_path: String,
    top_level_entries: Vec<FileEntry>,
    key_files: Vec<String>,
    summary: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSearchMatchPayload {
    path: String,
    line: usize,
    snippet: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentFileReadPayload {
    path: String,
    content: String,
    truncated: bool,
    start_line: usize,
    end_line: usize,
    total_lines: usize,
}

fn build_agent_session_title(goal: &str) -> String {
    let trimmed = goal.trim();
    if trimmed.is_empty() {
        return "New Agent Session".to_string();
    }

    let mut title = trimmed.chars().take(48).collect::<String>();
    if trimmed.chars().count() > 48 {
        title.push('…');
    }
    title
}

fn load_agent_sessions_from_db(conn: &Connection) -> Result<Vec<AgentSessionRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, title, goal, status, provider_id, model, root_path, created_at, updated_at FROM agent_sessions ORDER BY updated_at DESC, created_at DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(AgentSessionRecord {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                goal: row.get(3)?,
                status: row.get(4)?,
                provider_id: row.get(5)?,
                model: row.get(6)?,
                root_path: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

// author: BrianXiong
// time: 2026/04/08/16:24:00
fn load_agent_session_by_id(conn: &Connection, session_id: &str) -> Result<AgentSessionRecord, String> {
    conn.query_row(
        "SELECT id, project_id, title, goal, status, provider_id, model, root_path, created_at, updated_at FROM agent_sessions WHERE id = ?1",
        params![session_id],
        |row| {
            Ok(AgentSessionRecord {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                goal: row.get(3)?,
                status: row.get(4)?,
                provider_id: row.get(5)?,
                model: row.get(6)?,
                root_path: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .optional()
    .map_err(|error| error.to_string())?
    .ok_or_else(|| "Agent session not found".to_string())
}

// author: BrianXiong
// time: 2026/04/08/16:24:00
fn load_agent_messages_from_db(conn: &Connection, session_id: &str) -> Result<Vec<AgentMessageRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, role, content, created_at FROM agent_messages WHERE session_id = ?1 ORDER BY created_at, id",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(AgentMessageRecord {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

// author: BrianXiong
// time: 2026/04/08/16:24:00
fn build_agent_session_detail(conn: &Connection, session_id: &str) -> Result<AgentSessionDetailPayload, String> {
    Ok(AgentSessionDetailPayload {
        session: load_agent_session_by_id(conn, session_id)?,
        messages: load_agent_messages_from_db(conn, session_id)?,
        plan_items: load_agent_plan_items_from_db(conn, session_id)?,
        tool_calls: load_agent_tool_calls_from_db(conn, session_id)?,
    })
}

// author: BrianXiong
// time: 2026/04/09/11:10:00
fn load_agent_plan_items_from_db(conn: &Connection, session_id: &str) -> Result<Vec<AgentPlanItemRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, title, status, position, created_at, updated_at FROM agent_plan_items WHERE session_id = ?1 ORDER BY position, created_at, id",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(AgentPlanItemRecord {
                id: row.get(0)?,
                session_id: row.get(1)?,
                title: row.get(2)?,
                status: row.get(3)?,
                position: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

// author: BrianXiong
// time: 2026/04/09/11:10:00
fn load_agent_tool_calls_from_db(conn: &Connection, session_id: &str) -> Result<Vec<AgentToolCallRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, tool_name, arguments_summary, result_summary, status, created_at FROM agent_tool_calls WHERE session_id = ?1 ORDER BY created_at, id",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(AgentToolCallRecord {
                id: row.get(0)?,
                session_id: row.get(1)?,
                tool_name: row.get(2)?,
                arguments_summary: row.get(3)?,
                result_summary: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn load_ai_provider_by_id(conn: &Connection, provider_id: &str) -> Result<AiProviderRecord, String> {
    conn.query_row(
        "SELECT id, name, provider_type, base_url, api_key, model, available_models_json, enabled_models_json, enabled, is_default FROM ai_providers WHERE id = ?1",
        params![provider_id],
        |row| {
            let available_models_json: String = row.get(6)?;
            let enabled_models_json: String = row.get(7)?;
            Ok(AiProviderRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                provider_type: row.get(2)?,
                base_url: row.get(3)?,
                api_key: row.get(4)?,
                model: row.get(5)?,
                available_models: serde_json::from_str(&available_models_json).unwrap_or_default(),
                enabled_models: serde_json::from_str(&enabled_models_json).unwrap_or_default(),
                enabled: row.get(8)?,
                is_default: row.get(9)?,
            })
        },
    )
    .optional()
    .map_err(|error| error.to_string())?
    .ok_or_else(|| "AI Provider not found".to_string())
}

fn validate_agent_root_path(root_path: &str) -> Result<String, String> {
    let trimmed = root_path.trim();
    if trimmed.is_empty() {
        return Err("Agent project path is required".to_string());
    }

    let resolved = expand_path(trimmed);
    if !resolved.is_dir() {
        return Err(format!("Agent project path not found: {}", resolved.display()));
    }

    Ok(resolved.display().to_string())
}

// author: BrianXiong
// time: 2026/04/09/09:30:00
fn load_agent_session_root_path(conn: &Connection, session_id: &str) -> Result<PathBuf, String> {
    let session = load_agent_session_by_id(conn, session_id)?;
    let root = PathBuf::from(validate_agent_root_path(&session.root_path)?);
    root.canonicalize().map_err(|error| error.to_string())
}

// author: BrianXiong
// time: 2026/04/09/09:30:00
fn resolve_agent_scoped_path(root: &Path, input_path: &str) -> Result<PathBuf, String> {
    let trimmed = input_path.trim();
    let candidate = if trimmed.is_empty() || trimmed == "." {
        root.to_path_buf()
    } else {
        let raw = PathBuf::from(trimmed);
        if raw.is_absolute() {
            raw
        } else {
            root.join(raw)
        }
    };

    let resolved = candidate.canonicalize().map_err(|error| error.to_string())?;
    if !resolved.starts_with(root) {
        return Err("Agent path is outside the project scope".to_string());
    }

    Ok(resolved)
}

// author: BrianXiong
// time: 2026/04/09/09:30:00
fn agent_relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .map(|value| {
            let text = value.display().to_string();
            if text.is_empty() {
                ".".to_string()
            } else {
                text
            }
        })
        .unwrap_or_else(|_| path.display().to_string())
}

// author: BrianXiong
// time: 2026/04/09/09:30:00
fn should_skip_agent_dir(name: &str) -> bool {
    matches!(name, ".git" | "node_modules" | "target" | "dist" | "build" | ".next" | ".turbo" | "coverage")
}

// author: BrianXiong
// time: 2026/04/09/09:30:00
fn collect_agent_key_files(root: &Path) -> Vec<String> {
    [
        "README.md",
        "README",
        "package.json",
        "Cargo.toml",
        "tsconfig.json",
        "vite.config.ts",
        "vite.config.js",
        "src-tauri/Cargo.toml",
    ]
    .into_iter()
    .filter_map(|relative| {
        let path = root.join(relative);
        if path.is_file() {
            Some(relative.to_string())
        } else {
            None
        }
    })
    .collect()
}

// author: BrianXiong
// time: 2026/04/09/09:30:00
fn build_agent_project_context(root: &Path) -> Result<AgentProjectContextPayload, String> {
    let mut top_level_entries = file_entries_from_dir(root)?;
    top_level_entries.truncate(24);
    let key_files = collect_agent_key_files(root);
    let directory_count = top_level_entries.iter().filter(|entry| entry.is_dir).count();
    let file_count = top_level_entries.len().saturating_sub(directory_count);

    Ok(AgentProjectContextPayload {
        root_path: root.display().to_string(),
        top_level_entries,
        key_files: key_files.clone(),
        summary: format!(
            "Project root: {}. Top-level entries: {} directories, {} files. Key files: {}.",
            root.display(),
            directory_count,
            file_count,
            if key_files.is_empty() {
                "none detected".to_string()
            } else {
                key_files.join(", ")
            }
        ),
    })
}

// author: BrianXiong
// time: 2026/04/09/09:30:00
fn search_agent_files_recursive(
    root: &Path,
    current_dir: &Path,
    query_lower: &str,
    max_results: usize,
    results: &mut Vec<AgentSearchMatchPayload>,
) -> Result<(), String> {
    if results.len() >= max_results {
        return Ok(());
    }

    let entries = fs::read_dir(current_dir).map_err(|error| error.to_string())?;
    for entry in entries {
        if results.len() >= max_results {
            break;
        }

        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();

        if file_type.is_dir() {
            if should_skip_agent_dir(&name) {
                continue;
            }

            search_agent_files_recursive(root, &path, query_lower, max_results, results)?;
            continue;
        }

        if !file_type.is_file() {
            continue;
        }

        let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
        if metadata.len() > 512 * 1024 {
            continue;
        }

        let content = match fs::read_to_string(&path) {
            Ok(value) => value,
            Err(_) => continue,
        };

        for (index, line) in content.lines().enumerate() {
            let is_match = if query_lower.is_empty() {
                false
            } else {
                line.to_lowercase().contains(query_lower)
            };

            if !is_match {
                continue;
            }

            results.push(AgentSearchMatchPayload {
                path: agent_relative_path(root, &path),
                line: index + 1,
                snippet: line.trim().to_string(),
            });

            if results.len() >= max_results {
                break;
            }
        }
    }

    Ok(())
}

// author: BrianXiong
// time: 2026/04/09/09:30:00
fn search_agent_files(
    root: &Path,
    base_path: &Path,
    query: &str,
    max_results: usize,
) -> Result<Vec<AgentSearchMatchPayload>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Err("Search query is required".to_string());
    }

    let mut results = Vec::new();
    search_agent_files_recursive(
        root,
        base_path,
        &trimmed.to_lowercase(),
        max_results.max(1).min(50),
        &mut results,
    )?;
    Ok(results)
}

// author: BrianXiong
// time: 2026/04/09/09:30:00
fn read_agent_file(
    root: &Path,
    path: &Path,
    start_line: Option<usize>,
    line_count: Option<usize>,
) -> Result<AgentFileReadPayload, String> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    if !metadata.is_file() {
        return Err("Agent read_file expects a file path".to_string());
    }

    if metadata.len() > 512 * 1024 {
        return Err("File is too large for agent read_file".to_string());
    }

    let content = fs::read_to_string(path).map_err(|_| "File is not readable as UTF-8 text".to_string())?;
    let lines = content.lines().collect::<Vec<_>>();
    let total_lines = lines.len();
    let start = start_line.unwrap_or(1).max(1);
    let count = line_count.unwrap_or(160).max(1).min(300);
    let start_index = start.saturating_sub(1).min(total_lines);
    let end_index = start_index.saturating_add(count).min(total_lines);
    let sliced = lines[start_index..end_index].join("\n");

    Ok(AgentFileReadPayload {
        path: agent_relative_path(root, path),
        content: sliced,
        truncated: end_index < total_lines,
        start_line: if total_lines == 0 { 0 } else { start_index + 1 },
        end_line: end_index,
        total_lines,
    })
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

fn default_ai_provider_base_url(provider_type: &str) -> &str {
    match provider_type {
        "openai" => "https://api.openai.com/v1",
        "anthropic" => "https://api.anthropic.com/v1",
        "openrouter" => "https://openrouter.ai/api/v1",
        "gemini" => "https://generativelanguage.googleapis.com/v1beta",
        _ => "",
    }
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
fn emit_agent_stream_event(app: &AppHandle, payload: AgentStreamEventPayload) {
    eprintln!(
        "[AGENT] emit event session={} phase={} message={} created_at={} delta_len={} has_content={} has_error={}",
        payload.session_id,
        payload.phase,
        payload.message_id,
        payload.created_at,
        payload.delta.as_ref().map(|value| value.len()).unwrap_or(0),
        payload.content.as_ref().map(|value| !value.is_empty()).unwrap_or(false),
        payload.error.as_ref().map(|value| !value.is_empty()).unwrap_or(false)
    );
    let _ = app.emit("agent-stream", payload);
}

// author: BrianXiong
// time: 2026/04/08/19:58:00
fn preview_log_text(value: &str, limit: usize) -> String {
    let mut preview = value.chars().take(limit).collect::<String>();
    if value.chars().count() > limit {
        preview.push('…');
    }
    preview.replace('\n', "\\n")
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
fn update_agent_session_status(conn: &Connection, session_id: &str, status: &str, updated_at: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE agent_sessions SET status = ?2, updated_at = ?3 WHERE id = ?1",
        params![session_id, status, updated_at],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

// author: BrianXiong
// time: 2026/04/08/20:06:00
fn update_agent_session_provider_model(
    conn: &Connection,
    session_id: &str,
    provider_id: &str,
    model: &str,
    updated_at: i64,
) -> Result<(), String> {
    conn.execute(
        "UPDATE agent_sessions SET provider_id = ?2, model = ?3, updated_at = ?4 WHERE id = ?1",
        params![session_id, provider_id, model, updated_at],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
fn insert_agent_message(conn: &Connection, message: &AgentMessageRecord) -> Result<(), String> {
    conn.execute(
        "INSERT INTO agent_messages (id, session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![message.id, message.session_id, message.role, message.content, message.created_at],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

// author: BrianXiong
// time: 2026/04/09/11:10:00
fn replace_agent_plan_items(conn: &Connection, session_id: &str, items: &[AgentPlanItemRecord]) -> Result<(), String> {
    conn.execute("DELETE FROM agent_plan_items WHERE session_id = ?1", params![session_id])
        .map_err(|error| error.to_string())?;

    for item in items {
        conn.execute(
            "INSERT INTO agent_plan_items (id, session_id, title, status, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                item.id,
                item.session_id,
                item.title,
                item.status,
                item.position,
                item.created_at,
                item.updated_at,
            ],
        )
        .map_err(|error| error.to_string())?;
    }

    Ok(())
}

// author: BrianXiong
// time: 2026/04/09/11:10:00
fn append_agent_tool_call(conn: &Connection, call: &AgentToolCallRecord) -> Result<(), String> {
    conn.execute(
        "INSERT INTO agent_tool_calls (id, session_id, tool_name, arguments_summary, result_summary, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            call.id,
            call.session_id,
            call.tool_name,
            call.arguments_summary,
            call.result_summary,
            call.status,
            call.created_at,
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

// author: BrianXiong
// time: 2026/04/09/11:10:00
fn append_agent_tool_log(
    conn: &Connection,
    session_id: &str,
    tool_name: &str,
    arguments_summary: &str,
    result_summary: &str,
    status: &str,
) -> Result<(), String> {
    let created_at = now_millis_i64();

    // Insert into agent_tool_calls table
    append_agent_tool_call(
        conn,
        &AgentToolCallRecord {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.to_string(),
            tool_name: tool_name.to_string(),
            arguments_summary: arguments_summary.to_string(),
            result_summary: result_summary.to_string(),
            status: status.to_string(),
            created_at,
        },
    )?;

    // Also insert as a tool message for inline display in conversation
    let tool_message_content = format!(
        "{}\nArguments: {}\nResult: {}",
        tool_name,
        arguments_summary,
        result_summary
    );
    insert_agent_message(
        conn,
        &AgentMessageRecord {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.to_string(),
            role: "tool".to_string(),
            content: tool_message_content,
            created_at,
        },
    )
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
fn build_agent_system_prompt(session: &AgentSessionRecord, runtime_context: &str) -> String {
    format!(
        "You are ServerDeck's project-scoped AI assistant. The current project root is: {}. This phase supports read-only project inspection. You must answer with concrete findings from the provided context and must not say that you will inspect later if the context already includes the inspection results. Respond in concise Markdown.\n\nProject inspection context:\n{}",
        session.root_path,
        runtime_context
    )
}

// author: BrianXiong
// time: 2026/04/09/10:45:00
fn latest_user_message<'a>(messages: &'a [AgentMessageRecord], session: &'a AgentSessionRecord) -> &'a str {
    messages
        .iter()
        .rev()
        .find(|message| message.role == "user")
        .map(|message| message.content.as_str())
        .unwrap_or(session.goal.as_str())
}

// author: BrianXiong
// time: 2026/04/09/10:45:00
fn looks_like_structure_request(message: &str) -> bool {
    let lower = message.to_lowercase();
    ["结构", "目录", "项目结构", "文件结构", "tree", "structure", "folder", "目录树", "看下结构"]
        .iter()
        .any(|keyword| lower.contains(keyword))
}

// author: BrianXiong
// time: 2026/04/09/10:45:00
fn format_agent_entries(root: &Path, entries: &[FileEntry]) -> String {
    entries
        .iter()
        .map(|entry| {
            let path = PathBuf::from(&entry.path);
            let relative = agent_relative_path(root, &path);
            if entry.is_dir {
                format!("- [dir] {}", relative)
            } else {
                format!("- [file] {}", relative)
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

// author: BrianXiong
// time: 2026/04/09/10:45:00
fn extract_search_query(message: &str) -> Option<String> {
    for delimiter in ['`', '"', '“', '”', '\'', '‘', '’'] {
        let parts = message.split(delimiter).collect::<Vec<_>>();
        if parts.len() >= 3 {
            let candidate = parts[1].trim();
            if !candidate.is_empty() {
                return Some(candidate.to_string());
            }
        }
    }

    None
}

// author: BrianXiong
// time: 2026/04/09/11:10:00
fn build_agent_plan_items(session: &AgentSessionRecord, latest_message: &str, search_query: Option<&str>) -> Vec<AgentPlanItemRecord> {
    let created_at = now_millis_i64();
    let mut items = vec![AgentPlanItemRecord {
        id: Uuid::new_v4().to_string(),
        session_id: session.id.clone(),
        title: "Review project context and key files".to_string(),
        status: "completed".to_string(),
        position: 0,
        created_at,
        updated_at: created_at,
    }];

    if looks_like_structure_request(latest_message) {
        items.push(AgentPlanItemRecord {
            id: Uuid::new_v4().to_string(),
            session_id: session.id.clone(),
            title: "Inspect top-level project structure".to_string(),
            status: "completed".to_string(),
            position: 1,
            created_at,
            updated_at: created_at,
        });
    }

    if let Some(query) = search_query {
        items.push(AgentPlanItemRecord {
            id: Uuid::new_v4().to_string(),
            session_id: session.id.clone(),
            title: format!("Search project files for `{}`", query),
            status: "completed".to_string(),
            position: items.len() as i64,
            created_at,
            updated_at: created_at,
        });
    }

    items.push(AgentPlanItemRecord {
        id: Uuid::new_v4().to_string(),
        session_id: session.id.clone(),
        title: "Summarize findings for the user".to_string(),
        status: "in_progress".to_string(),
        position: items.len() as i64,
        created_at,
        updated_at: created_at,
    });

    items
}

struct AgentTurnArtifacts {
    runtime_context: String,
    plan_items: Vec<AgentPlanItemRecord>,
}

// author: BrianXiong
// time: 2026/04/09/11:10:00
fn with_final_plan_status(items: &[AgentPlanItemRecord], status: &str) -> Vec<AgentPlanItemRecord> {
    items
        .iter()
        .enumerate()
        .map(|(index, item)| {
            if index + 1 == items.len() {
                let mut next = item.clone();
                next.status = status.to_string();
                next.updated_at = now_millis_i64();
                next
            } else {
                item.clone()
            }
        })
        .collect()
}

// author: BrianXiong
// time: 2026/04/09/10:45:00
fn build_agent_turn_artifacts(
    conn: &Connection,
    session: &AgentSessionRecord,
    messages: &[AgentMessageRecord],
) -> AgentTurnArtifacts {
    let root = match PathBuf::from(&session.root_path).canonicalize() {
        Ok(path) => path,
        Err(error) => {
            return AgentTurnArtifacts {
                runtime_context: format!("Project root is unavailable: {}", error),
                plan_items: build_agent_plan_items(session, latest_user_message(messages, session), None),
            };
        }
    };

    let latest_message = latest_user_message(messages, session);
    let search_query = extract_search_query(latest_message);
    let plan_items = build_agent_plan_items(session, latest_message, search_query.as_deref());
    let mut sections = Vec::new();

    match build_agent_project_context(&root) {
        Ok(context) => {
            let _ = append_agent_tool_log(
                conn,
                &session.id,
                "get_project_context",
                ".",
                &context.summary,
                "completed",
            );
            sections.push(format!("Summary:\n{}", context.summary));
            if !context.key_files.is_empty() {
                sections.push(format!("Key files:\n- {}", context.key_files.join("\n- ")));
            }

            if looks_like_structure_request(latest_message) {
                let top_level_summary = format_agent_entries(&root, &context.top_level_entries);
                let _ = append_agent_tool_log(
                    conn,
                    &session.id,
                    "list_dir",
                    ".",
                    &format!("{} top-level entries", context.top_level_entries.len()),
                    "completed",
                );
                sections.push(format!(
                    "Top-level structure:\n{}",
                    top_level_summary
                ));
            }
        }
        Err(error) => {
            let _ = append_agent_tool_log(conn, &session.id, "get_project_context", ".", &error, "error");
            sections.push(format!("Project context error:\n{}", error));
        }
    }

    if let Some(query) = search_query.as_deref() {
        match search_agent_files(&root, &root, query, 8) {
            Ok(matches) if !matches.is_empty() => {
                let formatted = matches
                    .iter()
                    .map(|item| format!("- {}:{} -> {}", item.path, item.line, item.snippet))
                    .collect::<Vec<_>>()
                    .join("\n");
                let _ = append_agent_tool_log(
                    conn,
                    &session.id,
                    "search_in_files",
                    query,
                    &format!("{} matches", matches.len()),
                    "completed",
                );
                sections.push(format!("Search results for `{}`:\n{}", query, formatted));
            }
            Ok(_) => {
                let _ = append_agent_tool_log(conn, &session.id, "search_in_files", query, "no matches", "completed");
                sections.push(format!("Search results for `{}`:\n- no matches found", query));
            }
            Err(error) => {
                let _ = append_agent_tool_log(conn, &session.id, "search_in_files", query, &error, "error");
                sections.push(format!("Search error for `{}`:\n{}", query, error));
            }
        }
    }

    AgentTurnArtifacts {
        runtime_context: sections.join("\n\n"),
        plan_items,
    }
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
fn resolve_provider_base_url(provider: &AiProviderRecord) -> Result<String, String> {
    let trimmed = provider.base_url.trim();
    if !trimmed.is_empty() {
        return Ok(trimmed.trim_end_matches('/').to_string());
    }

    let default_url = default_ai_provider_base_url(&provider.provider_type);
    if default_url.is_empty() {
        return Err("Base URL is required for this AI Provider".to_string());
    }

    Ok(default_url.trim_end_matches('/').to_string())
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
fn validate_agent_session_provider(session: &AgentSessionRecord, provider: &AiProviderRecord) -> Result<(), String> {
    if session.provider_id.trim().is_empty() || session.model.trim().is_empty() {
        return Err("Select an AI model before starting the agent session".to_string());
    }

    if provider.api_key.trim().is_empty() {
        return Err("The selected AI Provider is missing an API key".to_string());
    }

    Ok(())
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
fn parse_openai_like_delta(json: &serde_json::Value) -> Option<String> {
    json.get("choices")
        .and_then(|value| value.as_array())
        .and_then(|items| items.first())
        .and_then(|item| item.get("delta"))
        .and_then(|delta| delta.get("content"))
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
}

// author: BrianXiong
// time: 2026/04/08/19:45:00
fn parse_openai_like_response(json: &serde_json::Value) -> Option<String> {
    if let Some(content) = json
        .get("choices")
        .and_then(|value| value.as_array())
        .and_then(|items| items.first())
        .and_then(|item| item.get("message"))
        .and_then(|message| message.get("content"))
    {
        if let Some(text) = content.as_str() {
            return Some(text.to_string());
        }

        if let Some(parts) = content.as_array() {
            let text = parts
                .iter()
                .filter_map(|part| part.get("text").and_then(|value| value.as_str()))
                .collect::<String>();
            if !text.is_empty() {
                return Some(text);
            }
        }
    }

    None
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
fn parse_anthropic_delta(json: &serde_json::Value) -> Option<String> {
    if json.get("type").and_then(|value| value.as_str()) != Some("content_block_delta") {
        return None;
    }

    json.get("delta")
        .and_then(|value| value.get("text"))
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
}

// author: BrianXiong
// time: 2026/04/08/19:45:00
fn parse_anthropic_response(json: &serde_json::Value) -> Option<String> {
    json.get("content")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("text").and_then(|value| value.as_str()))
                .collect::<String>()
        })
        .filter(|text| !text.is_empty())
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
fn parse_gemini_delta(json: &serde_json::Value) -> Option<String> {
    let texts = json
        .get("candidates")
        .and_then(|value| value.as_array())
        .and_then(|items| items.first())
        .and_then(|item| item.get("content"))
        .and_then(|value| value.get("parts"))
        .and_then(|value| value.as_array())
        .map(|parts| {
            parts
                .iter()
                .filter_map(|part| part.get("text").and_then(|value| value.as_str()))
                .collect::<String>()
        })
        .unwrap_or_default();

    if texts.is_empty() {
        None
    } else {
        Some(texts)
    }
}

// author: BrianXiong
// time: 2026/04/08/19:45:00
fn parse_error_response(json: &serde_json::Value) -> Option<String> {
    if let Some(message) = json
        .get("error")
        .and_then(|value| value.get("message").or(Some(value)))
        .and_then(|value| value.as_str())
    {
        return Some(message.to_string());
    }

    json.get("message")
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
fn collect_stream_from_curl<F>(
    mut command: Command,
    app: &AppHandle,
    session_id: &str,
    message_id: &str,
    created_at: i64,
    request_label: &str,
    mut parse_delta: F,
    parse_response: fn(&serde_json::Value) -> Option<String>,
) -> Result<String, String>
where
    F: FnMut(&serde_json::Value) -> Option<String>,
{
    eprintln!(
        "[AGENT] starting curl stream session={} message={} request={}",
        session_id, message_id, request_label
    );
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let stdout = child.stdout.take().ok_or_else(|| "Failed to capture stream output".to_string())?;
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    let mut collected = String::new();
    let mut raw_output = String::new();
    let mut saw_sse_payload = false;

    emit_agent_stream_event(
        app,
        AgentStreamEventPayload {
            session_id: session_id.to_string(),
            phase: "start".to_string(),
            message_id: message_id.to_string(),
            created_at,
            delta: None,
            content: None,
            error: None,
        },
    );

    loop {
        line.clear();
        let bytes_read = reader.read_line(&mut line).map_err(|error| error.to_string())?;
        if bytes_read == 0 {
            break;
        }

        raw_output.push_str(&line);

        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with(':') || trimmed.starts_with("event:") {
            continue;
        }

        if !trimmed.starts_with("data:") {
            continue;
        }

        let payload = trimmed.trim_start_matches("data:").trim();
        if payload == "[DONE]" {
            eprintln!("[AGENT] received DONE marker session={} request={}", session_id, request_label);
            break;
        }

        saw_sse_payload = true;
        eprintln!(
            "[AGENT] received sse payload session={} request={} payload_preview={}",
            session_id,
            request_label,
            preview_log_text(payload, 220)
        );

        let json: serde_json::Value = serde_json::from_str(payload).map_err(|error| error.to_string())?;
        if let Some(error) = parse_error_response(&json) {
            eprintln!("[AGENT] parsed error payload session={} request={} error={}", session_id, request_label, error);
            return Err(error);
        }

        if let Some(delta) = parse_delta(&json) {
            if delta.is_empty() {
                continue;
            }

            collected.push_str(&delta);
            eprintln!(
                "[AGENT] parsed delta session={} request={} delta_len={} total_len={}",
                session_id,
                request_label,
                delta.len(),
                collected.len()
            );
            emit_agent_stream_event(
                app,
                AgentStreamEventPayload {
                    session_id: session_id.to_string(),
                    phase: "delta".to_string(),
                    message_id: message_id.to_string(),
                    created_at,
                    delta: Some(delta),
                    content: None,
                    error: None,
                },
            );
        }
    }

    let mut stderr_output = String::new();
    if let Some(mut stderr) = child.stderr.take() {
        stderr.read_to_string(&mut stderr_output).map_err(|error| error.to_string())?;
    }

    let status = child.wait().map_err(|error| error.to_string())?;
    eprintln!(
        "[AGENT] curl finished session={} request={} success={} saw_sse={} raw_len={} stderr_len={} collected_len={}",
        session_id,
        request_label,
        status.success(),
        saw_sse_payload,
        raw_output.len(),
        stderr_output.len(),
        collected.len()
    );
    if !status.success() {
        let detail = stderr_output.trim().to_string();
        eprintln!(
            "[AGENT] curl failure session={} request={} stderr_preview={}",
            session_id,
            request_label,
            preview_log_text(&detail, 220)
        );
        return Err(if detail.is_empty() { "Agent request failed".to_string() } else { detail });
    }

    if !saw_sse_payload {
        let trimmed = raw_output.trim();
        if !trimmed.is_empty() {
            eprintln!(
                "[AGENT] non-sse response session={} request={} body_preview={}",
                session_id,
                request_label,
                preview_log_text(trimmed, 220)
            );
            let json: serde_json::Value = serde_json::from_str(trimmed).map_err(|error| error.to_string())?;
            if let Some(error) = parse_error_response(&json) {
                eprintln!("[AGENT] parsed non-sse error session={} request={} error={}", session_id, request_label, error);
                return Err(error);
            }

            if let Some(content) = parse_response(&json) {
                if !content.is_empty() {
                    eprintln!(
                        "[AGENT] parsed non-sse content session={} request={} content_len={}",
                        session_id,
                        request_label,
                        content.len()
                    );
                    emit_agent_stream_event(
                        app,
                        AgentStreamEventPayload {
                            session_id: session_id.to_string(),
                            phase: "delta".to_string(),
                            message_id: message_id.to_string(),
                            created_at,
                            delta: Some(content.clone()),
                            content: None,
                            error: None,
                        },
                    );
                    return Ok(content);
                }
            }
        }
    }

    eprintln!(
        "[AGENT] returning collected content session={} request={} content_len={}",
        session_id,
        request_label,
        collected.len()
    );
    Ok(collected)
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
fn stream_openai_compatible_completion(
    app: &AppHandle,
    session: &AgentSessionRecord,
    provider: &AiProviderRecord,
    messages: &[AgentMessageRecord],
    system_prompt: &str,
    message_id: &str,
    created_at: i64,
) -> Result<String, String> {
    let base_url = resolve_provider_base_url(provider)?;
    let url = if provider.provider_type == "azure-openai" {
        format!(
            "{}/openai/deployments/{}/chat/completions?api-version=2024-02-01",
            base_url,
            session.model
        )
    } else {
        format!("{}/chat/completions", base_url)
    };

    let prompt_messages = std::iter::once(serde_json::json!({
        "role": "system",
        "content": system_prompt,
    }))
    .chain(messages.iter().map(|message| {
        serde_json::json!({
            "role": message.role,
            "content": message.content,
        })
    }))
    .collect::<Vec<_>>();

    let body = serde_json::json!({
        "model": session.model,
        "stream": true,
        "messages": prompt_messages,
    });

    let mut command = Command::new(resolve_binary("curl")?);
    command
        .arg("-sS")
        .arg("-N")
        .arg("-X")
        .arg("POST")
        .arg(url)
        .arg("-H")
        .arg("Content-Type: application/json")
        .arg("-d")
        .arg(body.to_string());

    if provider.provider_type == "azure-openai" {
        command.arg("-H").arg(format!("api-key: {}", provider.api_key.trim()));
    } else {
        command.arg("-H").arg(format!("Authorization: Bearer {}", provider.api_key.trim()));
    }

    collect_stream_from_curl(
        command,
        app,
        &session.id,
        message_id,
        created_at,
        &format!("{}:{}", provider.provider_type, session.model),
        parse_openai_like_delta,
        parse_openai_like_response,
    )
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
fn stream_anthropic_completion(
    app: &AppHandle,
    session: &AgentSessionRecord,
    provider: &AiProviderRecord,
    messages: &[AgentMessageRecord],
    system_prompt: &str,
    message_id: &str,
    created_at: i64,
) -> Result<String, String> {
    let base_url = resolve_provider_base_url(provider)?;
    let url = format!("{}/messages", base_url);
    let prompt_messages = messages
        .iter()
        .filter(|message| message.role == "user" || message.role == "assistant")
        .map(|message| {
            serde_json::json!({
                "role": message.role,
                "content": [{
                    "type": "text",
                    "text": message.content,
                }],
            })
        })
        .collect::<Vec<_>>();
    let body = serde_json::json!({
        "model": session.model,
        "stream": true,
        "max_tokens": 4096,
        "system": system_prompt,
        "messages": prompt_messages,
    });

    let mut command = Command::new(resolve_binary("curl")?);
    command
        .arg("-sS")
        .arg("-N")
        .arg("-X")
        .arg("POST")
        .arg(url)
        .arg("-H")
        .arg("Content-Type: application/json")
        .arg("-H")
        .arg(format!("x-api-key: {}", provider.api_key.trim()))
        .arg("-H")
        .arg("anthropic-version: 2023-06-01")
        .arg("-d")
        .arg(body.to_string());

    collect_stream_from_curl(
        command,
        app,
        &session.id,
        message_id,
        created_at,
        &format!("{}:{}", provider.provider_type, session.model),
        parse_anthropic_delta,
        parse_anthropic_response,
    )
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
fn stream_gemini_completion(
    app: &AppHandle,
    session: &AgentSessionRecord,
    provider: &AiProviderRecord,
    messages: &[AgentMessageRecord],
    system_prompt: &str,
    message_id: &str,
    created_at: i64,
) -> Result<String, String> {
    let base_url = resolve_provider_base_url(provider)?;
    let url = format!(
        "{}/models/{}:streamGenerateContent?alt=sse&key={}",
        base_url,
        session.model,
        provider.api_key.trim()
    );
    let contents = messages
        .iter()
        .filter(|message| message.role == "user" || message.role == "assistant")
        .map(|message| {
            serde_json::json!({
                "role": if message.role == "assistant" { "model" } else { "user" },
                "parts": [{ "text": message.content }],
            })
        })
        .collect::<Vec<_>>();
    let body = serde_json::json!({
        "system_instruction": {
            "parts": [{ "text": system_prompt }],
        },
        "contents": contents,
    });

    let mut command = Command::new(resolve_binary("curl")?);
    command
        .arg("-sS")
        .arg("-N")
        .arg("-X")
        .arg("POST")
        .arg(url)
        .arg("-H")
        .arg("Content-Type: application/json")
        .arg("-d")
        .arg(body.to_string());

    collect_stream_from_curl(
        command,
        app,
        &session.id,
        message_id,
        created_at,
        &format!("{}:{}", provider.provider_type, session.model),
        parse_gemini_delta,
        parse_gemini_delta,
    )
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
fn run_streaming_agent_completion(
    app: &AppHandle,
    session: &AgentSessionRecord,
    provider: &AiProviderRecord,
    messages: &[AgentMessageRecord],
    runtime_context: &str,
    message_id: &str,
    created_at: i64,
) -> Result<String, String> {
    eprintln!(
        "[AGENT] runtime context prepared session={} context_len={}",
        session.id,
        runtime_context.len()
    );
    let system_prompt = build_agent_system_prompt(session, runtime_context);
    match provider.provider_type.as_str() {
        "anthropic" => stream_anthropic_completion(app, session, provider, messages, &system_prompt, message_id, created_at),
        "gemini" => stream_gemini_completion(app, session, provider, messages, &system_prompt, message_id, created_at),
        "openai" | "openrouter" | "custom-openai" | "azure-openai" => {
            stream_openai_compatible_completion(app, session, provider, messages, &system_prompt, message_id, created_at)
        }
        _ => Err("This AI Provider type is not supported yet for Agent streaming".to_string()),
    }
}

#[tauri::command]
pub(crate) fn list_agent_sessions() -> Result<Vec<AgentSessionRecord>, String> {
    let conn = open_db()?;
    load_agent_sessions_from_db(&conn)
}

#[tauri::command]
// author: BrianXiong
// time: 2026/04/08/16:24:00
pub(crate) fn get_agent_session_detail(session_id: String) -> Result<AgentSessionDetailPayload, String> {
    let conn = open_db()?;
    build_agent_session_detail(&conn, &session_id)
}

#[tauri::command]
// author: BrianXiong
// time: 2026/04/08/16:24:00
pub(crate) fn create_agent_session(request: AgentSessionCreateRequest) -> Result<AgentSessionDetailPayload, String> {
    if request.goal.trim().is_empty() {
        return Err("Agent task is required".to_string());
    }

    let root_path = validate_agent_root_path(&request.root_path)?;
    let session_id = Uuid::new_v4().to_string();
    let message_id = Uuid::new_v4().to_string();
    let created_at = now_millis_i64();
    let title = build_agent_session_title(&request.goal);

    let mut conn = open_db()?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    tx.execute(
        "INSERT INTO agent_sessions (id, project_id, title, goal, status, provider_id, model, root_path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            session_id,
            request.project_id.trim(),
            title,
            request.goal.trim(),
            "idle",
            request.provider_id.trim(),
            request.model.trim(),
            root_path,
            created_at,
            created_at,
        ],
    )
    .map_err(|error| error.to_string())?;
    tx.execute(
        "INSERT INTO agent_messages (id, session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![message_id, session_id, "user", request.goal.trim(), created_at],
    )
    .map_err(|error| error.to_string())?;
    tx.commit().map_err(|error| error.to_string())?;

    let conn = open_db()?;
    build_agent_session_detail(&conn, &session_id)
}

#[tauri::command]
// author: BrianXiong
// time: 2026/04/08/16:24:00
pub(crate) fn append_agent_user_message(session_id: String, content: String) -> Result<AgentSessionDetailPayload, String> {
    if content.trim().is_empty() {
        return Err("Agent message is required".to_string());
    }

    let created_at = now_millis_i64();
    let message_id = Uuid::new_v4().to_string();
    let mut conn = open_db()?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    load_agent_session_by_id(&tx, &session_id)?;
    tx.execute(
        "INSERT INTO agent_messages (id, session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![message_id, session_id, "user", content.trim(), created_at],
    )
    .map_err(|error| error.to_string())?;
    tx.execute(
        "UPDATE agent_sessions SET updated_at = ?2 WHERE id = ?1",
        params![session_id, created_at],
    )
    .map_err(|error| error.to_string())?;
    tx.commit().map_err(|error| error.to_string())?;

    let conn = open_db()?;
    build_agent_session_detail(&conn, &session_id)
}

#[tauri::command]
// author: BrianXiong
// time: 2026/04/08/20:22:00
pub(crate) fn delete_agent_session(session_id: String) -> Result<bool, String> {
    let mut conn = open_db()?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM agent_messages WHERE session_id = ?1", params![session_id])
        .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM agent_plan_items WHERE session_id = ?1", params![session_id.clone()])
        .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM agent_tool_calls WHERE session_id = ?1", params![session_id.clone()])
        .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM agent_sessions WHERE id = ?1", params![session_id])
        .map_err(|error| error.to_string())?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
// author: BrianXiong
// time: 2026/04/08/19:20:00
pub(crate) fn run_agent_turn(app: AppHandle, request: AgentTurnRequest) -> Result<bool, String> {
    let conn = open_db()?;
    let mut session = load_agent_session_by_id(&conn, &request.session_id)?;
    eprintln!(
        "[AGENT] run turn requested session={} status={} provider={} model={} root={}",
        session.id,
        session.status,
        session.provider_id,
        session.model,
        session.root_path
    );

    if session.provider_id.trim().is_empty() || session.model.trim().is_empty() {
        let fallback_provider_id = request.provider_id.unwrap_or_default();
        let fallback_model = request.model.unwrap_or_default();
        if fallback_provider_id.trim().is_empty() || fallback_model.trim().is_empty() {
            return Err("Select an AI model before starting the agent session".to_string());
        }

        let updated_at = now_millis_i64();
        update_agent_session_provider_model(&conn, &session.id, fallback_provider_id.trim(), fallback_model.trim(), updated_at)?;
        session.provider_id = fallback_provider_id.trim().to_string();
        session.model = fallback_model.trim().to_string();
        session.updated_at = updated_at;
        eprintln!(
            "[AGENT] applied fallback model binding session={} provider={} model={}",
            session.id,
            session.provider_id,
            session.model
        );
    }

    let provider = load_ai_provider_by_id(&conn, &session.provider_id)?;
    eprintln!(
        "[AGENT] provider loaded session={} provider_type={} provider_name={} base_url_present={} api_key_present={}",
        session.id,
        provider.provider_type,
        provider.name,
        !provider.base_url.trim().is_empty(),
        !provider.api_key.trim().is_empty()
    );
    validate_agent_session_provider(&session, &provider)?;

    let messages = load_agent_messages_from_db(&conn, &session.id)?;
    let artifacts = build_agent_turn_artifacts(&conn, &session, &messages);
    replace_agent_plan_items(&conn, &session.id, &artifacts.plan_items)?;

    if session.status == "streaming" {
        return Err("Agent session is already streaming".to_string());
    }

    let updated_at = now_millis_i64();
    update_agent_session_status(&conn, &session.id, "streaming", updated_at)?;
    let app_handle = app.clone();
    let plan_items = artifacts.plan_items.clone();
    let runtime_context = artifacts.runtime_context;

    std::thread::spawn(move || {
        let message_id = Uuid::new_v4().to_string();
        let created_at = now_millis_i64();
        eprintln!(
            "[AGENT] worker started session={} message={} provider_type={} model={}",
            session.id,
            message_id,
            provider.provider_type,
            session.model
        );
        let result = run_streaming_agent_completion(
            &app_handle,
            &session,
            &provider,
            &messages,
            &runtime_context,
            &message_id,
            created_at,
        );

        match result {
            Ok(content) => {
                eprintln!(
                    "[AGENT] worker success session={} message={} content_len={}",
                    session.id,
                    message_id,
                    content.len()
                );
                if let Ok(conn) = open_db() {
                    let _ = insert_agent_message(
                        &conn,
                        &AgentMessageRecord {
                            id: message_id.clone(),
                            session_id: session.id.clone(),
                            role: "assistant".to_string(),
                            content: content.clone(),
                            created_at,
                        },
                    );
                    let _ = replace_agent_plan_items(&conn, &session.id, &with_final_plan_status(&plan_items, "completed"));
                    let _ = update_agent_session_status(&conn, &session.id, "idle", now_millis_i64());
                }

                emit_agent_stream_event(
                    &app_handle,
                    AgentStreamEventPayload {
                        session_id: session.id.clone(),
                        phase: "done".to_string(),
                        message_id,
                        created_at,
                        delta: None,
                        content: Some(content),
                        error: None,
                    },
                );
            }
            Err(error) => {
                eprintln!(
                    "[AGENT] worker error session={} message={} error={}",
                    session.id,
                    message_id,
                    error
                );
                if let Ok(conn) = open_db() {
                    let _ = insert_agent_message(
                        &conn,
                        &AgentMessageRecord {
                            id: message_id.clone(),
                            session_id: session.id.clone(),
                            role: "assistant".to_string(),
                            content: format!("Request failed:\n\n{}", error),
                            created_at,
                        },
                    );
                    let _ = replace_agent_plan_items(&conn, &session.id, &with_final_plan_status(&plan_items, "pending"));
                    let _ = update_agent_session_status(&conn, &session.id, "error", now_millis_i64());
                }

                emit_agent_stream_event(
                    &app_handle,
                    AgentStreamEventPayload {
                        session_id: session.id.clone(),
                        phase: "error".to_string(),
                        message_id,
                        created_at,
                        delta: None,
                        content: None,
                        error: Some(error),
                    },
                );
            }
        }
    });

    Ok(true)
}

#[tauri::command]
// author: BrianXiong
// time: 2026/04/09/09:30:00
pub(crate) fn agent_get_project_context(session_id: String) -> Result<AgentProjectContextPayload, String> {
    let conn = open_db()?;
    let root = load_agent_session_root_path(&conn, &session_id)?;
    build_agent_project_context(&root)
}

#[tauri::command]
// author: BrianXiong
// time: 2026/04/09/09:30:00
pub(crate) fn agent_list_dir(request: AgentListDirRequest) -> Result<Vec<FileEntry>, String> {
    let conn = open_db()?;
    let root = load_agent_session_root_path(&conn, &request.session_id)?;
    let scoped_path = resolve_agent_scoped_path(&root, &request.path)?;
    if !scoped_path.is_dir() {
        return Err("Agent list_dir expects a directory path".to_string());
    }

    file_entries_from_dir(&scoped_path)
}

#[tauri::command]
// author: BrianXiong
// time: 2026/04/09/09:30:00
pub(crate) fn agent_search_in_files(request: AgentSearchRequest) -> Result<Vec<AgentSearchMatchPayload>, String> {
    let conn = open_db()?;
    let root = load_agent_session_root_path(&conn, &request.session_id)?;
    let base_path = resolve_agent_scoped_path(&root, request.path.as_deref().unwrap_or("."))?;
    if !base_path.is_dir() {
        return Err("Agent search_in_files expects a directory path".to_string());
    }

    search_agent_files(&root, &base_path, &request.query, request.max_results.unwrap_or(20))
}

#[tauri::command]
// author: BrianXiong
// time: 2026/04/09/09:30:00
pub(crate) fn agent_read_file(request: AgentReadFileRequest) -> Result<AgentFileReadPayload, String> {
    let conn = open_db()?;
    let root = load_agent_session_root_path(&conn, &request.session_id)?;
    let scoped_path = resolve_agent_scoped_path(&root, &request.path)?;
    read_agent_file(&root, &scoped_path, request.start_line, request.line_count)
}
