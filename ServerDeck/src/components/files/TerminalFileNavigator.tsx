import { useEffect, useMemo, useRef } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { FileEntry } from "../../lib/api";
import { formatFileSize, formatModified } from "../../lib/fileBrowser";

type TerminalFileNavigatorProps = {
  title: string;
  refreshLabel: string;
  upLabel: string;
  loadingText: string;
  emptyText: string;
  path: string;
  items: FileEntry[];
  loading: boolean;
  error?: string;
  selectedPath?: string;
  autoFocus?: boolean;
  onPathChange: (path: string) => void;
  onRefresh: () => void;
  onGoUp: () => void;
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
  loadingText,
  emptyText,
  path,
  items,
  loading,
  error,
  selectedPath,
  autoFocus,
  onPathChange,
  onRefresh,
  onGoUp,
  onOpenDir,
  onSelectEntry,
  onContextMenu
}: TerminalFileNavigatorProps) {
  const paneRef = useRef<HTMLElement | null>(null);
  const selectedIndex = useMemo(
    () => items.findIndex((entry) => entry.path === selectedPath),
    [items, selectedPath]
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
    const nextEntry = items[index];
    if (nextEntry) {
      onSelectEntry(nextEntry);
    }
  }

  // author: BrianXiong
  // time: 2026/04/05/12:55:30
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (items.length === 0) {
      return;
    }

    const baseIndex = selectedIndex >= 0 ? selectedIndex : -1;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectEntryAt(Math.min(baseIndex + 1, items.length - 1));
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
      const entry = items[Math.max(baseIndex, 0)];
      if (entry?.is_dir) {
        event.preventDefault();
        onOpenDir(entry);
      }
    }
  }

  return (
    <section className="terminal-file-navigator" ref={paneRef} tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="terminal-file-navigator__header">
        <div>
          <strong>{title}</strong>
          <span>{path}</span>
        </div>
        <div className="terminal-file-navigator__actions">
          <button type="button" className="terminal-mini-button" onClick={onGoUp}>
            {upLabel}
          </button>
          <button type="button" className="terminal-mini-button" onClick={onRefresh}>
            {refreshLabel}
          </button>
        </div>
      </div>

      <div className="terminal-file-navigator__pathbar">
        <span className="terminal-file-navigator__prompt">$</span>
        <input value={path} onChange={(event) => onPathChange(event.target.value)} />
      </div>

      <div className="terminal-file-navigator__list">
        {loading ? <div className="terminal-file-navigator__state">{loadingText}</div> : null}
        {!loading && error ? <div className="terminal-file-navigator__state terminal-file-navigator__state--error">{error}</div> : null}
        {!loading && !error && items.length === 0 ? <div className="terminal-file-navigator__state">{emptyText}</div> : null}
        {!loading && !error && items.map((entry) => {
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
              <span className="terminal-file-navigator__meta">{formatModified(entry.modified)}</span>
              <span className="terminal-file-navigator__meta">{entry.is_dir ? "dir" : formatFileSize(entry.size)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
