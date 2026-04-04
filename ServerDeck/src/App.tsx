import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update as AppUpdate } from "@tauri-apps/plugin-updater";
import packageJson from "../package.json";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import {
  ChevronRight,
  Copy,
  Download,
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Info,
  Link2,
  Pencil,
  Plus,
  PlugZap,
  Save,
  Search,
  Server,
  Wrench,
  TerminalSquare,
  Trash2,
  Users,
  X
} from "lucide-react";
import {
  clearAppData,
  closeTerminalSession,
  deleteLocalEntry,
  deleteHost,
  deleteRemoteEntry,
  downloadFromRemote,
  listLocalDirectory,
  listRemoteDirectory,
  listHosts,
  saveHost,
  startTerminalSession,
  testConnection,
  uploadToRemote,
  writeTerminalInput,
  type FileEntry,
  type SavedHost,
  type TerminalEventPayload
} from "./lib/api";
import {
  defaultTerminalThemeId,
  terminalThemePresets,
  type TerminalThemePreset
} from "./data/terminalThemes";

const HOSTS_TAB_ID = "hosts";
const SFTP_TAB_ID = "sftp";
const SETTINGS_TAB_ID = "settings";
const SETTINGS_STORAGE_KEY = "serverdeck.settings";
const DEFAULT_APP_SETTINGS: AppSettings = {
  appTheme: "dark",
  terminalThemeId: defaultTerminalThemeId,
  terminalFontSize: 14
};

const blankHost: SavedHost = {
  id: "",
  label: "",
  address: "",
  port: 22,
  username: "root",
  authType: "password",
  password: ""
};

type DrawerMode = "new" | "edit";
type TerminalState = "connecting" | "connected" | "error";

type TerminalTab = {
  id: string;
  sessionId: string;
  title: string;
  host: SavedHost;
  state: TerminalState;
  statusText: string;
  buffer: string[];
};

type ContextMenuState = {
  host: SavedHost;
  x: number;
  y: number;
};

type FileMenuState = {
  side: "local" | "remote";
  entry: FileEntry;
  x: number;
  y: number;
};

type TransferJob = {
  id: string;
  name: string;
  direction: "upload" | "download";
  status: "running" | "success" | "error";
  detail: string;
};

type AppSettings = {
  appTheme: "light" | "dark";
  terminalThemeId: string;
  terminalFontSize: number;
};

type UpdateStage = "idle" | "downloading" | "ready";
type UpdateCheckState = "idle" | "checking" | "available" | "upToDate" | "error" | "unsupported";

const appThemeOptions = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" }
] as const;

const terminalFontSizeOptions = [
  { label: "S", value: 12 },
  { label: "M", value: 14 },
  { label: "L", value: 16 }
] as const;

function getHostTitle(host: SavedHost) {
  return host.label.trim() || host.address.trim() || "Untitled Host";
}

function getHostBadge(host: SavedHost) {
  return getHostTitle(host).slice(0, 1).toUpperCase();
}

function hasTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

