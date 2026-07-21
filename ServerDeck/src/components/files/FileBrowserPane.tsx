import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import {
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder
} from "lucide-react";
import type { FileEntry } from "../../lib/api";
import { formatFileSize, formatModified, parseModifiedTimestamp } from "../../lib/fileBrowser";

type SortField = "name" | "modified" | "size";

type FileBrowserPaneProps = {
  title: string;
  refreshLabel: string;
  upLabel: string;
  loadingText: string;
  nameColumnLabel: string;
  modifiedColumnLabel: string;
  sizeColumnLabel: string;
  path: string;
  items: FileEntry[];
  loading: boolean;
  error?: string;
  emptyText: string;
  disabled?: boolean;
  selectedPath?: string;
  autoFocus?: boolean;
  enableKeyboardNavigation?: boolean;
  openDirectoryOnClick?: boolean;
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>, entry: FileEntry) => void;
  onSelectEntry?: (entry: FileEntry | null) => void;
  onPathChange: (path: string) => void;
  onRefresh: () => void;
  onOpenDir: (entry: FileEntry) => void;
  onGoUp: () => void;
};

// author: BrianXiong
// time: 2026/04/05/12:19:04
function getFileIcon(entry: FileEntry) {
  if (entry.is_dir) {
    return { icon: Folder, className: "browser-row__icon--dir" };
  }

  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";

  if (["txt", "md", "log", "rtf"].includes(ext)) {
    return { icon: FileText, className: "browser-row__icon--text" };
  }
  if (["xls", "xlsx", "csv", "numbers"].includes(ext)) {
    return { icon: FileSpreadsheet, className: "browser-row__icon--sheet" };
  }
  if (["doc", "docx", "pages", "pdf"].includes(ext)) {
    return { icon: FileText, className: "browser-row__icon--doc" };
  }
  if (["js", "ts", "tsx", "jsx", "json", "py", "sh", "rs", "go", "java", "c", "cpp", "yml", "yaml"].includes(ext)) {
    return { icon: FileCode2, className: "browser-row__icon--code" };
  }
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"].includes(ext)) {
    return { icon: FileImage, className: "browser-row__icon--image" };
  }
  if (["zip", "tar", "gz", "tgz", "rar", "7z"].includes(ext)) {
    return { icon: FileArchive, className: "browser-row__icon--archive" };
  }

  return { icon: File, className: "browser-row__icon--file" };
}

// author: BrianXiong
// time: 2026/04/05/12:19:04
export function FileBrowserPane({
  title,
  refreshLabel,
  upLabel,
  loadingText,
  nameColumnLabel,
  modifiedColumnLabel,
  sizeColumnLabel,
  path,
  items,
  loading,
  error,
  emptyText,
  disabled,
  selectedPath,
  autoFocus,
  enableKeyboardNavigation,
  openDirectoryOnClick = true,
  onContextMenu,
  onSelectEntry,
  onPathChange,
  onRefresh,
  onOpenDir,
  onGoUp
}: FileBrowserPaneProps) {
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
  // path does not trigger a directory listing (and an SFTP round-trip) per key.
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
        return (left.size - right.size) * direction || left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
      }

      if (sortField === "modified") {
        return ((parseModifiedTimestamp(left.modified) ?? 0) - (parseModifiedTimestamp(right.modified) ?? 0)) * direction || left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
      }

      return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }) * direction;
    });

    return entries;
  }, [items, sortDirection, sortField]);

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
  // time: 2026/04/05/12:19:04
  function selectEntryAt(index: number) {
    const nextEntry = orderedItems[index];
    if (!nextEntry) {
      return;
    }

    onSelectEntry?.(nextEntry);
  }

  // author: BrianXiong
  // time: 2026/04/05/12:19:04
  function handlePaneKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!enableKeyboardNavigation || disabled || orderedItems.length === 0) {
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
      return;
    }
  }

  // author: BrianXiong
  // time: 2026/04/08/16:49:48
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection(field === "modified" || field === "size" ? "desc" : "asc");
  }

  // author: BrianXiong
  // time: 2026/04/08/16:49:48
  function renderSortArrow(field: SortField) {
    if (sortField !== field) {
      return null;
    }

    return <span>{sortDirection === "asc" ? "⌃" : "⌄"}</span>;
  }

  return (
    <section
      ref={paneRef}
      className={`browser-pane ${disabled ? "browser-pane--disabled" : ""}`}
      tabIndex={enableKeyboardNavigation ? 0 : -1}
      onKeyDown={handlePaneKeyDown}
    >
      <div className="browser-pane__header">
        <strong>{title}</strong>
        <button type="button" className="row-button" onClick={onRefresh} disabled={disabled}>
          {refreshLabel}
        </button>
      </div>

      <div className="browser-pathbar">
        <button type="button" className="row-button" onClick={onGoUp} disabled={disabled}>
          {upLabel}
        </button>
        <input
          value={pathDraft}
          onChange={(event) => setPathDraft(event.target.value)}
          onKeyDown={handlePathKeyDown}
          onBlur={commitPathDraft}
          spellCheck={false}
          disabled={disabled}
        />
      </div>

      <div className="browser-list">
        <div className="browser-column-header">
          <button type="button" className="browser-column-button browser-column-button--name" onClick={() => handleSort("name")} disabled={disabled}>
            <span>{nameColumnLabel}</span>
            {renderSortArrow("name")}
          </button>
          <button type="button" className="browser-column-button browser-column-button--modified" onClick={() => handleSort("modified")} disabled={disabled}>
            <span>{modifiedColumnLabel}</span>
            {renderSortArrow("modified")}
          </button>
          <button type="button" className="browser-column-button browser-column-button--size" onClick={() => handleSort("size")} disabled={disabled}>
            <span>{sizeColumnLabel}</span>
            {renderSortArrow("size")}
          </button>
        </div>

        {loading ? <div className="browser-empty">{loadingText}</div> : null}
        {!loading && error ? <div className="browser-error">{error}</div> : null}
        {!loading && !error && orderedItems.length === 0 ? <div className="browser-empty">{emptyText}</div> : null}
        {!loading && !error &&
          orderedItems.map((entry) => {
            const { icon: FileIcon, className } = getFileIcon(entry);
            const isNavigable = entry.is_dir;
            const isSelected = selectedPath === entry.path;

            return (
              <button
                key={entry.path}
                type="button"
                data-path={entry.path}
                className={`browser-row ${isNavigable ? "" : "browser-row--file"} ${isSelected ? "browser-row--selected" : ""}`.trim()}
                onClick={() => {
                  if (openDirectoryOnClick && isNavigable) {
                    onOpenDir(entry);
                    return;
                  }

                  onSelectEntry?.(entry);
                }}
                onDoubleClick={() => {
                  if (!openDirectoryOnClick && isNavigable) {
                    onOpenDir(entry);
                  }
                }}
                onContextMenu={(event) => onContextMenu?.(event, entry)}
                disabled={disabled}
                aria-disabled={!isNavigable}
                aria-selected={isSelected}
                tabIndex={-1}
              >
                <div className="browser-row__name">
                  <span className={`browser-row__icon ${className}`}>
                    <FileIcon size={14} />
                  </span>
                  <span>{entry.name}</span>
                </div>
                <span className="browser-row__meta browser-row__meta--modified">{formatModified(entry.modified)}</span>
                <span className="browser-row__meta browser-row__meta--size">{entry.is_dir ? "-" : formatFileSize(entry.size)}</span>
              </button>
            );
          })}
      </div>
    </section>
  );
}
