import type { FileEntry } from "./api";

export type AgentSession = {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  status: string;
  providerId: string;
  model: string;
  rootPath: string;
  createdAt: number;
  updatedAt: number;
};

export type AgentMessage = {
  id: string;
  sessionId: string;
  role: "system" | "user" | "assistant" | "tool" | string;
  content: string;
  createdAt: number;
};

export type AgentPlanItem = {
  id: string;
  sessionId: string;
  title: string;
  status: string;
  position: number;
  createdAt: number;
  updatedAt: number;
};

export type AgentToolCall = {
  id: string;
  sessionId: string;
  toolName: string;
  argumentsSummary: string;
  resultSummary: string;
  status: string;
  createdAt: number;
};

export type AgentSessionDetail = {
  session: AgentSession;
  messages: AgentMessage[];
  planItems: AgentPlanItem[];
  toolCalls: AgentToolCall[];
};

export type AgentProjectContext = {
  rootPath: string;
  topLevelEntries: FileEntry[];
  keyFiles: string[];
  summary: string;
};

export type AgentSearchMatch = {
  path: string;
  line: number;
  snippet: string;
};

export type AgentFileReadResult = {
  path: string;
  content: string;
  truncated: boolean;
  startLine: number;
  endLine: number;
  totalLines: number;
};

export type AgentStreamEvent = {
  sessionId: string;
  phase: "start" | "delta" | "done" | "error";
  messageId: string;
  createdAt: number;
  delta?: string;
  content?: string;
  error?: string;
};

export type CreateAgentSessionRequest = {
  projectId: string;
  rootPath: string;
  providerId: string;
  model: string;
  goal: string;
};

type BrowserAgentStore = {
  sessions: AgentSession[];
  messagesBySessionId: Record<string, AgentMessage[]>;
  planItemsBySessionId: Record<string, AgentPlanItem[]>;
  toolCallsBySessionId: Record<string, AgentToolCall[]>;
};

type RunAgentTurnOptions = {
  onEvent?: (event: AgentStreamEvent) => void;
  providerId?: string;
  model?: string;
};

type AgentListDirRequest = {
  sessionId: string;
  path: string;
};

type AgentSearchRequest = {
  sessionId: string;
  query: string;
  path?: string;
  maxResults?: number;
};

type AgentReadFileRequest = {
  sessionId: string;
  path: string;
  startLine?: number;
  lineCount?: number;
};

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const STORAGE_KEY = "serverdeck.agent.sessions";

async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const mod = await import("@tauri-apps/api/core");
  return mod.invoke<T>(command, args);
}

function hasTauri() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

// author: BrianXiong
// time: 2026/04/08/16:24:00
function loadBrowserStore(): BrowserAgentStore {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { sessions: [], messagesBySessionId: {}, planItemsBySessionId: {}, toolCallsBySessionId: {} };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BrowserAgentStore>;
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions as AgentSession[] : [],
      messagesBySessionId: parsed.messagesBySessionId && typeof parsed.messagesBySessionId === "object"
        ? parsed.messagesBySessionId as Record<string, AgentMessage[]>
        : {},
      planItemsBySessionId: parsed.planItemsBySessionId && typeof parsed.planItemsBySessionId === "object"
        ? parsed.planItemsBySessionId as Record<string, AgentPlanItem[]>
        : {},
      toolCallsBySessionId: parsed.toolCallsBySessionId && typeof parsed.toolCallsBySessionId === "object"
        ? parsed.toolCallsBySessionId as Record<string, AgentToolCall[]>
        : {}
    };
  } catch {
    return { sessions: [], messagesBySessionId: {}, planItemsBySessionId: {}, toolCallsBySessionId: {} };
  }
}

// author: BrianXiong
// time: 2026/04/08/16:24:00
function saveBrowserStore(store: BrowserAgentStore) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// author: BrianXiong
// time: 2026/04/08/16:24:00
function buildBrowserTitle(goal: string) {
  const trimmed = goal.trim();
  if (!trimmed) {
    return "New Agent Session";
  }

  const title = Array.from(trimmed).slice(0, 48).join("");
  return Array.from(trimmed).length > 48 ? `${title}…` : title;
}

// author: BrianXiong
// time: 2026/04/09/09:30:00
function normalizeRelativePath(path: string) {
  const trimmed = path.trim();
  if (!trimmed || trimmed === ".") {
    return "";
  }

  return trimmed.replace(/^\.\//, "");
}

// author: BrianXiong
// time: 2026/04/09/09:30:00
function joinAgentPath(rootPath: string, relativePath: string) {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) {
    return rootPath;
  }

  return `${rootPath.replace(/\/$/, "")}/${normalized}`;
}

