import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { ChevronUp, Home, RefreshCw } from "lucide-react";
import type { FileEntry } from "../../lib/api";
import { formatFileSize, formatTimestamp } from "../../lib/fileBrowser";

type SortField = "name" | "size" | "kind" | "addedDate";

type TerminalFileNavigatorProps = {
  title: string;
  refreshLabel: string;
  upLabel: string;
  homeLabel: string;
  loadingText: string;
  emptyText: string;
  nameColumnLabel: string;
  sizeColumnLabel: string;
  kindColumnLabel: string;
  addedDateColumnLabel: string;
  folderKindLabel: string;
  fileKindFallbackLabel: string;
  path: string;
  items: FileEntry[];
  loading: boolean;
  error?: string;
  selectedPath?: string;
  autoFocus?: boolean;
  onPathChange: (path: string) => void;
  onRefresh: () => void;
  onGoUp: () => void;
  onGoHome: () => void;
  onOpenDir: (entry: FileEntry) => void;
  onSelectEntry: (entry: FileEntry | null) => void;
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>, entry: FileEntry) => void;
};

// author: BrianXiong
// time: 2026/04/05/12:55:30
function renderPrefix(entry: FileEntry, isSelected: boolean) {
  if (entry.is_dir) {
    return isSelected ? "▸" : "▹";
  }
  return isSelected ? "◆" : "·";
}

