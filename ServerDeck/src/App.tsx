import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { emit, listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update as AppUpdate } from "@tauri-apps/plugin-updater";
import packageJson from "../package.json";
import ReactECharts from "echarts-for-react";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import {
  Activity,
  ArrowLeft,
  ArrowLeftRight,
  Home,
  ChevronRight,
  Copy,
  Download,
  FolderOpen,
  Info,
  KeyRound,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  PlugZap,
  ShieldAlert,
  Save,
  Search,
  ScrollText,
  Server,
  SwatchBook,
  Wrench,
  TerminalSquare,
  Trash2,
  Users,
  X,
  RefreshCw,
  ExternalLink,
  FileText
} from "lucide-react";
import {
  clearAppData,
  cancelDownloadFromRemote,
  cancelUploadToRemote,
  closeTerminalSession,
  DEFAULT_PROJECT_ID,
  deleteLocalEntry,
  deleteHost,
  deleteRemoteEntry,
  duplicateHost,
  downloadFromRemote,
  getTerminalSessionCwd,
  listLocalDirectory,
  pickLocalDirectory,
  readLocalFilePreview,
  resizeTerminalSession,
  listRemoteDirectory,
  listHosts,
  loadAppPreferences,
  observeServer,
  openExternalUrl,
  resolveRemotePath,
  queryLocalEntrySize,
  saveHost,
  saveAppPreferences,
  startDownloadFromRemote,
  startLocalTerminalSession,
  startUploadToRemote,
  startTerminalSession,
  testConnection,
  writeTerminalInput,
  type FileEntry,
  type ManagedProject,
  type PortForward,
  type PortForwardStatus,
  listPortForwards,
  savePortForward,
  deletePortForward,
  startPortForward,
  stopPortForward,
  previewSshConfig,
  importSshConfig,
  listKnownHosts,
  removeKnownHost,
  listSshKeys,
  generateSshKey,
  readSshPublicKey,
  listSnippets,
  saveSnippet,
  deleteSnippet,
  type SnippetRecord,
  type KnownHostRecord,
  type SshKeyRecord,
  type SshConfigPreview,
  type AppPreferences,
  type LocalFilePreview,
  type SavedHost,
  type ServerObservation,
  type SshConnectionOptions,
  type TerminalEventPayload,
  type TerminalExitPayload,
  type TransferUpdatePayload
} from "./lib/api";
import { FileBrowserPane } from "./components/files/FileBrowserPane";
import { ProjectEditorModal } from "./components/projects/ProjectEditorModal";
import { CommandPalette } from "./components/commands/CommandPalette";
import { PortForwardEditorModal } from "./components/forwards/PortForwardEditorModal";
import { SshConfigModal } from "./components/hosts/SshConfigModal";
import { SnippetPanel } from "./components/snippets/SnippetPanel";
import { LocalTerminalWorkspace } from "./components/terminal/LocalTerminalWorkspace";
import {
  getDocumentLanguageTag,
  languageOptions,
  messagesByLanguage,
  type AppLanguage
} from "./lib/i18n";
import { formatFileSize, getParentPath, joinChildPath } from "./lib/fileBrowser";
import { detectSshErrorHint, type SshErrorHint } from "./lib/sshErrors";
import { isSettingsWindowView, openSettingsWindow } from "./lib/appWindow";
import {
  defaultTerminalThemeId,
  terminalThemePresets,
  type TerminalThemePreset
} from "./data/terminalThemes";

const appLogo = new URL("../src-tauri/icons/icon.png", import.meta.url).href;

const HOME_TAB_ID = "home";
const HOSTS_TAB_ID = "hosts";
const SFTP_TAB_ID = "sftp";
const FORWARDS_TAB_ID = "forwards";
const SETTINGS_TAB_ID = "settings";
const SETTINGS_STORAGE_KEY = "serverdeck.settings";
const LOCAL_TERMINAL_RECENT_PROJECTS_KEY = "serverdeck.localTerminalRecentProjects";
const RECENT_HOSTS_STORAGE_KEY = "serverdeck.recentHosts";
const RECENT_HOSTS_LIMIT = 8;
const DEFAULT_APP_SETTINGS: AppSettings = {
  appTheme: "dark",
  language: "en",
  projects: [],
  localTerminalDefaultPath: "",
  sshConnectTimeoutSeconds: 5,
  sshServerAliveIntervalSeconds: 30,
  terminalThemeId: defaultTerminalThemeId,
  terminalFontSize: 14,
  terminalCharset: "utf-8",
  tmuxPersistence: false
};

const blankHost: SavedHost = {
  id: "",
  label: "",
  projectId: DEFAULT_PROJECT_ID,
  address: "",
  port: 22,
  username: "root",
  authType: "password",
  password: ""
};

// author: BrianXiong
// time: 2026/10/18/00:10:00
const blankPortForward: PortForward = {
  id: "",
  label: "",
  kind: "local",
  bindHost: "127.0.0.1",
  bindPort: 0,
  targetHost: "127.0.0.1",
  targetPort: 0,
  hostId: "",
  autoStart: false
};

type DrawerMode = "new" | "edit";
type TerminalState = "connecting" | "connected" | "error" | "disconnected";

type TerminalTab = {
  id: string;
  sessionId: string;
  title: string;
  kind: "remote" | "local";
  host: SavedHost | null;
  cwd?: string;
  state: TerminalState;
  statusText: string;
};

type DeleteConfirmState = {
  side: "local" | "remote";
  entry: FileEntry;
};

type MonitorTab = {
  id: string;
  host: SavedHost;
  title: string;
  observation: ServerObservation | null;
  history: Array<{
    capturedAt: string;
    cpu: number | null;
    memory: number | null;
    disk: number | null;
  }>;
  loading: boolean;
  error: string;
};

type PreferencesSyncPayload = {
  source: "main" | "settings";
  settings: AppPreferences["settings"];
  recentProjectIds: string[];
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
  status: "running" | "success" | "error" | "cancelled";
  detail: string;
  progressPercent?: number;
  transferredBytes?: number;
  totalBytes?: number;
  host?: SavedHost;
  remoteDir?: string;
  localTargetPath?: string;
};

type TerminalCharset = "utf-8" | "gb18030" | "gbk" | "big5";
type TerminalViewportSyncMode = "immediate" | "resize";

type AppSettings = {
  appTheme: "light" | "dark";
  language: AppLanguage;
  projects: ManagedProject[];
  localTerminalDefaultPath: string;
  sshConnectTimeoutSeconds: number;
  sshServerAliveIntervalSeconds: number;
  terminalThemeId: string;
  terminalFontSize: number;
  terminalCharset: TerminalCharset;
  tmuxPersistence: boolean;
};

type UpdateStage = "idle" | "downloading" | "ready";
type UpdateCheckState = "idle" | "checking" | "available" | "upToDate" | "error" | "unsupported";
type SettingsSectionId = "general" | "projects" | "terminal" | "ssh" | "about" | "danger";
type ProjectEditorMode = "new" | "edit";
type LocalTerminalSource = "default" | "project" | "directory";


const terminalFontSizeOptions = [
  { label: "S", value: 12 },
  { label: "M", value: 14 },
  { label: "L", value: 16 }
] as const;

const terminalCharsetOptions: Array<{ label: string; value: TerminalCharset }> = [
  { label: "UTF-8", value: "utf-8" },
  { label: "GB18030", value: "gb18030" },
  { label: "GBK", value: "gbk" },
  { label: "Big5", value: "big5" }
];

const sshConnectTimeoutOptions = [5, 10, 15, 30] as const;
const sshServerAliveIntervalOptions = [15, 30, 60, 120] as const;

// author: BrianXiong
// time: 2026/04/05/11:21:34
function isTerminalCharset(value: unknown): value is TerminalCharset {
  return terminalCharsetOptions.some((option) => option.value === value);
}

// author: BrianXiong
// time: 2026/04/05/11:21:34
function createTerminalDecoder(charset: TerminalCharset) {
  try {
    return new TextDecoder(charset);
  } catch {
    return new TextDecoder("utf-8");
  }
}

// author: BrianXiong
// time: 2026/04/05/11:21:34
function getTerminalControlSequence(event: KeyboardEvent) {
  if (event.type !== "keydown") {
    return null;
  }

  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
    return null;
  }

  switch (event.key) {
    case "Delete":
      return "\u001b[3~";
    default:
      return null;
  }
}

// author: BrianXiong
// time: 2026/04/15/17:58:00
function isTerminalViewportNearBottom(terminal: Terminal) {
  const activeBuffer = terminal.buffer.active;
  return activeBuffer.baseY - activeBuffer.viewportY <= 1;
}

const MAX_TERMINAL_BUFFER_CHUNKS = 800;
const MAX_TERMINAL_BUFFER_CHARS = 400_000;
const TERMINAL_VIEWPORT_RESIZE_DEBOUNCE_MS = 80;

// author: BrianXiong
// time: 2026/04/15/18:20:00
function appendTerminalBufferChunk(buffer: string[], chunk: string) {
  const nextBuffer = [...buffer, chunk];
  let totalChars = nextBuffer.reduce((sum, item) => sum + item.length, 0);

  while (nextBuffer.length > MAX_TERMINAL_BUFFER_CHUNKS || totalChars > MAX_TERMINAL_BUFFER_CHARS) {
    const removed = nextBuffer.shift();
    totalChars -= removed?.length ?? 0;
  }

  return nextBuffer;
}

const blankProject: ManagedProject = {
  id: "",
  name: "",
  namespace: "",
  path: "",
  projectType: "local"
};

// author: BrianXiong
// time: 2026/04/06/11:42:03
function normalizeAppSettings(parsed: Partial<AppSettings>): AppSettings {
  return {
    appTheme: parsed.appTheme === "light" ? "light" : DEFAULT_APP_SETTINGS.appTheme,
    language: languageOptions.find((item) => item.value === parsed.language)?.value ?? DEFAULT_APP_SETTINGS.language,
    projects:
      Array.isArray(parsed.projects)
        ? parsed.projects
            .map((project) => ({
              id: typeof project?.id === "string" && project.id.trim() ? project.id : crypto.randomUUID(),
              name: typeof project?.name === "string" ? project.name : "",
              namespace: typeof project?.namespace === "string" ? project.namespace : "",
              path: typeof project?.path === "string" ? project.path : "",
              projectType:
                project?.projectType === "server" || project?.projectType === "hybrid" || project?.projectType === "local"
                  ? project.projectType
                  : "local"
            }))
            .filter((project) => project.name.trim())
        : DEFAULT_APP_SETTINGS.projects,
    localTerminalDefaultPath:
      typeof parsed.localTerminalDefaultPath === "string"
        ? parsed.localTerminalDefaultPath
        : DEFAULT_APP_SETTINGS.localTerminalDefaultPath,
    sshConnectTimeoutSeconds:
      typeof parsed.sshConnectTimeoutSeconds === "number" &&
      sshConnectTimeoutOptions.includes(parsed.sshConnectTimeoutSeconds as (typeof sshConnectTimeoutOptions)[number])
        ? parsed.sshConnectTimeoutSeconds
        : DEFAULT_APP_SETTINGS.sshConnectTimeoutSeconds,
    sshServerAliveIntervalSeconds:
      typeof parsed.sshServerAliveIntervalSeconds === "number" &&
      sshServerAliveIntervalOptions.includes(parsed.sshServerAliveIntervalSeconds as (typeof sshServerAliveIntervalOptions)[number])
        ? parsed.sshServerAliveIntervalSeconds
        : DEFAULT_APP_SETTINGS.sshServerAliveIntervalSeconds,
    terminalThemeId:
      terminalThemePresets.find((item) => item.id === parsed.terminalThemeId)?.id ?? defaultTerminalThemeId,
    terminalFontSize:
      typeof parsed.terminalFontSize === "number" && parsed.terminalFontSize >= 10 && parsed.terminalFontSize <= 24
        ? parsed.terminalFontSize
        : DEFAULT_APP_SETTINGS.terminalFontSize,
    terminalCharset: isTerminalCharset(parsed.terminalCharset)
      ? parsed.terminalCharset
      : DEFAULT_APP_SETTINGS.terminalCharset,
    tmuxPersistence:
      typeof parsed.tmuxPersistence === "boolean" ? parsed.tmuxPersistence : DEFAULT_APP_SETTINGS.tmuxPersistence
  };
}

function getHostTitle(host: SavedHost, fallback = "Untitled Host") {
  return host.label.trim() || host.address.trim() || fallback;
}

function getHostBadge(host: SavedHost, fallback = "Untitled Host") {
  return getHostTitle(host, fallback).slice(0, 1).toUpperCase();
}

function hasTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

// author: BrianXiong
// time: 2026/10/17/23:40:00
// Recent connections only power the command palette ordering, so a storage
// failure must never break the app: fall back to an empty list.
function readRecentHostIds(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_HOSTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string").slice(0, RECENT_HOSTS_LIMIT);
  } catch {
    return [];
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

function getExpandedErrorMessage(error: unknown, fallback: string) {
  const parts: string[] = [];

  function appendValue(value: unknown) {
    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        parts.push(trimmed);
      }
      return;
    }

    if (value instanceof Error) {
      appendValue(value.message);

      const cause = (value as Error & { cause?: unknown }).cause;
      if (cause) {
        appendValue(cause);
      }
      return;
    }

    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      const preferredKeys = [
        "message",
        "error",
        "code",
        "type",
        "kind",
        "url",
        "status",
        "statusText",
        "details",
        "cause"
      ];

      preferredKeys.forEach((key) => {
        if (key in record) {
          const keyValue = record[key];
          if (typeof keyValue === "string" || keyValue instanceof Error || typeof keyValue === "object") {
            appendValue(keyValue);
          } else if (typeof keyValue === "number" || typeof keyValue === "boolean") {
            parts.push(`${key}: ${String(keyValue)}`);
          }
        }
      });

      try {
        const serialized = JSON.stringify(value);
        if (serialized && serialized !== "{}") {
          parts.push(serialized);
        }
      } catch {
        return;
      }
    }
  }

  appendValue(error);

  const uniqueParts = parts.filter((part, index) => parts.indexOf(part) === index);
  return uniqueParts.length ? uniqueParts.join(" | ") : fallback;
}

function formatObservationCapturedAt(value: string) {
  if (!value) return "-";
  const numeric = Number(value);
  const date = Number.isNaN(numeric) ? new Date(value) : new Date(numeric);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function parsePercentValue(value: string) {
  const match = value.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
}

function buildMonitorHistoryPoint(observation: ServerObservation) {
  return {
    capturedAt: observation.capturedAt,
    cpu: parsePercentValue(observation.cpuUsage),
    memory: parsePercentValue(observation.memoryPercent),
    disk: parsePercentValue(observation.diskPercent)
  };
}

function appendMonitorHistory(
  history: MonitorTab["history"],
  observation: ServerObservation
) {
  const next = [...history, buildMonitorHistoryPoint(observation)];
  return next.slice(-20);
}

function MetricChartCard({
  label,
  value,
  detail,
  history,
  accent = "var(--blue)"
}: {
  label: string;
  value: string;
  detail: string;
  history: Array<number | null>;
  accent?: string;
}) {
  const percent = parsePercentValue(value);
  const settingsTextColor =
    typeof window !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--settings-text").trim() || "#1f2f4a"
      : "#1f2f4a";
  const option = {
    animation: true,
    backgroundColor: "transparent",
    series: [
      {
        type: "gauge",
        center: ["50%", "60%"],
        radius: "84%",
        startAngle: 220,
        endAngle: -40,
        min: 0,
        max: 100,
        splitNumber: 10,
        axisLine: {
          lineStyle: {
            width: 14,
            color: [
              [0.35, "#57e0df"],
              [0.75, "#2f8de1"],
              [1, "#ff6a6a"]
            ]
          }
        },
        progress: {
          show: false
        },
        axisTick: {
          distance: -18,
          splitNumber: 4,
          length: 7,
          lineStyle: { color: "rgba(255,255,255,0.78)", width: 1.4 }
        },
        splitLine: {
          distance: -20,
          length: 16,
          lineStyle: { color: "rgba(255,255,255,0.95)", width: 2.5 }
        },
        axisLabel: {
          distance: -28,
          color: "#59a9e8",
          fontSize: 12,
          fontWeight: 600
        },
        pointer: {
          show: true,
          icon: "path://M2 0 L-6 0 L0 -58 L6 0 Z",
          length: "62%",
          width: 10,
          offsetCenter: [0, "6%"],
          itemStyle: { color: accent, shadowBlur: 8, shadowColor: `${accent}55` }
        },
        anchor: {
          show: true,
          size: 14,
          itemStyle: { color: "#182033", borderColor: `${accent}`, borderWidth: 3 }
        },
        title: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, "54%"],
          formatter: (val: number) => `${Math.round(val)}%`,
          color: settingsTextColor,
          fontSize: 26,
          fontWeight: 800,
          textBorderWidth: 0
        },
        data: [{ value: percent ?? 0 }]
      }
    ]
  };

  return (
    <div className="gauge-card">
      <div className="gauge-card__header">
        <strong>{label}</strong>
        <div className="gauge-card__value-badge">{percent !== null ? `${Math.round(percent)}%` : "--"}</div>
      </div>

      <ReactECharts option={option} className="gauge-card__echart" notMerge lazyUpdate />
      <div className="gauge-card__detail">{detail}</div>
    </div>
  );
}

function ProcessBarChart({
  processes,
  cpuLabel,
  memoryLabel,
  emptyLabel,
  pidLabel,
  topFiveLabel,
  topTenLabel
}: {
  processes: ServerObservation["topProcesses"];
  cpuLabel: string;
  memoryLabel: string;
  emptyLabel: string;
  pidLabel: string;
  topFiveLabel: string;
  topTenLabel: string;
}) {
  const [metric, setMetric] = useState<"cpu" | "memory">("cpu");
  const [limit, setLimit] = useState<5 | 10>(5);

  const sorted = [...processes]
    .sort((left, right) =>
      metric === "cpu" ? right.cpuPercent - left.cpuPercent : right.memoryPercent - left.memoryPercent
    )
    .slice(0, limit);

  if (!sorted.length) {
    return <span>{emptyLabel}</span>;
  }

  const option = {
    animation: true,
    backgroundColor: "transparent",
    grid: {
      left: 110,
      right: 16,
      top: 12,
      bottom: 16
    },
    xAxis: {
      type: "value",
      axisLabel: { color: "#7f91aa" },
      splitLine: { lineStyle: { color: "rgba(125,177,255,0.10)" } }
    },
    yAxis: {
      type: "category",
      data: sorted.map((item) => item.command),
      axisLabel: { color: "#7f91aa" },
      axisTick: { show: false },
      axisLine: { show: false }
    },
    series: [
      {
        type: "bar",
        data: sorted.map((item) => ({
          value: metric === "cpu" ? item.cpuPercent : item.memoryPercent,
          pid: item.pid,
          command: item.command,
          cpuPercent: item.cpuPercent,
          memoryPercent: item.memoryPercent
        })),
        barWidth: 16,
        itemStyle: {
          borderRadius: 999,
          color: (params: { value: number }) => {
            const current = params.value;
            if (current >= 80) return "#ff5a6f";
            if (current >= 55) return "#ffb020";
            return metric === "cpu" ? "#4da3ff" : "#7d5cff";
          }
        },
        label: {
          show: true,
          position: "right",
          color: "#cbd7e9",
          formatter: (params: { value: number; data: { pid: string } }) => `${params.value}% · ${pidLabel} ${params.data.pid}`
        }
      }
    ],
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (items: Array<{ data: { command: string; pid: string; cpuPercent: number; memoryPercent: number } }>) => {
        const item = items[0]?.data;
        if (!item) return "";
        return [
          `<strong>${item.command}</strong>`,
          `${pidLabel}: ${item.pid}`,
          `${cpuLabel}: ${item.cpuPercent}%`,
          `${memoryLabel}: ${item.memoryPercent}%`
        ].join("<br/>");
      }
    }
  };

  return (
    <div className="process-chart">
      <div className="process-chart__tabs">
        <button
          type="button"
          className={`settings-chip ${metric === "cpu" ? "settings-chip--active" : ""}`}
          onClick={() => setMetric("cpu")}
        >
          {cpuLabel}
        </button>
        <button
          type="button"
          className={`settings-chip ${metric === "memory" ? "settings-chip--active" : ""}`}
          onClick={() => setMetric("memory")}
        >
          {memoryLabel}
        </button>
        <button
          type="button"
          className={`settings-chip ${limit === 5 ? "settings-chip--active" : ""}`}
          onClick={() => setLimit(5)}
        >
          {topFiveLabel}
        </button>
        <button
          type="button"
          className={`settings-chip ${limit === 10 ? "settings-chip--active" : ""}`}
          onClick={() => setLimit(10)}
        >
          {topTenLabel}
        </button>
      </div>
      <ReactECharts option={option} className="process-chart__echart" notMerge lazyUpdate />
    </div>
  );
}