function formatFileSize(size: number) {
  if (size <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatModified(value: string) {
  if (!value) return "-";
  const numeric = Number(value);
  const date = Number.isNaN(numeric) ? new Date(value) : new Date(numeric * 1000);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString();
}

function getParentPath(path: string) {
  const trimmed = path.trim();
  if (!trimmed || trimmed === ".") {
    return ".";
  }
  if (trimmed === "~" || trimmed === "/") {
    return trimmed;
  }
  const normalized = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  const parts = normalized.split("/").filter(Boolean);
  if (normalized.startsWith("~")) {
    if (parts.length <= 1) return "~";
    return `~/${parts.slice(1, -1).join("/")}`;
  }
  if (parts.length <= 1) return "/";
  return `/${parts.slice(0, -1).join("/")}`;
}

function joinChildPath(basePath: string, name: string) {
  if (basePath === ".") return `./${name}`;
  if (basePath === "~") return `~/${name}`;
  if (basePath === "/") return `/${name}`;
  return `${basePath.replace(/\/$/, "")}/${name}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

function getFileIcon(entry: FileEntry) {
  if (entry.is_dir) {
    return { icon: Folder, className: "browser-row__icon--dir" };
  }

  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";

  if (["txt", "md", "log", "rtf"].includes(ext)) {
    return { icon: FileText, className: "browser-row__icon--text" };
  }
  if (["xls", "xlsx", "csv", "numbers"].includes(ext)) {
    return { icon: FileSpreadsheet, className: "browser-row__icon--sheet" };
  }
  if (["doc", "docx", "pages", "pdf"].includes(ext)) {
    return { icon: FileText, className: "browser-row__icon--doc" };
  }
  if (["js", "ts", "tsx", "jsx", "json", "py", "sh", "rs", "go", "java", "c", "cpp", "yml", "yaml"].includes(ext)) {
    return { icon: FileCode2, className: "browser-row__icon--code" };
  }
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"].includes(ext)) {
    return { icon: FileImage, className: "browser-row__icon--image" };
  }
  if (["zip", "tar", "gz", "tgz", "rar", "7z"].includes(ext)) {
    return { icon: FileArchive, className: "browser-row__icon--archive" };
  }

  return { icon: File, className: "browser-row__icon--file" };
}

function FileBrowserPane({
  title,
  path,
  items,
  loading,
  error,
  emptyText,
  disabled,
  onContextMenu,
  onPathChange,
  onRefresh,
  onOpenDir,
  onGoUp
}: {
  title: string;
  path: string;
  items: FileEntry[];
  loading: boolean;
  error?: string;
  emptyText: string;
  disabled?: boolean;
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>, entry: FileEntry) => void;
  onPathChange: (path: string) => void;
  onRefresh: () => void;
  onOpenDir: (entry: FileEntry) => void;
  onGoUp: () => void;
}) {
  return (
    <section className={`browser-pane ${disabled ? "browser-pane--disabled" : ""}`}>
      <div className="browser-pane__header">
        <strong>{title}</strong>
        <button type="button" className="row-button" onClick={onRefresh} disabled={disabled}>
          Refresh
        </button>
      </div>

      <div className="browser-pathbar">
        <button type="button" className="row-button" onClick={onGoUp} disabled={disabled}>
          Up
        </button>
        <input value={path} onChange={(event) => onPathChange(event.target.value)} disabled={disabled} />
      </div>

      <div className="browser-list">
        {loading ? <div className="browser-empty">Loading...</div> : null}
        {!loading && error ? <div className="browser-error">{error}</div> : null}
        {!loading && !error && items.length === 0 ? <div className="browser-empty">{emptyText}</div> : null}
        {!loading && !error &&
          items.map((entry) => {
            const { icon: FileIcon, className } = getFileIcon(entry);

            return (
              <button
                key={entry.path}
                type="button"
                className="browser-row"
                onClick={() => entry.is_dir && onOpenDir(entry)}
                onContextMenu={(event) => onContextMenu?.(event, entry)}
                disabled={disabled || !entry.is_dir}
              >
                <div className="browser-row__name">
                  <span className={`browser-row__icon ${className}`}>
                    <FileIcon size={14} />
                  </span>
                  <span>{entry.name}</span>
                </div>
                <span>{formatModified(entry.modified)}</span>
                <span>{entry.is_dir ? "-" : formatFileSize(entry.size)}</span>
              </button>
            );
          })}
      </div>
    </section>
  );
}

export default function App() {
  const [activeTabId, setActiveTabId] = useState(HOSTS_TAB_ID);
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [hosts, setHosts] = useState<SavedHost[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<SavedHost>(blankHost);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("new");
  const [status, setStatus] = useState("Ready");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [busy, setBusy] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [fileMenu, setFileMenu] = useState<FileMenuState | null>(null);
  const [transferJobs, setTransferJobs] = useState<TransferJob[]>([]);
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdate | null>(null);
  const [appVersion, setAppVersion] = useState(packageJson.version);
  const [updateCheckState, setUpdateCheckState] = useState<UpdateCheckState>(
    hasTauriRuntime() ? "idle" : "unsupported"
  );
  const [updateCheckMessage, setUpdateCheckMessage] = useState("");
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateStage, setUpdateStage] = useState<UpdateStage>("idle");
  const [updateDownloadedBytes, setUpdateDownloadedBytes] = useState(0);
  const [updateContentLength, setUpdateContentLength] = useState<number | null>(null);
  const [updateError, setUpdateError] = useState("");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [localPath, setLocalPath] = useState("~");
  const [remotePath, setRemotePath] = useState(".");
  const [localEntries, setLocalEntries] = useState<FileEntry[]>([]);
  const [remoteEntries, setRemoteEntries] = useState<FileEntry[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [remoteError, setRemoteError] = useState("");
  const [localRefreshTick, setLocalRefreshTick] = useState(0);
  const [remoteRefreshTick, setRemoteRefreshTick] = useState(0);

  const terminalEl = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const activeTabIdRef = useRef(HOSTS_TAB_ID);
  const terminalTabsRef = useRef<TerminalTab[]>([]);

  const isHostsView = activeTabId === HOSTS_TAB_ID;
  const isSftpView = activeTabId === SFTP_TAB_ID;
  const isSettingsView = activeTabId === SETTINGS_TAB_ID;

  const selectedHost = useMemo(
    () => hosts.find((item) => item.id === selectedId) ?? null,
    [hosts, selectedId]
  );

  const activeTerminalTab = useMemo(
    () => terminalTabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, terminalTabs]
  );

  const activeTerminalTheme = useMemo<TerminalThemePreset>(
    () => terminalThemePresets.find((item) => item.id === settings.terminalThemeId) ?? terminalThemePresets[0],
    [settings.terminalThemeId]
  );

  const filteredHosts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return hosts;

    return hosts.filter((host) => {
      const haystack = [host.label, host.address, host.username, String(host.port)].join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [hosts, search]);

  const updateProgressPercent = useMemo(() => {
    if (!updateContentLength || updateContentLength <= 0) {
      return null;
    }

    return Math.min(100, Math.round((updateDownloadedBytes / updateContentLength) * 100));
  }, [updateContentLength, updateDownloadedBytes]);

  async function refreshHosts(nextSelectedId?: string) {
    const items = await listHosts();
    setHosts(items);

    const preferredId = nextSelectedId !== undefined ? nextSelectedId : selectedId;
    const finalSelectedId = items.find((item) => item.id === preferredId)?.id ?? items[0]?.id ?? "";
    setSelectedId(finalSelectedId);
  }

  useEffect(() => {
    void refreshHosts();
  }, []);

  const checkForUpdates = useCallback(async (options?: { silent?: boolean }) => {
    if (!hasTauriRuntime()) {
      setUpdateCheckState("unsupported");
      setUpdateCheckMessage("Updater is only available in the desktop app.");
      return null;
    }

    setUpdateCheckState("checking");
    setUpdateCheckMessage("");

    if (!options?.silent) {
      setStatus("Checking for updates...");
      setStatusTone("neutral");
    }

    try {
      const update = await check();
      setAvailableUpdate(update);

      if (update) {
        setUpdateCheckState("available");
        setUpdateCheckMessage(`Version ${update.version} is available.`);

        if (!options?.silent) {
          setStatus(`Update ${update.version} is available`);
          setStatusTone("success");
        }

        return update;
      }

      setUpdateCheckState("upToDate");
      setUpdateCheckMessage("You are already on the latest version.");

      if (!options?.silent) {
        setStatus("You are already on the latest version");
        setStatusTone("success");
      }

      return null;
    } catch (error) {
      const message = getErrorMessage(error, "Update check failed");
      setAvailableUpdate(null);
      setUpdateCheckState("error");
      setUpdateCheckMessage(message);

      if (!options?.silent) {
        setStatus(message);
        setStatusTone("error");
      }

      return null;
    }
  }, []);

  useEffect(() => {
    if (!hasTauriRuntime()) {
      return;
    }

    let cancelled = false;

    void getVersion()
      .then((version) => {
        if (!cancelled) {
          setAppVersion(version);
        }
      })
      .catch(() => {});

    void checkForUpdates({ silent: true }).then((update) => {
      if (cancelled) {
        void update?.close().catch(() => {});
      }
    });

    return () => {
      cancelled = true;
    };
  }, [checkForUpdates]);

  useEffect(() => {
    return () => {
      if (availableUpdate) {
        void availableUpdate.close().catch(() => {});
      }
    };
  }, [availableUpdate]);

  useEffect(() => {
    const savedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!savedSettings) {
      return;
    }

    try {
      const parsed = JSON.parse(savedSettings) as Partial<AppSettings>;
      setSettings({
          appTheme: parsed.appTheme === "light" ? "light" : DEFAULT_APP_SETTINGS.appTheme,
          terminalThemeId:
            terminalThemePresets.find((item) => item.id === parsed.terminalThemeId)?.id ?? defaultTerminalThemeId,
          terminalFontSize:
            typeof parsed.terminalFontSize === "number" && parsed.terminalFontSize >= 10 && parsed.terminalFontSize <= 24
            ? parsed.terminalFontSize
            : DEFAULT_APP_SETTINGS.terminalFontSize
      });
    } catch {
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    document.documentElement.dataset.appTheme = settings.appTheme;
    document.documentElement.style.colorScheme = settings.appTheme;
  }, [settings.appTheme]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    terminalTabsRef.current = terminalTabs;
  }, [terminalTabs]);

  useEffect(() => {
    if (drawerMode === "edit") {
      setDraft(selectedHost ?? blankHost);
    }
  }, [drawerMode, selectedHost]);

  useEffect(() => {
    if (!contextMenu && !fileMenu) {
      return;
    }

    const closeMenu = () => {
      setContextMenu(null);
      setFileMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [contextMenu, fileMenu]);

  useEffect(() => {
    if (!isSftpView) {
      return;
    }

    let cancelled = false;
    setLocalLoading(true);
    setLocalError("");
    void listLocalDirectory(localPath)
      .then((items) => {
        if (!cancelled) setLocalEntries(items);
      })
      .catch((error) => {
        if (!cancelled) {
          setLocalEntries([]);
          setLocalError(getErrorMessage(error, "Failed to load local directory"));
        }
      })
      .finally(() => {
        if (!cancelled) setLocalLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSftpView, localPath, localRefreshTick]);

  useEffect(() => {
    if (!isSftpView || !selectedHost) {
      setRemoteEntries([]);
      setRemoteError("");
      return;
    }

    let cancelled = false;
    setRemoteLoading(true);
    setRemoteError("");
    void listRemoteDirectory(selectedHost, remotePath)
      .then((items) => {
        if (!cancelled) setRemoteEntries(items);
      })
      .catch((error) => {
        if (!cancelled) {
          setRemoteEntries([]);
          setRemoteError(getErrorMessage(error, "Failed to load remote directory"));
        }
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSftpView, selectedHost, remotePath, remoteRefreshTick]);

  useEffect(() => {
    if (!activeTerminalTab || !terminalEl.current) {
      return;
    }

    terminalEl.current.innerHTML = "";

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: settings.terminalFontSize,
      theme: activeTerminalTheme.theme
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalEl.current);
    fitAddon.fit();
    terminal.focus();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    if (activeTerminalTab.buffer.length > 0) {
      terminal.write(activeTerminalTab.buffer.join(""));
    }

    const disposable = terminal.onData((data) => {
      const currentActiveTab = terminalTabsRef.current.find((tab) => tab.id === activeTabIdRef.current);
      if (!currentActiveTab) return;
      void writeTerminalInput(currentActiveTab.sessionId, data);
    });

    const onResize = () => fitAddon.fit();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      disposable.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [activeTerminalTab?.id, activeTerminalTheme, settings.terminalFontSize]);

  useEffect(() => {
    if (!terminalRef.current) {
      return;
    }

    terminalRef.current.options.theme = activeTerminalTheme.theme;
  }, [activeTerminalTheme]);

  useEffect(() => {
    if (!terminalRef.current) {
      return;
    }

    terminalRef.current.options.fontSize = settings.terminalFontSize;
    fitAddonRef.current?.fit();
  }, [settings.terminalFontSize]);

  useEffect(() => {
    let cleanup: null | (() => void) = null;
    let disposed = false;

    void listen<TerminalEventPayload>("terminal-output", (event) => {
      const matchingTab = terminalTabsRef.current.find((tab) => tab.sessionId === event.payload.sessionId);
      if (!matchingTab) {
        return;
      }

      const nextState: TerminalState =
        matchingTab.state === "connecting" && event.payload.stream === "stdout"
          ? "connected"
          : matchingTab.state;

      const nextStatusText =
        matchingTab.state === "connecting" && event.payload.stream === "stdout"
          ? "Connected"
          : matchingTab.statusText;

      setTerminalTabs((prev) =>
        prev.map((tab) =>
          tab.sessionId === event.payload.sessionId
            ? { ...tab, state: nextState, statusText: nextStatusText, buffer: [...tab.buffer, event.payload.data] }
            : tab
        )
      );

      if (activeTabIdRef.current === matchingTab.id && terminalRef.current) {
        terminalRef.current.write(event.payload.data);
      }
    })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
          return;
        }
        cleanup = unlisten;
      })
      .catch(() => {
        setStatus("Failed to subscribe terminal output events");
        setStatusTone("error");
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  function openNewDrawer() {
    setActiveTabId(HOSTS_TAB_ID);
    setDrawerMode("new");
    setDrawerOpen(true);
    setSelectedId("");
    setDraft(blankHost);
    setStatus("Ready");
    setStatusTone("neutral");
  }

  function openEditDrawer(host: SavedHost) {
    setActiveTabId(HOSTS_TAB_ID);
    setDrawerMode("edit");
    setDrawerOpen(true);
    setSelectedId(host.id);
    setDraft(host);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function openSettings() {
    setContextMenu(null);
    setFileMenu(null);
    setDrawerOpen(false);
    setActiveTabId(SETTINGS_TAB_ID);
  }

  function handleUpdateClick() {
    if (!availableUpdate) {
      return;
    }

    setUpdateModalOpen(true);
  }

  async function handleCheckForUpdates() {
    const update = await checkForUpdates();
    if (update) {
      setUpdateModalOpen(true);
    }
  }

  async function handleDownloadUpdate() {
    if (!availableUpdate || updateStage !== "idle") {
      return;
    }

    setUpdateError("");
    setUpdateDownloadedBytes(0);
    setUpdateContentLength(null);
    setUpdateStage("downloading");
    setStatusTone("neutral");
    setStatus(`Downloading update ${availableUpdate.version}...`);

    try {
      await availableUpdate.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          setUpdateContentLength(event.data.contentLength ?? null);
          setUpdateDownloadedBytes(0);
        }

        if (event.event === "Progress") {
          setUpdateDownloadedBytes((current) => current + event.data.chunkLength);
        }
      });

      setUpdateStage("ready");
      setStatus(`Update ${availableUpdate.version} is ready to restart`);
      setStatusTone("success");
    } catch (error) {
      setUpdateStage("idle");
      setUpdateError(getErrorMessage(error, "Update download failed"));
      setStatus(getErrorMessage(error, "Update download failed"));
      setStatusTone("error");
    }
  }

  async function handleRestartForUpdate() {
    if (updateStage !== "ready") {
      return;
    }

    setStatus("Restarting to apply update...");
    setStatusTone("neutral");

    try {
      await relaunch();
    } catch (error) {
      setStatus(getErrorMessage(error, "Restart failed"));
      setStatusTone("error");
    }
  }

  async function handleClearLocalData() {
    setBusy(true);
    setStatusTone("neutral");

    try {
      await clearAppData();
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
      setHosts([]);
      setSelectedId("");
      setDraft(blankHost);
      setSearch("");
      setDrawerOpen(false);
      setDrawerMode("new");
      setLocalEntries([]);
      setRemoteEntries([]);
      setLocalError("");
      setRemoteError("");
      setTransferJobs([]);
      setSettings(DEFAULT_APP_SETTINGS);
      setLocalPath("~");
      setRemotePath(".");
      setStatus("Cleared local app data");
      setStatusTone("success");
    } catch (error) {
      setStatus(getErrorMessage(error, "Failed to clear local data"));
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  function handleSelectTerminalTheme(themeId: string) {
    const selectedTheme = terminalThemePresets.find((item) => item.id === themeId);
    setSettings((current) => ({ ...current, terminalThemeId: themeId }));
    setStatus(`Applied terminal theme ${selectedTheme?.name ?? themeId}`);
    setStatusTone("success");
  }

  function handleSelectAppTheme(appTheme: AppSettings["appTheme"]) {
    setSettings((current) => ({ ...current, appTheme }));
    setStatus(`Applied ${appTheme} app theme`);
    setStatusTone("success");
  }

  function handleSelectTerminalFontSize(fontSize: number) {
    setSettings((current) => ({ ...current, terminalFontSize: fontSize }));
    setStatus(`Applied terminal font size ${fontSize}px`);
    setStatusTone("success");
  }

  function startTransferJob(name: string, direction: TransferJob["direction"], detail: string) {
    const id = crypto.randomUUID();
    const nextJob: TransferJob = { id, name, direction, status: "running", detail };
    setTransferJobs((current) => [nextJob, ...current].slice(0, 8));
    return id;
  }

  function removeTransferJob(id: string) {
    setTransferJobs((current) => current.filter((job) => job.id !== id));
  }

  function finishTransferJob(id: string, status: TransferJob["status"], detail: string) {
    setTransferJobs((current) => current.map((job) => (job.id === id ? { ...job, status, detail } : job)));

    if (status === "success") {
      window.setTimeout(() => {
        removeTransferJob(id);
      }, 1400);
    }
  }

  async function handleUploadEntry(entry: FileEntry) {
    if (!selectedHost) return;
    const jobId = startTransferJob(entry.name, "upload", `Uploading to ${remotePath}`);
    try {
      await uploadToRemote(selectedHost, entry.path, remotePath);
      setStatus(`Uploaded ${entry.name}`);
      setStatusTone("success");
      finishTransferJob(jobId, "success", `Uploaded to ${remotePath}`);
      setFileMenu(null);
      setRemoteRefreshTick((current) => current + 1);
    } catch (error) {
      const message = getErrorMessage(error, `Upload failed for ${entry.name}`);
      setStatus(message);
      setStatusTone("error");
      finishTransferJob(jobId, "error", message);
    }
  }

  async function handleDownloadEntry(entry: FileEntry) {
    if (!selectedHost) return;
    const remoteTarget = joinChildPath(remotePath, entry.name);
    const jobId = startTransferJob(entry.name, "download", `Downloading to ${localPath}`);
    try {
      await downloadFromRemote(selectedHost, remoteTarget, localPath, entry.is_dir);
      setStatus(`Downloaded ${entry.name}`);
      setStatusTone("success");
      finishTransferJob(jobId, "success", `Downloaded to ${localPath}`);
      setFileMenu(null);
      setLocalRefreshTick((current) => current + 1);
    } catch (error) {
      const message = getErrorMessage(error, `Download failed for ${entry.name}`);
      setStatus(message);
      setStatusTone("error");
      finishTransferJob(jobId, "error", message);
    }
  }

  async function handleDeleteLocalFile(entry: FileEntry) {
    await deleteLocalEntry(entry.path, entry.is_dir);
    setStatus(`Deleted local ${entry.name}`);
    setStatusTone("success");
    setFileMenu(null);
    setLocalRefreshTick((current) => current + 1);
  }

  async function handleDeleteRemoteFile(entry: FileEntry) {
    if (!selectedHost) return;
    const remoteTarget = joinChildPath(remotePath, entry.name);
    await deleteRemoteEntry(selectedHost, remoteTarget, entry.is_dir);
    setStatus(`Deleted remote ${entry.name}`);
    setStatusTone("success");
    setFileMenu(null);
    setRemoteRefreshTick((current) => current + 1);
  }

  function handleSelectSftpHost(hostId: string) {
    setSelectedId(hostId);
    setRemotePath(".");
    setRemoteEntries([]);
    setRemoteError("");
  }

  async function handleSave() {
    setBusy(true);
    setStatusTone("neutral");

    try {
      if (!draft.address.trim()) {
        throw new Error("Address is required");
      }

      const saved = await saveHost({
        ...draft,
        id: draft.id || crypto.randomUUID()
      });

      setDrawerMode("edit");
      setDrawerOpen(true);
      setStatus(`Saved host ${getHostTitle(saved)}`);
      setStatusTone("success");
      await refreshHosts(saved.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!draft.id) return;

    setBusy(true);
    setStatusTone("neutral");

    try {
      await deleteHost(draft.id);
      setStatus(`Deleted host ${getHostTitle(draft)}`);
      setStatusTone("success");
      setDrawerOpen(false);
      setDrawerMode("new");
      setDraft(blankHost);
      await refreshHosts();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed");
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteHost(targetHost: SavedHost) {
    setBusy(true);
    setStatusTone("neutral");

    try {
      await deleteHost(targetHost.id);
      setContextMenu(null);
      setDrawerOpen((open) => (draft.id === targetHost.id ? false : open));
      if (draft.id === targetHost.id) {
        setDraft(blankHost);
        setDrawerMode("new");
      }
      setStatus(`Removed host ${getHostTitle(targetHost)}`);
      setStatusTone("success");
      await refreshHosts();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Remove failed");
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicateHost(targetHost: SavedHost) {
    setBusy(true);
    setStatusTone("neutral");

    try {
      const duplicated = await saveHost({
        ...targetHost,
        id: crypto.randomUUID(),
        label: `${getHostTitle(targetHost)} Copy`
      });
      setContextMenu(null);
      setStatus(`Duplicated host ${getHostTitle(targetHost)}`);
      setStatusTone("success");
      await refreshHosts(duplicated.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Duplicate failed");
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyHostLink(targetHost: SavedHost) {
    const sshLink = `ssh://${targetHost.username}@${targetHost.address}:${targetHost.port}`;

    try {
      await navigator.clipboard.writeText(sshLink);
      setContextMenu(null);
      setStatus(`Copied link for ${getHostTitle(targetHost)}`);
      setStatusTone("success");
    } catch {
      setStatus("Copy link failed");
      setStatusTone("error");
    }
  }

  function handlePlaceholderAction(label: string) {
    setContextMenu(null);
    setStatus(`${label} is not wired yet`);
    setStatusTone("neutral");
  }

  async function handleTest() {
    setBusy(true);
    setStatusTone("neutral");

    try {
      if (!draft.address.trim()) {
        throw new Error("Select or fill a host first");
      }

      setStatus(`Testing ${draft.username}@${draft.address}:${draft.port} ...`);
      const message = await testConnection(draft);
      setStatus(message);
      setStatusTone("success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connection test failed");
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenTerminal(targetHost: SavedHost = draft) {
    setBusy(true);
    setStatusTone("neutral");

    try {
      if (!targetHost.address.trim()) {
        throw new Error("Select or fill a host first");
      }
      if (targetHost.authType === "password" && !(targetHost.password || "").trim()) {
        throw new Error("Password auth requires a password");
      }
      if (targetHost.authType === "key" && !(targetHost.privateKeyPath || "").trim()) {
        throw new Error("Key auth requires a private key path");
      }

      setStatus(`Connecting to ${targetHost.username}@${targetHost.address}:${targetHost.port}...`);
      const sessionId = await startTerminalSession(targetHost);
      const tabId = crypto.randomUUID();
      const title = getHostTitle(targetHost);

      setTerminalTabs((prev) => [
        ...prev,
        {
          id: tabId,
          sessionId,
          title,
          host: targetHost,
          state: "connecting",
          statusText: `Connecting to ${targetHost.username}@${targetHost.address}:${targetHost.port}...`,
          buffer: []
        }
      ]);

      setActiveTabId(tabId);
      setDrawerOpen(false);
      setStatus(`Terminal session opened for ${targetHost.username}@${targetHost.address}`);
      setStatusTone("success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Terminal open failed");
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseTerminalTab(tabId: string) {
    const currentTabs = terminalTabsRef.current;
    const targetIndex = currentTabs.findIndex((tab) => tab.id === tabId);
    if (targetIndex < 0) return;

    const targetTab = currentTabs[targetIndex];
    await closeTerminalSession(targetTab.sessionId);

    const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);
    const nextActiveTabId =
      activeTabIdRef.current === tabId
        ? nextTabs[targetIndex]?.id ?? nextTabs[targetIndex - 1]?.id ?? HOSTS_TAB_ID
        : activeTabIdRef.current;

    setTerminalTabs(nextTabs);
    setActiveTabId(nextActiveTabId);
    setStatus(`Closed terminal tab ${targetTab.title}`);
    setStatusTone("neutral");
  }

  const contextMenuPosition = useMemo(() => {
    if (!contextMenu || typeof window === "undefined") {
      return { left: 0, top: 0 };
    }

    const menuWidth = 320;
    const menuHeight = 470;
    const left = Math.min(contextMenu.x, window.innerWidth - menuWidth - 16);
    const top = Math.min(contextMenu.y, window.innerHeight - menuHeight - 16);

    return {
      left: Math.max(12, left),
      top: Math.max(12, top)
    };
  }, [contextMenu]);

  const fileMenuPosition = useMemo(() => {
    if (!fileMenu || typeof window === "undefined") {
      return { left: 0, top: 0 };
    }

    const menuWidth = 220;
    const menuHeight = 160;
    return {
      left: Math.max(12, Math.min(fileMenu.x, window.innerWidth - menuWidth - 16)),
      top: Math.max(12, Math.min(fileMenu.y, window.innerHeight - menuHeight - 16))
    };
  }, [fileMenu]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <div className="topbar__logo">SD</div>
          <span>ServerDeck</span>
        </div>

        <div className="topbar__tabs">
          <button
            type="button"
            className={`top-tab ${isHostsView ? "top-tab--active" : ""}`}
            onClick={() => setActiveTabId(HOSTS_TAB_ID)}
          >
            <Server size={16} />
            Hosts
          </button>

          <button
            type="button"
            className={`top-tab ${isSftpView ? "top-tab--active" : ""}`}
            onClick={() => setActiveTabId(SFTP_TAB_ID)}
          >
            <FolderOpen size={16} />
            SFTP
          </button>

          {terminalTabs.map((tab) => (
            <div
              key={tab.id}
              className={`top-tab ${activeTabId === tab.id ? "top-tab--active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => setActiveTabId(tab.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveTabId(tab.id);
                }
              }}
            >
              <TerminalSquare size={16} />
              <span className={`top-tab__dot top-tab__dot--${tab.state}`} />
              <span className="top-tab__label">{tab.title}</span>
              <button
                type="button"
                className="top-tab__close"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleCloseTerminalTab(tab.id);
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}

          <button type="button" className="top-tab top-tab--ghost" disabled>
            <Plus size={16} />
            New Tab
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar__top">
            <button
              type="button"
              className={`side-nav ${isHostsView ? "side-nav--active" : ""}`}
              onClick={() => setActiveTabId(HOSTS_TAB_ID)}
            >
              <Server size={18} />
              Hosts
            </button>
          </div>

          <div className="sidebar__bottom">
            {availableUpdate ? (
              <button
                type="button"
                className="side-nav side-nav--update"
                onClick={handleUpdateClick}
              >
                <Download size={18} />
                Update
              </button>
            ) : null}

            <button
              type="button"
              className={`side-nav ${isSettingsView ? "side-nav--active" : ""}`}
              onClick={openSettings}
            >
              <Wrench size={18} />
              Settings
            </button>
          </div>
        </aside>

        <main className="mainpane">
          {isHostsView ? (
            <section className="hosts-screen">
              <div className="hosts-toolbar">
                <div className="searchbar">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Find a host or ssh user@hostname..."
                  />
                </div>

                <button type="button" className="primary-button" onClick={openNewDrawer}>
                  <Plus size={16} />
                  New
                </button>
              </div>

              <div className={`hosts-layout ${drawerOpen ? "hosts-layout--drawer" : ""}`}>
                <section className="hosts-board">
                  <div className="hosts-board__header">
                    <div>
                      <h2>Hosts</h2>
                      <span>{filteredHosts.length} available</span>
                    </div>
                  </div>

                  <div className="host-rows">
                    {filteredHosts.map((host) => (
                      <div
                        key={host.id}
                        className={`host-row ${selectedId === host.id ? "host-row--active" : ""}`}
                        onClick={() => openEditDrawer(host)}
                        onContextMenuCapture={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedId(host.id);
                          setContextMenu({ host, x: event.clientX, y: event.clientY });
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openEditDrawer(host);
                          }
                        }}
                      >
                        <div className="host-row__badge">{getHostBadge(host)}</div>

                        <div className="host-row__body">
                          <div className="host-row__title">{getHostTitle(host)}</div>
                          <div className="host-row__sub">ssh, {host.username}</div>
                          <div className="host-row__meta">{host.address}:{host.port}</div>
                        </div>

                        <div className="host-row__actions">
                          <button
                            type="button"
                            className="row-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditDrawer(host);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="row-button row-button--primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(host.id);
                              setDraft(host);
                              void handleOpenTerminal(host);
                            }}
                          >
                            Connect
                          </button>
                        </div>
                      </div>
                    ))}

                    {!filteredHosts.length ? (
                      <div className="empty-state">
                        <h3>No hosts found</h3>
                        <p>Try another keyword or create a new host.</p>
                        <button type="button" className="primary-button" onClick={openNewDrawer}>
                          <Plus size={16} />
                          Create Host
                        </button>
                      </div>
                    ) : null}
                  </div>
                </section>

                {drawerOpen ? (
                  <aside className="host-drawer">
                    <div className="host-drawer__header">
                      <div>
                        <div className="drawer-eyebrow">{drawerMode === "new" ? "New Host" : "Edit Host"}</div>
                        <h3>{drawerMode === "new" ? "Create server profile" : getHostTitle(draft)}</h3>
                      </div>

                      <button type="button" className="icon-button" onClick={closeDrawer}>
                        <X size={16} />
                      </button>
                    </div>

                    <div className={`notice notice--${statusTone}`}>{status}</div>

                    <div className="drawer-form">
                      <label>
                        <span>Label</span>
                        <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
                      </label>

                      <label>
                        <span>Address</span>
                        <input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} />
                      </label>

                      <label>
                        <span>Port</span>
                        <input
                          value={draft.port}
                          onChange={(event) => setDraft({ ...draft, port: Number(event.target.value || "22") })}
                        />
                      </label>

                      <label>
                        <span>Username</span>
                        <input
                          value={draft.username}
                          onChange={(event) => setDraft({ ...draft, username: event.target.value })}
                        />
                      </label>

                      <label>
                        <span>Auth Type</span>
                        <select
                          value={draft.authType}
                          onChange={(event) =>
                            setDraft({ ...draft, authType: event.target.value as SavedHost["authType"] })
                          }
                        >
                          <option value="password">password</option>
                          <option value="key">key</option>
                        </select>
                      </label>

                      {draft.authType === "password" ? (
                        <label>
                          <span>Password</span>
                          <input
                            type="password"
                            value={draft.password ?? ""}
                            onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                          />
                        </label>
                      ) : (
                        <label>
                          <span>Private Key Path</span>
                          <input
                            value={draft.privateKeyPath ?? ""}
                            onChange={(event) => setDraft({ ...draft, privateKeyPath: event.target.value })}
                          />
                        </label>
                      )}
                    </div>

                    <div className="drawer-actions">
                      <button type="button" className="secondary-button" onClick={handleTest} disabled={busy}>
                        <PlugZap size={16} />
                        {busy ? "Working..." : "Test SSH"}
                      </button>

                      <button type="button" className="secondary-button" onClick={handleSave} disabled={busy}>
                        <Save size={16} />
                        {busy ? "Working..." : "Save"}
                      </button>

                      <button type="button" className="primary-button" onClick={() => void handleOpenTerminal()} disabled={busy}>
                        <TerminalSquare size={16} />
                        {busy ? "Working..." : "Connect"}
                      </button>

                      <button
                        type="button"
                        className="danger-button"
                        onClick={handleDelete}
                        disabled={busy || !draft.id}
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </aside>
                ) : null}
              </div>
            </section>
          ) : isSftpView ? (
            <section className="sftp-screen">
              <div className="sftp-screen__header">
                <div>
                  <h2>SFTP</h2>
                  <span>Choose a host before browsing remote files.</span>
                </div>

                <label className="sftp-host-select">
                  <span>Select Host</span>
                  <select value={selectedId} onChange={(event) => handleSelectSftpHost(event.target.value)}>
                    <option value="">Select host</option>
                    {hosts.map((host) => (
                      <option key={host.id} value={host.id}>
                        {getHostTitle(host)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="sftp-browser-grid">
                <FileBrowserPane
                  title="Local"
                  path={localPath}
                  items={localEntries}
                  loading={localLoading}
                  error={localError}
                  emptyText="No local files"
                  onPathChange={setLocalPath}
                  onContextMenu={(event, entry) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setFileMenu({ side: "local", entry, x: event.clientX, y: event.clientY });
                  }}
                  onRefresh={() => setLocalRefreshTick((current) => current + 1)}
                  onGoUp={() => setLocalPath((current) => getParentPath(current))}
                  onOpenDir={(entry) => setLocalPath((current) => joinChildPath(current, entry.name))}
                />

                <FileBrowserPane
                  title="Remote"
                  path={remotePath}
                  items={remoteEntries}
                  loading={remoteLoading}
                  error={remoteError}
                  emptyText={selectedHost ? "No remote files" : "Select a host first"}
                  disabled={!selectedHost}
                  onPathChange={setRemotePath}
                  onContextMenu={(event, entry) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setFileMenu({ side: "remote", entry, x: event.clientX, y: event.clientY });
                  }}
                  onRefresh={() => setRemoteRefreshTick((current) => current + 1)}
                  onGoUp={() => setRemotePath((current) => getParentPath(current))}
                  onOpenDir={(entry) => setRemotePath((current) => joinChildPath(current, entry.name))}
                />
              </div>

              {transferJobs.length ? <div className="transfer-panel">
                <div className="transfer-panel__header">
                  <strong>Transfers</strong>
                  <span>{`${transferJobs.length} item(s)`}</span>
                </div>

                <div className="transfer-list">
                  {transferJobs.map((job) => (
                    <div key={job.id} className="transfer-item">
                      <div className="transfer-item__meta">
                        <strong>{job.name}</strong>
                        <span>
                          {job.direction === "upload" ? "Upload" : "Download"} · {job.detail}
                        </span>
                      </div>
                      <div className={`transfer-progress transfer-progress--${job.status}`}>
                        <span />
                      </div>
                    </div>
                  ))}
                </div>
              </div> : null}
            </section>
          ) : isSettingsView ? (
            <section className="settings-screen">
              <div className="settings-screen__header">
                <div>
                  <h2>Settings</h2>
                  <span>Application preferences and connection defaults.</span>
                </div>
              </div>

              <div className="settings-list">
                <section className="settings-section">
                  <h3>General</h3>
                  <div className="settings-item">
                    <div>
                      <strong>App Theme</strong>
                      <span>Choose the light or dark app appearance.</span>
                    </div>
                    <select
                      className="settings-select"
                      value={settings.appTheme}
                      onChange={(event) => handleSelectAppTheme(event.target.value as AppSettings["appTheme"])}
                    >
                      {appThemeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="settings-item">
                    <div>
                      <strong>Language</strong>
                      <span>Current interface language for the desktop app.</span>
                    </div>
                    <span className="settings-pill">English</span>
                  </div>
                </section>

                <section className="settings-section">
                  <h3>Connection</h3>
                  <div className="settings-item">
                    <div>
                      <strong>SSH Defaults</strong>
                      <span>Default connect timeout and keepalive settings.</span>
                    </div>
                    <span className="settings-pill">5s / 30s</span>
                  </div>
                  <div className="settings-item">
                    <div>
                      <strong>Terminal</strong>
                      <span>Font size for all terminal sessions.</span>
                    </div>
                    <select
                      className="settings-select"
                      value={String(settings.terminalFontSize)}
                      onChange={(event) => handleSelectTerminalFontSize(Number(event.target.value))}
                    >
                      {terminalFontSizeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} ({option.value}px)
                        </option>
                      ))}
                    </select>
                  </div>
                </section>

                <section className="settings-section">
                  <h3>Terminal Theme</h3>
                  <div className="theme-list theme-list--grid">
                    {terminalThemePresets.map((theme) => {
                      const selected = theme.id === settings.terminalThemeId;

                      return (
                        <button
                          key={theme.id}
                          type="button"
                          className={`theme-card theme-card--grid ${selected ? "theme-card--active" : ""}`}
                          onClick={() => handleSelectTerminalTheme(theme.id)}
                        >
                          <div
                            className="theme-card__preview"
                            style={{ background: theme.preview.background, borderColor: theme.preview.border }}
                          >
                            <span style={{ background: theme.preview.lines[0] }} />
                            <span style={{ background: theme.preview.lines[1] }} />
                            <span style={{ background: theme.preview.lines[2] }} />
                          </div>

                          <div className="theme-card__body">
                            <div className="theme-card__title">{theme.name}</div>
                          </div>

                          <span className={`theme-card__check ${selected ? "theme-card__check--active" : ""}`}>
                            {selected ? "Selected" : "Select"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="settings-section">
                  <h3>About</h3>
                  <div className="settings-item">
                    <div>
                      <strong>ServerDeck</strong>
                      <span>Remote server workbench for macOS.</span>
                    </div>
                    <span className="settings-pill">v{appVersion}</span>
                  </div>
                  <div className="settings-item">
                    <div>
                      <strong>Software Update</strong>
                      <span>
                        {availableUpdate
                          ? `Version ${availableUpdate.version} is ready to download.`
                          : updateCheckState === "checking"
                            ? "Checking GitHub release metadata..."
                            : updateCheckState === "upToDate"
                              ? "You are already on the latest version."
                              : updateCheckState === "error"
                                ? updateCheckMessage
                                : updateCheckMessage || "Check whether a newer desktop build is available."}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={availableUpdate ? "primary-button" : "secondary-button"}
                      onClick={() => void (availableUpdate ? handleUpdateClick() : handleCheckForUpdates())}
                      disabled={updateCheckState === "checking"}
                    >
                      {availableUpdate ? "View Update" : updateCheckState === "checking" ? "Checking..." : "Check Now"}
                    </button>
                  </div>
                </section>

                <section className="settings-section">
                  <h3>Danger Zone</h3>
                  <div className="settings-item settings-item--danger">
                    <div>
                      <strong>Clear Local Data</strong>
                      <span>Remove saved hosts and local settings from this Mac.</span>
                    </div>
                    <button type="button" className="danger-button" onClick={() => void handleClearLocalData()} disabled={busy}>
                      <Trash2 size={14} />
                      {busy ? "Clearing..." : "Clear Data"}
                    </button>
                  </div>
                </section>
              </div>
            </section>
          ) : (
            <section className="terminal-screen" style={{ background: activeTerminalTheme.theme.background }}>
              <div
                className="terminal-frame"
                ref={terminalEl}
                style={{ background: activeTerminalTheme.theme.background }}
              />
            </section>
          )}
        </main>
      </div>

      {contextMenu ? (
        <div
          className="context-menu"
          style={{ left: contextMenuPosition.left, top: contextMenuPosition.top }}
          onMouseDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className="context-menu__item"
            onClick={() => {
              setContextMenu(null);
              void handleOpenTerminal(contextMenu.host);
            }}
          >
            <PlugZap size={18} />
            <span>Quick Connect</span>
            <span className="context-menu__badge">↩</span>
          </button>

          <button
            type="button"
            className="context-menu__item"
            onClick={() => {
              setContextMenu(null);
              void handleOpenTerminal(contextMenu.host);
            }}
          >
            <TerminalSquare size={18} />
            <span>Connect</span>
            <ChevronRight size={18} className="context-menu__hint" />
          </button>

          <button
            type="button"
            className="context-menu__item"
            onClick={() => {
              setContextMenu(null);
              openEditDrawer(contextMenu.host);
            }}
          >
            <Pencil size={18} />
            <span>Edit Host Details</span>
            <span className="context-menu__badge">E</span>
          </button>

          <button type="button" className="context-menu__item" onClick={() => handlePlaceholderAction("Collaborate")}>
            <Users size={18} />
            <span>Collaborate</span>
          </button>

          <button type="button" className="context-menu__item" onClick={() => handlePlaceholderAction("Move to")}>
            <Server size={18} />
            <span>Move to</span>
            <ChevronRight size={18} className="context-menu__hint" />
          </button>

          <button type="button" className="context-menu__item" onClick={() => handlePlaceholderAction("Copy to")}>
            <Copy size={18} />
            <span>Copy to</span>
            <ChevronRight size={18} className="context-menu__hint" />
          </button>

          <button type="button" className="context-menu__item" onClick={() => void handleDuplicateHost(contextMenu.host)}>
            <Copy size={18} />
            <span>Duplicate</span>
          </button>

          <button type="button" className="context-menu__item" onClick={() => void handleCopyHostLink(contextMenu.host)}>
            <Link2 size={18} />
            <span>Copy Link</span>
            <Info size={18} className="context-menu__hint" />
          </button>

          <button
            type="button"
            className="context-menu__item context-menu__item--danger"
            onClick={() => void handleDeleteHost(contextMenu.host)}
          >
            <Trash2 size={18} />
            <span>Remove</span>
          </button>
        </div>
      ) : null}

      {fileMenu ? (
        <div
          className="context-menu context-menu--compact"
          style={{ left: fileMenuPosition.left, top: fileMenuPosition.top }}
          onMouseDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {fileMenu.side === "local" ? (
            <>
              <button type="button" className="context-menu__item" onClick={() => void handleUploadEntry(fileMenu.entry)}>
                <FolderOpen size={18} />
                <span>Upload</span>
              </button>
              <button
                type="button"
                className="context-menu__item context-menu__item--danger"
                onClick={() => void handleDeleteLocalFile(fileMenu.entry)}
              >
                <Trash2 size={18} />
                <span>Delete</span>
              </button>
            </>
          ) : (
            <>
              <button type="button" className="context-menu__item" onClick={() => void handleDownloadEntry(fileMenu.entry)}>
                <FolderOpen size={18} />
                <span>Download</span>
              </button>
              <button
                type="button"
                className="context-menu__item context-menu__item--danger"
                onClick={() => void handleDeleteRemoteFile(fileMenu.entry)}
              >
                <Trash2 size={18} />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      ) : null}

      {updateModalOpen && availableUpdate ? (
        <div className="update-modal-backdrop" onMouseDown={() => setUpdateModalOpen(false)}>
          <section className="update-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="update-modal__header">
              <div>
                <div className="drawer-eyebrow">Update Available</div>
                <h3>ServerDeck {availableUpdate.version}</h3>
                <span>
                  Current version {availableUpdate.currentVersion} → new version {availableUpdate.version}
                </span>
              </div>

              <button type="button" className="icon-button" onClick={() => setUpdateModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="update-modal__body">
              <div className="update-modal__summary">
                <div className="update-modal__version-pill">v{availableUpdate.version}</div>
                <p>
                  Download installs the update quietly in the background. Restart switches the app to the new version.
                </p>
              </div>

              <div className="update-modal__notes">
                <strong>What&apos;s New</strong>
                <div className="update-modal__notes-content">
                  {availableUpdate.body?.trim() || "No release notes provided for this version."}
                </div>
              </div>

              <div className="update-modal__status">
                <strong>Status</strong>
                <span>
                  {updateStage === "ready"
                    ? "Update downloaded and installed. Restart to finish."
                    : updateStage === "downloading"
                      ? "Downloading and installing update..."
                      : "Ready to download this update."}
                </span>

                {updateStage === "downloading" ? (
                  <>
                    <div className="update-progress">
                      <span style={{ width: `${updateProgressPercent ?? 18}%` }} />
                    </div>
                    <div className="update-progress__meta">
                      <span>
                        {updateProgressPercent !== null
                          ? `${updateProgressPercent}%`
                          : "Preparing download..."}
                      </span>
                      <span>
                        {updateContentLength
                          ? `${Math.round(updateDownloadedBytes / 1024 / 1024)} / ${Math.round(updateContentLength / 1024 / 1024)} MB`
                          : `${Math.round(updateDownloadedBytes / 1024 / 1024)} MB`}
                      </span>
                    </div>
                  </>
                ) : null}

                {updateError ? <div className="update-modal__error">{updateError}</div> : null}
              </div>
            </div>

            <div className="update-modal__actions">
              <button type="button" className="secondary-button" onClick={() => setUpdateModalOpen(false)}>
                Later
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void handleDownloadUpdate()}
                disabled={updateStage !== "idle"}
              >
                {updateStage === "downloading" ? "Downloading..." : updateStage === "ready" ? "Downloaded" : "Download"}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleRestartForUpdate()}
                disabled={updateStage !== "ready"}
              >
                Restart
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