export async function listAgentSessions() {
  if (hasTauri()) {
    return tauriInvoke<AgentSession[]>("list_agent_sessions");
  }

  const store = loadBrowserStore();
  return [...store.sessions].sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function getAgentSessionDetail(sessionId: string) {
  if (hasTauri()) {
    return tauriInvoke<AgentSessionDetail>("get_agent_session_detail", { sessionId });
  }

  const store = loadBrowserStore();
  const session = store.sessions.find((item) => item.id === sessionId);
  if (!session) {
    throw new Error("Agent session not found");
  }

  return {
    session,
    messages: store.messagesBySessionId[sessionId] ?? [],
    planItems: store.planItemsBySessionId[sessionId] ?? [],
    toolCalls: store.toolCallsBySessionId[sessionId] ?? []
  };
}

export async function deleteAgentSession(sessionId: string) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("delete_agent_session", { sessionId });
  }

  const store = loadBrowserStore();
  store.sessions = store.sessions.filter((item) => item.id !== sessionId);
  delete store.messagesBySessionId[sessionId];
  delete store.planItemsBySessionId[sessionId];
  delete store.toolCallsBySessionId[sessionId];
  saveBrowserStore(store);
  return true;
}

export async function agentGetProjectContext(sessionId: string) {
  if (hasTauri()) {
    return tauriInvoke<AgentProjectContext>("agent_get_project_context", { sessionId });
  }

  const detail = await getAgentSessionDetail(sessionId);
  return {
    rootPath: detail.session.rootPath,
    topLevelEntries: [],
    keyFiles: [],
    summary: `Project root: ${detail.session.rootPath}`
  };
}

export async function agentListDir(request: AgentListDirRequest) {
  if (hasTauri()) {
    return tauriInvoke<FileEntry[]>("agent_list_dir", { request });
  }

  return [];
}

export async function agentSearchInFiles(request: AgentSearchRequest) {
  if (hasTauri()) {
    return tauriInvoke<AgentSearchMatch[]>("agent_search_in_files", { request });
  }

  const detail = await getAgentSessionDetail(request.sessionId);
  const latestUserMessage = detail.messages[detail.messages.length - 1]?.content ?? "";
  return [{
    path: normalizeRelativePath(request.path ?? ".") || ".",
    line: 1,
    snippet: `Mock search result for "${request.query}" in ${latestUserMessage.slice(0, 40)}`
  }];
}

export async function agentReadFile(request: AgentReadFileRequest) {
  if (hasTauri()) {
    return tauriInvoke<AgentFileReadResult>("agent_read_file", { request });
  }

  const detail = await getAgentSessionDetail(request.sessionId);
  return {
    path: normalizeRelativePath(request.path),
    content: `Mock read for ${joinAgentPath(detail.session.rootPath, request.path)}`,
    truncated: false,
    startLine: request.startLine ?? 1,
    endLine: request.startLine ?? 1,
    totalLines: 1
  };
}

export async function createAgentSession(request: CreateAgentSessionRequest) {
  if (hasTauri()) {
    return tauriInvoke<AgentSessionDetail>("create_agent_session", { request });
  }

  const goal = request.goal.trim();
  if (!goal) {
    throw new Error("Agent task is required");
  }

  const createdAt = Date.now();
  const sessionId = crypto.randomUUID();
  const session: AgentSession = {
    id: sessionId,
    projectId: request.projectId,
    title: buildBrowserTitle(goal),
    goal,
    status: "idle",
    providerId: request.providerId,
    model: request.model,
    rootPath: request.rootPath,
    createdAt,
    updatedAt: createdAt
  };
  const message: AgentMessage = {
    id: crypto.randomUUID(),
    sessionId,
    role: "user",
    content: goal,
    createdAt
  };

  const store = loadBrowserStore();
  store.sessions = [session, ...store.sessions].sort((left, right) => right.updatedAt - left.updatedAt);
  store.messagesBySessionId[sessionId] = [message];
  store.planItemsBySessionId[sessionId] = [];
  store.toolCallsBySessionId[sessionId] = [];
  saveBrowserStore(store);

  return {
    session,
    messages: [message],
    planItems: [],
    toolCalls: []
  };
}

