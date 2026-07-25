import { hosts as mockHosts } from "../data/mock";

export type SavedHost = {
  id: string;
  label: string;
  projectId: string;
  address: string;
  port: number;
  username: string;
  authType: "password" | "key";
  password?: string;
  privateKeyPath?: string;
  // author: BrianXiong
  // time: 2026/07/21/00:00:00
  // True when a password is stored in the system keychain for this host.
  // The password itself is never returned to the UI.
  hasPassword?: boolean;
};

export type FileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  is_symlink?: boolean;
  size: number;
  modified: string;
};

export type TerminalEventPayload = {
  sessionId: string;
  data?: string;
  bytes?: number[];
  stream?: "stdout" | "stderr" | "system";
};

// author: BrianXiong
// time: 2026/07/21/00:00:00
export type TerminalExitPayload = {
  sessionId: string;
  exitCode?: number | null;
};

export type TransferUpdatePayload = {
  jobId: string;
  direction: "upload" | "download";
  name: string;
  status: "running" | "success" | "error" | "cancelled";
  detail: string;
  progressPercent?: number;
  transferredBytes?: number;
  totalBytes?: number;
};

export type LocalFilePreview = {
  path: string;
  name: string;
  kind: "text" | "image" | "pdf" | "archive" | "unsupported";
  size: number;
  mimeType?: string;
  text?: string;
  bytes?: number[];
  archiveEntries?: string[];
  truncated?: boolean;
  detail?: string;
};

export type SshConnectionOptions = {
  connectTimeoutSeconds: number;
  serverAliveIntervalSeconds: number;
};

export type ManagedProject = {
  id: string;
  name: string;
  namespace: string;
  path: string;
  projectType: "local" | "server" | "hybrid";
};

export type AiProviderConfig = {
  id: string;
  name: string;
  providerType: "openai" | "anthropic" | "gemini" | "openrouter" | "azure-openai" | "custom-openai";
  baseUrl: string;
  apiKey: string;
  model: string;
  availableModels: string[];
  enabledModels: string[];
  enabled: boolean;
  isDefault: boolean;
};

export type AiProviderImportSuggestion = {
  sourceId: "claude-code" | "codex-cli";
  title: string;
  providerType: AiProviderConfig["providerType"];
  baseUrl: string;
  apiKey: string;
  model: string;
  note: string;
};

// author: BrianXiong
// time: 2026/05/07/23:30:00
export type AiMemoryFile = {
  id: string;
  agentName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  modifiedTime: number;
};

export type AppPreferences = {
  settings: {
    appTheme: "light" | "dark";
    language: string;
    projects: ManagedProject[];
    aiProviders: AiProviderConfig[];
    localTerminalDefaultPath: string;
    sshConnectTimeoutSeconds: number;
    sshServerAliveIntervalSeconds: number;
    terminalThemeId: string;
    terminalFontSize: number;
    terminalCharset: string;
  };
  recentProjectIds: string[];
};

export type AiProviderFetchRequest = Pick<AiProviderConfig, "providerType" | "baseUrl" | "apiKey">;

export type ServerObservation = {
  hostname: string;
  operatingSystem: string;
  uptime: string;
  loadAverage: string;
  cpuCores: string;
  cpuUsage: string;
  memoryUsage: string;
  memoryPercent: string;
  diskUsage: string;
  diskPercent: string;
  networkUsage: string;
  topProcesses: Array<{
    pid: string;
    command: string;
    cpuPercent: number;
    memoryPercent: number;
  }>;
  capturedAt: string;
};

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const STORAGE_KEY = "serverdeck.hosts";
export const DEFAULT_PROJECT_ID = "default";

function normalizeHost(host: Partial<SavedHost> & Pick<SavedHost, "id" | "address" | "port" | "username" | "authType">): SavedHost {
  return {
    id: host.id,
    label: host.label ?? "",
    projectId: typeof host.projectId === "string" && host.projectId.trim() ? host.projectId : DEFAULT_PROJECT_ID,
    address: host.address,
    port: host.port,
    username: host.username,
    authType: host.authType,
    password: host.password,
    privateKeyPath: host.privateKeyPath
  };
}

async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const mod = await import("@tauri-apps/api/core");
  return mod.invoke<T>(command, args);
}

function hasTauri() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

