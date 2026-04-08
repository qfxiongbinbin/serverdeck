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

export type AgentSessionDetail = {
  session: AgentSession;
  messages: AgentMessage[];
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
    return { sessions: [], messagesBySessionId: {} };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BrowserAgentStore>;
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions as AgentSession[] : [],
      messagesBySessionId: parsed.messagesBySessionId && typeof parsed.messagesBySessionId === "object"
        ? parsed.messagesBySessionId as Record<string, AgentMessage[]>
        : {}
    };
  } catch {
    return { sessions: [], messagesBySessionId: {} };
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
    messages: store.messagesBySessionId[sessionId] ?? []
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
  saveBrowserStore(store);

  return {
    session,
    messages: [message]
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
    messages: store.messagesBySessionId[sessionId]
  };
}
