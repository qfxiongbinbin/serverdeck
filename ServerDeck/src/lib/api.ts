import { hosts as mockHosts } from "../data/mock";

export type SavedHost = {
  id: string;
  label: string;
  address: string;
  port: number;
  username: string;
  authType: "password" | "key";
  password?: string;
  privateKeyPath?: string;
};

export type FileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string;
};

export type TerminalEventPayload = {
  sessionId: string;
  data: string;
  stream?: "stdout" | "stderr" | "system";
};

export type UpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  downloadUrl?: string | null;
  assetName?: string | null;
  releasePageUrl?: string | null;
};

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const STORAGE_KEY = "serverdeck.hosts";

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
    return JSON.parse(saved) as SavedHost[];
  }

  const initial: SavedHost[] = mockHosts.map((item) => ({
    id: item.id,
    label: item.label,
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
  const existingIndex = items.findIndex((item) => item.id === host.id);
  const next = [...items];

  if (existingIndex >= 0) {
    next[existingIndex] = host;
  } else {
    next.push({ ...host, id: host.id || crypto.randomUUID() });
  }

  saveBrowserHosts(next);
  return next[existingIndex >= 0 ? existingIndex : next.length - 1];
}

export async function deleteHost(id: string) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("delete_host", { id });
  }
  const next = loadBrowserHosts().filter((item) => item.id !== id);
  saveBrowserHosts(next);
  return true;
}

export async function testConnection(host: SavedHost) {
  if (hasTauri()) {
    return tauriInvoke<string>("test_connection", { host });
  }
  return `Mock connection ok: ${host.username}@${host.address}:${host.port}`;
}

export async function listLocalDirectory(path: string) {
  if (hasTauri()) {
    return tauriInvoke<FileEntry[]>("list_local_directory", { path });
  }
  return [];
}

export async function listRemoteDirectory(host: SavedHost, path: string) {
  if (hasTauri()) {
    return tauriInvoke<FileEntry[]>("list_remote_directory", { host, path });
  }
  return [];
}

export async function uploadToRemote(host: SavedHost, localPath: string, remoteDir: string) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("upload_to_remote", { host, localPath, remoteDir });
  }
  return true;
}

export async function downloadFromRemote(host: SavedHost, remotePath: string, localDir: string, isDir: boolean) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("download_from_remote", { host, remotePath, localDir, isDir });
  }
  return true;
}

export async function deleteLocalEntry(path: string, isDir: boolean) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("delete_local_entry", { path, isDir });
  }
  return true;
}

export async function deleteRemoteEntry(host: SavedHost, remotePath: string, isDir: boolean) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("delete_remote_entry", { host, remotePath, isDir });
  }
  return true;
}

export async function checkForUpdate() {
  if (hasTauri()) {
    return tauriInvoke<UpdateInfo>("check_for_update");
  }
  return {
    currentVersion: "0.0.2",
    latestVersion: "0.0.2",
    hasUpdate: false,
    downloadUrl: null,
    assetName: null,
    releasePageUrl: null
  } satisfies UpdateInfo;
}

export async function downloadAndOpenUpdate(downloadUrl: string, assetName: string) {
  if (hasTauri()) {
    return tauriInvoke<string>("download_and_open_update", { downloadUrl, assetName });
  }
  return "";
}

export async function clearAppData() {
  if (hasTauri()) {
    return tauriInvoke<boolean>("clear_app_data");
  }
  window.localStorage.removeItem(STORAGE_KEY);
  return true;
}

export async function startTerminalSession(host: SavedHost) {
  if (hasTauri()) {
    return tauriInvoke<string>("start_terminal_session", { host });
  }
  return crypto.randomUUID();
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