// author: BrianXiong
// time: 2026/04/05/12:55:30
export function TerminalFileNavigator({
  title,
  refreshLabel,
  upLabel,
  homeLabel,
  loadingText,
  emptyText,
  nameColumnLabel,
  sizeColumnLabel,
  kindColumnLabel,
  addedDateColumnLabel,
  folderKindLabel,
  fileKindFallbackLabel,
  path,
  items,
  loading,
  error,
  selectedPath,
  autoFocus,
  onPathChange,
  onRefresh,
  onGoUp,
  onGoHome,
  onOpenDir,
  onSelectEntry,
  onContextMenu
}: TerminalFileNavigatorProps) {
  const paneRef = useRef<HTMLElement | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [pathDraft, setPathDraft] = useState(path);

  useEffect(() => {
    setPathDraft(path);
  }, [path]);

  // author: BrianXiong
  // time: 2026/07/21/00:00:00
  // Commit the path on Enter/blur instead of on every keystroke, so typing a
  // path does not trigger one directory listing per key press.
  function commitPathDraft() {
    const next = pathDraft.trim();
    if (!next || next === path) {
      setPathDraft(path);
      return;
    }

    onPathChange(next);
  }

  function handlePathKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    event.stopPropagation();

    if (event.key === "Enter") {
      event.preventDefault();
      commitPathDraft();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setPathDraft(path);
    }
  }

  const orderedItems = useMemo(() => {
    const entries = [...items];

    entries.sort((left, right) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (left.is_dir !== right.is_dir) {
        return left.is_dir ? -1 : 1;
      }

      if (sortField === "size") {
        return (left.size - right.size) * direction;
      }

      if (sortField === "addedDate") {
        return (Number(left.modified) - Number(right.modified)) * direction;
      }

      if (sortField === "kind") {
        const leftKind = getEntryKindLabel(left, folderKindLabel, fileKindFallbackLabel);
        const rightKind = getEntryKindLabel(right, folderKindLabel, fileKindFallbackLabel);
        return leftKind.localeCompare(rightKind) * direction || left.name.localeCompare(right.name) * direction;
      }

      return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }) * direction;
    });

    return entries;
  }, [fileKindFallbackLabel, folderKindLabel, items, sortDirection, sortField]);

  const selectedIndex = useMemo(
    () => orderedItems.findIndex((entry) => entry.path === selectedPath),
    [orderedItems, selectedPath]
  );

  useEffect(() => {
    if (autoFocus && paneRef.current) {
      paneRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!selectedPath || !paneRef.current) {
      return;
    }

    const selectedRow = paneRef.current.querySelector<HTMLElement>(`[data-path="${CSS.escape(selectedPath)}"]`);
    selectedRow?.scrollIntoView({ block: "nearest" });
  }, [selectedPath]);

  // author: BrianXiong
  // time: 2026/04/05/12:55:30
  function selectEntryAt(index: number) {
      const nextEntry = orderedItems[index];
    if (nextEntry) {
      onSelectEntry(nextEntry);
    }
  }

  // author: BrianXiong
  // time: 2026/04/05/12:55:30
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (orderedItems.length === 0) {
      return;
    }

    const baseIndex = selectedIndex >= 0 ? selectedIndex : -1;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectEntryAt(Math.min(baseIndex + 1, orderedItems.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectEntryAt(Math.max(baseIndex <= 0 ? 0 : baseIndex - 1, 0));
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onGoUp();
      return;
    }

    if (event.key === "ArrowRight" || event.key === "Enter") {
      const entry = orderedItems[Math.max(baseIndex, 0)];
      if (entry?.is_dir) {
        event.preventDefault();
        onOpenDir(entry);
      }
    }
  }

  // author: BrianXiong
  // time: 2026/04/05/15:35:54
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection(field === "size" || field === "addedDate" ? "desc" : "asc");
  }

  return (
    <section className="terminal-file-navigator" ref={paneRef} tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="terminal-file-navigator__header">
        <div className="terminal-file-navigator__header-main">
          <div className="terminal-file-navigator__header-topline">
            <div className="terminal-file-navigator__titleline">
              <strong>{title}</strong>
              <button type="button" className="terminal-mini-button terminal-mini-button--icon" onClick={onGoHome} title={homeLabel} aria-label={homeLabel}>
                <Home size={15} />
              </button>
            </div>

            <div className="terminal-file-navigator__actions">
              <button type="button" className="terminal-mini-button terminal-mini-button--icon" onClick={onGoUp} title={upLabel} aria-label={upLabel}>
                <ChevronUp size={15} />
              </button>
              <button type="button" className="terminal-mini-button terminal-mini-button--icon" onClick={onRefresh} title={refreshLabel} aria-label={refreshLabel}>
                <RefreshCw size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="terminal-file-navigator__pathbar">
        <span className="terminal-file-navigator__prompt">$</span>
        <input
          value={pathDraft}
          onChange={(event) => setPathDraft(event.target.value)}
          onKeyDown={handlePathKeyDown}
          onBlur={commitPathDraft}
          spellCheck={false}
        />
      </div>

      <div className="terminal-file-navigator__columns" role="row">
        <div className="terminal-file-navigator__column-spacer" aria-hidden="true" />
        <button type="button" className="terminal-file-navigator__column terminal-file-navigator__column--name" onClick={() => handleSort("name")}>
          <span>{nameColumnLabel}</span>
          {sortField === "name" ? <span>{sortDirection === "asc" ? "⌃" : "⌄"}</span> : null}
        </button>
        <button type="button" className="terminal-file-navigator__column" onClick={() => handleSort("size")}>
          <span>{sizeColumnLabel}</span>
          {sortField === "size" ? <span>{sortDirection === "asc" ? "⌃" : "⌄"}</span> : null}
        </button>
        <button type="button" className="terminal-file-navigator__column" onClick={() => handleSort("kind")}>
          <span>{kindColumnLabel}</span>
          {sortField === "kind" ? <span>{sortDirection === "asc" ? "⌃" : "⌄"}</span> : null}
        </button>
        <button type="button" className="terminal-file-navigator__column" onClick={() => handleSort("addedDate")}>
          <span>{addedDateColumnLabel}</span>
          {sortField === "addedDate" ? <span>{sortDirection === "asc" ? "⌃" : "⌄"}</span> : null}
        </button>
      </div>

      <div className="terminal-file-navigator__list">
        {loading ? <div className="terminal-file-navigator__state">{loadingText}</div> : null}
        {!loading && error ? <div className="terminal-file-navigator__state terminal-file-navigator__state--error">{error}</div> : null}
        {!loading && !error && orderedItems.length === 0 ? <div className="terminal-file-navigator__state">{emptyText}</div> : null}
        {!loading && !error && orderedItems.map((entry) => {
          const isSelected = selectedPath === entry.path;

          return (
            <button
              key={entry.path}
              type="button"
              data-path={entry.path}
              className={`terminal-file-navigator__row ${isSelected ? "terminal-file-navigator__row--selected" : ""}`}
              onClick={() => onSelectEntry(entry)}
              onDoubleClick={() => {
                if (entry.is_dir) {
                  onOpenDir(entry);
                }
              }}
              onContextMenu={(event) => onContextMenu?.(event, entry)}
            >
              <span className="terminal-file-navigator__prefix">{renderPrefix(entry, isSelected)}</span>
              <span className="terminal-file-navigator__name">{entry.name}{entry.is_dir ? "/" : ""}</span>
              <span className="terminal-file-navigator__meta">{entry.is_dir ? "dir" : formatFileSize(entry.size)}</span>
              <span className="terminal-file-navigator__meta">{getEntryKindLabel(entry, folderKindLabel, fileKindFallbackLabel)}</span>
              <span className="terminal-file-navigator__meta">{formatTimestamp(entry.modified)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// author: BrianXiong
// time: 2026/04/05/15:35:54
function getEntryKindLabel(entry: FileEntry, folderKindLabel: string, fileKindFallbackLabel: string) {
  if (entry.is_dir) {
    return folderKindLabel;
  }

  const ext = entry.name.split(".").pop()?.trim().toLowerCase();
  if (!ext || ext === entry.name.toLowerCase()) {
    return fileKindFallbackLabel;
  }

  return ext.toUpperCase();
}
