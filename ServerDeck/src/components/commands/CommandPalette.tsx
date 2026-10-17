import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, Pencil, PlugZap, Plus, Search, Wifi } from "lucide-react";
import type { SavedHost } from "../../lib/api";

type QuickTarget = {
  username: string;
  address: string;
  port: number;
};

type CommandPaletteLabels = {
  placeholder: string;
  noResults: string;
  recentSection: string;
  hostsSection: string;
  actionsSection: string;
  quickConnectSection: string;
  temporary: string;
  openSftp: string;
  testConnection: string;
  editHost: string;
  newHost: string;
  footer: string;
};

type CommandPaletteProps = {
  open: boolean;
  hosts: SavedHost[];
  recentHostIds: string[];
  projectNameById: Map<string, string>;
  labels: CommandPaletteLabels;
  getHostTitle: (host: SavedHost) => string;
  getHostBadge: (host: SavedHost) => string;
  onClose: () => void;
  onConnect: (host: SavedHost) => void;
  onQuickConnect: (target: QuickTarget) => void;
  onOpenSftp: (host: SavedHost) => void;
  onTestConnection: (host: SavedHost) => void;
  onEditHost: (host: SavedHost) => void;
  onNewHost: () => void;
};

type PaletteRow =
  | { id: string; section: string; kind: "quick"; target: QuickTarget }
  | { id: string; section: string; kind: "host"; host: SavedHost }
  | { id: string; section: string; kind: "actionNew" };

// author: BrianXiong
// time: 2026/10/17/23:40:00
// Parses the free-form quick connect syntax supported by the palette:
// "host", "host:port", "user@host" and "user@host:port".
function parseQuickTarget(query: string): QuickTarget | null {
  const value = query.trim();
  if (!value || /\s/.test(value)) {
    return null;
  }

  const userSplit = value.match(/^([^@]+)@(.+)$/);
  const username = userSplit ? userSplit[1] : "";
  const rest = userSplit ? userSplit[2] : value;
  const portSplit = rest.match(/^([^:]+):(\d{1,5})$/);
  const address = portSplit ? portSplit[1] : rest;
  const port = portSplit ? Number(portSplit[2]) : 22;

  if (!address || !/^[A-Za-z0-9._-]+$/.test(address)) {
    return null;
  }
  if (username && !/^[A-Za-z0-9._-]+$/.test(username)) {
    return null;
  }
  if (port <= 0 || port > 65535) {
    return null;
  }

  return { username, address, port };
}

// author: BrianXiong
// time: 2026/10/17/23:40:00
// Lower score sorts first; -1 filters the host out of the result list.
function scoreHost(host: SavedHost, query: string, projectName: string): number {
  const value = query.trim().toLowerCase();
  if (!value) {
    return 0;
  }

  const label = host.label.toLowerCase();
  const address = host.address.toLowerCase();
  const username = host.username.toLowerCase();
  const project = projectName.toLowerCase();

  if (label === value) return 0;
  if (label.startsWith(value)) return 1;
  if (address.startsWith(value)) return 2;
  if (label.includes(value)) return 3;
  if (address.includes(value)) return 4;
  if (username.includes(value)) return 5;
  if (project.includes(value)) return 6;
  return -1;
}