// author: BrianXiong
// time: 2026/04/05/11:21:34
export default function App() {
  const detachedSettingsWindow = isSettingsWindowView();
  const preferenceSyncSource = detachedSettingsWindow ? "settings" : "main";

  const [activeTabId, setActiveTabId] = useState(() => (detachedSettingsWindow ? SETTINGS_TAB_ID : HOME_TAB_ID));
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [monitorTabs, setMonitorTabs] = useState<MonitorTab[]>([]);
  const [hosts, setHosts] = useState<SavedHost[]>([]);
  const [selectedId, setSelectedId] = useState("");
  // author: BrianXiong
  // time: 2026/07/21/00:00:00
  // The SFTP view keeps its own host selection (empty by default) so entering
  // the view never triggers keychain/SSH auth until the user picks a server.
  const [sftpHostId, setSftpHostId] = useState("");
  const [draft, setDraft] = useState<SavedHost>(blankHost);
  const [search, setSearch] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [recentHostIds, setRecentHostIds] = useState<string[]>(() => readRecentHostIds());
  const [portForwards, setPortForwards] = useState<PortForwardStatus[]>([]);
  const [forwardEditorOpen, setForwardEditorOpen] = useState(false);
  const [forwardEditorMode, setForwardEditorMode] = useState<"new" | "edit">("new");
  const [forwardDraft, setForwardDraft] = useState<PortForward>(blankPortForward);
  const [forwardBusyId, setForwardBusyId] = useState("");
  const [forwardPendingDeleteId, setForwardPendingDeleteId] = useState("");
  const [sshConfigOpen, setSshConfigOpen] = useState(false);
  const [sshConfigPreview, setSshConfigPreview] = useState<SshConfigPreview | null>(null);
  const [sshConfigSelected, setSshConfigSelected] = useState<string[]>([]);
  const [sshConfigBusy, setSshConfigBusy] = useState(false);
  const [knownHosts, setKnownHosts] = useState<KnownHostRecord[]>([]);
  const [knownHostsLoading, setKnownHostsLoading] = useState(false);
  const [sshKeys, setSshKeys] = useState<SshKeyRecord[]>([]);
  const [sshKeyName, setSshKeyName] = useState("");
  const [sshKeyComment, setSshKeyComment] = useState("");
  const [sshKeyBusy, setSshKeyBusy] = useState(false);
  const [snippets, setSnippets] = useState<SnippetRecord[]>([]);
  const [snippetPanelOpen, setSnippetPanelOpen] = useState(false);
  const [snippetBusy, setSnippetBusy] = useState(false);
  const [snippetPendingDeleteId, setSnippetPendingDeleteId] = useState("");
  const [snippetPendingRunId, setSnippetPendingRunId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("new");
  const [status, setStatus] = useState(messagesByLanguage[DEFAULT_APP_SETTINGS.language].ready);
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [busy, setBusy] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [fileMenu, setFileMenu] = useState<FileMenuState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [terminalMountNode, setTerminalMountNode] = useState<HTMLDivElement | null>(null);
  const [transferJobs, setTransferJobs] = useState<TransferJob[]>([]);
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdate | null>(null);
  const [appVersion, setAppVersion] = useState(packageJson.version);
  const [updateCheckState, setUpdateCheckState] = useState<UpdateCheckState>(
    hasTauriRuntime() ? "idle" : "unsupported"
  );
  const [updateCheckError, setUpdateCheckError] = useState("");
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateStage, setUpdateStage] = useState<UpdateStage>("idle");
  const [updateDownloadedBytes, setUpdateDownloadedBytes] = useState(0);
  const [updateContentLength, setUpdateContentLength] = useState<number | null>(null);
  const [updateError, setUpdateError] = useState("");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>("general");
  const [projectEditorOpen, setProjectEditorOpen] = useState(false);
  const [projectEditorMode, setProjectEditorMode] = useState<ProjectEditorMode>("new");
  const [projectDraft, setProjectDraft] = useState<ManagedProject>(blankProject);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [localTerminalMenuOpen, setLocalTerminalMenuOpen] = useState(false);
  const [localTerminalProjectSearch, setLocalTerminalProjectSearch] = useState("");
  const [recentLocalProjectIds, setRecentLocalProjectIds] = useState<string[]>([]);
  const [activeHostProjectId, setActiveHostProjectId] = useState<string | null>(null);
  const [monitorInfoOpen, setMonitorInfoOpen] = useState(false);
  const [monitorInfoCopied, setMonitorInfoCopied] = useState(false);
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
  const [localPreviewOpen, setLocalPreviewOpen] = useState(false);
  const [localBrowserSelectedPath, setLocalBrowserSelectedPath] = useState("");
  const [localPreviewPath, setLocalPreviewPath] = useState("");
  const [localPreview, setLocalPreview] = useState<LocalFilePreview | null>(null);
  const [localPreviewLoading, setLocalPreviewLoading] = useState(false);
  const [localPreviewError, setLocalPreviewError] = useState("");
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [terminalSearchOpen, setTerminalSearchOpen] = useState(false);
  const [terminalSearchQuery, setTerminalSearchQuery] = useState("");
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(RECENT_HOSTS_STORAGE_KEY, JSON.stringify(recentHostIds));
    } catch {
      // Recents are a convenience only; ignore storage failures.
    }
  }, [recentHostIds]);

  // author: BrianXiong
  // time: 2026/10/17/23:40:00
  // Cmd+K opens the quick connect palette from anywhere, including a focused
  // terminal. Clearing the terminal screen moved to Cmd+Shift+K.
  useEffect(() => {
    const handlePaletteShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handlePaletteShortcut);
    return () => window.removeEventListener("keydown", handlePaletteShortcut);
  }, []);

  const terminalEl = useRef<HTMLDivElement | null>(null);
  const localTerminalMenuRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const terminalSearchInputRef = useRef<HTMLInputElement | null>(null);
  const terminalDecodersRef = useRef<Map<string, TextDecoder>>(new Map());
  const terminalBuffersRef = useRef<Map<string, string[]>>(new Map());
  const terminalShouldStickToBottomRef = useRef(true);
  const terminalWriteQueueRef = useRef<string[]>([]);
  const terminalWriteFrameRef = useRef<number | null>(null);
  const terminalViewportSyncRef = useRef<((mode: TerminalViewportSyncMode) => void) | null>(null);
  const activeTabIdRef = useRef(HOME_TAB_ID);
  const previousTabIdRef = useRef(HOME_TAB_ID);
  const terminalTabsRef = useRef<TerminalTab[]>([]);
  const monitorTabsRef = useRef<MonitorTab[]>([]);
  const skipPreferenceSyncRef = useRef(false);

  const isHomeView = activeTabId === HOME_TAB_ID;
  const isHostsView = activeTabId === HOSTS_TAB_ID;
  const isSftpView = activeTabId === SFTP_TAB_ID;
  const isForwardsView = activeTabId === FORWARDS_TAB_ID;
  const isSettingsView = activeTabId === SETTINGS_TAB_ID;

  const selectedHost = useMemo(
    () => hosts.find((item) => item.id === selectedId) ?? null,
    [hosts, selectedId]
  );

  const sftpHost = useMemo(
    () => hosts.find((item) => item.id === sftpHostId) ?? null,
    [hosts, sftpHostId]
  );

  const activeTerminalTab = useMemo(
    () => terminalTabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, terminalTabs]
  );
  // author: BrianXiong
  // time: 2026/10/18/01:40:00
  // Snippets are sent to the terminal the user was last working in, which is not
  // necessarily the active tab while the snippets panel is open.
  const lastTerminalTabIdRef = useRef("");

  useEffect(() => {
    if (terminalTabs.some((tab) => tab.id === activeTabId)) {
      lastTerminalTabIdRef.current = activeTabId;
    }
  }, [activeTabId, terminalTabs]);

  const isLocalTerminalView = activeTerminalTab?.kind === "local";
  const selectedLocalBrowserEntry = useMemo(
    () => localEntries.find((entry) => entry.path === localBrowserSelectedPath) ?? null,
    [localBrowserSelectedPath, localEntries]
  );

  const activeMonitorTab = useMemo(
    () => monitorTabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, monitorTabs]
  );

  const activeTerminalTheme = useMemo<TerminalThemePreset>(
    () => terminalThemePresets.find((item) => item.id === settings.terminalThemeId) ?? terminalThemePresets[0],
    [settings.terminalThemeId]
  );

  const handleTerminalMount = useCallback((element: HTMLDivElement | null) => {
    terminalEl.current = element;
    setTerminalMountNode(element);
  }, []);

  const messages = useMemo(() => messagesByLanguage[settings.language], [settings.language]);
  const sshOptions = useMemo<SshConnectionOptions>(
    () => ({
      connectTimeoutSeconds: settings.sshConnectTimeoutSeconds,
      serverAliveIntervalSeconds: settings.sshServerAliveIntervalSeconds
    }),
    [settings.sshConnectTimeoutSeconds, settings.sshServerAliveIntervalSeconds]
  );

  // author: BrianXiong
  // time: 2026/04/05/11:21:34
  const sendActiveTerminalInput = useCallback((data: string) => {
    const currentActiveTab = terminalTabsRef.current.find((tab) => tab.id === activeTabIdRef.current);
    if (!currentActiveTab) {
      return;
    }

    void writeTerminalInput(currentActiveTab.sessionId, data);
  }, []);

  // author: BrianXiong
  // time: 2026/04/05/11:21:34
  const decodeTerminalPayload = useCallback(
    (payload: TerminalEventPayload) => {
      if (Array.isArray(payload.bytes)) {
        let decoder = terminalDecodersRef.current.get(payload.sessionId);
        if (!decoder) {
          decoder = createTerminalDecoder(settings.terminalCharset);
          terminalDecodersRef.current.set(payload.sessionId, decoder);
        }
        return decoder.decode(new Uint8Array(payload.bytes), { stream: true });
      }

      return payload.data ?? "";
    },
    [settings.terminalCharset]
  );

  // author: BrianXiong
  // time: 2026/04/21/11:06:00
  const flushActiveTerminalOutput = useCallback(() => {
    if (terminalWriteFrameRef.current !== null) {
      return;
    }

    terminalWriteFrameRef.current = window.requestAnimationFrame(() => {
      terminalWriteFrameRef.current = null;

      const terminal = terminalRef.current;
      if (!terminal) {
        terminalWriteQueueRef.current = [];
        return;
      }

      const queuedChunks = terminalWriteQueueRef.current;
      if (queuedChunks.length === 0) {
        return;
      }

      terminalWriteQueueRef.current = [];
      const nextOutput = queuedChunks.join("");
      const shouldStickToBottom = terminalShouldStickToBottomRef.current || isTerminalViewportNearBottom(terminal);

      terminal.write(nextOutput, () => {
        if (shouldStickToBottom) {
          terminal.scrollToBottom();
          terminalShouldStickToBottomRef.current = true;
          return;
        }

        terminalShouldStickToBottomRef.current = isTerminalViewportNearBottom(terminal);
      });
    });
  }, []);

  // author: BrianXiong
  // time: 2026/04/21/11:06:00
  const enqueueActiveTerminalOutput = useCallback(
    (chunk: string) => {
      terminalWriteQueueRef.current.push(chunk);
      flushActiveTerminalOutput();
    },
    [flushActiveTerminalOutput]
  );

  // author: BrianXiong
  // time: 2026/07/21/00:00:00
  // Terminal search (Cmd+F): incremental highlight while typing, Enter/Shift+Enter
  // to jump between matches, Esc to close and return focus to the terminal.
  function findInTerminal(direction: "next" | "previous") {
    const addon = searchAddonRef.current;
    const query = terminalSearchQuery.trim();
    if (!addon || !query) {
      return;
    }

    if (direction === "next") {
      addon.findNext(query);
    } else {
      addon.findPrevious(query);
    }
  }

  function closeTerminalSearch() {
    setTerminalSearchOpen(false);
    setTerminalSearchQuery("");
    searchAddonRef.current?.clearDecorations();
    terminalRef.current?.focus();
  }

  useEffect(() => {
    if (!terminalSearchOpen) {
      return;
    }

    const addon = searchAddonRef.current;
    if (!addon) {
      return;
    }

    const query = terminalSearchQuery.trim();
    if (!query) {
      addon.clearDecorations();
      return;
    }

    addon.findNext(query, { incremental: true });
  }, [terminalSearchOpen, terminalSearchQuery]);

  // author: BrianXiong
  // time: 2026/07/21/00:00:00
  // Keep a ref to the latest close handler so the global shortcut listener
  // (registered once) never calls a stale closure.
  const closeTerminalTabRef = useRef<(tabId: string) => void>(() => {});
  closeTerminalTabRef.current = (tabId: string) => {
    void handleCloseTerminalTab(tabId);
  };

  // Terminal keyboard shortcuts: Cmd+1-9 switch tabs, and on an active
  // terminal tab Cmd+W closes it, Cmd+Shift+K clears the screen, Cmd+F searches.
  // Cmd+K itself is reserved for the quick connect palette.
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const digit = Number.parseInt(event.key, 10);
      if (digit >= 1 && digit <= 9) {
        const target = terminalTabsRef.current[digit - 1];
        if (target) {
          event.preventDefault();
          setActiveTabId(target.id);
        }
        return;
      }

      const activeTab = terminalTabsRef.current.find((tab) => tab.id === activeTabIdRef.current);
      if (!activeTab) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "w") {
        event.preventDefault();
        closeTerminalTabRef.current(activeTab.id);
        return;
      }

      if (key === "k" && event.shiftKey) {
        event.preventDefault();
        terminalRef.current?.clear();
        return;
      }

      if (key === "f") {
        event.preventDefault();
        setTerminalSearchOpen(true);
        window.setTimeout(() => terminalSearchInputRef.current?.select(), 0);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const appThemeOptions = useMemo(
    () => [
      { label: messages.light, value: "light" },
      { label: messages.dark, value: "dark" }
    ] as const,
    [messages.dark, messages.light]
  );


  const getDisplayHostTitle = useCallback(
    (host: SavedHost) => getHostTitle(host, messages.untitledHost),
    [messages.untitledHost]
  );

  const getDisplayHostBadge = useCallback(
    (host: SavedHost) => getHostBadge(host, messages.untitledHost),
    [messages.untitledHost]
  );

  const projectOptions = useMemo(
    () => [
      { id: DEFAULT_PROJECT_ID, name: messages.defaultProject },
      ...settings.projects
        .filter((project) => project.projectType === "server" || project.projectType === "hybrid")
        .map((project) => ({ id: project.id, name: project.name }))
    ],
    [messages.defaultProject, settings.projects]
  );

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    projectOptions.forEach((project) => {
      map.set(project.id, project.name);
    });
    return map;
  }, [projectOptions]);

  const localTerminalProjects = useMemo(
    () => settings.projects.filter((project) => project.path.trim() && (project.projectType === "local" || project.projectType === "hybrid")),
    [settings.projects]
  );


  const recentLocalProjects = useMemo(
    () => recentLocalProjectIds
      .map((projectId) => localTerminalProjects.find((project) => project.id === projectId) ?? null)
      .filter((project): project is ManagedProject => Boolean(project)),
    [localTerminalProjects, recentLocalProjectIds]
  );

  const filteredLocalTerminalProjects = useMemo(() => {
    const keyword = localTerminalProjectSearch.trim().toLowerCase();
    if (!keyword) {
      return localTerminalProjects;
    }

    return localTerminalProjects.filter((project) =>
      [project.name, project.namespace, project.path].some((value) => value.toLowerCase().includes(keyword))
    );
  }, [localTerminalProjectSearch, localTerminalProjects]);

  const settingsNavItems = useMemo(
    () => [
      { id: "general" as const, label: messages.general, icon: Wrench },
      { id: "projects" as const, label: messages.projects, icon: FolderOpen },
      { id: "terminal" as const, label: messages.terminal, icon: TerminalSquare },
      { id: "ssh" as const, label: messages.sshSettings, icon: KeyRound },
      { id: "about" as const, label: messages.about, icon: Info },
      { id: "danger" as const, label: messages.dangerZone, icon: ShieldAlert }
    ],
    [messages.about, messages.dangerZone, messages.general, messages.projects, messages.sshSettings, messages.terminal]
  );

  // author: BrianXiong
  // time: 2026/04/08/16:24:00


  // author: BrianXiong
  // time: 2026/04/08/16:24:00

  const sshConfigPendingCount = useMemo(
    () => (sshConfigPreview?.entries ?? []).filter((entry) => entry.state !== "unchanged").length,
    [sshConfigPreview]
  );

  const filteredHosts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return hosts;

    return hosts.filter((host) => {
      const haystack = [
        host.label,
        host.address,
        host.username,
        String(host.port),
        projectNameById.get(host.projectId) ?? messages.defaultProject
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [hosts, messages.defaultProject, projectNameById, search]);

  const groupedHosts = useMemo(() => {
    const groups = new Map<string, SavedHost[]>();
    const keyword = search.trim().toLowerCase();

    projectOptions.forEach((project) => {
      groups.set(project.id, []);
    });

    filteredHosts.forEach((host) => {
      const projectId = projectNameById.has(host.projectId) ? host.projectId : DEFAULT_PROJECT_ID;
      const items = groups.get(projectId) ?? [];
      items.push({ ...host, projectId });
      groups.set(projectId, items);
    });

    return projectOptions
      .map((project) => ({
        id: project.id,
        name: project.name,
        hosts: groups.get(project.id) ?? []
      }))
      .filter((group) => !keyword || group.hosts.length > 0 || group.name.toLowerCase().includes(keyword));
  }, [filteredHosts, projectNameById, projectOptions, search]);

  const activeHostGroup = useMemo(
    () => groupedHosts.find((group) => group.id === activeHostProjectId) ?? null,
    [activeHostProjectId, groupedHosts]
  );

  const updateProgressPercent = useMemo(() => {
    if (!updateContentLength || updateContentLength <= 0) {
      return null;
    }

    return Math.min(100, Math.round((updateDownloadedBytes / updateContentLength) * 100));
  }, [updateContentLength, updateDownloadedBytes]);

  async function refreshHosts(nextSelectedId?: string) {
    const items = (await listHosts()).map((item) => ({
      ...item,
      projectId: item.projectId || DEFAULT_PROJECT_ID
    }));
    setHosts(items);

    const preferredId = nextSelectedId !== undefined ? nextSelectedId : selectedId;
    const finalSelectedId = items.find((item) => item.id === preferredId)?.id ?? items[0]?.id ?? "";
    setSelectedId(finalSelectedId);
  }

  useEffect(() => {
    void refreshHosts();
  }, []);

  // author: BrianXiong
  // time: 2026/10/18/00:10:00
  const refreshPortForwards = useCallback(async () => {
    try {
      setPortForwards(await listPortForwards());
    } catch (error) {
      setStatus(getErrorMessage(error, messages.forwardsLoadFailed));
      setStatusTone("error");
    }
  }, [messages]);

  useEffect(() => {
    if (isForwardsView) {
      void refreshPortForwards();
    }
  }, [isForwardsView, refreshPortForwards]);

  // author: BrianXiong
  // time: 2026/10/18/00:35:00
  // `~/.ssh/config` is re-read whenever the hosts screen opens so the toolbar
  // can show how many aliases are new or changed.
  const refreshSshConfigPreview = useCallback(async (options?: { silent?: boolean }) => {
    try {
      setSshConfigPreview(await previewSshConfig());
    } catch (error) {
      if (!options?.silent) {
        setStatus(getErrorMessage(error, messages.sshConfigLoadFailed));
        setStatusTone("error");
      }
    }
  }, [messages]);

  useEffect(() => {
    if (isHostsView) {
      void refreshSshConfigPreview({ silent: true });
    }
  }, [isHostsView, refreshSshConfigPreview]);


  const checkForUpdates = useCallback(async (options?: { silent?: boolean }) => {
    if (!hasTauriRuntime()) {
      setUpdateCheckState("unsupported");
      setUpdateCheckError("");
      return null;
    }

    setUpdateCheckState("checking");
    setUpdateCheckError("");

    if (!options?.silent) {
      setStatus(messages.checkingForUpdates);
      setStatusTone("neutral");
    }

    try {
      const update = await check();
      setAvailableUpdate(update);

      if (update) {
        setUpdateCheckState("available");

        if (!options?.silent) {
          setStatus(messages.updateAvailableStatus(update.version));
          setStatusTone("success");
        }

        return update;
      }

      setUpdateCheckState("upToDate");

      if (!options?.silent) {
        setStatus(messages.latestVersion);
        setStatusTone("success");
      }

      return null;
    } catch (error) {
      const message = getExpandedErrorMessage(error, messages.updateCheckFailed);
      console.error("[serverdeck] update check failed", error);
      setAvailableUpdate(null);
      setUpdateCheckState("error");
      setUpdateCheckError(message);

      if (!options?.silent) {
        setStatus(message);
        setStatusTone("error");
      }

      return null;
    }
  }, [messages]);

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
    if (hasTauriRuntime()) {
      let cancelled = false;

      void loadAppPreferences()
        .then((payload: AppPreferences) => {
          if (cancelled) {
            return;
          }

          const hasStoredData = payload.settings.projects.length > 0 || payload.recentProjectIds.length > 0;
          const legacySettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
          const legacyRecentProjects = window.localStorage.getItem(LOCAL_TERMINAL_RECENT_PROJECTS_KEY);

          if (!hasStoredData && legacySettings) {
            try {
              const parsedSettings = JSON.parse(legacySettings) as Partial<AppSettings>;
              const nextSettings = normalizeAppSettings(parsedSettings);
              const parsedRecentProjects = legacyRecentProjects ? (JSON.parse(legacyRecentProjects) as string[]) : [];
              const nextRecentProjects = Array.isArray(parsedRecentProjects)
                ? parsedRecentProjects.filter((item) => typeof item === "string")
                : [];

              setSettings(nextSettings);
              setRecentLocalProjectIds(nextRecentProjects);
              void saveAppPreferences({ settings: nextSettings as AppPreferences["settings"], recentProjectIds: nextRecentProjects });
              window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
              window.localStorage.removeItem(LOCAL_TERMINAL_RECENT_PROJECTS_KEY);
            } catch {
              window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
              window.localStorage.removeItem(LOCAL_TERMINAL_RECENT_PROJECTS_KEY);
              setSettings(normalizeAppSettings(payload.settings as Partial<AppSettings>));
              setRecentLocalProjectIds(payload.recentProjectIds);
            }
          } else {
            setSettings(normalizeAppSettings(payload.settings as Partial<AppSettings>));
            setRecentLocalProjectIds(payload.recentProjectIds);
          }

          setPreferencesHydrated(true);
        })
        .catch(() => {
          if (!cancelled) {
            setPreferencesHydrated(true);
          }
        });

      return () => {
        cancelled = true;
      };
    }

    const savedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings) as Partial<AppSettings>;
        setSettings(normalizeAppSettings(parsed));
      } catch {
        window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
      }
    }

    const savedRecentProjects = window.localStorage.getItem(LOCAL_TERMINAL_RECENT_PROJECTS_KEY);
    if (savedRecentProjects) {
      try {
        const parsed = JSON.parse(savedRecentProjects) as string[];
        setRecentLocalProjectIds(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
      } catch {
        window.localStorage.removeItem(LOCAL_TERMINAL_RECENT_PROJECTS_KEY);
      }
    }

    setPreferencesHydrated(true);
  }, []);

  useEffect(() => {
    if (!preferencesHydrated) {
      return;
    }

    if (skipPreferenceSyncRef.current) {
      skipPreferenceSyncRef.current = false;
      return;
    }

    if (hasTauriRuntime()) {
      void saveAppPreferences({ settings: settings as AppPreferences["settings"], recentProjectIds: recentLocalProjectIds }).then(() =>
        emit("preferences-updated", {
          source: preferenceSyncSource,
          settings: settings as AppPreferences["settings"],
          recentProjectIds: recentLocalProjectIds
        } satisfies PreferencesSyncPayload)
      );
      return;
    }

    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [preferenceSyncSource, preferencesHydrated, recentLocalProjectIds, settings]);

  useEffect(() => {
    if (!preferencesHydrated || hasTauriRuntime()) {
      return;
    }

    window.localStorage.setItem(LOCAL_TERMINAL_RECENT_PROJECTS_KEY, JSON.stringify(recentLocalProjectIds));
  }, [preferencesHydrated, recentLocalProjectIds]);

  useEffect(() => {
    if (!hasTauriRuntime()) {
      return;
    }

    let cleanup: null | (() => void) = null;
    let disposed = false;

    void listen<PreferencesSyncPayload>("preferences-updated", (event) => {
      if (event.payload.source === preferenceSyncSource) {
        return;
      }

      skipPreferenceSyncRef.current = true;
      setSettings(normalizeAppSettings(event.payload.settings as Partial<AppSettings>));
      setRecentLocalProjectIds(event.payload.recentProjectIds);
    })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
          return;
        }
        cleanup = unlisten;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [preferenceSyncSource]);

  useEffect(() => {
    if (!localTerminalMenuOpen) {
      setLocalTerminalProjectSearch("");
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!localTerminalMenuRef.current?.contains(event.target as Node)) {
        setLocalTerminalMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLocalTerminalMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [localTerminalMenuOpen]);


  // author: BrianXiong
  // time: 2026/05/07/23:30:00
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }


  useEffect(() => {
    terminalDecodersRef.current.clear();
  }, [settings.terminalCharset]);

  useEffect(() => {
    document.documentElement.dataset.appTheme = settings.appTheme;
    document.documentElement.style.colorScheme = settings.appTheme;
    document.documentElement.lang = getDocumentLanguageTag(settings.language);
  }, [settings.appTheme, settings.language]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    terminalTabsRef.current = terminalTabs;
  }, [terminalTabs]);

  useEffect(() => {
    monitorTabsRef.current = monitorTabs;
  }, [monitorTabs]);

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
    if (!isSftpView && !(isLocalTerminalView && localPreviewOpen)) {
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
          setLocalError(getErrorMessage(error, messages.failedLoadLocalDirectory));
        }
      })
      .finally(() => {
        if (!cancelled) setLocalLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLocalTerminalView, isSftpView, localPath, localPreviewOpen, localRefreshTick, messages.failedLoadLocalDirectory]);

  useEffect(() => {
    if (!isSftpView || !sftpHost) {
      setRemoteEntries([]);
      setRemoteError("");
      return;
    }

    let cancelled = false;
    setRemoteLoading(true);
    setRemoteError("");
    void listRemoteDirectory(sftpHost, remotePath, sshOptions)
      .then((items) => {
        if (!cancelled) setRemoteEntries(items);
      })
      .catch((error) => {
        if (!cancelled) {
          setRemoteEntries([]);
          setRemoteError(getErrorMessage(error, messages.failedLoadRemoteDirectory));
        }
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSftpView, sftpHost, remotePath, remoteRefreshTick, sshOptions]);

  // author: BrianXiong
  // time: 2026/07/21/00:00:00
  // Resolve the placeholder "." into the real remote home directory so the
  // path bar shows an absolute path users can read, edit and copy.
  useEffect(() => {
    if (!isSftpView || !sftpHost || remotePath !== ".") {
      return;
    }

    let cancelled = false;
    void resolveRemotePath(sftpHost, ".", sshOptions)
      .then((absolutePath) => {
        const next = absolutePath.trim();
        if (!cancelled && next && next !== ".") {
          setRemotePath(next);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isSftpView, remotePath, sftpHost, sshOptions]);

  useEffect(() => {
    setLocalPreview(null);
    setLocalBrowserSelectedPath("");
    setLocalPreviewPath("");
    setLocalPreviewError("");
    setLocalPreviewLoading(false);
  }, [localPath]);

  useEffect(() => {
    if (!isLocalTerminalView || !localPreviewOpen || localLoading || localEntries.length === 0) {
      return;
    }

    const selectedExists = localEntries.some((entry) => entry.path === localBrowserSelectedPath);
    if (!selectedExists) {
      setLocalBrowserSelectedPath(localEntries[0].path);
    }
  }, [isLocalTerminalView, localBrowserSelectedPath, localEntries, localLoading, localPreviewOpen]);

  useEffect(() => {
    if (!isLocalTerminalView || !localPreviewOpen) {
      return;
    }

    if (!activeTerminalTab) {
      return;
    }

    let cancelled = false;

    void getTerminalSessionCwd(activeTerminalTab.sessionId)
      .then((cwd) => {
        if (!cancelled && cwd.trim()) {
          setLocalPath(cwd);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeTerminalTab, isLocalTerminalView, localPreviewOpen]);

  useEffect(() => {
    if (!isLocalTerminalView || !localPreviewOpen) {
      return;
    }

    if (!selectedLocalBrowserEntry || selectedLocalBrowserEntry.is_dir) {
      setLocalPreview(null);
      setLocalPreviewPath("");
      setLocalPreviewError("");
      setLocalPreviewLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLocalPreviewPath(selectedLocalBrowserEntry.path);
      setLocalPreviewLoading(true);
      setLocalPreviewError("");

      void readLocalFilePreview(selectedLocalBrowserEntry.path)
        .then((preview) => {
          if (!cancelled) {
            setLocalPreview(preview);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setLocalPreview(null);
            setLocalPreviewError(getErrorMessage(error, messages.failedLoadLocalPreview));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLocalPreviewLoading(false);
          }
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isLocalTerminalView, localPreviewOpen, messages.failedLoadLocalPreview, selectedLocalBrowserEntry]);

  useEffect(() => {
    if (!activeTerminalTab || !terminalMountNode) {
      return;
    }

    const activeTerminalSessionId = activeTerminalTab.sessionId;
    terminalMountNode.innerHTML = "";

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: settings.terminalFontSize,
      lineHeight: 1.12,
      scrollback: 5000,
      theme: activeTerminalTheme.theme
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // author: BrianXiong
    // time: 2026/07/21/00:00:00
    // Search (Cmd+F), clickable links (opened via the system browser), and
    // WebGL rendering with silent fallback to the DOM renderer.
    const searchAddon = new SearchAddon();
    terminal.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    terminal.loadAddon(
      new WebLinksAddon((event, uri) => {
        event.preventDefault();
        void openExternalUrl(uri);
      })
    );

    terminal.open(terminalMountNode);

    let webglAddon: WebglAddon | null = null;
    try {
      webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon?.dispose();
        webglAddon = null;
      });
      terminal.loadAddon(webglAddon);
    } catch {
      webglAddon = null;
    }
    const clearSelectionFrame = window.requestAnimationFrame(() => {
      terminal.clearSelection();
    });
    terminal.attachCustomKeyEventHandler((event) => {
      const sequence = getTerminalControlSequence(event);
      if (!sequence) {
        return true;
      }

      event.preventDefault();
      sendActiveTerminalInput(sequence);
      return false;
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    terminalShouldStickToBottomRef.current = true;
    terminalWriteQueueRef.current = [];

    const bufferedOutput = terminalBuffersRef.current.get(activeTerminalTab.sessionId) ?? [];
    if (bufferedOutput.length > 0) {
      terminal.write(bufferedOutput.join(""), () => {
        terminal.scrollToBottom();
        terminalShouldStickToBottomRef.current = true;
      });
    }

    const disposable = terminal.onData((data) => {
      sendActiveTerminalInput(data);
    });
    const scrollDisposable = terminal.onScroll(() => {
      terminalShouldStickToBottomRef.current = isTerminalViewportNearBottom(terminal);
    });

    let frameId: number | null = null;
    let resizeTimerId: number | null = null;
    let lastViewportSize = "";

    // author: BrianXiong
    // time: 2026/04/21/11:06:00
    function runTerminalViewportSync() {
      const shouldStickToBottom = terminalShouldStickToBottomRef.current || isTerminalViewportNearBottom(terminal);
      fitAddon.fit();
      terminal.refresh(0, Math.max(terminal.rows - 1, 0));
      if (shouldStickToBottom) {
        terminal.scrollToBottom();
        terminalShouldStickToBottomRef.current = true;
      } else {
        terminalShouldStickToBottomRef.current = isTerminalViewportNearBottom(terminal);
      }

      const nextViewportSize = `${terminal.cols}x${terminal.rows}`;
      if (nextViewportSize !== lastViewportSize) {
        lastViewportSize = nextViewportSize;
        void resizeTerminalSession(activeTerminalSessionId, terminal.cols, terminal.rows);
      }
    }

    // author: BrianXiong
    // time: 2026/04/21/11:06:00
    function requestTerminalViewportSyncFrame() {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        runTerminalViewportSync();
        frameId = null;
      });
    }

    // author: BrianXiong
    // time: 2026/04/21/11:06:00
    function syncTerminalViewport(mode: TerminalViewportSyncMode) {
      if (mode === "resize") {
        if (resizeTimerId !== null) {
          window.clearTimeout(resizeTimerId);
        }

        resizeTimerId = window.setTimeout(() => {
          resizeTimerId = null;
          requestTerminalViewportSyncFrame();
        }, TERMINAL_VIEWPORT_RESIZE_DEBOUNCE_MS);
        return;
      }

      requestTerminalViewportSyncFrame();
    }

    terminalViewportSyncRef.current = syncTerminalViewport;

    syncTerminalViewport("immediate");

    const resizeObserver = new ResizeObserver(() => {
      syncTerminalViewport("resize");
    });
    resizeObserver.observe(terminalMountNode);

    return () => {
      resizeObserver.disconnect();
      if (resizeTimerId !== null) {
        window.clearTimeout(resizeTimerId);
      }
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      if (terminalWriteFrameRef.current !== null) {
        window.cancelAnimationFrame(terminalWriteFrameRef.current);
        terminalWriteFrameRef.current = null;
      }
      terminalWriteQueueRef.current = [];
      terminalViewportSyncRef.current = null;
      window.cancelAnimationFrame(clearSelectionFrame);
      disposable.dispose();
      scrollDisposable.dispose();
      searchAddonRef.current = null;
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [activeTerminalTab?.id, activeTerminalTab?.sessionId, sendActiveTerminalInput, terminalMountNode]);

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
    terminalViewportSyncRef.current?.("immediate");
  }, [settings.terminalFontSize]);

  useEffect(() => {
    if (!isSettingsView || detachedSettingsWindow) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closeSettings();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [detachedSettingsWindow, isSettingsView]);

  useEffect(() => {
    let cleanup: null | (() => void) = null;
    let disposed = false;

    void listen<TerminalEventPayload>("terminal-output", (event) => {
      const matchingTab = terminalTabsRef.current.find((tab) => tab.sessionId === event.payload.sessionId);
      if (!matchingTab) {
        return;
      }

      const chunk = decodeTerminalPayload(event.payload);

      const nextState: TerminalState =
        matchingTab.state === "connecting" && event.payload.stream === "stdout"
          ? "connected"
          : matchingTab.state;

      const nextStatusText =
        matchingTab.state === "connecting" && event.payload.stream === "stdout"
          ? messages.connected
          : matchingTab.statusText;

      const existingBuffer = terminalBuffersRef.current.get(event.payload.sessionId) ?? [];
      terminalBuffersRef.current.set(event.payload.sessionId, appendTerminalBufferChunk(existingBuffer, chunk));

      if (matchingTab.state !== nextState || matchingTab.statusText !== nextStatusText) {
        setTerminalTabs((prev) =>
          prev.map((tab) =>
            tab.sessionId === event.payload.sessionId
              ? { ...tab, state: nextState, statusText: nextStatusText }
              : tab
          )
        );
      }

      if (activeTabIdRef.current === matchingTab.id && terminalRef.current) {
        enqueueActiveTerminalOutput(chunk);
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
        setStatus(messages.failedSubscribeTerminalEvents);
        setStatusTone("error");
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [decodeTerminalPayload, enqueueActiveTerminalOutput, messages.connected]);

  // author: BrianXiong
  // time: 2026/07/21/00:00:00
  // Track PTY exit so a dropped SSH session is surfaced in the tab state
  // instead of silently keeping the "connected" dot forever.
  useEffect(() => {
    let cleanup: null | (() => void) = null;
    let disposed = false;

    void listen<TerminalExitPayload>("terminal-exit", (event) => {
      const matchingTab = terminalTabsRef.current.find((tab) => tab.sessionId === event.payload.sessionId);
      if (!matchingTab || matchingTab.state === "disconnected") {
        return;
      }

      setTerminalTabs((prev) =>
        prev.map((tab) =>
          tab.sessionId === event.payload.sessionId
            ? { ...tab, state: "disconnected", statusText: messages.sessionDisconnected }
            : tab
        )
      );
    })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
          return;
        }
        cleanup = unlisten;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [messages.sessionDisconnected]);

  useEffect(() => {
    let cleanup: null | (() => void) = null;
    let disposed = false;

    void listen<TransferUpdatePayload>("transfer-update", (event) => {
      const payload = event.payload;

      if (payload.status === "running") {
        updateTransferJob(payload.jobId, {
          detail: payload.direction === "upload" ? messages.uploadingTo(payload.detail) : messages.downloadingTo(payload.detail),
          progressPercent: payload.progressPercent,
          transferredBytes: payload.transferredBytes,
          totalBytes: payload.totalBytes
        });
        return;
      }

      if (payload.status === "success") {
        updateTransferJob(payload.jobId, {
          progressPercent: payload.progressPercent ?? 100,
          transferredBytes: payload.totalBytes ?? payload.transferredBytes,
          totalBytes: payload.totalBytes
        });
        finishTransferJob(
          payload.jobId,
          "success",
          payload.direction === "upload" ? messages.uploadedTo(payload.detail) : messages.downloadedTo(payload.detail)
        );
        setStatus(payload.direction === "upload" ? messages.uploaded(payload.name) : messages.downloaded(payload.name));
        setStatusTone("success");
        if (payload.direction === "upload") {
          setRemoteRefreshTick((current) => current + 1);
        } else {
          setLocalRefreshTick((current) => current + 1);
        }
        return;
      }

      if (payload.status === "cancelled") {
        removeTransferJob(payload.jobId);
        setStatus(messages.uploadCancelled(payload.name));
        setStatusTone("neutral");
        return;
      }

      updateTransferJob(payload.jobId, {
        progressPercent: payload.progressPercent,
        transferredBytes: payload.transferredBytes,
        totalBytes: payload.totalBytes
      });
      finishTransferJob(payload.jobId, "error", payload.detail);
      setStatus(payload.detail);
      setStatusTone("error");
    })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
          return;
        }
        cleanup = unlisten;
      })
      .catch(() => {
        setStatus(messages.failedSubscribeTerminalEvents);
        setStatusTone("error");
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [messages]);

  useEffect(() => {
    const runningUploadJobs = transferJobs.filter(
      (job) => job.status === "running" && job.direction === "upload" && job.host && job.remoteDir && (job.totalBytes ?? 0) > 0
    );

    if (!runningUploadJobs.length) {
      return;
    }

    let cancelled = false;

    const pollRemoteProgress = async () => {
      await Promise.all(
        runningUploadJobs.map(async (job) => {
          try {
            const items = await listRemoteDirectory(job.host!, job.remoteDir!, sshOptions);
            if (cancelled) {
              return;
            }

            const remoteEntry = items.find((item) => item.name === job.name);
            if (!remoteEntry) {
              return;
            }

            const totalBytes = job.totalBytes ?? 0;
            const transferredBytes = Math.min(remoteEntry.size, totalBytes);
            const progressPercent = totalBytes > 0 ? (transferredBytes / totalBytes) * 100 : 0;

            updateTransferJob(job.id, {
              transferredBytes,
              totalBytes,
              progressPercent,
            });
          } catch {
            return;
          }
        })
      );
    };

    void pollRemoteProgress();
    const intervalId = window.setInterval(() => {
      void pollRemoteProgress();
    }, 800);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [sshOptions, transferJobs]);

  useEffect(() => {
    const runningDownloadJobs = transferJobs.filter(
      (job) => job.status === "running" && job.direction === "download" && job.localTargetPath && (job.totalBytes ?? 0) > 0
    );

    if (!runningDownloadJobs.length) {
      return;
    }

    let cancelled = false;

    const pollLocalProgress = async () => {
      await Promise.all(
        runningDownloadJobs.map(async (job) => {
          try {
            const localSize = await queryLocalEntrySize(job.localTargetPath!);
            if (cancelled) {
              return;
            }

            const totalBytes = job.totalBytes ?? 0;
            const transferredBytes = Math.min(localSize, totalBytes);
            const progressPercent = totalBytes > 0 ? (transferredBytes / totalBytes) * 100 : 0;

            updateTransferJob(job.id, {
              transferredBytes,
              totalBytes,
              progressPercent,
            });
          } catch {
            return;
          }
        })
      );
    };

    void pollLocalProgress();
    const intervalId = window.setInterval(() => {
      void pollLocalProgress();
    }, 800);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [transferJobs]);

  function openNewDrawer() {
    setActiveTabId(HOSTS_TAB_ID);
    setDrawerMode("new");
    setDrawerOpen(true);
    setSelectedId("");
    setDraft({ ...blankHost, projectId: activeHostProjectId ?? DEFAULT_PROJECT_ID });
    setStatus(messages.ready);
    setStatusTone("neutral");
  }

  function openNewDrawerForProject(projectId: string) {
    setActiveHostProjectId(projectId);
    setActiveTabId(HOSTS_TAB_ID);
    setDrawerMode("new");
    setDrawerOpen(true);
    setSelectedId("");
    setDraft({ ...blankHost, projectId });
    setStatus(messages.ready);
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
    if (hasTauriRuntime()) {
      void openSettingsWindow(messages.settings).catch((error) => {
        setStatus(getErrorMessage(error, messages.saveFailed));
        setStatusTone("error");
      });
      return;
    }

    if (activeTabId !== SETTINGS_TAB_ID) {
      previousTabIdRef.current = activeTabId;
    }
    setActiveTabId(SETTINGS_TAB_ID);
  }

  function closeSettings() {
    const fallbackTabId = previousTabIdRef.current === SETTINGS_TAB_ID ? HOME_TAB_ID : previousTabIdRef.current;
    setActiveTabId(fallbackTabId);
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
    setStatus(messages.downloadUpdateStatus(availableUpdate.version));

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
      setStatus(messages.updateReadyStatus(availableUpdate.version));
      setStatusTone("success");
    } catch (error) {
      setUpdateStage("idle");
      const message = getExpandedErrorMessage(error, messages.updateDownloadFailed);
      console.error("[serverdeck] update download failed", error);
      setUpdateError(message);
      setStatus(message);
      setStatusTone("error");
    }
  }

  async function handleRestartForUpdate() {
    if (updateStage !== "ready") {
      return;
    }

    setStatus(messages.restartingToApplyUpdate);
    setStatusTone("neutral");

    try {
      await relaunch();
    } catch (error) {
      setStatus(getErrorMessage(error, messages.restartFailed));
      setStatusTone("error");
    }
  }

  async function handleClearLocalData() {
    setBusy(true);
    setStatusTone("neutral");

    try {
      await clearAppData();
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
      window.localStorage.removeItem(LOCAL_TERMINAL_RECENT_PROJECTS_KEY);
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
      setRecentLocalProjectIds([]);
      setLocalPath("~");
      setRemotePath(".");
      setStatus(messages.clearDataSuccess);
      setStatusTone("success");
    } catch (error) {
      setStatus(getErrorMessage(error, messages.clearDataFailed));
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  function handleSelectTerminalTheme(themeId: string) {
    const selectedTheme = terminalThemePresets.find((item) => item.id === themeId);
    setSettings((current) => ({ ...current, terminalThemeId: themeId }));
    setStatus(messages.appliedTerminalTheme(selectedTheme?.name ?? themeId));
    setStatusTone("success");
  }

  function handleSelectAppTheme(appTheme: AppSettings["appTheme"]) {
    setSettings((current) => ({ ...current, appTheme }));
    setStatus(messages.appliedAppTheme(appTheme === "light" ? messages.light : messages.dark));
    setStatusTone("success");
  }

  function handleSelectLanguage(language: AppLanguage) {
    const label = languageOptions.find((item) => item.value === language)?.label ?? language;
    setSettings((current) => ({ ...current, language }));
    setStatus(messagesByLanguage[language].appliedLanguage(label));
    setStatusTone("success");
  }

  function openNewProjectEditor() {
    setProjectEditorMode("new");
    setProjectDraft(blankProject);
    setProjectEditorOpen(true);
  }

  function openEditProjectEditor(project: ManagedProject) {
    setProjectEditorMode("edit");
    setProjectDraft(project);
    setProjectEditorOpen(true);
  }

  function closeProjectEditor() {
    setProjectEditorOpen(false);
    setProjectDraft(blankProject);
    setProjectEditorMode("new");
  }

  function handleSaveProject() {
    const name = projectDraft.name.trim();
    if (!name) {
      setStatus(messages.projectNameRequired);
      setStatusTone("error");
      return;
    }

    const nextProject: ManagedProject = {
      ...projectDraft,
      id: projectDraft.id || crypto.randomUUID(),
      name,
      namespace: projectDraft.namespace.trim(),
      path: projectDraft.path.trim(),
      projectType: projectDraft.projectType
    };

    setSettings((current) => ({
      ...current,
      projects: projectEditorMode === "edit"
        ? current.projects.map((project) => (project.id === nextProject.id ? nextProject : project))
        : [nextProject, ...current.projects]
    }));

    setStatus(projectEditorMode === "edit" ? messages.projectUpdated(nextProject.name) : messages.projectAdded(nextProject.name));
    setStatusTone("success");
    closeProjectEditor();
  }

  // author: BrianXiong
  // time: 2026/04/05/17:12:08
  async function handlePickProjectPath() {
    try {
      const path = await pickLocalDirectory();
      if (!path) {
        return;
      }

      setProjectDraft((current) => ({ ...current, path }));
    } catch (error) {
      setStatus(getErrorMessage(error, messages.projectPathPickFailed));
      setStatusTone("error");
    }
  }

  function handleDeleteProject(projectId: string) {
    const project = settings.projects.find((item) => item.id === projectId);
    setSettings((current) => ({
      ...current,
      projects: current.projects.filter((item) => item.id !== projectId)
    }));

    if (project) {
      setStatus(messages.projectRemoved(project.name));
      setStatusTone("success");
    }

    if (projectDraft.id === projectId) {
      closeProjectEditor();
    }
  }

  function handleSelectSshDefaults(field: "sshConnectTimeoutSeconds" | "sshServerAliveIntervalSeconds", value: number) {
    const nextSettings = {
      ...settings,
      [field]: value
    };
    setSettings(nextSettings);
    setStatus(
      messages.appliedSshDefaults(nextSettings.sshConnectTimeoutSeconds, nextSettings.sshServerAliveIntervalSeconds)
    );
    setStatusTone("success");
  }

  function handleSelectTerminalFontSize(fontSize: number) {
    setSettings((current) => ({ ...current, terminalFontSize: fontSize }));
    setStatus(messages.appliedTerminalFontSize(fontSize));
    setStatusTone("success");
  }

  // author: BrianXiong
  // time: 2026/04/05/11:21:34
  function handleSelectTerminalCharset(terminalCharset: TerminalCharset) {
    setSettings((current) => ({ ...current, terminalCharset }));
    setStatus(messages.appliedTerminalCharset(terminalCharset.toUpperCase()));
    setStatusTone("success");
  }

  function handleLocalTerminalDefaultPathChange(path: string) {
    setSettings((current) => ({ ...current, localTerminalDefaultPath: path }));
  }

  function startTransferJob(
    name: string,
    direction: TransferJob["direction"],
    detail: string,
    metadata: Partial<Pick<TransferJob, "host" | "remoteDir" | "localTargetPath" | "totalBytes">> = {}
  ) {
    const id = crypto.randomUUID();
    const nextJob: TransferJob = {
      id,
      name,
      direction,
      status: "running",
      detail,
      progressPercent: 0,
      transferredBytes: 0,
      ...metadata
    };
    setTransferJobs((current) => [nextJob, ...current].slice(0, 8));
    return id;
  }

  function removeTransferJob(id: string) {
    setTransferJobs((current) => current.filter((job) => job.id !== id));
  }

  function updateTransferJob(id: string, patch: Partial<TransferJob>) {
    setTransferJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }

  function finishTransferJob(id: string, status: TransferJob["status"], detail: string) {
    setTransferJobs((current) => current.map((job) => (job.id === id ? {
      ...job,
      status,
      detail,
      progressPercent: status === "success" ? 100 : job.progressPercent
    } : job)));

    if (status === "success") {
      window.setTimeout(() => {
        removeTransferJob(id);
      }, 1400);
    }
  }

  async function handleUploadEntry(entry: FileEntry) {
    if (!sftpHost) return;
    const jobId = startTransferJob(entry.name, "upload", messages.uploadingTo(remotePath), {
      host: sftpHost,
      remoteDir: remotePath,
      totalBytes: entry.size,
    });
    setFileMenu(null);
    setStatus(messages.uploadingTo(remotePath));
    setStatusTone("neutral");
    try {
      await startUploadToRemote(sftpHost, entry.path, remotePath, sshOptions, jobId);
    } catch (error) {
      const message = getErrorMessage(error, messages.uploadFailed(entry.name));
      setStatus(message);
      setStatusTone("error");
      finishTransferJob(jobId, "error", message);
    }
  }

  async function handleClearTransferJob(job: TransferJob) {
    if (job.status === "running" && job.direction === "upload") {
      try {
        await cancelUploadToRemote(job.id);
        removeTransferJob(job.id);
      } catch (error) {
        const message = getErrorMessage(error, messages.uploadFailed(job.name));
        setStatus(message);
        setStatusTone("error");
      }
      return;
    }

    if (job.status === "running" && job.direction === "download") {
      try {
        await cancelDownloadFromRemote(job.id);
        removeTransferJob(job.id);
      } catch (error) {
        const message = getErrorMessage(error, messages.downloadFailed(job.name));
        setStatus(message);
        setStatusTone("error");
      }
      return;
    }

    removeTransferJob(job.id);
  }

  async function handleDownloadEntry(entry: FileEntry) {
    if (!sftpHost) return;
    const remoteTarget = joinChildPath(remotePath, entry.name);
    const jobId = startTransferJob(entry.name, "download", messages.downloadingTo(localPath), {
      localTargetPath: joinChildPath(localPath, entry.name),
      totalBytes: entry.is_dir ? undefined : entry.size,
    });
    setFileMenu(null);
    setStatus(messages.downloadingTo(localPath));
    setStatusTone("neutral");
    try {
      await startDownloadFromRemote(sftpHost, remoteTarget, localPath, entry.is_dir, sshOptions, jobId);
    } catch (error) {
      const message = getErrorMessage(error, messages.downloadFailed(entry.name));
      setStatus(message);
      setStatusTone("error");
      finishTransferJob(jobId, "error", message);
    }
  }

  async function handleDeleteLocalFile(entry: FileEntry) {
    await deleteLocalEntry(entry.path, entry.is_dir);
    setStatus(messages.deletedLocal(entry.name));
    setStatusTone("success");
    setFileMenu(null);
    setLocalRefreshTick((current) => current + 1);
  }

  async function handleDeleteRemoteFile(entry: FileEntry) {
    if (!sftpHost) return;
    const remoteTarget = joinChildPath(remotePath, entry.name);
    await deleteRemoteEntry(sftpHost, remoteTarget, entry.is_dir, sshOptions);
    setStatus(messages.deletedRemote(entry.name));
    setStatusTone("success");
    setFileMenu(null);
    setRemoteRefreshTick((current) => current + 1);
  }

  // author: BrianXiong
  // time: 2026/07/21/00:00:00
  // Deleting is destructive and has no undo, so it always goes through an
  // explicit confirmation dialog instead of firing straight from the menu.
  function handleRequestDeleteEntry(side: DeleteConfirmState["side"], entry: FileEntry) {
    setFileMenu(null);
    setDeleteConfirm({ side, entry });
  }

  async function handleConfirmDeleteEntry() {
    const target = deleteConfirm;
    if (!target) return;

    setDeleteConfirm(null);

    try {
      if (target.side === "local") {
        await handleDeleteLocalFile(target.entry);
      } else {
        await handleDeleteRemoteFile(target.entry);
      }
    } catch (error) {
      setStatus(getErrorMessage(error, messages.deleteEntryFailed(target.entry.name)));
      setStatusTone("error");
    }
  }

  function handleSelectSftpHost(hostId: string) {
    setSftpHostId(hostId);
    setRemotePath(".");
    setRemoteEntries([]);
    setRemoteError("");
  }

    // author: BrianXiong
  // time: 2026/10/17/23:40:00
  // Quick connect builds a throwaway host from "user@host:port" so a one-off
  // machine can be reached without persisting it.
  function handlePaletteQuickConnect(target: { username: string; address: string; port: number }) {
    setCommandPaletteOpen(false);
    const quickHost: SavedHost = {
      ...blankHost,
      id: crypto.randomUUID(),
      label: `${target.username ? `${target.username}@` : ""}${target.address}`,
      address: target.address,
      port: target.port,
      username: target.username || blankHost.username,
      authType: "password",
      password: ""
    };

    void handleOpenTerminal(quickHost, { allowInteractiveAuth: true });
  }

  function handlePaletteConnect(host: SavedHost) {
    setCommandPaletteOpen(false);
    rememberRecentHost(host.id);
    void handleOpenTerminal(host);
  }

  function handlePaletteOpenSftp(host: SavedHost) {
    setCommandPaletteOpen(false);
    rememberRecentHost(host.id);
    setActiveTabId(SFTP_TAB_ID);
    handleSelectSftpHost(host.id);
  }

  async function handlePaletteTestConnection(host: SavedHost) {
    setCommandPaletteOpen(false);
    setStatusTone("neutral");

    try {
      setStatus(messages.testingHost(host.username, host.address, host.port));
      const message = await testConnection(host, sshOptions);
      setStatus(message);
      setStatusTone("success");
    } catch (error) {
      setStatus(formatSshFailure(error instanceof Error ? error.message : messages.connectionTestFailed));
      setStatusTone("error");
    }
  }

  function handlePaletteEditHost(host: SavedHost) {
    setCommandPaletteOpen(false);
    openEditDrawer(host);
  }

  function handlePaletteNewHost() {
    setCommandPaletteOpen(false);
    openNewDrawer();
  }

    // author: BrianXiong
  // time: 2026/10/18/00:10:00
  function openNewPortForwardEditor() {
    setForwardEditorMode("new");
    setForwardDraft({ ...blankPortForward, hostId: hosts[0]?.id ?? "" });
    setForwardPendingDeleteId("");
    setForwardEditorOpen(true);
  }

  function openEditPortForwardEditor(forward: PortForward) {
    setForwardEditorMode("edit");
    setForwardDraft(forward);
    setForwardPendingDeleteId("");
    setForwardEditorOpen(true);
  }

  function closePortForwardEditor() {
    setForwardEditorOpen(false);
    setForwardDraft(blankPortForward);
    setForwardEditorMode("new");
  }

  async function handleSavePortForward() {
    try {
      await savePortForward(forwardDraft);
      closePortForwardEditor();
      await refreshPortForwards();
      setStatus(messages.forwardsSaved);
      setStatusTone("success");
    } catch (error) {
      setStatus(getErrorMessage(error, messages.forwardsSaveFailed));
      setStatusTone("error");
    }
  }

  async function handleTogglePortForward(forward: PortForward, running: boolean) {
    setForwardBusyId(forward.id);
    setStatusTone("neutral");

    try {
      if (running) {
        await stopPortForward(forward.id);
        setStatus(messages.forwardsStopped(forward.label || forward.bindHost));
      } else {
        await startPortForward(forward.id, sshOptions);
        setStatus(messages.forwardsStarted(forward.label || forward.bindHost));
      }
      setStatusTone("success");
      await refreshPortForwards();
    } catch (error) {
      setStatus(getErrorMessage(error, messages.forwardsToggleFailed));
      setStatusTone("error");
      await refreshPortForwards();
    } finally {
      setForwardBusyId("");
    }
  }

  async function handleDeletePortForward(forwardId: string) {
    setForwardBusyId(forwardId);

    try {
      await deletePortForward(forwardId);
      setForwardPendingDeleteId("");
      await refreshPortForwards();
      setStatus(messages.forwardsDeleted);
      setStatusTone("success");
    } catch (error) {
      setStatus(getErrorMessage(error, messages.forwardsToggleFailed));
      setStatusTone("error");
    } finally {
      setForwardBusyId("");
    }
  }

  // author: BrianXiong
  // time: 2026/10/18/00:35:00
  async function openSshConfigModal() {
    setSshConfigOpen(true);
    setSshConfigBusy(true);

    try {
      const preview = await previewSshConfig();
      setSshConfigPreview(preview);
      setSshConfigSelected(
        preview.entries.filter((entry) => entry.state !== "unchanged").map((entry) => entry.alias)
      );
    } catch (error) {
      setStatus(getErrorMessage(error, messages.sshConfigLoadFailed));
      setStatusTone("error");
    } finally {
      setSshConfigBusy(false);
    }
  }

  function closeSshConfigModal() {
    setSshConfigOpen(false);
    setSshConfigBusy(false);
  }

  function handleToggleSshConfigAlias(alias: string) {
    setSshConfigSelected((current) =>
      current.includes(alias) ? current.filter((item) => item !== alias) : [...current, alias]
    );
  }

  function handleToggleAllSshConfig(selectAll: boolean) {
    if (!selectAll) {
      setSshConfigSelected([]);
      return;
    }

    setSshConfigSelected(
      (sshConfigPreview?.entries ?? [])
        .filter((entry) => entry.state !== "unchanged")
        .map((entry) => entry.alias)
    );
  }

  function sshHintText(hint: SshErrorHint): string {
    switch (hint) {
      case "dns":
        return messages.sshErrorDns;
      case "refused":
        return messages.sshErrorRefused;
      case "timeout":
        return messages.sshErrorTimeout;
      case "unreachable":
        return messages.sshErrorUnreachable;
      case "publicKey":
        return messages.sshErrorPublicKey;
      case "password":
        return messages.sshErrorPassword;
      case "hostKey":
        return messages.sshErrorHostKey;
      case "tooManyAttempts":
        return messages.sshErrorTooManyAttempts;
      case "connectionReset":
        return messages.sshErrorConnectionReset;
      case "sshpassMissing":
        return messages.sshErrorSshpassMissing;
    }
  }

  // author: BrianXiong
  // time: 2026/10/18/01:00:00
  // Prefixes raw ssh stderr with a plain-language hint so failures are
  // actionable, while keeping the original message available.
  function formatSshFailure(raw: string): string {
    const hint = detectSshErrorHint(raw);
    if (!hint) {
      return raw;
    }

    return `${sshHintText(hint)} — ${raw}`;
  }

  async function refreshKnownHosts() {
    setKnownHostsLoading(true);

    try {
      setKnownHosts(await listKnownHosts());
    } catch (error) {
      setStatus(getErrorMessage(error, messages.knownHostsLoadFailed));
      setStatusTone("error");
    } finally {
      setKnownHostsLoading(false);
    }
  }

  // author: BrianXiong
  // time: 2026/10/18/01:20:00
  async function refreshSshKeys() {
    try {
      setSshKeys(await listSshKeys());
    } catch (error) {
      setStatus(getErrorMessage(error, messages.sshKeyLoadFailed));
      setStatusTone("error");
    }
  }

  useEffect(() => {
    if (activeSettingsSection === "ssh") {
      void refreshKnownHosts();
      void refreshSshKeys();
    }
  }, [activeSettingsSection]);

  async function handleCopySshPublicKey(key: SshKeyRecord) {
    if (!key.publicPath) {
      setStatus(messages.sshKeyCopyFailed);
      setStatusTone("error");
      return;
    }

    try {
      const content = await readSshPublicKey(key.publicPath);
      await navigator.clipboard.writeText(content.trim());
      setStatus(messages.sshKeyCopied(key.name));
      setStatusTone("success");
    } catch (error) {
      setStatus(getErrorMessage(error, messages.sshKeyCopyFailed));
      setStatusTone("error");
    }
  }

  async function handleGenerateSshKey() {
    setSshKeyBusy(true);

    try {
      const key = await generateSshKey(sshKeyName, sshKeyComment);
      setSshKeyName("");
      setSshKeyComment("");
      await refreshSshKeys();
      setStatus(messages.sshKeyGenerated(key.name));
      setStatusTone("success");
    } catch (error) {
      setStatus(getErrorMessage(error, messages.sshKeyGenerateFailed));
      setStatusTone("error");
    } finally {
      setSshKeyBusy(false);
    }
  }

  async function handleRemoveKnownHost(host: string) {
    try {
      await removeKnownHost(host);
      await refreshKnownHosts();
      setStatus(messages.knownHostsRemoved(host));
      setStatusTone("success");
    } catch (error) {
      setStatus(getErrorMessage(error, messages.knownHostsRemoveFailed));
      setStatusTone("error");
    }
  }

  // author: BrianXiong
  // time: 2026/10/18/01:40:00
  const refreshSnippets = useCallback(async () => {
    try {
      setSnippets(await listSnippets());
    } catch (error) {
      setStatus(getErrorMessage(error, messages.snippetSaveFailed));
      setStatusTone("error");
    }
  }, [messages]);

  function openSnippetPanel() {
    setSnippetPanelOpen(true);
    setSnippetPendingDeleteId("");
    setSnippetPendingRunId("");
    void refreshSnippets();
  }

  async function handleSaveSnippet(snippet: SnippetRecord) {
    setSnippetBusy(true);

    try {
      await saveSnippet(snippet);
      await refreshSnippets();
      setStatus(messages.snippetSaved);
      setStatusTone("success");
    } catch (error) {
      setStatus(getErrorMessage(error, messages.snippetSaveFailed));
      setStatusTone("error");
    } finally {
      setSnippetBusy(false);
    }
  }

  async function handleDeleteSnippet(id: string) {
    setSnippetBusy(true);

    try {
      await deleteSnippet(id);
      setSnippetPendingDeleteId("");
      await refreshSnippets();
      setStatus(messages.snippetDeleted);
      setStatusTone("success");
    } catch (error) {
      setStatus(getErrorMessage(error, messages.snippetDeleteFailed));
      setStatusTone("error");
    } finally {
      setSnippetBusy(false);
    }
  }

  function getSnippetHost(snippet: SnippetRecord): SavedHost | null {
    if (snippet.hostId) {
      return hosts.find((host) => host.id === snippet.hostId) ?? null;
    }

    const tab = terminalTabs.find((item) => item.id === lastTerminalTabIdRef.current) ?? null;
    return tab?.host ?? null;
  }

  function substituteSnippetVariables(content: string, host: SavedHost | null): string {
    const values: Record<string, string> = {
      host: host ? host.label.trim() || host.address : "",
      address: host?.address ?? "",
      user: host?.username ?? "",
      port: host?.port ? String(host.port) : ""
    };

    return content.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, name: string) => values[name.toLowerCase()] ?? match);
  }

  function handleRunSnippet(snippet: SnippetRecord, mode: "run" | "paste") {
    const targetTab = terminalTabs.find((tab) => tab.id === lastTerminalTabIdRef.current) ?? null;
    if (!targetTab) {
      setStatus(messages.snippetNoTerminal);
      setStatusTone("error");
      return;
    }

    if (snippet.dangerous && snippetPendingRunId !== snippet.id) {
      setSnippetPendingRunId(snippet.id);
      setStatus(messages.snippetConfirmRun);
      setStatusTone("neutral");
      return;
    }

    setSnippetPendingRunId("");
    const text = substituteSnippetVariables(snippet.content, getSnippetHost(snippet));
    void writeTerminalInput(targetTab.sessionId, mode === "run" ? `${text}\n` : text);
    setActiveTabId(targetTab.id);
    setSnippetPanelOpen(false);
    setStatus(messages.snippetSent(snippet.name));
    setStatusTone("success");
  }

  async function handleImportSshConfig() {
    if (!sshConfigSelected.length) {
      return;
    }

    setSshConfigBusy(true);

    try {
      const report = await importSshConfig(sshConfigSelected);
      await refreshHosts();
      await refreshSshConfigPreview({ silent: true });
      setStatus(messages.sshConfigImported(report.imported, report.updated));
      setStatusTone("success");
      setSshConfigOpen(false);
      setSshConfigSelected([]);
    } catch (error) {
      setStatus(getErrorMessage(error, messages.sshConfigImportFailed));
      setStatusTone("error");
    } finally {
      setSshConfigBusy(false);
    }
  }

  async function handleSave() {
    setBusy(true);
    setStatusTone("neutral");

    try {
      if (!draft.address.trim()) {
        throw new Error(messages.addressRequired);
      }

      const saved = await saveHost({
        ...draft,
        id: draft.id || crypto.randomUUID()
      });

      setDrawerMode("edit");
      setDrawerOpen(true);
      setStatus(messages.savedHost(getDisplayHostTitle(saved)));
      setStatusTone("success");
      await refreshHosts(saved.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : messages.saveFailed);
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
      setStatus(messages.deletedHost(getDisplayHostTitle(draft)));
      setStatusTone("success");
      setDrawerOpen(false);
      setDrawerMode("new");
      setDraft(blankHost);
      await refreshHosts();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : messages.deleteFailed);
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
      setStatus(messages.removedHost(getDisplayHostTitle(targetHost)));
      setStatusTone("success");
      await refreshHosts();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : messages.removeFailed);
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicateHost(targetHost: SavedHost) {
    setBusy(true);
    setStatusTone("neutral");

    try {
      const duplicated = await duplicateHost(
        targetHost.id,
        `${getDisplayHostTitle(targetHost)} ${messages.hostCopySuffix}`
      );
      setContextMenu(null);
      setStatus(messages.duplicatedHost(getDisplayHostTitle(targetHost)));
      setStatusTone("success");
      await refreshHosts(duplicated.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : messages.duplicateFailed);
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
      setStatus(messages.copiedLink(getDisplayHostTitle(targetHost)));
      setStatusTone("success");
    } catch {
      setStatus(messages.copyLinkFailed);
      setStatusTone("error");
    }
  }

  function handlePlaceholderAction(label: string) {
    setContextMenu(null);
    setStatus(messages.notWiredYet(label));
    setStatusTone("neutral");
  }

  async function handleTest() {
    setBusy(true);
    setStatusTone("neutral");

    try {
      if (!draft.address.trim()) {
        throw new Error(messages.selectOrFillHostFirst);
      }

      setStatus(messages.testingHost(draft.username, draft.address, draft.port));
      const message = await testConnection(draft, sshOptions);
      setStatus(message);
      setStatusTone("success");
    } catch (error) {
      setStatus(formatSshFailure(error instanceof Error ? error.message : messages.connectionTestFailed));
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  // author: BrianXiong
  // time: 2026/10/18/02:00:00
  // One stable tmux session per host so reconnects (and app restarts) land back
  // in the same remote shell instead of a fresh login.
  function buildTmuxSessionName(host: SavedHost): string {
    const base = (host.label.trim() || host.address)
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);
    const suffix = host.id.replace(/[^A-Za-z0-9]/g, "").slice(-6);
    return `serverdeck-${base || "host"}-${suffix}`.toLowerCase();
  }

  async function handleOpenTerminal(targetHost: SavedHost = draft, options?: { allowInteractiveAuth?: boolean }) {
    setBusy(true);
    setStatusTone("neutral");

    try {
      if (!targetHost.address.trim()) {
        throw new Error(messages.selectOrFillHostFirst);
      }
      // Quick connect targets have no saved credentials on purpose: ssh prompts
      // for the password inside the pty instead of failing the pre-flight check.
      if (!options?.allowInteractiveAuth) {
        if (targetHost.authType === "password" && !(targetHost.password || "").trim() && !targetHost.hasPassword) {
          throw new Error(messages.passwordRequired);
        }
        if (targetHost.authType === "key" && !(targetHost.privateKeyPath || "").trim()) {
          throw new Error(messages.keyPathRequired);
        }
      }

      setStatus(messages.connectingToHost(targetHost.username, targetHost.address, targetHost.port));
      const sessionOptions: SshConnectionOptions = settings.tmuxPersistence
        ? { ...sshOptions, tmuxSession: buildTmuxSessionName(targetHost) }
        : sshOptions;
      const sessionId = await startTerminalSession(targetHost, sessionOptions);
      const tabId = crypto.randomUUID();
      const title = getDisplayHostTitle(targetHost);

      setTerminalTabs((prev) => [
        ...prev,
        {
          id: tabId,
          sessionId,
          title,
          kind: "remote",
          host: targetHost,
          state: "connecting",
          statusText: messages.connectingToHost(targetHost.username, targetHost.address, targetHost.port)
        }
      ]);

      terminalBuffersRef.current.set(sessionId, []);
      rememberRecentHost(targetHost.id);
      setActiveTabId(tabId);
      setDrawerOpen(false);
      setStatus(messages.terminalSessionOpened(targetHost.username, targetHost.address));
      setStatusTone("success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : messages.terminalOpenFailed);
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  // author: BrianXiong
  // time: 2026/04/05/20:55:02
  function rememberRecentLocalProject(projectId: string) {
    setRecentLocalProjectIds((current) => [projectId, ...current.filter((item) => item !== projectId)].slice(0, 5));
  }

  // author: BrianXiong
  // time: 2026/10/17/23:40:00
  // Only persisted hosts are remembered; ad-hoc quick connect targets use a
  // throwaway id and would otherwise leave dead entries behind.
  function rememberRecentHost(hostId: string) {
    if (!hostId || !hosts.some((host) => host.id === hostId)) {
      return;
    }

    setRecentHostIds((current) => [hostId, ...current.filter((item) => item !== hostId)].slice(0, RECENT_HOSTS_LIMIT));
  }

  // author: BrianXiong
  // time: 2026/04/05/20:55:02
  async function handleOpenLocalTerminal(options?: { cwd?: string; title?: string; source?: LocalTerminalSource; projectId?: string }) {
    setBusy(true);
    setStatusTone("neutral");

    try {
      setStatus(messages.openingLocalTerminal);
      const requestedPath = options?.cwd?.trim();
      const fallbackPath = settings.localTerminalDefaultPath.trim();
      const cwd = requestedPath || fallbackPath || undefined;
      const sessionId = await startLocalTerminalSession(cwd);
      const localTabCount = terminalTabsRef.current.filter((tab) => tab.kind === "local").length;
      const baseTitle = options?.title?.trim() || messages.localTerminal;
      const title = localTabCount > 0 ? `${baseTitle} ${localTabCount + 1}` : baseTitle;
      const tabId = crypto.randomUUID();

      setTerminalTabs((prev) => [
        ...prev,
        {
          id: tabId,
          sessionId,
          title,
          kind: "local",
          host: null,
          cwd,
          state: "connecting",
          statusText: messages.openingLocalTerminal
        }
      ]);

      terminalBuffersRef.current.set(sessionId, []);
      setActiveTabId(tabId);
      if (cwd) {
        setLocalPath(cwd);
      } else if (settings.localTerminalDefaultPath.trim()) {
        setLocalPath(settings.localTerminalDefaultPath.trim());
      }
      if (options?.projectId) {
        rememberRecentLocalProject(options.projectId);
      }
      setLocalTerminalMenuOpen(false);
      setStatus(messages.localTerminalOpened);
      setStatusTone("success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : messages.terminalOpenFailed);
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  // author: BrianXiong
  // time: 2026/04/05/20:55:02
  function handleToggleLocalTerminalMenu() {
    setLocalTerminalMenuOpen((current) => {
      const next = !current;
      if (!next) {
        setLocalTerminalProjectSearch("");
      }
      return next;
    });
  }

  // author: BrianXiong
  // time: 2026/04/05/20:55:02
  async function handleOpenProjectLocalTerminal(project: ManagedProject) {
    await handleOpenLocalTerminal({ cwd: project.path, title: project.name, source: "project", projectId: project.id });
  }

  // author: BrianXiong
  // time: 2026/04/05/20:55:02
  async function handleOpenPickedDirectoryTerminal() {
    try {
      const path = await pickLocalDirectory();
      if (!path) {
        return;
      }

      await handleOpenLocalTerminal({ cwd: path, title: messages.localTerminal, source: "directory" });
    } catch (error) {
      setStatus(getErrorMessage(error, messages.projectPathPickFailed));
      setStatusTone("error");
    }
  }

  // author: BrianXiong
  // time: 2026/04/05/12:19:04
  function handleToggleLocalPreview() {
    setLocalPreviewOpen((current) => {
      const next = !current;

      if (next && settings.localTerminalDefaultPath.trim() && localPath === "~") {
        setLocalPath(settings.localTerminalDefaultPath.trim());
      }

      if (!next) {
        setLocalBrowserSelectedPath("");
        setLocalPreview(null);
        setLocalPreviewPath("");
        setLocalPreviewError("");
        setLocalPreviewLoading(false);
      }

      return next;
    });
  }

  // author: BrianXiong
  // time: 2026/04/05/12:19:04
  function handleSelectLocalPreview(entry: FileEntry | null) {
    setLocalBrowserSelectedPath(entry?.path ?? "");
  }

  // author: BrianXiong
  // time: 2026/07/21/00:00:00
  // Reconnect a disconnected tab in place: start a fresh session for the same
  // host (or local cwd) and rebind the existing tab to the new session id.
  async function handleReconnectTerminalTab(tab: TerminalTab) {
    setStatusTone("neutral");
    setStatus(messages.reconnecting);
    setTerminalTabs((prev) =>
      prev.map((item) => (item.id === tab.id ? { ...item, state: "connecting", statusText: messages.reconnecting } : item))
    );

    try {
      const sessionId =
        tab.kind === "remote" && tab.host
          ? await startTerminalSession(tab.host, sshOptions)
          : await startLocalTerminalSession(tab.cwd);

      terminalDecodersRef.current.delete(tab.sessionId);
      terminalBuffersRef.current.delete(tab.sessionId);
      void closeTerminalSession(tab.sessionId).catch(() => {});
      terminalBuffersRef.current.set(sessionId, []);

      const statusText =
        tab.kind === "remote" && tab.host
          ? messages.connectingToHost(tab.host.username, tab.host.address, tab.host.port)
          : messages.openingLocalTerminal;

      setTerminalTabs((prev) =>
        prev.map((item) => (item.id === tab.id ? { ...item, sessionId, state: "connecting", statusText } : item))
      );
      setStatus(statusText);
    } catch (error) {
      setTerminalTabs((prev) =>
        prev.map((item) =>
          item.id === tab.id ? { ...item, state: "disconnected", statusText: messages.sessionDisconnected } : item
        )
      );
      setStatus(getErrorMessage(error, messages.terminalOpenFailed));
      setStatusTone("error");
    }
  }

  // author: BrianXiong
  // time: 2026/04/05/11:21:34
  async function handleCloseTerminalTab(tabId: string) {
    const currentTabs = terminalTabsRef.current;
    const targetIndex = currentTabs.findIndex((tab) => tab.id === tabId);
    if (targetIndex < 0) return;

    const targetTab = currentTabs[targetIndex];
    terminalDecodersRef.current.delete(targetTab.sessionId);
    terminalBuffersRef.current.delete(targetTab.sessionId);
    await closeTerminalSession(targetTab.sessionId);

    const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);
    const nextActiveTabId =
      activeTabIdRef.current === tabId
        ? nextTabs[targetIndex]?.id ?? nextTabs[targetIndex - 1]?.id ?? HOME_TAB_ID
        : activeTabIdRef.current;

    setTerminalTabs(nextTabs);
    setActiveTabId(nextActiveTabId);
    setStatus(messages.closedTerminalTab(targetTab.title));
    setStatusTone("neutral");
  }

  async function loadServerObservation(host: SavedHost) {
    return observeServer(host, sshOptions);
  }

  async function handleOpenMonitor(host: SavedHost) {
    const existingTab = monitorTabsRef.current.find((tab) => tab.host.id === host.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      if (!existingTab.observation && !existingTab.loading) {
        void handleRefreshMonitor(existingTab.id);
      }
      return;
    }

    const tabId = crypto.randomUUID();
    const title = `${getDisplayHostTitle(host)} · ${messages.monitor}`;

    setMonitorTabs((prev) => [
      ...prev,
      {
        id: tabId,
        host,
        title,
        observation: null,
        history: [],
        loading: true,
        error: ""
      }
    ]);
    setActiveTabId(tabId);
    setStatus(messages.openingMonitor(getDisplayHostTitle(host)));
    setStatusTone("neutral");

    try {
      const observation = await loadServerObservation(host);
      setMonitorTabs((prev) => prev.map((tab) => (tab.id === tabId ? {
        ...tab,
        observation,
        history: appendMonitorHistory(tab.history, observation),
        loading: false
      } : tab)));
      setStatus(messages.monitorLoaded(getDisplayHostTitle(host)));
      setStatusTone("success");
    } catch (error) {
      const message = getErrorMessage(error, messages.monitorLoadFailed);
      setMonitorTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, loading: false, error: message } : tab)));
      setStatus(message);
      setStatusTone("error");
    }
  }

  // author: BrianXiong
  // time: 2026/04/05/17:00:22
  function handleToggleSidebar() {
    setSidebarCollapsed((current) => !current);
  }

  async function handleRefreshMonitor(tabId: string, options?: { silent?: boolean }) {
    const targetTab = monitorTabsRef.current.find((tab) => tab.id === tabId);
    if (!targetTab) return;

    setMonitorTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, loading: true, error: "" } : tab)));
    if (!options?.silent) {
      setStatus(messages.refreshingMonitor(getDisplayHostTitle(targetTab.host)));
      setStatusTone("neutral");
    }

    try {
      const observation = await loadServerObservation(targetTab.host);
      setMonitorTabs((prev) => prev.map((tab) => (tab.id === tabId ? {
        ...tab,
        observation,
        history: appendMonitorHistory(tab.history, observation),
        loading: false,
        error: ""
      } : tab)));
      if (!options?.silent) {
        setStatus(messages.monitorLoaded(getDisplayHostTitle(targetTab.host)));
        setStatusTone("success");
      }
    } catch (error) {
      const message = getErrorMessage(error, messages.monitorLoadFailed);
      setMonitorTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, loading: false, error: message } : tab)));
      setStatus(message);
      setStatusTone("error");
    }
  }

  function handleCloseMonitorTab(tabId: string) {
    const currentTabs = monitorTabsRef.current;
    const targetIndex = currentTabs.findIndex((tab) => tab.id === tabId);
    if (targetIndex < 0) return;

    const targetTab = currentTabs[targetIndex];
    const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);
    const nextActiveTabId = activeTabIdRef.current === tabId ? HOME_TAB_ID : activeTabIdRef.current;

    setMonitorTabs(nextTabs);
    setActiveTabId(nextActiveTabId);
    setStatus(messages.closedMonitorTab(targetTab.title));
    setStatusTone("neutral");
  }

  async function handleCopyMonitorInfo(observation: ServerObservation) {
    const content = [
      `${messages.monitorHostname}: ${observation.hostname}`,
      `${messages.monitorOperatingSystem}: ${observation.operatingSystem}`,
      `${messages.monitorCpuCores}: ${observation.cpuCores}`,
      `${messages.monitorMemory}: ${observation.memoryUsage}`,
      `${messages.monitorDisk}: ${observation.diskUsage}`,
      `${messages.monitorUptime}: ${observation.uptime}`
    ].join("\n");

    try {
      await navigator.clipboard.writeText(content);
      setMonitorInfoCopied(true);
      window.setTimeout(() => setMonitorInfoCopied(false), 1400);
      setStatus(messages.monitorInfoCopied);
      setStatusTone("success");
    } catch {
      setStatus(messages.copyLinkFailed);
      setStatusTone("error");
    }
  }

  useEffect(() => {
    if (!activeMonitorTab) {
      setMonitorInfoOpen(false);
      setMonitorInfoCopied(false);
      return;
    }

    const timer = window.setInterval(() => {
      void handleRefreshMonitor(activeMonitorTab.id, { silent: true });
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeMonitorTab?.id]);

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

  // author: BrianXiong
  // time: 2026/07/21/00:00:00
  const terminalDisconnectOverlay =
    activeTerminalTab && activeTerminalTab.state === "disconnected" ? (
      <div className="terminal-disconnect">
        <div className="terminal-disconnect__card">
          <span className="terminal-disconnect__title">{messages.sessionDisconnected}</span>
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleReconnectTerminalTab(activeTerminalTab)}
          >
            <RefreshCw size={14} />
            {messages.reconnect}
          </button>
        </div>
      </div>
    ) : null;

  // author: BrianXiong
  // time: 2026/07/21/00:00:00
  const terminalSearchBar =
    activeTerminalTab && terminalSearchOpen ? (
      <div className="terminal-search">
        <Search size={14} />
        <input
          ref={terminalSearchInputRef}
          value={terminalSearchQuery}
          placeholder={messages.terminalSearchPlaceholder}
          autoFocus
          spellCheck={false}
          onChange={(event) => setTerminalSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              findInTerminal(event.shiftKey ? "previous" : "next");
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              closeTerminalSearch();
            }
          }}
        />
        <button type="button" className="terminal-search__button" onClick={() => findInTerminal("previous")} aria-label="Previous match" title="Shift+Enter">
          ⌃
        </button>
        <button type="button" className="terminal-search__button" onClick={() => findInTerminal("next")} aria-label="Next match" title="Enter">
          ⌄
        </button>
        <button type="button" className="terminal-search__button" onClick={closeTerminalSearch} aria-label="Close search" title="Esc">
          <X size={13} />
        </button>
      </div>
    ) : null;

  return (
    <div className={`app-shell ${detachedSettingsWindow ? "app-shell--settings-window" : ""}`}>
      <header className="topbar">
        <div className="topbar__brand">
          <div className="topbar__logo">SD</div>
          <span>ServerDeck</span>
        </div>

        <div className="topbar__tabs">
          <button
            type="button"
            className="top-tab top-tab--ghost"
            onClick={handleToggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>

          <button
            type="button"
            className="top-tab top-tab--ghost topbar-command-button"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label={messages.commandPalettePlaceholder}
            title={messages.commandPalettePlaceholder}
          >
            <Search size={16} />
            <span className="topbar-command-button__kbd">⌘K</span>
          </button>

          <button
            type="button"
            className="top-tab top-tab--ghost"
            onClick={openSnippetPanel}
            title={messages.snippets}
            aria-label={messages.snippets}
          >
            <ScrollText size={16} />
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

          {monitorTabs.map((tab) => (
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
              <Activity size={16} />
              <span className={`top-tab__dot ${tab.loading ? "top-tab__dot--connecting" : tab.error ? "top-tab__dot--error" : "top-tab__dot--connected"}`} />
              <span className="top-tab__label">{tab.title}</span>
              <button
                type="button"
                className="top-tab__close"
                onClick={(event) => {
                  event.stopPropagation();
                  handleCloseMonitorTab(tab.id);
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}

          <div className="topbar-menu" ref={localTerminalMenuRef}>
            <button type="button" className="top-tab top-tab--ghost" onClick={handleToggleLocalTerminalMenu}>
              <Plus size={16} />
              {messages.localTerminal}
            </button>

            {localTerminalMenuOpen ? (
              <div className="topbar-popover">
                <div className="topbar-popover__search">
                  <Search size={14} />
                  <input
                    value={localTerminalProjectSearch}
                    onChange={(event) => setLocalTerminalProjectSearch(event.target.value)}
                    placeholder={messages.searchProjectsPlaceholder}
                  />
                </div>

                {recentLocalProjects.length ? (
                  <div className="topbar-popover__section">
                    <div className="topbar-popover__label">{messages.recentProjects}</div>
                    <div className="topbar-popover__list">
                      {recentLocalProjects.map((project) => (
                        <button key={project.id} type="button" className="topbar-popover__item" onClick={() => void handleOpenProjectLocalTerminal(project)}>
                          <div>
                            <strong>{project.name}</strong>
                            <span>{project.path}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="topbar-popover__section">
                  <div className="topbar-popover__label">{messages.projects}</div>
                  {filteredLocalTerminalProjects.length ? (
                    <div className="topbar-popover__list">
                      {filteredLocalTerminalProjects.map((project) => (
                        <button key={project.id} type="button" className="topbar-popover__item" onClick={() => void handleOpenProjectLocalTerminal(project)}>
                          <div>
                            <strong>{project.name}</strong>
                            <span>{project.path}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="topbar-popover__empty">{messages.noProjectPaths}</div>
                  )}
                </div>

                <div className="topbar-popover__section topbar-popover__section--actions">
                  <button type="button" className="topbar-popover__item" onClick={() => void handleOpenLocalTerminal({ source: "default" })}>
                    <div>
                      <strong>{messages.openDefaultDirectory}</strong>
                      <span>{settings.localTerminalDefaultPath.trim() || "~"}</span>
                    </div>
                  </button>
                  <button type="button" className="topbar-popover__item" onClick={() => void handleOpenPickedDirectoryTerminal()}>
                    <div>
                      <strong>{messages.chooseDirectory}</strong>
                      <span>{messages.localTerminal}</span>
                    </div>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className={`workspace ${sidebarCollapsed ? "workspace--sidebar-collapsed" : ""}`}>
        <aside className={`sidebar ${sidebarCollapsed ? "sidebar--collapsed" : ""}`}>
          <div className="sidebar__top">
            <button
              type="button"
              className={`side-nav ${isHomeView ? "side-nav--active" : ""}`}
              onClick={() => setActiveTabId(HOME_TAB_ID)}
            >
              <Home size={18} />
              <span>{messages.home}</span>
            </button>

            <button
              type="button"
              className={`side-nav ${isHostsView ? "side-nav--active" : ""}`}
              onClick={() => setActiveTabId(HOSTS_TAB_ID)}
            >
              <Server size={18} />
              <span>{messages.hosts}</span>
            </button>

            <button
              type="button"
              className={`side-nav ${isSftpView ? "side-nav--active" : ""}`}
              onClick={() => setActiveTabId(SFTP_TAB_ID)}
            >
              <FolderOpen size={18} />
              <span>{messages.sftp}</span>
            </button>

            <button
              type="button"
              className={`side-nav ${isForwardsView ? "side-nav--active" : ""}`}
              onClick={() => setActiveTabId(FORWARDS_TAB_ID)}
            >
              <ArrowLeftRight size={18} />
              <span>{messages.forwards}</span>
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
              <span>{messages.update}</span>
            </button>
          ) : null}

            <button
              type="button"
              className={`side-nav ${isSettingsView ? "side-nav--active" : ""}`}
              onClick={openSettings}
            >
              <Wrench size={18} />
              <span>{messages.settings}</span>
            </button>
          </div>
        </aside>

        <main className="mainpane">
          {isHomeView ? (
            <section className="home-screen">
              <div className="home-screen__inner">
                <div className="home-screen__badge">
                  <img src={appLogo} alt="ServerDeck logo" className="home-screen__logo" />
                </div>
                <h1>ServerDeck</h1>

                <div className="home-screen__actions">
                  <button type="button" className="secondary-button" onClick={() => setActiveTabId(HOSTS_TAB_ID)}>
                    <Server size={16} />
                    {messages.hosts}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setActiveTabId(SFTP_TAB_ID)}>
                    <FolderOpen size={16} />
                    {messages.sftp}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => void handleOpenPickedDirectoryTerminal()}>
                    <Plus size={16} />
                    {messages.localTerminal}
                  </button>
                </div>

              </div>
            </section>
          ) : isHostsView ? (
            <section className="hosts-screen">
              <div className="hosts-toolbar">
                <div className="searchbar">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={messages.searchPlaceholder}
                  />
                </div>

                <button type="button" className="secondary-button" onClick={() => void openSshConfigModal()}>
                  <FileText size={16} />
                  {messages.sshConfig}
                  {sshConfigPendingCount > 0 ? (
                    <span className="ssh-config-badge">{sshConfigPendingCount}</span>
                  ) : null}
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => (activeHostGroup ? openNewDrawerForProject(activeHostGroup.id) : openNewDrawer())}
                >
                  <Plus size={16} />
                  {activeHostGroup ? messages.addHost : messages.new}
                </button>
              </div>

              <div className={`hosts-layout ${drawerOpen ? "hosts-layout--drawer" : ""}`}>
                <section className="hosts-board">
                  <div className="hosts-board__header">
                    <div>
                      <h2>{activeHostGroup ? activeHostGroup.name : messages.projects}</h2>
                      <span>{messages.hostCount(activeHostGroup ? activeHostGroup.hosts.length : groupedHosts.length)}</span>
                    </div>

                    {activeHostGroup ? (
                      <button type="button" className="row-button" onClick={() => setActiveHostProjectId(null)}>
                        <ArrowLeft size={14} />
                        {messages.backToProjects}
                      </button>
                    ) : null}
                  </div>

                  <div className="host-rows">
                    {activeHostGroup ? (
                      <section className="host-group host-group--detail">
                        <div className="host-group__header">
                          <div className="host-group__header-main">
                            <strong>{activeHostGroup.name}</strong>
                            <span>{messages.hostCount(activeHostGroup.hosts.length)}</span>
                          </div>
                          <button
                            type="button"
                            className="row-button"
                            onClick={() => openNewDrawerForProject(activeHostGroup.id)}
                          >
                            <Plus size={14} />
                            {messages.addHost}
                          </button>
                        </div>

                        {activeHostGroup.hosts.length ? (
                          activeHostGroup.hosts.map((host) => (
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
                              <div className="host-row__badge">{getDisplayHostBadge(host)}</div>

                              <div className="host-row__body">
                                <div className="host-row__title">{getDisplayHostTitle(host)}</div>
                                <div className="host-row__sub">ssh, {host.username}</div>
                                <div className="host-row__meta">
                                  {host.address}:{host.port}
                                  {host.jumpHostId
                                    ? ` · ${messages.jumpHostVia(
                                        getDisplayHostTitle(hosts.find((item) => item.id === host.jumpHostId) ?? host)
                                      )}`
                                    : ""}
                                </div>
                              </div>

                              <div className="host-row__actions">
                              <button
                                type="button"
                                className="row-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleOpenMonitor(host);
                                }}
                              >
                                <Activity size={14} />
                                {messages.monitor}
                              </button>
                              <button
                                type="button"
                                className="row-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditDrawer(host);
                                }}
                                >
                                  {messages.edit}
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
                                  {messages.connect}
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="host-group__empty">
                            <strong>{messages.noHostsInProject}</strong>
                            <span>{messages.noHostsInProjectDescription}</span>
                            <button type="button" className="secondary-button" onClick={() => openNewDrawerForProject(activeHostGroup.id)}>
                              <Plus size={14} />
                              {messages.addHost}
                            </button>
                          </div>
                        )}
                      </section>
                    ) : (
                      <div className="project-card-grid">
                        {groupedHosts.map((group) => (
                          <div
                            key={group.id}
                            className="project-host-card"
                          >
                            <button
                              type="button"
                              className="project-host-card__main"
                              onClick={() => setActiveHostProjectId(group.id)}
                            >
                              <div className="project-host-card__icon">
                                <FolderOpen size={20} />
                              </div>
                              <div className="project-host-card__body">
                                <strong>{group.name}</strong>
                                <span>{messages.hostCount(group.hosts.length)}</span>
                              </div>
                              <ChevronRight size={18} className="project-host-card__arrow" />
                            </button>

                            <div className="project-host-card__actions">
                              <button type="button" className="row-button" onClick={() => setActiveHostProjectId(group.id)}>
                                {messages.openProject}
                              </button>
                              <button type="button" className="row-button row-button--primary" onClick={() => openNewDrawerForProject(group.id)}>
                                <Plus size={14} />
                                {messages.addHost}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!filteredHosts.length ? (
                      <div className="empty-state">
                        <h3>{messages.noHostsFound}</h3>
                        <p>{messages.noHostsHint}</p>
                        <button type="button" className="primary-button" onClick={openNewDrawer}>
                          <Plus size={16} />
                          {messages.createHost}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </section>

                {drawerOpen ? (
                  <aside className="host-drawer">
                    <div className="host-drawer__header">
                      <div>
                        <div className="drawer-eyebrow">{drawerMode === "new" ? messages.newHost : messages.editHost}</div>
                        <h3>{drawerMode === "new" ? messages.createServerProfile : getDisplayHostTitle(draft)}</h3>
                      </div>

                      <button type="button" className="icon-button" onClick={closeDrawer}>
                        <X size={16} />
                      </button>
                    </div>

                    <div className={`notice notice--${statusTone}`}>{status}</div>

                    <div className="drawer-form">
                      <label>
                        <span>{messages.label}</span>
                        <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
                      </label>

                      <label>
                        <span>{messages.projects}</span>
                        <select
                          value={draft.projectId}
                          onChange={(event) => setDraft({ ...draft, projectId: event.target.value })}
                        >
                          {projectOptions.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>{messages.address}</span>
                        <input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} />
                      </label>

                      <label>
                        <span>{messages.port}</span>
                        <input
                          value={draft.port}
                          onChange={(event) => setDraft({ ...draft, port: Number(event.target.value || "22") })}
                        />
                      </label>

                      <label>
                        <span>{messages.username}</span>
                        <input
                          value={draft.username}
                          onChange={(event) => setDraft({ ...draft, username: event.target.value })}
                        />
                      </label>

                      <label>
                        <span>{messages.jumpHost}</span>
                        <select
                          value={draft.jumpHostId ?? ""}
                          onChange={(event) => setDraft({ ...draft, jumpHostId: event.target.value || undefined })}
                        >
                          <option value="">{messages.jumpHostNone}</option>
                          {hosts
                            .filter((host) => host.id !== draft.id)
                            .map((host) => (
                              <option key={host.id} value={host.id}>
                                {host.label.trim() || host.address} ({host.address})
                              </option>
                            ))}
                        </select>
                      </label>

                      <label>
                        <span>{messages.authType}</span>
                        <select
                          value={draft.authType}
                          onChange={(event) =>
                            setDraft({ ...draft, authType: event.target.value as SavedHost["authType"] })
                          }
                        >
                          <option value="password">{messages.authPassword}</option>
                          <option value="key">{messages.authKey}</option>
                        </select>
                      </label>

                      {draft.authType === "password" ? (
                        <label>
                          <span>{messages.password}</span>
                          <input
                            type="password"
                            value={draft.password ?? ""}
                            placeholder={draft.hasPassword ? messages.passwordStoredPlaceholder : undefined}
                            onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                          />
                        </label>
                      ) : (
                        <label>
                          <span>{messages.privateKeyPath}</span>
                          <input
                            value={draft.privateKeyPath ?? ""}
                            list="serverdeck-ssh-key-paths"
                            onChange={(event) => setDraft({ ...draft, privateKeyPath: event.target.value })}
                          />
                          <datalist id="serverdeck-ssh-key-paths">
                            {sshKeys
                              .map((key) => key.privatePath)
                              .filter((path): path is string => Boolean(path))
                              .map((path) => (
                                <option key={path} value={path} />
                              ))}
                          </datalist>
                        </label>
                      )}
                    </div>

                    <div className="drawer-actions">
                      <button type="button" className="secondary-button" onClick={handleTest} disabled={busy}>
                        <PlugZap size={16} />
                        {busy ? messages.working : messages.testSsh}
                      </button>

                      <button type="button" className="secondary-button" onClick={handleSave} disabled={busy}>
                        <Save size={16} />
                        {busy ? messages.working : messages.save}
                      </button>

                      <button type="button" className="primary-button" onClick={() => void handleOpenTerminal()} disabled={busy}>
                        <TerminalSquare size={16} />
                        {busy ? messages.working : messages.connect}
                      </button>

                      <button
                        type="button"
                        className="danger-button"
                        onClick={handleDelete}
                        disabled={busy || !draft.id}
                      >
                        <Trash2 size={16} />
                        {messages.delete}
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
                  <h2>{messages.sftp}</h2>
                  <span>{messages.sftpDescription}</span>
                </div>

                <div className="sftp-screen__controls">
                  {sftpHost ? (
                    <button
                      type="button"
                      className="secondary-button sftp-back-button"
                      onClick={() => handleSelectSftpHost("")}
                    >
                      ← {messages.sftpBackToServers}
                    </button>
                  ) : null}

                  <label className="sftp-hidden-toggle">
                    <input
                      type="checkbox"
                      checked={showHiddenFiles}
                      onChange={(event) => setShowHiddenFiles(event.target.checked)}
                    />
                    <span>{messages.showHiddenFiles}</span>
                  </label>

                  <label className="sftp-host-select">
                    <span>{messages.selectHost}</span>
                    <select value={sftpHostId} onChange={(event) => handleSelectSftpHost(event.target.value)}>
                      <option value="">{messages.selectHostPlaceholder}</option>
                      {hosts.map((host) => (
                        <option key={host.id} value={host.id}>
                          {getDisplayHostTitle(host)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {!sftpHost ? (
                <div className="sftp-screen__inner sftp-welcome">
                  <div className="sftp-screen__icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="14" rx="2" />
                      <path d="M8 21h8" />
                      <path d="M12 18v3" />
                      <path d="m9.5 9.5 2 2-2 2" />
                      <path d="M13.5 13.5h2" />
                    </svg>
                  </div>
                  <h2>{messages.sftpWelcomeTitle}</h2>
                  <p>{messages.sftpWelcomeDescription}</p>
                  {hosts.length ? (
                    <div className="sftp-welcome__hosts">
                      {hosts.map((host) => (
                        <button
                          key={host.id}
                          type="button"
                          className="sftp-welcome__host"
                          onClick={() => handleSelectSftpHost(host.id)}
                        >
                          <strong>{getDisplayHostTitle(host)}</strong>
                          <span>{host.username}@{host.address}:{host.port}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="sftp-welcome__empty">{messages.noHostsHint}</p>
                  )}
                </div>
              ) : null}

              {sftpHost ? <div className="sftp-browser-grid">
                <FileBrowserPane
                  title={messages.local}
                  refreshLabel={messages.refresh}
                  upLabel={messages.up}
                  loadingText={messages.loading}
                  nameColumnLabel={messages.fileNameColumn}
                  modifiedColumnLabel={messages.fileModifiedDateColumn}
                  sizeColumnLabel={messages.fileSizeColumn}
                  path={localPath}
                  items={showHiddenFiles ? localEntries : localEntries.filter((entry) => !entry.name.startsWith("."))}
                  loading={localLoading}
                  error={localError}
                  emptyText={messages.noLocalFiles}
                  onPathChange={setLocalPath}
                  onContextMenu={(event, entry) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setFileMenu({ side: "local", entry, x: event.clientX, y: event.clientY });
                  }}
                  onRefresh={() => setLocalRefreshTick((current) => current + 1)}
                  onGoUp={() => setLocalPath((current) => getParentPath(current))}
                  onOpenDir={(entry) => setLocalPath((current) => joinChildPath(current, entry.name))}
                  onOpenFile={(entry) => void handleUploadEntry(entry)}
                />

                <FileBrowserPane
                  title={messages.remote}
                  refreshLabel={messages.refresh}
                  upLabel={messages.up}
                  loadingText={messages.loading}
                  nameColumnLabel={messages.fileNameColumn}
                  modifiedColumnLabel={messages.fileModifiedDateColumn}
                  sizeColumnLabel={messages.fileSizeColumn}
                  path={remotePath}
                  items={showHiddenFiles ? remoteEntries : remoteEntries.filter((entry) => !entry.name.startsWith("."))}
                  loading={remoteLoading}
                  error={remoteError}
                  emptyText={sftpHost ? messages.noRemoteFiles : messages.selectHostPlaceholder}
                  disabled={!sftpHost}
                  onPathChange={setRemotePath}
                  onContextMenu={(event, entry) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setFileMenu({ side: "remote", entry, x: event.clientX, y: event.clientY });
                  }}
                  onRefresh={() => setRemoteRefreshTick((current) => current + 1)}
                  onGoUp={() => setRemotePath((current) => getParentPath(current))}
                  onOpenDir={(entry) => setRemotePath((current) => joinChildPath(current, entry.name))}
                  onOpenFile={(entry) => void handleDownloadEntry(entry)}
                />
              </div> : null}

              {transferJobs.length ? <div className="transfer-panel">
                <div className="transfer-panel__header">
                  <strong>{messages.transfers}</strong>
                  <span>{messages.transferCount(transferJobs.length)}</span>
                </div>

                <div className="transfer-list">
                  {transferJobs.map((job) => (
                    <div key={job.id} className="transfer-item">
                      <div className="transfer-item__header">
                        <div className="transfer-item__meta">
                          <strong>{job.name}</strong>
                          <span>
                            {job.direction === "upload" ? messages.transferUpload : messages.transferDownload}
                            {job.totalBytes ? ` · ${Math.round(job.progressPercent ?? 0)}% · ${formatFileSize(job.transferredBytes ?? 0)} / ${formatFileSize(job.totalBytes)}` : ""}
                            {` · ${job.detail}`}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="transfer-item__clear"
                          onClick={() => void handleClearTransferJob(job)}
                          aria-label={job.status === "running" ? messages.cancel : messages.clearTransfer}
                          title={job.status === "running" ? messages.cancel : messages.clearTransfer}
                        >
                          {job.status === "running" ? messages.cancel : messages.clearTransfer}
                        </button>
                      </div>
                      <div className={`transfer-progress transfer-progress--${job.status}`}>
                        <span style={{ width: `${Math.min(100, Math.max(0, job.progressPercent ?? 0))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div> : null}
            </section>
          ) : isForwardsView ? (
            <section className="forwards-screen">
              <div className="forwards-screen__inner">
                <header className="forwards-header">
                  <div>
                    <h2>{messages.forwards}</h2>
                    <span>{messages.forwardsDescription}</span>
                  </div>
                  <button type="button" className="primary-button" onClick={openNewPortForwardEditor}>
                    <Plus size={16} />
                    {messages.newForward}
                  </button>
                </header>

                {portForwards.length === 0 ? (
                  <div className="forwards-empty">
                    <ArrowLeftRight size={34} strokeWidth={1.4} />
                    <strong>{messages.forwardsEmpty}</strong>
                    <span>{messages.forwardsEmptyDescription}</span>
                  </div>
                ) : (
                  <div className="forwards-list">
                    {portForwards.map(({ forward, running }) => {
                      const host = hosts.find((item) => item.id === forward.hostId) ?? null;
                      const busy = forwardBusyId === forward.id;
                      const pendingDelete = forwardPendingDeleteId === forward.id;
                      const kindLabel =
                        forward.kind === "local"
                          ? messages.forwardKindLocal
                          : forward.kind === "remote"
                            ? messages.forwardKindRemote
                            : messages.forwardKindDynamic;

                      return (
                        <div key={forward.id} className="forward-row">
                          <span className={`forward-row__dot ${running ? "forward-row__dot--running" : ""}`.trim()} />
                          <div className="forward-row__body">
                            <div className="forward-row__titleline">
                              <strong>
                                {forward.label.trim() ||
                                  `${forward.bindHost}:${forward.bindPort}${
                                    forward.kind === "dynamic" ? "" : ` → ${forward.targetHost}:${forward.targetPort}`
                                  }`}
                              </strong>
                              <span className="forward-row__kind">{kindLabel}</span>
                              {forward.autoStart ? <span className="forward-row__kind">{messages.forwardAutoStart}</span> : null}
                            </div>
                            <div className="forward-row__meta">
                              {forward.kind === "dynamic"
                                ? `socks ${forward.bindHost}:${forward.bindPort}`
                                : `${forward.bindHost}:${forward.bindPort} → ${forward.targetHost}:${forward.targetPort}`}
                              {" · "}
                              {host ? getDisplayHostTitle(host) : messages.forwardsHostMissing}
                            </div>
                          </div>
                          <div className="forward-row__actions">
                            <button
                              type="button"
                              className={running ? "secondary-button" : "primary-button"}
                              disabled={busy}
                              onClick={() => void handleTogglePortForward(forward, running)}
                            >
                              {busy ? messages.working : running ? messages.forwardStop : messages.forwardStart}
                            </button>
                            <button
                              type="button"
                              className="row-button"
                              onClick={() => openEditPortForwardEditor(forward)}
                            >
                              {messages.edit}
                            </button>
                            {pendingDelete ? (
                              <button
                                type="button"
                                className="danger-button"
                                disabled={busy}
                                onClick={() => void handleDeletePortForward(forward.id)}
                              >
                                {messages.forwardsConfirmDelete}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="row-button"
                                onClick={() => setForwardPendingDeleteId(forward.id)}
                              >
                                {messages.delete}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          ) : isSettingsView ? (
            <section className="settings-screen">
              <div className="settings-layout">
                <aside className="settings-sidebar">
                  <div className="settings-screen__header">
                    <div>
                      <h2>{messages.settings}</h2>
                      <span>{messages.settingsDescription}</span>
                    </div>
                  </div>

                  <div className="settings-nav">
                    {settingsNavItems.map((item) => {
                      const Icon = item.icon;
                      const active = item.id === activeSettingsSection;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`settings-nav__item ${active ? "settings-nav__item--active" : ""}`}
                          onClick={() => setActiveSettingsSection(item.id)}
                        >
                          <Icon size={17} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </aside>

                <div className="settings-content">
                  {activeSettingsSection === "general" ? (
                    <section className="settings-panel">
                      <div className="settings-panel__header">
                        <Wrench size={18} />
                        <div>
                          <h3>{messages.general}</h3>
                          <span>{messages.settingsDescription}</span>
                        </div>
                      </div>

                      <div className="settings-card">
                        <div className="settings-item settings-item--panel">
                          <div>
                            <strong>{messages.appTheme}</strong>
                            <span>{messages.appThemeDescription}</span>
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

                        <div className="settings-item settings-item--panel">
                          <div>
                            <strong>{messages.language}</strong>
                            <span>{messages.languageDescription}</span>
                          </div>
                          <select
                            className="settings-select"
                            value={settings.language}
                            onChange={(event) => handleSelectLanguage(event.target.value as AppLanguage)}
                          >
                            {languageOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {activeSettingsSection === "projects" ? (
                    <section className="settings-panel">
                      <div className="settings-panel__header">
                        <FolderOpen size={18} />
                        <div>
                          <h3>{messages.projects}</h3>
                          <span>{messages.projectsDescription}</span>
                        </div>
                      </div>

                      <div className="settings-panel__toolbar">
                        <span className="settings-panel__toolbar-label">{messages.projects}</span>
                        <button type="button" className="secondary-button" onClick={openNewProjectEditor}>
                          <Plus size={14} />
                          {messages.addProject}
                        </button>
                      </div>

                      <div className="settings-card settings-card--projects">
                        {settings.projects.length ? (
                          settings.projects.map((project) => (
                            <div key={project.id} className="project-row">
                              <div className="project-row__icon">
                                <FolderOpen size={18} />
                              </div>

                              <div className="project-row__body">
                                <div className="project-row__titleline">
                                  <strong>{project.name}</strong>
                                  {project.namespace ? <span>{project.namespace}</span> : null}
                                </div>
                                {project.path ? <div className="project-row__path">{project.path}</div> : null}
                              </div>

                              <div className="project-row__actions">
                                <button type="button" className="row-button" onClick={() => openEditProjectEditor(project)}>
                                  <Pencil size={14} />
                                  {messages.edit}
                                </button>
                                <button
                                  type="button"
                                  className="danger-button"
                                  onClick={() => handleDeleteProject(project.id)}
                                >
                                  <Trash2 size={14} />
                                  {messages.delete}
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="project-empty-state">
                            <strong>{messages.noProjects}</strong>
                            <span>{messages.noProjectsDescription}</span>
                          </div>
                        )}
                      </div>
                    </section>
                  ) : null}

                  {activeSettingsSection === "terminal" ? (
                    <section className="settings-panel">
                      <div className="settings-panel__header">
                        <SwatchBook size={18} />
                        <div>
                          <h3>{messages.terminal}</h3>
                          <span>{messages.terminalDescription}</span>
                        </div>
                      </div>

                      <div className="settings-panel__subheading">{messages.connection}</div>
                      <div className="settings-card">
                        <div className="settings-item settings-item--panel">
                          <div>
                            <strong>{messages.sshConnectTimeout}</strong>
                            <span>{messages.sshConnectTimeoutDescription}</span>
                          </div>
                          <select
                            className="settings-select"
                            value={String(settings.sshConnectTimeoutSeconds)}
                            onChange={(event) => handleSelectSshDefaults("sshConnectTimeoutSeconds", Number(event.target.value))}
                          >
                            {sshConnectTimeoutOptions.map((option) => (
                              <option key={option} value={option}>
                                {messages.secondsValue(option)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="settings-item settings-item--panel">
                          <div>
                            <strong>{messages.sshKeepaliveInterval}</strong>
                            <span>{messages.sshKeepaliveIntervalDescription}</span>
                          </div>
                          <select
                            className="settings-select"
                            value={String(settings.sshServerAliveIntervalSeconds)}
                            onChange={(event) => handleSelectSshDefaults("sshServerAliveIntervalSeconds", Number(event.target.value))}
                          >
                            {sshServerAliveIntervalOptions.map((option) => (
                              <option key={option} value={option}>
                                {messages.secondsValue(option)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="settings-item settings-item--panel">
                          <div>
                            <strong>{messages.tmuxPersistence}</strong>
                            <span>{messages.tmuxPersistenceDescription}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={settings.tmuxPersistence}
                            onChange={(event) =>
                              setSettings((current) => ({ ...current, tmuxPersistence: event.target.checked }))
                            }
                          />
                        </div>
                      </div>

                      <div className="settings-card">
                        <div className="settings-item settings-item--panel settings-item--stacked">
                          <div>
                            <strong>{messages.localTerminalDefaultPath}</strong>
                            <span>{messages.localTerminalDefaultPathDescription}</span>
                          </div>
                          <input
                            className="settings-input"
                            value={settings.localTerminalDefaultPath}
                            placeholder={messages.localTerminalDefaultPathPlaceholder}
                            onChange={(event) => handleLocalTerminalDefaultPathChange(event.target.value)}
                            onBlur={() => {
                              setStatus(messages.localTerminalPathSaved);
                              setStatusTone("success");
                            }}
                          />
                        </div>

                        <div className="settings-item settings-item--panel">
                          <div>
                            <strong>{messages.terminalFontSize}</strong>
                            <span>{messages.terminalFontSizeDescription}</span>
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

                        <div className="settings-item settings-item--panel">
                          <div>
                            <strong>{messages.terminalCharset}</strong>
                            <span>{messages.terminalCharsetDescription}</span>
                          </div>
                          <select
                            className="settings-select"
                            value={settings.terminalCharset}
                            onChange={(event) => handleSelectTerminalCharset(event.target.value as TerminalCharset)}
                          >
                            {terminalCharsetOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="settings-panel__subheading">{messages.terminalTheme}</div>
                      <div className="settings-card settings-card--themes">
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
                                  {selected ? messages.selected : messages.select}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {activeSettingsSection === "ssh" ? (
                    <section className="settings-panel">
                      <div className="settings-panel__header">
                        <KeyRound size={18} />
                        <div>
                          <h3>{messages.sshSettings}</h3>
                          <span>{messages.sshSettingsDescription}</span>
                        </div>
                      </div>

                      <div className="settings-panel__toolbar">
                        <span className="settings-panel__toolbar-label">{messages.sshKeys}</span>
                        <button
                          type="button"
                          className="secondary-button secondary-button--compact"
                          onClick={() => void refreshSshKeys()}
                        >
                          <RefreshCw size={14} />
                          {messages.knownHostsRefresh}
                        </button>
                      </div>

                      <div className="settings-card settings-card--projects">
                        {sshKeys.length === 0 ? (
                          <div className="project-empty-state">
                            <strong>{messages.sshKeysEmpty}</strong>
                            <span>{messages.sshKeysDescription}</span>
                          </div>
                        ) : (
                          sshKeys.map((key) => (
                            <div key={key.name} className="project-row">
                              <div className="project-row__icon">
                                <KeyRound size={18} />
                              </div>

                              <div className="project-row__body">
                                <div className="project-row__titleline">
                                  <strong>{key.name}</strong>
                                  {key.keyType ? <span>{key.keyType}</span> : null}
                                </div>
                                <div className="project-row__path">
                                  {key.fingerprint}
                                  {key.bits ? ` · ${key.bits} bits` : ""}
                                  {key.privatePath ? ` · ${key.privatePath}` : ""}
                                </div>
                              </div>

                              <div className="project-row__actions">
                                <button
                                  type="button"
                                  className="row-button"
                                  onClick={() => void handleCopySshPublicKey(key)}
                                  disabled={!key.publicPath}
                                >
                                  {messages.sshKeyCopyPublic}
                                </button>
                              </div>
                            </div>
                          ))
                        )}

                        <div className="ssh-key-generate">
                          <input
                            value={sshKeyName}
                            onChange={(event) => setSshKeyName(event.target.value)}
                            placeholder={messages.sshKeyNamePlaceholder}
                          />
                          <input
                            value={sshKeyComment}
                            onChange={(event) => setSshKeyComment(event.target.value)}
                            placeholder={messages.sshKeyCommentPlaceholder}
                          />
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => void handleGenerateSshKey()}
                            disabled={sshKeyBusy || !sshKeyName.trim()}
                          >
                            {sshKeyBusy ? messages.working : messages.sshKeyGenerate}
                          </button>
                        </div>
                      </div>

                      <div className="settings-panel__toolbar">
                        <span className="settings-panel__toolbar-label">{messages.knownHosts}</span>
                        <button
                          type="button"
                          className="secondary-button secondary-button--compact"
                          onClick={() => void refreshKnownHosts()}
                          disabled={knownHostsLoading}
                        >
                          <RefreshCw size={14} />
                          {messages.knownHostsRefresh}
                        </button>
                      </div>

                      <div className="settings-card settings-card--projects">
                        {knownHostsLoading ? (
                          <div className="project-empty-state">
                            <strong>{messages.loading}</strong>
                          </div>
                        ) : knownHosts.length === 0 ? (
                          <div className="project-empty-state">
                            <strong>{messages.knownHostsEmpty}</strong>
                            <span>{messages.knownHostsDescription}</span>
                          </div>
                        ) : (
                          knownHosts.map((entry) => (
                            <div key={`${entry.host}-${entry.keyType}-${entry.fingerprint}`} className="project-row">
                              <div className="project-row__icon">
                                <KeyRound size={18} />
                              </div>

                              <div className="project-row__body">
                                <div className="project-row__titleline">
                                  <strong>{entry.host}</strong>
                                  {entry.keyType ? <span>{entry.keyType}</span> : null}
                                </div>
                                <div className="project-row__path">
                                  {entry.fingerprint}
                                  {entry.bits ? ` · ${entry.bits} bits` : ""}
                                </div>
                              </div>

                              <div className="project-row__actions">
                                <button
                                  type="button"
                                  className="danger-button"
                                  onClick={() => void handleRemoveKnownHost(entry.host)}
                                >
                                  <Trash2 size={14} />
                                  {messages.delete}
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  ) : null}

                  {activeSettingsSection === "about" ? (
                    <section className="settings-panel">
                      <div className="settings-panel__header">
                        <Info size={18} />
                        <div>
                          <h3>{messages.about}</h3>
                          <span>{messages.appDescription}</span>
                        </div>
                      </div>

                      <div className="settings-card">
                        <div className="settings-item settings-item--panel">
                          <div>
                            <strong>ServerDeck</strong>
                            <span>{messages.appDescription}</span>
                          </div>
                          <span className="settings-pill">v{appVersion}</span>
                        </div>

                        <div className="settings-item settings-item--panel">
                          <div>
                            <strong>{messages.softwareUpdate}</strong>
                            <span>
                              {availableUpdate
                                ? messages.softwareUpdateAvailable(availableUpdate.version)
                                : updateCheckState === "checking"
                                  ? messages.softwareUpdateChecking
                                  : updateCheckState === "upToDate"
                                    ? messages.latestVersion
                                    : updateCheckState === "error"
                                      ? updateCheckError
                                      : updateCheckState === "unsupported"
                                        ? messages.updaterDesktopOnly
                                        : messages.softwareUpdateDefault}
                            </span>
                          </div>
                          <button
                            type="button"
                            className={availableUpdate ? "primary-button" : "secondary-button"}
                            onClick={() => void (availableUpdate ? handleUpdateClick() : handleCheckForUpdates())}
                            disabled={updateCheckState === "checking"}
                          >
                            {availableUpdate ? messages.viewUpdate : updateCheckState === "checking" ? messages.checkingForUpdates : messages.checkNow}
                          </button>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {activeSettingsSection === "danger" ? (
                    <section className="settings-panel">
                      <div className="settings-panel__header settings-panel__header--danger">
                        <ShieldAlert size={18} />
                        <div>
                          <h3>{messages.dangerZone}</h3>
                          <span>{messages.clearLocalDataDescription}</span>
                        </div>
                      </div>

                      <div className="settings-card">
                        <div className="settings-item settings-item--panel settings-item--danger">
                          <div>
                            <strong>{messages.clearLocalData}</strong>
                            <span>{messages.clearLocalDataDescription}</span>
                          </div>
                          <button type="button" className="danger-button" onClick={() => void handleClearLocalData()} disabled={busy}>
                            <Trash2 size={14} />
                            {busy ? messages.clearing : messages.clearData}
                          </button>
                        </div>
                      </div>
                    </section>
                  ) : null}
                </div>
              </div>
            </section>
          ) : activeMonitorTab ? (
            <section className="settings-screen">
              <div className="settings-layout">
                <div className="settings-content settings-content--wide">
                  <section className="settings-panel">
                    <div className="settings-panel__header">
                      <Activity size={18} />
                      <div className="monitor-header__titlewrap">
                        <div className="monitor-header__titleline">
                          <h3>{activeMonitorTab.host.label || activeMonitorTab.host.address}</h3>
                          {activeMonitorTab.observation ? (
                            <button
                              type="button"
                              className="monitor-info-button"
                              onClick={() => setMonitorInfoOpen((open) => !open)}
                            >
                              <Info size={14} />
                            </button>
                          ) : null}
                        </div>
                        <span>{messages.monitorDescription}</span>

                        {monitorInfoOpen && activeMonitorTab.observation ? (
                          <div className="monitor-info-popover">
                            <div className="monitor-info-popover__header">
                              <strong>{messages.serverInfo}</strong>
                              <button
                                type="button"
                                className="row-button"
                                onClick={() => void handleCopyMonitorInfo(activeMonitorTab.observation!)}
                              >
                                <Copy size={14} />
                                {monitorInfoCopied ? messages.copied : messages.copyServerInfo}
                              </button>
                            </div>
                            <div className="monitor-info-popover__body">
                              <div><strong>{messages.monitorHostname}</strong><span>{activeMonitorTab.observation.hostname}</span></div>
                              <div><strong>{messages.monitorOperatingSystem}</strong><span>{activeMonitorTab.observation.operatingSystem}</span></div>
                              <div><strong>{messages.monitorCpuCores}</strong><span>{activeMonitorTab.observation.cpuCores}</span></div>
                              <div><strong>{messages.monitorMemory}</strong><span>{activeMonitorTab.observation.memoryUsage}</span></div>
                              <div><strong>{messages.monitorDisk}</strong><span>{activeMonitorTab.observation.diskUsage}</span></div>
                              <div><strong>{messages.monitorUptime}</strong><span>{activeMonitorTab.observation.uptime}</span></div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="settings-panel__toolbar">
                      <span className="settings-panel__toolbar-label">{activeMonitorTab.host.username}@{activeMonitorTab.host.address}:{activeMonitorTab.host.port}</span>
                      <div className="monitor-toolbar__actions">
                        <span className="settings-pill">{messages.autoRefresh}</span>
                        <button type="button" className="secondary-button" onClick={() => void handleRefreshMonitor(activeMonitorTab.id)}>
                          {activeMonitorTab.loading ? messages.refreshing : messages.refresh}
                        </button>
                      </div>
                    </div>

                    {activeMonitorTab.error ? <div className="notice notice--error">{activeMonitorTab.error}</div> : null}

                    {activeMonitorTab.observation ? (
                      <>
                        <div className="monitor-gauges">
                          <MetricChartCard
                            label={messages.monitorCpuUsage}
                            value={activeMonitorTab.observation.cpuUsage}
                            detail={`${messages.monitorCpuCores}: ${activeMonitorTab.observation.cpuCores}`}
                            history={activeMonitorTab.history.map((point) => point.cpu)}
                            accent="#ffb020"
                          />
                          <MetricChartCard
                            label={messages.monitorMemoryPercent}
                            value={activeMonitorTab.observation.memoryPercent}
                            detail={activeMonitorTab.observation.memoryUsage}
                            history={activeMonitorTab.history.map((point) => point.memory)}
                            accent="#4da3ff"
                          />
                          <MetricChartCard
                            label={messages.monitorDiskPercent}
                            value={activeMonitorTab.observation.diskPercent}
                            detail={activeMonitorTab.observation.diskUsage}
                            history={activeMonitorTab.history.map((point) => point.disk)}
                            accent="#7d5cff"
                          />
                        </div>

                        <div className="monitor-grid">
                        <div className="monitor-card"><strong>{messages.monitorHostname}</strong><span>{activeMonitorTab.observation.hostname}</span></div>
                        <div className="monitor-card"><strong>{messages.monitorOperatingSystem}</strong><span>{activeMonitorTab.observation.operatingSystem}</span></div>
                        <div className="monitor-card"><strong>{messages.monitorUptime}</strong><span>{activeMonitorTab.observation.uptime}</span></div>
                        <div className="monitor-card"><strong>{messages.monitorLoad}</strong><span>{activeMonitorTab.observation.loadAverage}</span></div>
                        <div className="monitor-card"><strong>{messages.monitorNetwork}</strong><span>{activeMonitorTab.observation.networkUsage}</span></div>
                        <div className="monitor-card monitor-card--wide">
                          <strong>{messages.monitorTopProcesses}</strong>
                          <ProcessBarChart
                            processes={activeMonitorTab.observation.topProcesses}
                            cpuLabel={messages.monitorCpuUsage}
                            memoryLabel={messages.monitorMemoryPercent}
                            emptyLabel={messages.monitorNoProcesses}
                            pidLabel={messages.monitorPid}
                            topFiveLabel={messages.topFive}
                            topTenLabel={messages.topTen}
                          />
                        </div>
                        <div className="monitor-card monitor-card--wide"><strong>{messages.monitorUpdatedAt}</strong><span>{formatObservationCapturedAt(activeMonitorTab.observation.capturedAt)}</span></div>
                        </div>
                      </>
                    ) : activeMonitorTab.loading ? (
                      <div className="empty-state"><h3>{messages.monitorLoading}</h3><p>{messages.monitorLoadingDescription}</p></div>
                    ) : null}
                  </section>
                </div>
              </div>
            </section>
          ) : isLocalTerminalView && localPreviewOpen ? (
            <LocalTerminalWorkspace
              onTerminalMount={handleTerminalMount}
              terminalBackground={activeTerminalTheme.theme.background}
              previewOpen={localPreviewOpen}
              browserTitle={messages.localFiles}
              homeLabel={messages.homeDirectory}
              previewTitle={messages.preview}
              refreshLabel={messages.refresh}
              upLabel={messages.up}
              browserLoadingLabel={messages.loading}
              previewLoadingLabel={messages.previewLoading}
              emptyFilesLabel={messages.noLocalFiles}
              nameColumnLabel={messages.fileNameColumn}
              sizeColumnLabel={messages.fileSizeColumn}
              kindColumnLabel={messages.fileKindColumn}
              addedDateColumnLabel={messages.fileAddedDateColumn}
              folderKindLabel={messages.folderKind}
              fileKindFallbackLabel={messages.fileKindFallback}
              emptyPreviewLabel={messages.previewEmpty}
              unsupportedPreviewLabel={messages.previewUnsupported}
              truncatedPreviewLabel={messages.previewTruncated}
              archiveEntriesLabel={messages.archiveEntries}
              formatCodeLabel={messages.formatCode}
              renderMarkdownLabel={messages.renderMarkdown}
              showRawLabel={messages.showRaw}
              previewSwitchLabel={messages.preview}
              localPath={localPath}
              localEntries={localEntries}
              localLoading={localLoading}
              localError={localError}
              previewLoading={localPreviewLoading}
              previewError={localPreviewError}
              preview={localPreview}
              selectedBrowserPath={localBrowserSelectedPath}
              onTogglePreview={handleToggleLocalPreview}
              onPathChange={setLocalPath}
              onRefresh={() => setLocalRefreshTick((current) => current + 1)}
              onOpenDir={(entry) => setLocalPath((current) => joinChildPath(current, entry.name))}
              onGoUp={() => setLocalPath((current) => getParentPath(current))}
              onGoHome={() => setLocalPath("~")}
              onSelectEntry={handleSelectLocalPreview}
              onFocusTerminal={() => terminalRef.current?.focus()}
            />
          ) : isLocalTerminalView ? (
            <section className="terminal-screen terminal-screen--local" style={{ background: activeTerminalTheme.theme.background }}>
              <div className="terminal-screen__toolbar terminal-screen__toolbar--floating">
                <label className="preview-switch">
                  <input type="checkbox" checked={localPreviewOpen} onChange={handleToggleLocalPreview} />
                  <span className="preview-switch__track">
                    <span className="preview-switch__thumb" />
                  </span>
                  <span className="preview-switch__label">{messages.preview}</span>
                </label>
              </div>
              <div className="terminal-frame-shell" style={{ background: activeTerminalTheme.theme.background }}>
                <div
                  className="terminal-frame"
                  ref={handleTerminalMount}
                  onMouseDown={() => terminalRef.current?.focus()}
                  style={{ background: activeTerminalTheme.theme.background }}
                />
                {terminalSearchBar}
                {terminalDisconnectOverlay}
              </div>
            </section>
          ) : (
            <section className="terminal-screen" style={{ background: activeTerminalTheme.theme.background }}>
              <div className="terminal-frame-shell" style={{ background: activeTerminalTheme.theme.background }}>
                <div
                  className="terminal-frame"
                  ref={handleTerminalMount}
                  onMouseDown={() => terminalRef.current?.focus()}
                  style={{ background: activeTerminalTheme.theme.background }}
                />
                {terminalSearchBar}
                {terminalDisconnectOverlay}
              </div>
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
            <span>{messages.quickConnect}</span>
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
            <span>{messages.connect}</span>
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
            <span>{messages.editHostDetails}</span>
            <span className="context-menu__badge">E</span>
          </button>

          <button type="button" className="context-menu__item" onClick={() => handlePlaceholderAction(messages.collaborate)}>
            <Users size={18} />
            <span>{messages.collaborate}</span>
          </button>

          <button type="button" className="context-menu__item" onClick={() => handlePlaceholderAction(messages.moveTo)}>
            <Server size={18} />
            <span>{messages.moveTo}</span>
            <ChevronRight size={18} className="context-menu__hint" />
          </button>

          <button type="button" className="context-menu__item" onClick={() => handlePlaceholderAction(messages.copyTo)}>
            <Copy size={18} />
            <span>{messages.copyTo}</span>
            <ChevronRight size={18} className="context-menu__hint" />
          </button>

          <button type="button" className="context-menu__item" onClick={() => void handleDuplicateHost(contextMenu.host)}>
            <Copy size={18} />
            <span>{messages.duplicate}</span>
          </button>

          <button type="button" className="context-menu__item" onClick={() => void handleCopyHostLink(contextMenu.host)}>
            <Link2 size={18} />
            <span>{messages.copyLink}</span>
            <Info size={18} className="context-menu__hint" />
          </button>

          <button
            type="button"
            className="context-menu__item context-menu__item--danger"
            onClick={() => void handleDeleteHost(contextMenu.host)}
          >
            <Trash2 size={18} />
            <span>{messages.remove}</span>
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
                <span>{messages.upload}</span>
              </button>
              <button
                type="button"
                className="context-menu__item context-menu__item--danger"
                onClick={() => handleRequestDeleteEntry("local", fileMenu.entry)}
              >
                <Trash2 size={18} />
                <span>{messages.delete}</span>
              </button>
            </>
          ) : (
            <>
              <button type="button" className="context-menu__item" onClick={() => void handleDownloadEntry(fileMenu.entry)}>
                <FolderOpen size={18} />
                <span>{messages.download}</span>
              </button>
              <button
                type="button"
                className="context-menu__item context-menu__item--danger"
                onClick={() => handleRequestDeleteEntry("remote", fileMenu.entry)}
              >
                <Trash2 size={18} />
                <span>{messages.delete}</span>
              </button>
            </>
          )}
        </div>
      ) : null}

      {deleteConfirm ? (
        <div className="update-modal-backdrop" onMouseDown={() => setDeleteConfirm(null)}>
          <section className="confirm-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="confirm-modal__header">
              <span className="confirm-modal__icon">
                <Trash2 size={18} />
              </span>
              <h3>{messages.confirmDeleteTitle}</h3>
            </div>

            <p className="confirm-modal__message">
              {deleteConfirm.side === "local"
                ? messages.confirmDeleteLocalMessage(deleteConfirm.entry.path)
                : messages.confirmDeleteRemoteMessage(joinChildPath(remotePath, deleteConfirm.entry.name))}
            </p>

            <div className="confirm-modal__actions">
              <button type="button" className="secondary-button" onClick={() => setDeleteConfirm(null)}>
                {messages.cancel}
              </button>
              <button type="button" className="confirm-modal__danger" onClick={() => void handleConfirmDeleteEntry()}>
                <Trash2 size={14} />
                {messages.delete}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {updateModalOpen && availableUpdate ? (
        <div className="update-modal-backdrop" onMouseDown={() => setUpdateModalOpen(false)}>
          <section className="update-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="update-modal__header">
              <div>
                <div className="drawer-eyebrow">{messages.updateAvailable}</div>
                <h3>ServerDeck {availableUpdate.version}</h3>
                <span>
                  {messages.currentVersionToNewVersion(availableUpdate.currentVersion, availableUpdate.version)}
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
                  {messages.updateSummary}
                </p>
              </div>

              <div className="update-modal__notes">
                <strong>{messages.whatsNew}</strong>
                <div className="update-modal__notes-content">
                  {availableUpdate.body?.trim() || messages.noReleaseNotes}
                </div>
              </div>

              <div className="update-modal__status">
                <strong>{messages.status}</strong>
                <span>
                  {updateStage === "ready"
                    ? messages.updateInstalledRestart
                    : updateStage === "downloading"
                      ? messages.downloadingAndInstalling
                      : messages.readyToDownloadUpdate}
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
                          : messages.preparingDownload}
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
                {messages.later}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void handleDownloadUpdate()}
                disabled={updateStage !== "idle"}
              >
                {updateStage === "downloading" ? messages.downloading : updateStage === "ready" ? messages.downloadedState : messages.download}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleRestartForUpdate()}
                disabled={updateStage !== "ready"}
              >
                {messages.restart}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <SnippetPanel
        open={snippetPanelOpen}
        snippets={snippets}
        hosts={hosts}
        labels={{
          title: messages.snippets,
          description: messages.snippetsDescription,
          newSnippet: messages.newSnippet,
          editSnippet: messages.editSnippet,
          name: messages.snippetName,
          content: messages.snippetContent,
          contentPlaceholder: messages.snippetContentPlaceholder,
          host: messages.snippetHost,
          anyHost: messages.snippetAnyHost,
          dangerous: messages.snippetDangerous,
          dangerousHint: messages.snippetDangerousHint,
          variables: messages.snippetVariables,
          run: messages.snippetRun,
          paste: messages.snippetPaste,
          pasteHint: messages.snippetPasteHint,
          empty: messages.snippetEmpty,
          emptyDescription: messages.snippetEmptyDescription,
          cancel: messages.cancel,
          save: messages.save,
          deleteLabel: messages.delete,
          confirmDelete: messages.snippetConfirmDelete,
          confirmRun: messages.snippetConfirmRun
        }}
        busy={snippetBusy}
        pendingDeleteId={snippetPendingDeleteId}
        pendingRunId={snippetPendingRunId}
        onClose={() => setSnippetPanelOpen(false)}
        onSave={(snippet) => void handleSaveSnippet(snippet)}
        onDelete={(id) => void handleDeleteSnippet(id)}
        onRequestDelete={setSnippetPendingDeleteId}
        onRun={handleRunSnippet}
      />

      <SshConfigModal
        open={sshConfigOpen}
        preview={sshConfigPreview}
        selectedAliases={sshConfigSelected}
        busy={sshConfigBusy}
        labels={{
          eyebrow: messages.sshConfig,
          title: messages.sshConfig,
          description: messages.sshConfigDescription,
          fileLabel: messages.sshConfigFile,
          missingFile: messages.sshConfigMissing,
          empty: messages.sshConfigEmpty,
          selectAll: messages.sshConfigSelectAll,
          clearAll: messages.sshConfigClearAll,
          importLabel: messages.sshConfigImport,
          importingLabel: messages.working,
          cancelLabel: messages.cancel,
          stateNew: messages.sshConfigStateNew,
          stateUpdated: messages.sshConfigStateUpdated,
          stateUnchanged: messages.sshConfigStateUnchanged,
          viaJump: messages.sshConfigViaJump,
          noSelection: messages.sshConfigNoSelection
        }}
        onClose={closeSshConfigModal}
        onToggleAlias={handleToggleSshConfigAlias}
        onToggleAll={handleToggleAllSshConfig}
        onImport={() => void handleImportSshConfig()}
      />

      <PortForwardEditorModal
        open={forwardEditorOpen}
        mode={forwardEditorMode}
        draft={forwardDraft}
        hosts={hosts}
        labels={{
          eyebrow: messages.forwards,
          newTitle: messages.newForward,
          editTitle: messages.editForward,
          description: messages.forwardsDescription,
          label: messages.forwardLabel,
          kind: messages.forwardKind,
          kindLocal: messages.forwardKindLocal,
          kindRemote: messages.forwardKindRemote,
          kindDynamic: messages.forwardKindDynamic,
          host: messages.forwardHost,
          bindHost: messages.forwardBindHost,
          bindPort: messages.forwardBindPort,
          targetHost: messages.forwardTargetHost,
          targetPort: messages.forwardTargetPort,
          autoStart: messages.forwardAutoStart,
          autoStartDescription: messages.forwardAutoStartDescription,
          cancel: messages.cancel,
          save: messages.save
        }}
        onClose={closePortForwardEditor}
        onSave={() => void handleSavePortForward()}
        onDraftChange={setForwardDraft}
      />

      <ProjectEditorModal
        open={projectEditorOpen}
        mode={projectEditorMode}
        draft={projectDraft}
        projectsLabel={messages.projects}
        projectsDescription={messages.projectsDescription}
        editProjectLabel={messages.editProject}
        newProjectLabel={messages.newProject}
        projectNameLabel={messages.projectName}
        projectNameDescription={messages.projectNameDescription}
        projectNamespaceLabel={messages.projectNamespace}
        projectNamespaceDescription={messages.projectNamespaceDescription}
        projectTypeLabel={messages.projectType}
        projectTypeDescription={messages.projectTypeDescription}
        localProjectLabel={messages.localProject}
        serverProjectLabel={messages.serverProject}
        hybridProjectLabel={messages.hybridProject}
        projectPathLabel={messages.projectPath}
        projectPathDescription={messages.projectPathDescription}
        chooseDirectoryLabel={messages.chooseDirectory}
        cancelLabel={messages.cancel}
        saveProjectLabel={messages.saveProject}
        onClose={closeProjectEditor}
        onSave={handleSaveProject}
        onPickPath={() => void handlePickProjectPath()}
        onDraftChange={setProjectDraft}
      />

      <CommandPalette
        open={commandPaletteOpen}
        hosts={hosts}
        recentHostIds={recentHostIds}
        projectNameById={projectNameById}
        labels={{
          placeholder: messages.commandPalettePlaceholder,
          noResults: messages.commandPaletteNoResults,
          recentSection: messages.commandPaletteRecent,
          hostsSection: messages.commandPaletteHosts,
          actionsSection: messages.commandPaletteActions,
          quickConnectSection: messages.commandPaletteQuickConnect,
          temporary: messages.commandPaletteTemporary,
          openSftp: messages.commandPaletteOpenSftp,
          testConnection: messages.commandPaletteTestConnection,
          editHost: messages.commandPaletteEditHost,
          newHost: messages.newHost,
          footer: messages.commandPaletteFooter
        }}
        getHostTitle={getDisplayHostTitle}
        getHostBadge={getDisplayHostBadge}
        onClose={() => setCommandPaletteOpen(false)}
        onConnect={handlePaletteConnect}
        onQuickConnect={handlePaletteQuickConnect}
        onOpenSftp={handlePaletteOpenSftp}
        onTestConnection={(host) => void handlePaletteTestConnection(host)}
        onEditHost={handlePaletteEditHost}
        onNewHost={handlePaletteNewHost}
      />
    </div>
  );
}
