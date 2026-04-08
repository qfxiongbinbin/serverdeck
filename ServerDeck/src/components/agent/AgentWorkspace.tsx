import { Archive, ArrowUp, Bot, ChevronDown, MessageSquare, MoreHorizontal, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import type { ManagedProject } from "../../lib/api";
import type { AgentSession, AgentSessionDetail } from "../../lib/agentApi";

export type ModelOption = {
  providerId: string;
  providerName: string;
  model: string;
};

type AgentWorkspaceProps = {
  title: string;
  description: string;
  sessionsLabel: string;
  projectLabel: string;
  taskLabel: string;
  taskPlaceholder: string;
  startLabel: string;
  conversationLabel: string;
  messagePlaceholder: string;
  sendLabel: string;
  noSessionsLabel: string;
  noSessionsDescription: string;
  noProjectsLabel: string;
  loadingLabel: string;
  thinkingLabel: string;
  noMessagesLabel: string;
  modelLabel: string;
  deleteLabel: string;
  archiveLabel: string;
  projects: ManagedProject[];
  selectedProjectId: string;
  taskInput: string;
  followUpInput: string;
  sessions: AgentSession[];
  activeSessionId: string;
  activeSessionDetail: AgentSessionDetail | null;
  sessionsLoading: boolean;
  detailLoading: boolean;
  createBusy: boolean;
  sendBusy: boolean;
  availableModels: ModelOption[];
  selectedModel: string;
  onSelectProject: (projectId: string) => void;
  onTaskInputChange: (value: string) => void;
  onStartNewSession: () => void;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onFollowUpInputChange: (value: string) => void;
  onSendFollowUp: () => void;
  onSelectModel: (model: string) => void;
};

// author: BrianXiong
// time: 2026/04/08/16:24:00
function formatSessionTime(value: number) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

// author: BrianXiong
// time: 2026/04/08/19:20:00
function buildModelValue(providerId: string, model: string) {
  if (!providerId || !model) {
    return "";
  }

  return `${providerId}:${model}`;
}

// author: BrianXiong
// time: 2026/04/08/16:24:00
export function AgentWorkspace({
  title,
  description,
  sessionsLabel,
  projectLabel,
  taskLabel,
  taskPlaceholder,
  startLabel,
  conversationLabel,
  messagePlaceholder,
  sendLabel,
  noSessionsLabel,
  noSessionsDescription,
  noProjectsLabel,
  loadingLabel,
  thinkingLabel,
  noMessagesLabel,
  modelLabel,
  deleteLabel,
  archiveLabel,
  projects,
  selectedProjectId,
  taskInput,
  followUpInput,
  sessions,
  activeSessionId,
  activeSessionDetail,
  sessionsLoading,
  detailLoading,
  createBusy,
  sendBusy,
  availableModels,
  selectedModel,
  onSelectProject,
  onTaskInputChange,
  onStartNewSession,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
  onArchiveSession,
  onFollowUpInputChange,
  onSendFollowUp,
  onSelectModel
}: AgentWorkspaceProps) {
  const composerValue = activeSessionDetail ? followUpInput : taskInput;
  const composerPlaceholder = activeSessionDetail ? messagePlaceholder : taskPlaceholder;
  const composerDisabled = activeSessionDetail ? sendBusy : createBusy;
  const modelValue = activeSessionDetail
    ? buildModelValue(activeSessionDetail.session.providerId, activeSessionDetail.session.model)
    : selectedModel;
  const hasSelectedModelOption = availableModels.some((option) => buildModelValue(option.providerId, option.model) === modelValue);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const streamStateLabel = useMemo(() => {
    if (!activeSessionDetail) {
      return "";
    }

    return activeSessionDetail.session.status === "streaming" ? thinkingLabel : "";
  }, [activeSessionDetail, thinkingLabel]);
  const latestMessageSignature = useMemo(() => {
    if (!activeSessionDetail) {
      return "";
    }

    const latestMessage = activeSessionDetail.messages[activeSessionDetail.messages.length - 1];
    return `${activeSessionDetail.session.id}:${activeSessionDetail.session.status}:${latestMessage?.id ?? ""}:${latestMessage?.content.length ?? 0}`;
  }, [activeSessionDetail]);

  useEffect(() => {
    setStickToBottom(true);
  }, [activeSessionId]);

  useEffect(() => {
    if (!stickToBottom || !messageListRef.current) {
      return;
    }

    const node = messageListRef.current;
    node.scrollTop = node.scrollHeight;
  }, [latestMessageSignature, stickToBottom]);

  useEffect(() => {
    if (!openMenuSessionId) {
      return;
    }

    function handleClickOutside() {
      setOpenMenuSessionId(null);
    }

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuSessionId]);

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (activeSessionDetail) {
      onSendFollowUp();
      return;
    }

    onCreateSession();
  }

  function handleMessageListScroll() {
    const node = messageListRef.current;
    if (!node) {
      return;
    }

    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
    setStickToBottom(nearBottom);
  }

  return (
    <section className="agent-screen">
      <div className="agent-layout">
        <aside className="agent-sidebar">
          <div className="agent-sidebar__header">
            <div className="agent-sidebar__brand">
              <Bot size={18} />
              <strong>{title}</strong>
            </div>
          </div>

          <button
            type="button"
            className="agent-new-session"
            onClick={onStartNewSession}
          >
            <Plus size={16} />
            {startLabel}
          </button>

          <div className="agent-sidebar__section-label">
            <MessageSquare size={14} />
            <span>{sessionsLabel}</span>
          </div>

          {sessionsLoading ? <div className="agent-sidebar__empty">{loadingLabel}</div> : null}

          {!sessionsLoading && sessions.length === 0 ? (
            <div className="agent-sidebar__empty agent-sidebar__empty--compact">
              <span>{noSessionsLabel}</span>
            </div>
          ) : null}

          {!sessionsLoading && sessions.length > 0 ? (
            <div className="agent-session-list">
              {sessions.map((session) => {
                const active = session.id === activeSessionId;
                const menuOpen = openMenuSessionId === session.id;

                return (
                  <div key={session.id} className={`agent-session-item ${active ? "agent-session-item--active" : ""}`}>
                    <button
                      type="button"
                      className="agent-session-item__button"
                      onClick={() => onSelectSession(session.id)}
                    >
                      <div className="agent-session-item__title">{session.title}</div>
                    </button>
                    <div className="agent-session-item__menu-wrapper">
                      <button
                        type="button"
                        className="agent-session-item__menu-trigger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuSessionId(menuOpen ? null : session.id);
                        }}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {menuOpen ? (
                        <div className="agent-session-item__menu">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onArchiveSession(session.id);
                              setOpenMenuSessionId(null);
                            }}
                          >
                            <Archive size={14} />
                            <span>{archiveLabel}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(session.id);
                              setOpenMenuSessionId(null);
                            }}
                          >
                            <Trash2 size={14} />
                            <span>{deleteLabel}</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </aside>

        <section className="agent-main">
          {activeSessionDetail ? (
            <div className="agent-main__header">
              <div className="agent-main__header-content">
                <strong>{activeSessionDetail.session.title}</strong>
                <span>{activeSessionDetail.session.rootPath}</span>
              </div>
              <span className="agent-status-pill">{activeSessionDetail.session.status}</span>
            </div>
          ) : null}

          {activeSessionDetail ? (
            <div ref={messageListRef} className="agent-message-list agent-message-list--conversation" onScroll={handleMessageListScroll}>
              {detailLoading ? <div className="agent-messages-empty"><span>{loadingLabel}</span></div> : null}
              {!detailLoading && activeSessionDetail.messages.length === 0 && activeSessionDetail.session.status !== "streaming" ? (
                <div className="agent-messages-empty">
                  <MessageSquare size={24} strokeWidth={1.5} />
                  <span>{noMessagesLabel}</span>
                </div>
              ) : null}
              {!detailLoading && activeSessionDetail.messages.length === 0 && activeSessionDetail.session.status === "streaming" ? (
                <div className="agent-messages-empty">
                  <span className="agent-message__status">{streamStateLabel}</span>
                </div>
              ) : null}
              {!detailLoading && activeSessionDetail.messages.map((message) => {
                const isUserMessage = message.role === "user";
                const showStreamingState = !isUserMessage && activeSessionDetail.session.status === "streaming" && !message.content.trim();

                return (
                  <article key={message.id} className={`agent-message agent-message--${isUserMessage ? "user" : "assistant"}`}>
                    <div className="agent-message__inner">
                      {!isUserMessage ? <div className="agent-message__role">{message.role}</div> : null}
                      <div className="agent-message__bubble">
                        <div className="agent-message__content">
                          {showStreamingState ? (
                            <span className="agent-message__status">{streamStateLabel}</span>
                          ) : isUserMessage ? (
                            message.content
                          ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                              {message.content}
                            </ReactMarkdown>
                          )}
                        </div>
                      </div>
                      <div className="agent-message__meta">
                        <span className="agent-message__time">{formatSessionTime(message.createdAt)}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
              {!detailLoading && activeSessionDetail.session.status === "streaming" && activeSessionDetail.messages.length > 0 && activeSessionDetail.messages[activeSessionDetail.messages.length - 1].role === "user" ? (
                <article className="agent-message agent-message--assistant">
                  <div className="agent-message__inner">
                    <div className="agent-message__role">assistant</div>
                    <div className="agent-message__bubble">
                      <div className="agent-message__content">
                        <span className="agent-message__status">{streamStateLabel}</span>
                      </div>
                    </div>
                  </div>
                </article>
              ) : null}
            </div>
          ) : (
            <div className="agent-empty-state">
              <div className="agent-empty-state__icon">
                <Sparkles size={28} />
              </div>
              <strong>{title}</strong>
              {projects.length ? (
                <label className="agent-project-selector">
                  <select value={selectedProjectId} onChange={(event) => onSelectProject(event.target.value)}>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="agent-empty-state__no-project">{noProjectsLabel}</span>
              )}
            </div>
          )}

          <div className="agent-composer-shell">
            <div className="agent-composer">
              <textarea
                rows={3}
                value={composerValue}
                onKeyDown={handleComposerKeyDown}
                onChange={(event) => {
                  if (activeSessionDetail) {
                    onFollowUpInputChange(event.target.value);
                    return;
                  }

                  onTaskInputChange(event.target.value);
                }}
                placeholder={composerPlaceholder}
              />

              <div className="agent-composer__footer">
                <label className="agent-model-selector">
                  <select
                    value={modelValue}
                    onChange={(event) => onSelectModel(event.target.value)}
                    disabled={Boolean(activeSessionDetail) || availableModels.length === 0}
                  >
                    {availableModels.length === 0 ? (
                      <option value="">{modelLabel}</option>
                    ) : (
                      <>
                        {activeSessionDetail && modelValue && !hasSelectedModelOption ? (
                          <option value={modelValue}>
                            {activeSessionDetail.session.providerId} / {activeSessionDetail.session.model}
                          </option>
                        ) : null}
                        {availableModels.map((option) => (
                          <option key={`${option.providerId}:${option.model}`} value={`${option.providerId}:${option.model}`}>
                            {option.providerName} / {option.model}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  <ChevronDown size={14} className="agent-model-selector__icon" />
                </label>
                <div className="agent-composer__actions">
                  <span className="agent-composer__caption">{activeSessionDetail ? conversationLabel : taskLabel}</span>
                  <button
                    type="button"
                    className="agent-composer__send"
                    onClick={activeSessionDetail ? onSendFollowUp : onCreateSession}
                    disabled={composerDisabled || (!activeSessionDetail && !projects.length)}
                    aria-label={activeSessionDetail ? sendLabel : startLabel}
                    title={activeSessionDetail ? sendLabel : startLabel}
                  >
                    <ArrowUp size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
