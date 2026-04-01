import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import {
  ChevronRight,
  Copy,
  Info,
  Link2,
  Pencil,
  Plus,
  PlugZap,
  Save,
  Search,
  Server,
  TerminalSquare,
  Trash2,
  Users,
  X
} from "lucide-react";
import {
  closeTerminalSession,
  deleteHost,
  listHosts,
  saveHost,
  startTerminalSession,
  testConnection,
  writeTerminalInput,
  type SavedHost,
  type TerminalEventPayload
} from "./lib/api";

const HOSTS_TAB_ID = "hosts";

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

function getHostTitle(host: SavedHost) {
  return host.label.trim() || host.address.trim() || "Untitled Host";
}

function getHostBadge(host: SavedHost) {
  return getHostTitle(host).slice(0, 1).toUpperCase();
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

  const terminalEl = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const activeTabIdRef = useRef(HOSTS_TAB_ID);
  const terminalTabsRef = useRef<TerminalTab[]>([]);

  const isHostsView = activeTabId === HOSTS_TAB_ID;

  const selectedHost = useMemo(
    () => hosts.find((item) => item.id === selectedId) ?? null,
    [hosts, selectedId]
  );

  const activeTerminalTab = useMemo(
    () => terminalTabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, terminalTabs]
  );

  const filteredHosts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return hosts;

    return hosts.filter((host) => {
      const haystack = [host.label, host.address, host.username, String(host.port)].join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [hosts, search]);

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
    if (!contextMenu) {
      return;
    }

    const closeMenu = () => setContextMenu(null);
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
  }, [contextMenu]);

  useEffect(() => {
    if (!activeTerminalTab || !terminalEl.current) {
      return;
    }

    terminalEl.current.innerHTML = "";

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      theme: {
        background: "#0b1220",
        foreground: "#dce7f5",
        cursor: "#4da3ff"
      }
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalEl.current);
    fitAddon.fit();
    terminal.focus();

    terminalRef.current = terminal;

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
    };
  }, [activeTerminalTab?.id]);

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
          <button type="button" className="side-nav side-nav--active" onClick={() => setActiveTabId(HOSTS_TAB_ID)}>
            <Server size={18} />
            Hosts
          </button>
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
          ) : (
            <section className="terminal-screen">
              <div className="terminal-frame" ref={terminalEl} />
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
    </div>
  );
}
