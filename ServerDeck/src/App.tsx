import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update as AppUpdate } from "@tauri-apps/plugin-updater";
import packageJson from "../package.json";
import ReactECharts from "echarts-for-react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Copy,
  Download,
  FolderOpen,
  Info,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  PlugZap,
  ShieldAlert,
  Save,
  Search,
  Server,
  SwatchBook,
  Wrench,
  TerminalSquare,
  Trash2,
  Users,
  X
} from "lucide-react";
import {
  clearAppData,
  closeTerminalSession,
  DEFAULT_PROJECT_ID,
  deleteLocalEntry,
  deleteHost,
  deleteRemoteEntry,
  downloadFromRemote,
  getTerminalSessionCwd,
  listLocalDirectory,
  pickLocalDirectory,
  readLocalFilePreview,
  listRemoteDirectory,
  listHosts,
  observeServer,
  saveHost,
  startLocalTerminalSession,
  startTerminalSession,
  testConnection,
  uploadToRemote,
  writeTerminalInput,
  type FileEntry,
  type LocalFilePreview,
  type SavedHost,
  type ServerObservation,
  type SshConnectionOptions,
  type TerminalEventPayload
} from "./lib/api";
import { FileBrowserPane } from "./components/files/FileBrowserPane";
import { ProjectEditorModal } from "./components/projects/ProjectEditorModal";
import { LocalTerminalWorkspace } from "./components/terminal/LocalTerminalWorkspace";
import {
  getDocumentLanguageTag,
  languageOptions,
  messagesByLanguage,
  type AppLanguage
} from "./lib/i18n";
import { getParentPath, joinChildPath } from "./lib/fileBrowser";
import {
  defaultTerminalThemeId,
  terminalThemePresets,
  type TerminalThemePreset
} from "./data/terminalThemes";

const HOSTS_TAB_ID = "hosts";
const SFTP_TAB_ID = "sftp";
const SETTINGS_TAB_ID = "settings";
const SETTINGS_STORAGE_KEY = "serverdeck.settings";
const LOCAL_TERMINAL_RECENT_PROJECTS_KEY = "serverdeck.localTerminalRecentProjects";
const DEFAULT_APP_SETTINGS: AppSettings = {
  appTheme: "dark",
  language: "en",
  projects: [],
  localTerminalDefaultPath: "",
  sshConnectTimeoutSeconds: 5,
  sshServerAliveIntervalSeconds: 30,
  terminalThemeId: defaultTerminalThemeId,
  terminalFontSize: 14,
  terminalCharset: "utf-8"
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

type DrawerMode = "new" | "edit";
type TerminalState = "connecting" | "connected" | "error";

type TerminalTab = {
  id: string;
  sessionId: string;
  title: string;
  kind: "remote" | "local";
  host: SavedHost | null;
  state: TerminalState;
  statusText: string;
  buffer: string[];
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

type ManagedProject = {
  id: string;
  name: string;
  namespace: string;
  path: string;
  projectType: "local" | "server" | "hybrid";
};

type TerminalCharset = "utf-8" | "gb18030" | "gbk" | "big5";

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
};

type UpdateStage = "idle" | "downloading" | "ready";
type UpdateCheckState = "idle" | "checking" | "available" | "upToDate" | "error" | "unsupported";
type SettingsSectionId = "general" | "projects" | "connection" | "terminal" | "about" | "danger";
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
    case "ArrowUp":
      return "\u001b[A";
    case "Backspace":
      return "\u007f";
    case "Delete":
      return "\u001b[3~";
    default:
      return null;
  }
}

const blankProject: ManagedProject = {
  id: "",
  name: "",
  namespace: "",
  path: "",
  projectType: "local"
};

function getHostTitle(host: SavedHost, fallback = "Untitled Host") {
  return host.label.trim() || host.address.trim() || fallback;
}

function getHostBadge(host: SavedHost, fallback = "Untitled Host") {
  return getHostTitle(host, fallback).slice(0, 1).toUpperCase();
}

function hasTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
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
  const [activeTabId, setActiveTabId] = useState(HOSTS_TAB_ID);
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [monitorTabs, setMonitorTabs] = useState<MonitorTab[]>([]);
  const [hosts, setHosts] = useState<SavedHost[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<SavedHost>(blankHost);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("new");
  const [status, setStatus] = useState(messagesByLanguage[DEFAULT_APP_SETTINGS.language].ready);
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

  const terminalEl = useRef<HTMLDivElement | null>(null);
  const localTerminalMenuRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalDecodersRef = useRef<Map<string, TextDecoder>>(new Map());
  const activeTabIdRef = useRef(HOSTS_TAB_ID);
  const terminalTabsRef = useRef<TerminalTab[]>([]);
  const monitorTabsRef = useRef<MonitorTab[]>([]);

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
      { id: "connection" as const, label: messages.connection, icon: PlugZap },
      { id: "terminal" as const, label: messages.terminal, icon: TerminalSquare },
      { id: "about" as const, label: messages.about, icon: Info },
      { id: "danger" as const, label: messages.dangerZone, icon: ShieldAlert }
    ],
    [messages.about, messages.connection, messages.dangerZone, messages.general, messages.projects, messages.terminal]
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
    const savedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!savedSettings) {
      return;
    }

    try {
      const parsed = JSON.parse(savedSettings) as Partial<AppSettings>;
      setSettings({
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
            sshServerAliveIntervalOptions.includes(
              parsed.sshServerAliveIntervalSeconds as (typeof sshServerAliveIntervalOptions)[number]
            )
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
            : DEFAULT_APP_SETTINGS.terminalCharset
      });
    } catch {
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const savedRecentProjects = window.localStorage.getItem(LOCAL_TERMINAL_RECENT_PROJECTS_KEY);
    if (!savedRecentProjects) {
      return;
    }

    try {
      const parsed = JSON.parse(savedRecentProjects) as string[];
      setRecentLocalProjectIds(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
    } catch {
      window.localStorage.removeItem(LOCAL_TERMINAL_RECENT_PROJECTS_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(LOCAL_TERMINAL_RECENT_PROJECTS_KEY, JSON.stringify(recentLocalProjectIds));
  }, [recentLocalProjectIds]);

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
    if (!isSftpView || !selectedHost) {
      setRemoteEntries([]);
      setRemoteError("");
      return;
    }

    let cancelled = false;
    setRemoteLoading(true);
    setRemoteError("");
    void listRemoteDirectory(selectedHost, remotePath, sshOptions)
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
  }, [isSftpView, selectedHost, remotePath, remoteRefreshTick, sshOptions]);

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

    if (activeTerminalTab.buffer.length > 0) {
      terminal.write(activeTerminalTab.buffer.join(""));
    }

    const disposable = terminal.onData((data) => {
      sendActiveTerminalInput(data);
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
  }, [activeTerminalTab?.id, activeTerminalTheme, isLocalTerminalView, localPreviewOpen, sendActiveTerminalInput, settings.terminalFontSize]);

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

      const chunk = decodeTerminalPayload(event.payload);

      const nextState: TerminalState =
        matchingTab.state === "connecting" && event.payload.stream === "stdout"
          ? "connected"
          : matchingTab.state;

      const nextStatusText =
        matchingTab.state === "connecting" && event.payload.stream === "stdout"
          ? messages.connected
          : matchingTab.statusText;

      setTerminalTabs((prev) =>
        prev.map((tab) =>
          tab.sessionId === event.payload.sessionId
            ? { ...tab, state: nextState, statusText: nextStatusText, buffer: [...tab.buffer, chunk] }
            : tab
        )
      );

      if (activeTabIdRef.current === matchingTab.id && terminalRef.current) {
        terminalRef.current.write(chunk);
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
  }, [decodeTerminalPayload, messages.connected]);

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
    const jobId = startTransferJob(entry.name, "upload", messages.uploadingTo(remotePath));
    try {
      await uploadToRemote(selectedHost, entry.path, remotePath, sshOptions);
      setStatus(messages.uploaded(entry.name));
      setStatusTone("success");
      finishTransferJob(jobId, "success", messages.uploadedTo(remotePath));
      setFileMenu(null);
      setRemoteRefreshTick((current) => current + 1);
    } catch (error) {
      const message = getErrorMessage(error, messages.uploadFailed(entry.name));
      setStatus(message);
      setStatusTone("error");
      finishTransferJob(jobId, "error", message);
    }
  }

  async function handleDownloadEntry(entry: FileEntry) {
    if (!selectedHost) return;
    const remoteTarget = joinChildPath(remotePath, entry.name);
    const jobId = startTransferJob(entry.name, "download", messages.downloadingTo(localPath));
    try {
      await downloadFromRemote(selectedHost, remoteTarget, localPath, entry.is_dir, sshOptions);
      setStatus(messages.downloaded(entry.name));
      setStatusTone("success");
      finishTransferJob(jobId, "success", messages.downloadedTo(localPath));
      setFileMenu(null);
      setLocalRefreshTick((current) => current + 1);
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
    if (!selectedHost) return;
    const remoteTarget = joinChildPath(remotePath, entry.name);
    await deleteRemoteEntry(selectedHost, remoteTarget, entry.is_dir, sshOptions);
    setStatus(messages.deletedRemote(entry.name));
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
      const duplicated = await saveHost({
        ...targetHost,
        id: crypto.randomUUID(),
        label: `${getDisplayHostTitle(targetHost)} ${messages.hostCopySuffix}`
      });
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
      setStatus(error instanceof Error ? error.message : messages.connectionTestFailed);
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
        throw new Error(messages.selectOrFillHostFirst);
      }
      if (targetHost.authType === "password" && !(targetHost.password || "").trim()) {
        throw new Error(messages.passwordRequired);
      }
      if (targetHost.authType === "key" && !(targetHost.privateKeyPath || "").trim()) {
        throw new Error(messages.keyPathRequired);
      }

      setStatus(messages.connectingToHost(targetHost.username, targetHost.address, targetHost.port));
      const sessionId = await startTerminalSession(targetHost, sshOptions);
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
          statusText: messages.connectingToHost(targetHost.username, targetHost.address, targetHost.port),
          buffer: []
        }
      ]);

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
          state: "connecting",
          statusText: messages.openingLocalTerminal,
          buffer: []
        }
      ]);

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
  // time: 2026/04/05/11:21:34
  async function handleCloseTerminalTab(tabId: string) {
    const currentTabs = terminalTabsRef.current;
    const targetIndex = currentTabs.findIndex((tab) => tab.id === tabId);
    if (targetIndex < 0) return;

    const targetTab = currentTabs[targetIndex];
    terminalDecodersRef.current.delete(targetTab.sessionId);
    await closeTerminalSession(targetTab.sessionId);

    const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);
    const nextActiveTabId =
      activeTabIdRef.current === tabId
        ? nextTabs[targetIndex]?.id ?? nextTabs[targetIndex - 1]?.id ?? HOSTS_TAB_ID
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
    const nextActiveTabId = activeTabIdRef.current === tabId ? HOSTS_TAB_ID : activeTabIdRef.current;

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
            className="top-tab top-tab--ghost"
            onClick={handleToggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>

          <button
            type="button"
            className={`top-tab ${isHostsView ? "top-tab--active" : ""}`}
            onClick={() => setActiveTabId(HOSTS_TAB_ID)}
          >
            <Server size={16} />
            {messages.hosts}
          </button>

          <button
            type="button"
            className={`top-tab ${isSftpView ? "top-tab--active" : ""}`}
            onClick={() => setActiveTabId(SFTP_TAB_ID)}
          >
            <FolderOpen size={16} />
            {messages.sftp}
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
                    {recentLocalProjects.map((project) => (
                      <button key={project.id} type="button" className="topbar-popover__item" onClick={() => void handleOpenProjectLocalTerminal(project)}>
                        <div>
                          <strong>{project.name}</strong>
                          <span>{project.path}</span>
                        </div>
                      </button>
                    ))}
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
              className={`side-nav ${isHostsView ? "side-nav--active" : ""}`}
              onClick={() => setActiveTabId(HOSTS_TAB_ID)}
            >
              <Server size={18} />
              <span>Hosts</span>
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
          {isHostsView ? (
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
                                <div className="host-row__meta">{host.address}:{host.port}</div>
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
                            onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                          />
                        </label>
                      ) : (
                        <label>
                          <span>{messages.privateKeyPath}</span>
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

                <label className="sftp-host-select">
                  <span>{messages.selectHost}</span>
                  <select value={selectedId} onChange={(event) => handleSelectSftpHost(event.target.value)}>
                    <option value="">{messages.selectHostPlaceholder}</option>
                    {hosts.map((host) => (
                      <option key={host.id} value={host.id}>
                        {getDisplayHostTitle(host)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="sftp-browser-grid">
                <FileBrowserPane
                  title={messages.local}
                  refreshLabel={messages.refresh}
                  upLabel={messages.up}
                  loadingText={messages.loading}
                  path={localPath}
                  items={localEntries}
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
                />

                <FileBrowserPane
                  title={messages.remote}
                  refreshLabel={messages.refresh}
                  upLabel={messages.up}
                  loadingText={messages.loading}
                  path={remotePath}
                  items={remoteEntries}
                  loading={remoteLoading}
                  error={remoteError}
                  emptyText={selectedHost ? messages.noRemoteFiles : messages.selectHostPlaceholder}
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
                  <strong>{messages.transfers}</strong>
                  <span>{messages.transferCount(transferJobs.length)}</span>
                </div>

                <div className="transfer-list">
                  {transferJobs.map((job) => (
                    <div key={job.id} className="transfer-item">
                      <div className="transfer-item__meta">
                        <strong>{job.name}</strong>
                        <span>
                          {job.direction === "upload" ? messages.transferUpload : messages.transferDownload} · {job.detail}
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

                  {activeSettingsSection === "connection" ? (
                    <section className="settings-panel">
                      <div className="settings-panel__header">
                        <PlugZap size={18} />
                        <div>
                          <h3>{messages.connection}</h3>
                          <span>{messages.sshDefaultsDescription}</span>
                        </div>
                      </div>

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
              onTerminalMount={(element) => {
                terminalEl.current = element;
              }}
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
              <div
                className="terminal-frame"
                ref={terminalEl}
                onMouseDown={() => terminalRef.current?.focus()}
                style={{ background: activeTerminalTheme.theme.background }}
              />
            </section>
          ) : (
            <section className="terminal-screen" style={{ background: activeTerminalTheme.theme.background }}>
              <div
                className="terminal-frame"
                ref={terminalEl}
                onMouseDown={() => terminalRef.current?.focus()}
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
                onClick={() => void handleDeleteLocalFile(fileMenu.entry)}
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
                onClick={() => void handleDeleteRemoteFile(fileMenu.entry)}
              >
                <Trash2 size={18} />
                <span>{messages.delete}</span>
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
    </div>
  );
}
