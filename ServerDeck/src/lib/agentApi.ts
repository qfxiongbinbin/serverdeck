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
};

type RunAgentTurnOptions = {
  onEvent?: (event: AgentStreamEvent) => void;
  providerId?: string;
  model?: string;
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

export async function deleteAgentSession(sessionId: string) {
  if (hasTauri()) {
    return tauriInvoke<boolean>("delete_agent_session", { sessionId });
  }

  const store = loadBrowserStore();
  store.sessions = store.sessions.filter((item) => item.id !== sessionId);
  delete store.messagesBySessionId[sessionId];
  saveBrowserStore(store);
  return true;
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
  store.messagesBySessionId[sessionId] = [...(store.messagesBySessionId[sessionId] ?? []), assistantMessage];
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