// author: BrianXiong
// time: 2026/10/17/23:40:00
export function CommandPalette({
  open,
  hosts,
  recentHostIds,
  projectNameById,
  labels,
  getHostTitle,
  getHostBadge,
  onClose,
  onConnect,
  onQuickConnect,
  onOpenSftp,
  onTestConnection,
  onEditHost,
  onNewHost
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    setSelectedIndex(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());

    return () => cancelAnimationFrame(frame);
  }, [open]);

  const rows = useMemo<PaletteRow[]>(() => {
    const trimmed = query.trim();
    const next: PaletteRow[] = [];
    const target = trimmed ? parseQuickTarget(trimmed) : null;

    if (!trimmed) {
      const recentHosts = recentHostIds
        .map((hostId) => hosts.find((host) => host.id === hostId) ?? null)
        .filter((host): host is SavedHost => Boolean(host));

      recentHosts.forEach((host) => {
        next.push({ id: `host:${host.id}`, section: labels.recentSection, kind: "host", host });
      });
    }

    const recentIdSet = new Set(recentHostIds);
    const matchedHosts = hosts
      .map((host) => ({
        host,
        score: scoreHost(host, trimmed, projectNameById.get(host.projectId) ?? "")
      }))
      .filter((item) => item.score >= 0)
      .filter((item) => trimmed || !recentIdSet.has(item.host.id))
      .sort((left, right) => {
        if (left.score !== right.score) {
          return left.score - right.score;
        }
        const leftRecent = recentIdSet.has(left.host.id) ? recentHostIds.indexOf(left.host.id) : 99;
        const rightRecent = recentIdSet.has(right.host.id) ? recentHostIds.indexOf(right.host.id) : 99;
        if (leftRecent !== rightRecent) {
          return leftRecent - rightRecent;
        }
        return getHostTitle(left.host).localeCompare(getHostTitle(right.host));
      });

    matchedHosts.forEach(({ host }) => {
      next.push({ id: `host:${host.id}`, section: labels.hostsSection, kind: "host", host });
    });

    // Saved matches stay above the ad-hoc target so Enter never connects to a
    // throwaway address when the query actually matches a saved host.
    if (target) {
      next.push({ id: `quick:${trimmed}`, section: labels.quickConnectSection, kind: "quick", target });
    }

    next.push({ id: "action:new", section: labels.actionsSection, kind: "actionNew" });

    return next;
  }, [query, hosts, recentHostIds, projectNameById, labels, getHostTitle]);

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(rows.length - 1, 0)));
  }, [rows.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    listRef.current
      ?.querySelector<HTMLElement>(`[data-row-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, selectedIndex]);

  function activate(row: PaletteRow | undefined, mode: "connect" | "sftp") {
    if (!row) {
      return;
    }

    if (row.kind === "quick") {
      onQuickConnect(row.target);
      return;
    }

    if (row.kind === "host") {
      if (mode === "sftp") {
        onOpenSftp(row.host);
      } else {
        onConnect(row.host);
      }
      return;
    }

    onNewHost();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((current) => (rows.length ? (current + 1) % rows.length : 0));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((current) => (rows.length ? (current - 1 + rows.length) % rows.length : 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      activate(rows[selectedIndex], event.metaKey ? "sftp" : "connect");
      return;
    }

    if (event.key === "Tab") {
      const row = rows[selectedIndex];
      if (row?.kind === "host") {
        event.preventDefault();
        activate(row, "sftp");
      }
    }
  }

  if (!open) {
    return null;
  }

  const hasHostResults = rows.some((row) => row.kind === "host");
  const hasQuickTarget = rows.some((row) => row.kind === "quick");
  const showEmptyState = Boolean(query.trim()) && !hasHostResults && !hasQuickTarget;

  return (
    <div
      className="command-palette"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="command-palette__dialog" role="dialog" aria-modal="true" aria-label={labels.placeholder}>
        <div className="command-palette__input-row">
          <Search size={16} className="command-palette__input-icon" />
          <input
            ref={inputRef}
            className="command-palette__input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            spellCheck={false}
            autoComplete="off"
          />
          <span className="command-palette__esc">Esc</span>
        </div>

        <div className="command-palette__list" ref={listRef} role="listbox">
          {showEmptyState ? <div className="command-palette__empty">{labels.noResults}</div> : null}
          {rows.length === 0 ? (
            <div className="command-palette__empty">{labels.noResults}</div>
          ) : (
            rows.map((row, index) => {
              const showSection = index === 0 || rows[index - 1].section !== row.section;
              const active = index === selectedIndex;

              return (
                <div key={row.id}>
                  {showSection ? <div className="command-palette__section">{row.section}</div> : null}
                  <div
                    className={`command-palette__row ${active ? "command-palette__row--active" : ""}`.trim()}
                    data-row-index={index}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => activate(row, "connect")}
                  >
                    {row.kind === "quick" ? (
                      <>
                        <span className="command-palette__badge command-palette__badge--quick">
                          <PlugZap size={16} />
                        </span>
                        <span className="command-palette__body">
                          <strong>{`${row.target.username ? `${row.target.username}@` : ""}${row.target.address}:${row.target.port}`}</strong>
                          <span>{labels.temporary}</span>
                        </span>
                      </>
                    ) : row.kind === "host" ? (
                      <>
                        <span className="command-palette__badge">{getHostBadge(row.host)}</span>
                        <span className="command-palette__body">
                          <strong>{getHostTitle(row.host)}</strong>
                          <span>
                            {row.host.username}@{row.host.address}:{row.host.port}
                            {projectNameById.get(row.host.projectId)
                              ? ` · ${projectNameById.get(row.host.projectId)}`
                              : ""}
                          </span>
                        </span>
                        <span className="command-palette__actions">
                          <button
                            type="button"
                            className="command-palette__action"
                            title={labels.openSftp}
                            aria-label={labels.openSftp}
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenSftp(row.host);
                            }}
                          >
                            <FolderOpen size={14} />
                          </button>
                          <button
                            type="button"
                            className="command-palette__action"
                            title={labels.testConnection}
                            aria-label={labels.testConnection}
                            onClick={(event) => {
                              event.stopPropagation();
                              onTestConnection(row.host);
                            }}
                          >
                            <Wifi size={14} />
                          </button>
                          <button
                            type="button"
                            className="command-palette__action"
                            title={labels.editHost}
                            aria-label={labels.editHost}
                            onClick={(event) => {
                              event.stopPropagation();
                              onEditHost(row.host);
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="command-palette__badge command-palette__badge--new">
                          <Plus size={16} />
                        </span>
                        <span className="command-palette__body">
                          <strong>{labels.newHost}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="command-palette__footer">{labels.footer}</div>
      </div>
    </div>
  );
}
