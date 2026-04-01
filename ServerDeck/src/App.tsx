import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { FolderOpen, HardDriveDownload, PlugZap, Save, Server, TerminalSquare, Trash2 } from "lucide-react";
import {
  closeTerminalSession,
  deleteHost,
  listHosts,
  listLocalDirectory,
  listRemoteDirectory,
  saveHost,
  startTerminalSession,
  testConnection,
  writeTerminalInput,
  type FileEntry,
  type SavedHost,
  type TerminalEventPayload
} from "./lib/api";

const blankHost: SavedHost = {
  id: "",
  label: "",
  address: "",
  port: 22,
  username: "root",
  authType: "password",
  password: ""
};

type ViewMode = "hosts" | "terminal";

function fmtTime(value: string) {
  if (!value) return "-";
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return new Date(numeric * 1000).toLocaleString();
  }
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function FileTable({ title, items }: { title: string; items: FileEntry[] }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h3>{title}</h3>
        <span>{items.length} items</span>
      </div>
      <div className="file-table">
        <div className="file-table__head">
          <span>Name</span>
          <span>Modified</span>
          <span>Size</span>
          <span>Type</span>
        </div>
        <div className="file-table__body">
          {items.map((item) => (
            <div key={item.path} className="file-table__row">
              <span>{item.name}</span>
              <span>{fmtTime(item.modified)}</span>
              <span>{item.is_dir ? "-" : item.size}</span>
              <span>{item.is_dir ? "dir" : "file"}</span>
            </div>
          ))}
          {!items.length && <div className="empty-inline">No files</div>}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [view, setView] = useState<ViewMode>("hosts");
  const [hosts, setHosts] = useState<SavedHost[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<SavedHost>(blankHost);
  const [status, setStatus] = useState("Ready");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [localFiles, setLocalFiles] = useState<FileEntry[]>([]);
  const [remoteFiles, setRemoteFiles] = useState<FileEntry[]>([]);
  const [localPath, setLocalPath] = useState("/Users/xiongbin");
  const [remotePath, setRemotePath] = useState("~");
  const [busy, setBusy] = useState(false);
  const [terminalSessionId, setTerminalSessionId] = useState("");
  const [terminalHostLabel, setTerminalHostLabel] = useState("");
  const [terminalState, setTerminalState] = useState<"idle" | "connecting" | "connected" | "error">("idle");

  const terminalEl = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputCleanupRef = useRef<(() => void) | null>(null);
  const terminalSessionIdRef = useRef("");
  const pendingOutputRef = useRef<string[]>([]);
  const hasReceivedOutputRef = useRef(false);
  const setTerminalStateRef = useRef(setTerminalState);

  const selectedHost = useMemo(
    () => hosts.find((item) => item.id === selectedId) ?? null,
    [hosts, selectedId]
  );

  async function refreshHosts(nextSelectedId?: string) {
    const items = await listHosts();
    setHosts(items);
    const finalSelectedId =
      nextSelectedId !== undefined ? nextSelectedId : selectedId || items[0]?.id || "";
    setSelectedId(finalSelectedId);
  }

  useEffect(() => {
    console.log("[DEBUG] App mounted, checking Tauri...");
    console.log("[DEBUG] window.__TAURI_INTERNALS__:", window.__TAURI_INTERNALS__);
    void refreshHosts();
  }, []);

  useEffect(() => {
    if (selectedHost) {
      setDraft(selectedHost);
    } else {
      setDraft(blankHost);
    }
  }, [selectedHost]);

  useEffect(() => {
    void listLocalDirectory(localPath).then(setLocalFiles).catch(() => setLocalFiles([]));
  }, [localPath]);

  useEffect(() => {
    terminalSessionIdRef.current = terminalSessionId;
    if (terminalSessionId) {
      hasReceivedOutputRef.current = false;
    }
  }, [terminalSessionId]);

  useEffect(() => {
    setTerminalStateRef.current = setTerminalState;
  }, [setTerminalState]);

  useEffect(() => {
    if (view !== "terminal" || !terminalEl.current) {
      return;
    }

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
    fitAddonRef.current = fitAddon;

    if (pendingOutputRef.current.length > 0) {
      for (const chunk of pendingOutputRef.current) {
        terminal.write(chunk);
      }
      pendingOutputRef.current = [];
    }

    if (terminalSessionId) {
      const disposable = terminal.onData((data) => {
        void writeTerminalInput(terminalSessionId, data);
      });
      inputCleanupRef.current = () => disposable.dispose();
    }

    const onResize = () => fitAddon.fit();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      inputCleanupRef.current?.();
      inputCleanupRef.current = null;
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [view, terminalSessionId, terminalHostLabel]);

  useEffect(() => {
    let cleanup: null | (() => void) = null;

    console.log("[DEBUG] Setting up terminal-output event listener...");
    void listen<TerminalEventPayload>("terminal-output", (event) => {
      console.log("[DEBUG] Received terminal-output event:", event);

      if (event.payload.sessionId !== terminalSessionIdRef.current) {
        console.log("[DEBUG] Session ID mismatch, ignoring. Expected:", terminalSessionIdRef.current, "Got:", event.payload.sessionId);
        return;
      }

      // Update connection state on first stdout output
      if (!hasReceivedOutputRef.current && event.payload.stream === "stdout") {
        hasReceivedOutputRef.current = true;
        setTerminalStateRef.current("connected");
      }

      // Log for debugging
      console.log("[terminal-output]", event.payload.stream, event.payload.data.length, "bytes");

      if (terminalRef.current) {
        terminalRef.current.write(event.payload.data);
      } else {
        console.log("[DEBUG] Terminal not ready, buffering output");
        pendingOutputRef.current.push(event.payload.data);
      }
    }).then((unlisten) => {
      console.log("[DEBUG] Event listener registered successfully");
      cleanup = unlisten;
    }).catch((err) => {
      console.error("[DEBUG] Failed to register event listener:", err);
    });

    return () => {
      console.log("[DEBUG] Cleaning up event listener");
      cleanup?.();
    };
  }, []);

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
      setStatus(`Saved host ${saved.label || saved.address}`);
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
      setStatus(`Deleted host ${draft.label || draft.address}`);
      setStatusTone("success");
      await refreshHosts("");
      setDraft(blankHost);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed");
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
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

  async function handleBrowseRemote() {
    setBusy(true);
    setStatusTone("neutral");
    try {
      if (!draft.address.trim()) {
        throw new Error("Select or fill a host first");
      }
      const items = await listRemoteDirectory(draft, remotePath);
      setRemoteFiles(items);
      setStatus(`Loaded remote path ${remotePath}`);
      setStatusTone("success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Remote browse failed");
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenTerminal() {
    setBusy(true);
    setStatusTone("neutral");
    setTerminalState("connecting");
    try {
      if (!draft.address.trim()) {
        throw new Error("Select or fill a host first");
      }
      if (draft.authType === "password" && !(draft.password || "").trim()) {
        throw new Error("Password auth requires a password");
      }
      if (draft.authType === "key" && !(draft.privateKeyPath || "").trim()) {
        throw new Error("Key auth requires a private key path");
      }
      if (terminalSessionId) {
        await closeTerminalSession(terminalSessionId);
      }
      terminalRef.current?.clear();
      pendingOutputRef.current = [];
      setStatus(`Connecting to ${draft.username}@${draft.address}:${draft.port}...`);
      const sessionId = await startTerminalSession(draft);
      setTerminalSessionId(sessionId);
      setTerminalHostLabel(`${draft.username}@${draft.address}:${draft.port}`);
      setView("terminal");
      setStatus(`Terminal session opened for ${draft.username}@${draft.address}`);
      setStatusTone("success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Terminal open failed");
      setStatusTone("error");
      setTerminalState("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseTerminal() {
    if (!terminalSessionId) return;
    await closeTerminalSession(terminalSessionId);
    setTerminalSessionId("");
    setTerminalHostLabel("");
    setTerminalState("idle");
    setView("hosts");
    setStatus("Terminal session closed");
    setStatusTone("neutral");
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark">SD</div>
          <div>
            <h1>ServerDeck</h1>
            <p>macOS remote workbench</p>
          </div>
        </div>

        <div className="nav-stack">
          <button
            type="button"
            className={`action ${view === "hosts" ? "action--selected" : ""}`}
            onClick={() => setView("hosts")}
          >
            <Server size={16} />
            Hosts
          </button>
          <button
            type="button"
            className={`action ${view === "terminal" ? "action--selected" : ""}`}
            onClick={() => setView("terminal")}
          >
            <TerminalSquare size={16} />
            Terminal
          </button>
        </div>

        <button type="button" className="action action--primary" onClick={() => setDraft(blankHost)}>
          <Server size={16} />
          New Host
        </button>

        <div className="sidebar__section">
          <div className="sidebar__title">Saved Hosts</div>
          <div className="host-list">
            {hosts.map((host) => (
              <button
                key={host.id}
                type="button"
                className={`host-card ${host.id === selectedId ? "host-card--active" : ""}`}
                onClick={() => setSelectedId(host.id)}
              >
                <div className="host-card__title">{host.label || host.address}</div>
                <div className="host-card__sub">
                  {host.username}@{host.address}:{host.port}
                </div>
              </button>
            ))}
            {!hosts.length && <div className="empty-inline">No hosts yet</div>}
          </div>
        </div>
      </aside>

      <main className="content">
        {view === "hosts" ? (
          <>
            <section className="panel">
              <div className="panel__header">
                <div>
                  <h2>Host Manager</h2>
                  <span>Manage real connection data, not mock cards.</span>
                </div>
                <div className="actions">
                  <button type="button" className="action" onClick={handleSave} disabled={busy}>
                    <Save size={16} />
                    {busy ? "Working..." : "Save"}
                  </button>
                  <button type="button" className="action" onClick={handleTest} disabled={busy}>
                    <PlugZap size={16} />
                    {busy ? "Working..." : "Test SSH"}
                  </button>
                  <button type="button" className="action" onClick={handleOpenTerminal} disabled={busy}>
                    <TerminalSquare size={16} />
                    {busy ? "Working..." : "Open Terminal"}
                  </button>
                  <button
                    type="button"
                    className="action action--danger"
                    onClick={handleDelete}
                    disabled={busy || !draft.id}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>

              <div className={`inline-status inline-status--${statusTone}`}>{status}</div>

              <div className="form-grid">
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
                  <input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} />
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
                      value={draft.password || ""}
                      onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                    />
                  </label>
                ) : (
                  <label>
                    <span>Private Key Path</span>
                    <input
                      value={draft.privateKeyPath || ""}
                      onChange={(event) => setDraft({ ...draft, privateKeyPath: event.target.value })}
                    />
                  </label>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel__header">
                <div>
                  <h2>SFTP Browser</h2>
                  <span>Browse local and remote directories through the selected host.</span>
                </div>
                <div className="actions">
                  <button type="button" className="action" onClick={handleBrowseRemote} disabled={busy}>
                    <FolderOpen size={16} />
                    Browse Remote
                  </button>
                </div>
              </div>

              <div className="path-grid">
                <label>
                  <span>Local Path</span>
                  <input value={localPath} onChange={(event) => setLocalPath(event.target.value)} />
                </label>
                <label>
                  <span>Remote Path</span>
                  <input value={remotePath} onChange={(event) => setRemotePath(event.target.value)} />
                </label>
              </div>

              <div className="browser-grid">
                <FileTable title="Local" items={localFiles} />
                <FileTable title="Remote" items={remoteFiles} />
              </div>
            </section>

            <section className="panel panel--status">
              <div className="panel__header">
                <h3>Runtime Status</h3>
                <HardDriveDownload size={16} />
              </div>
              <pre className="status-box">{status}</pre>
            </section>
          </>
        ) : (
          <section className="panel terminal-panel">
            <div className="panel__header">
              <div>
                <h2>Terminal</h2>
                <span>{terminalHostLabel || "No active session"}</span>
              </div>
              <div className="actions">
                <span className={`connection-badge connection-badge--${terminalState}`}>
                  {terminalState === "connecting" && "Connecting..."}
                  {terminalState === "connected" && "Connected"}
                  {terminalState === "error" && "Error"}
                  {terminalState === "idle" && "Idle"}
                </span>
                <button type="button" className="action" onClick={() => setView("hosts")}>
                  <Server size={16} />
                  Back to Hosts
                </button>
                <button
                  type="button"
                  className="action action--danger"
                  onClick={handleCloseTerminal}
                  disabled={!terminalSessionId}
                >
                  <Trash2 size={16} />
                  Close Session
                </button>
              </div>
            </div>
            <div className={`inline-status inline-status--${statusTone}`}>{status}</div>
            <div className="terminal-frame" ref={terminalEl} />
          </section>
        )}
      </main>
    </div>
  );
}