export async function appendAgentUserMessage(sessionId: string, content: string) {
  if (hasTauri()) {
    return tauriInvoke<AgentSessionDetail>("append_agent_user_message", { sessionId, content });
  }

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Agent message is required");
  }

  const store = loadBrowserStore();
  const session = store.sessions.find((item) => item.id === sessionId);
  if (!session) {
    throw new Error("Agent session not found");
  }

  const createdAt = Date.now();
  const message: AgentMessage = {
    id: crypto.randomUUID(),
    sessionId,
    role: "user",
    content: trimmed,
    createdAt
  };

  session.updatedAt = createdAt;
  store.messagesBySessionId[sessionId] = [...(store.messagesBySessionId[sessionId] ?? []), message];
  store.sessions = [...store.sessions].sort((left, right) => right.updatedAt - left.updatedAt);
  saveBrowserStore(store);

  return {
    session,
    messages: store.messagesBySessionId[sessionId],
    planItems: store.planItemsBySessionId[sessionId] ?? [],
    toolCalls: store.toolCallsBySessionId[sessionId] ?? []
  };
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
function buildBrowserAssistantReply(session: AgentSession, messages: AgentMessage[]) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? session.goal;
  return [
    "Browser preview mode is active, so this is a mocked streaming reply.",
    `Project scope: ${session.rootPath}`,
    `Selected model: ${session.model || "not configured"}`,
    "",
    `Latest request: ${latestUserMessage}`,
    "",
    "Run the Tauri desktop app to connect a real AI Provider and receive actual streamed completions."
  ].join("\n");
}

export async function runAgentTurn(sessionId: string, options?: RunAgentTurnOptions) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("run_agent_turn", {
      request: {
        sessionId,
        providerId: options?.providerId,
        model: options?.model
      }
    });
  }

  const store = loadBrowserStore();
  const session = store.sessions.find((item) => item.id === sessionId);
  if (!session) {
    throw new Error("Agent session not found");
  }

  if (!session.providerId && options?.providerId) {
    session.providerId = options.providerId;
  }

  if (!session.model && options?.model) {
    session.model = options.model;
  }

  const createdAt = Date.now();
  const messageId = crypto.randomUUID();
  const content = buildBrowserAssistantReply(session, store.messagesBySessionId[sessionId] ?? []);
  const chunks = content.match(/.{1,36}(\s|$)/g)?.map((item) => item) ?? [content];
  const planItems: AgentPlanItem[] = [
    {
      id: crypto.randomUUID(),
      sessionId,
      title: "Review project context",
      status: "completed",
      position: 0,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: crypto.randomUUID(),
      sessionId,
      title: "Summarize findings",
      status: "completed",
      position: 1,
      createdAt,
      updatedAt: createdAt
    }
  ];
  const toolCalls: AgentToolCall[] = [{
    id: crypto.randomUUID(),
    sessionId,
    toolName: "get_project_context",
    argumentsSummary: ".",
    resultSummary: `Project root ${session.rootPath}`,
    status: "completed",
    createdAt
  }];

  // Insert tool messages for inline display in conversation
  const toolMessages: AgentMessage[] = toolCalls.map((call) => ({
    id: crypto.randomUUID(),
    sessionId,
    role: "tool" as const,
    content: `${call.toolName}\nArguments: ${call.argumentsSummary}\nResult: ${call.resultSummary}`,
    createdAt
  }));

  session.status = "streaming";
  session.updatedAt = createdAt;
  options?.onEvent?.({
    sessionId,
    phase: "start",
    messageId,
    createdAt
  });

  for (const chunk of chunks) {
    await delay(45);
    options?.onEvent?.({
      sessionId,
      phase: "delta",
      messageId,
      createdAt,
      delta: chunk
    });
  }

  const assistantMessage: AgentMessage = {
    id: messageId,
    sessionId,
    role: "assistant",
    content,
    createdAt
  };

  session.status = "idle";
  session.updatedAt = Date.now();
  store.messagesBySessionId[sessionId] = [...(store.messagesBySessionId[sessionId] ?? []), ...toolMessages, assistantMessage];
  store.planItemsBySessionId[sessionId] = planItems;
  store.toolCallsBySessionId[sessionId] = [...(store.toolCallsBySessionId[sessionId] ?? []), ...toolCalls];
  store.sessions = [...store.sessions].sort((left, right) => right.updatedAt - left.updatedAt);
  saveBrowserStore(store);

  options?.onEvent?.({
    sessionId,
    phase: "done",
    messageId,
    createdAt,
    content
  });

  return true;
}