function loadBrowserHosts(): SavedHost[] {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved) {
    return (JSON.parse(saved) as Array<Partial<SavedHost> & Pick<SavedHost, "id" | "address" | "port" | "username" | "authType">>).map(normalizeHost);
  }

  const initial: SavedHost[] = mockHosts.map((item) => ({
    id: item.id,
    label: item.label,
    projectId: DEFAULT_PROJECT_ID,
    address: item.address,
    port: item.port,
    username: item.username,
    authType: "password",
    password: ""
  }));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveBrowserHosts(hosts: SavedHost[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hosts));
}

export async function listHosts() {
  if (hasTauri()) {
    return tauriInvoke<SavedHost[]>("list_hosts");
  }
  return loadBrowserHosts();
}

export async function saveHost(host: SavedHost) {
  if (hasTauri()) {
    return tauriInvoke<SavedHost>("save_host", { host });
  }
  const items = loadBrowserHosts();
  const normalizedHost = normalizeHost(host);
  const existingIndex = items.findIndex((item) => item.id === normalizedHost.id);
  const next = [...items];

  if (existingIndex >= 0) {
    next[existingIndex] = normalizedHost;
  } else {
    next.push({ ...normalizedHost, id: normalizedHost.id || crypto.randomUUID() });
  }

  saveBrowserHosts(next);
  return next[existingIndex >= 0 ? existingIndex : next.length - 1];
}

// author: BrianXiong
// time: 2026/07/21/00:00:00
export async function duplicateHost(id: string, label: string) {
  if (hasTauri()) {
    return tauriInvoke<SavedHost>("duplicate_host", { id, label });
  }

  const items = loadBrowserHosts();
  const source = items.find((item) => item.id === id);
  if (!source) {
    throw new Error("Host not found");
  }

  const duplicated = { ...source, id: crypto.randomUUID(), label };
  saveBrowserHosts([...items, duplicated]);
  return duplicated;
}

export async function deleteHost(id: string) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("delete_host", { id });
  }
  const next = loadBrowserHosts().filter((item) => item.id !== id);
  saveBrowserHosts(next);
  return true;
}

export async function testConnection(host: SavedHost, sshOptions: SshConnectionOptions) {
  if (hasTauri()) {
    return tauriInvoke<string>("test_connection", { host, sshOptions });
  }
  return `Mock connection ok: ${host.username}@${host.address}:${host.port}`;
}

export async function listLocalDirectory(path: string) {
  if (hasTauri()) {
    return tauriInvoke<FileEntry[]>("list_local_directory", { path });
  }
  return [];
}

export async function listRemoteDirectory(host: SavedHost, path: string, sshOptions: SshConnectionOptions) {
  if (hasTauri()) {
    return tauriInvoke<FileEntry[]>("list_remote_directory", { host, path, sshOptions });
  }
  return [];
}

// author: BrianXiong
// time: 2026/07/21/00:00:00
export async function resolveRemotePath(host: SavedHost, path: string, sshOptions: SshConnectionOptions) {
  if (hasTauri()) {
    return tauriInvoke<string>("resolve_remote_path", { host, path, sshOptions });
  }
  return path;
}

// author: BrianXiong
// time: 2026/07/21/00:00:00
export async function openExternalUrl(url: string) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("open_external_url", { url });
  }
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

export async function uploadToRemote(host: SavedHost, localPath: string, remoteDir: string, sshOptions: SshConnectionOptions) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("upload_to_remote", { host, localPath, remoteDir, sshOptions });
  }
  return true;
}

export async function startUploadToRemote(
  host: SavedHost,
  localPath: string,
  remoteDir: string,
  sshOptions: SshConnectionOptions,
  jobId: string
) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("start_upload_to_remote", { host, localPath, remoteDir, sshOptions, jobId });
  }
  return true;
}

export async function cancelUploadToRemote(jobId: string) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("cancel_upload_to_remote", { jobId });
  }
  return true;
}

export async function startDownloadFromRemote(
  host: SavedHost,
  remotePath: string,
  localDir: string,
  isDir: boolean,
  sshOptions: SshConnectionOptions,
  jobId: string
) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("start_download_from_remote", { host, remotePath, localDir, isDir, sshOptions, jobId });
  }
  return true;
}

export async function cancelDownloadFromRemote(jobId: string) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("cancel_download_from_remote", { jobId });
  }
  return true;
}

export async function queryLocalEntrySize(path: string) {
  if (hasTauri()) {
    return tauriInvoke<number>("query_local_entry_size", { path });
  }
  return 0;
}

export async function downloadFromRemote(
  host: SavedHost,
  remotePath: string,
  localDir: string,
  isDir: boolean,
  sshOptions: SshConnectionOptions
) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("download_from_remote", { host, remotePath, localDir, isDir, sshOptions });
  }
  return true;
}

export async function deleteLocalEntry(path: string, isDir: boolean) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("delete_local_entry", { path, isDir });
  }
  return true;
}

export async function deleteRemoteEntry(host: SavedHost, remotePath: string, isDir: boolean, sshOptions: SshConnectionOptions) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("delete_remote_entry", { host, remotePath, isDir, sshOptions });
  }
  return true;
}

export async function clearAppData() {
  if (hasTauri()) {
    return tauriInvoke<boolean>("clear_app_data");
  }
  window.localStorage.removeItem(STORAGE_KEY);
  return true;
}

export async function loadAppPreferences() {
  if (hasTauri()) {
    return tauriInvoke<AppPreferences>("load_app_preferences");
  }

  throw new Error("App preferences require Tauri runtime");
}

export async function saveAppPreferences(payload: AppPreferences) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("save_app_preferences", { payload });
  }

  return true;
}

export async function fetchAiProviderModels(request: AiProviderFetchRequest) {
  if (hasTauri()) {
    return tauriInvoke<string[]>("fetch_ai_provider_models", { request });
  }

  return [];
}

export async function detectAiProviderImports() {
  if (hasTauri()) {
    return tauriInvoke<AiProviderImportSuggestion[]>("detect_ai_provider_imports");
  }

  return [];
}

// author: BrianXiong
// time: 2026/05/07/23:30:00
export async function scanAiMemoryFiles() {
  if (hasTauri()) {
    return tauriInvoke<AiMemoryFile[]>("scan_ai_memory_files");
  }

  return [];
}

// author: BrianXiong
// time: 2026/05/07/23:30:00
export async function readAiMemoryFile(path: string) {
  if (hasTauri()) {
    return tauriInvoke<string>("read_ai_memory_file", { path });
  }

  return "";
}

export async function startTerminalSession(host: SavedHost, sshOptions: SshConnectionOptions) {
  if (hasTauri()) {
    return tauriInvoke<string>("start_terminal_session", { host, sshOptions });
  }
  return crypto.randomUUID();
}

export async function startLocalTerminalSession(cwd?: string) {
  if (hasTauri()) {
    return tauriInvoke<string>("start_local_terminal_session", { cwd });
  }
  return crypto.randomUUID();
}

// author: BrianXiong
// time: 2026/04/05/16:20:45
export async function getTerminalSessionCwd(sessionId: string) {
  if (hasTauri()) {
    return tauriInvoke<string>("get_terminal_session_cwd", { sessionId });
  }

  return "~";
}

// author: BrianXiong
// time: 2026/04/06/11:12:14
export async function resizeTerminalSession(sessionId: string, cols: number, rows: number) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("resize_terminal_session", { sessionId, cols, rows });
  }

  return true;
}

// author: BrianXiong
// time: 2026/04/05/17:12:08
export async function pickLocalDirectory() {
  if (hasTauri()) {
    return tauriInvoke<string | null>("pick_local_directory");
  }

  return null;
}

export async function readLocalFilePreview(path: string) {
  if (hasTauri()) {
    return tauriInvoke<LocalFilePreview>("read_local_file_preview", { path });
  }

  throw new Error(`Local preview is only available in the desktop app: ${path}`);
}

export async function observeServer(host: SavedHost, sshOptions: SshConnectionOptions) {
  if (hasTauri()) {
    return tauriInvoke<ServerObservation>("observe_server", { host, sshOptions });
  }
  return {
    hostname: host.label || host.address,
    operatingSystem: "Mock OS",
    uptime: "Unknown",
    loadAverage: "0.00 0.00 0.00",
    cpuCores: "4",
    cpuUsage: "12%",
    memoryUsage: "Unknown",
    memoryPercent: "Unknown",
    diskUsage: "Unknown",
    diskPercent: "Unknown",
    networkUsage: "Unknown",
    topProcesses: [
      { pid: "1234", command: "sshd", cpuPercent: 1.2, memoryPercent: 0.4 },
      { pid: "5678", command: "node", cpuPercent: 0.8, memoryPercent: 1.1 }
    ],
    capturedAt: new Date().toISOString()
  };
}

export async function writeTerminalInput(sessionId: string, data: string) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("write_terminal_input", { sessionId, data });
  }
  return true;
}

export async function closeTerminalSession(sessionId: string) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("close_terminal_session", { sessionId });
  }
  return true;
}
