import { Eye, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { FileEntry, LocalFilePreview } from "../../lib/api";
import { TerminalFileNavigator } from "../files/TerminalFileNavigator";
import { LocalFilePreviewPane } from "../preview/LocalFilePreviewPane";

type LocalTerminalWorkspaceProps = {
  onTerminalMount: (element: HTMLDivElement | null) => void;
  terminalBackground: string;
  previewOpen: boolean;
  browserTitle: string;
  homeLabel: string;
  previewTitle: string;
  refreshLabel: string;
  upLabel: string;
  browserLoadingLabel: string;
  previewLoadingLabel: string;
  emptyFilesLabel: string;
  nameColumnLabel: string;
  sizeColumnLabel: string;
  kindColumnLabel: string;
  addedDateColumnLabel: string;
  folderKindLabel: string;
  fileKindFallbackLabel: string;
  emptyPreviewLabel: string;
  unsupportedPreviewLabel: string;
  truncatedPreviewLabel: string;
  archiveEntriesLabel: string;
  formatCodeLabel: string;
  renderMarkdownLabel: string;
  showRawLabel: string;
  previewSwitchLabel: string;
  localPath: string;
  localEntries: FileEntry[];
  localLoading: boolean;
  localError: string;
  previewLoading: boolean;
  previewError: string;
  preview: LocalFilePreview | null;
  selectedBrowserPath: string;
  onTogglePreview: () => void;
  onPathChange: (path: string) => void;
  onRefresh: () => void;
  onOpenDir: (entry: FileEntry) => void;
  onGoUp: () => void;
  onGoHome: () => void;
  onSelectEntry: (entry: FileEntry | null) => void;
  onFocusTerminal: () => void;
};

// author: BrianXiong
// time: 2026/04/05/12:55:30
export function LocalTerminalWorkspace({
  onTerminalMount,
  terminalBackground,
  previewOpen,
  browserTitle,
  homeLabel,
  previewTitle,
  refreshLabel,
  upLabel,
  browserLoadingLabel,
  previewLoadingLabel,
  emptyFilesLabel,
  nameColumnLabel,
  sizeColumnLabel,
  kindColumnLabel,
  addedDateColumnLabel,
  folderKindLabel,
  fileKindFallbackLabel,
  emptyPreviewLabel,
  unsupportedPreviewLabel,
  truncatedPreviewLabel,
  archiveEntriesLabel,
  formatCodeLabel,
  renderMarkdownLabel,
  showRawLabel,
  previewSwitchLabel,
  localPath,
  localEntries,
  localLoading,
  localError,
  previewLoading,
  previewError,
  preview,
  selectedBrowserPath,
  onTogglePreview,
  onPathChange,
  onRefresh,
  onOpenDir,
  onGoUp,
  onGoHome,
  onSelectEntry,
  onFocusTerminal
}: LocalTerminalWorkspaceProps) {
  const splitWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const [navigatorWidth, setNavigatorWidth] = useState(760);
  const [previewLayout, setPreviewLayout] = useState<"split" | "previewOnly">("split");
  const [lastNavigatorWidth, setLastNavigatorWidth] = useState(760);

  useEffect(() => {
    if (!previewOpen || previewLayout !== "split" || !splitWorkspaceRef.current) {
      return;
    }

    const availableWidth = splitWorkspaceRef.current.clientWidth;
    const clampedWidth = Math.min(Math.max(420, navigatorWidth), Math.max(420, availableWidth - 420));
    if (clampedWidth !== navigatorWidth) {
      setNavigatorWidth(clampedWidth);
    }
  }, [navigatorWidth, previewLayout, previewOpen]);

  useEffect(() => {
    if (!previewOpen) {
      setPreviewLayout("split");
    }
  }, [previewOpen]);

  // author: BrianXiong
  // time: 2026/04/05/16:52:44
  function collapseNavigator() {
    setLastNavigatorWidth(navigatorWidth);
    setPreviewLayout("previewOnly");
  }

  // author: BrianXiong
  // time: 2026/04/05/16:52:44
  function expandNavigator() {
    setPreviewLayout("split");
    setNavigatorWidth(lastNavigatorWidth);
  }

  // author: BrianXiong
  // time: 2026/04/05/16:43:18
  function handleResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (!splitWorkspaceRef.current) {
      return;
    }

    event.preventDefault();
    const container = splitWorkspaceRef.current;
    const containerRect = container.getBoundingClientRect();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = moveEvent.clientX - containerRect.left;
      const collapseThreshold = 180;
      const minWidth = 420;
      const maxWidth = Math.max(minWidth, containerRect.width - 420);

      if (nextWidth < collapseThreshold) {
        setPreviewLayout("previewOnly");
        return;
      }

      const clampedWidth = Math.min(Math.max(nextWidth, minWidth), maxWidth);
      setPreviewLayout("split");
      setNavigatorWidth(clampedWidth);
      setLastNavigatorWidth(clampedWidth);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  return (
    <section className="local-terminal-workspace local-terminal-workspace--dark" style={{ background: terminalBackground }}>
      <div className="local-terminal-workspace__toolbar local-terminal-workspace__toolbar--dark">
        <div className="local-terminal-workspace__toolbar-meta local-terminal-workspace__toolbar-meta--dark">
          <Eye size={16} />
          <span>{previewOpen ? localPath : previewTitle}</span>
        </div>

        <label className="preview-switch">
          <input type="checkbox" checked={previewOpen} onChange={onTogglePreview} />
          <span className="preview-switch__track">
            <span className="preview-switch__thumb" />
          </span>
          <span className="preview-switch__label">{previewSwitchLabel}</span>
        </label>
      </div>

      {previewOpen ? (
        <div
          ref={splitWorkspaceRef}
          className="local-terminal-split-workspace"
          style={{
            gridTemplateColumns:
              previewLayout === "previewOnly"
                ? `0px 14px minmax(0, 1fr)`
                : `${navigatorWidth}px 12px minmax(420px, 1fr)`
          }}
        >
          <div className={`local-terminal-split-workspace__pane local-terminal-split-workspace__pane--navigator ${previewLayout === "previewOnly" ? "local-terminal-split-workspace__pane--collapsed" : ""}`}>
            <TerminalFileNavigator
              title={browserTitle}
              homeLabel={homeLabel}
              refreshLabel={refreshLabel}
              upLabel={upLabel}
              loadingText={browserLoadingLabel}
              emptyText={emptyFilesLabel}
              nameColumnLabel={nameColumnLabel}
              sizeColumnLabel={sizeColumnLabel}
              kindColumnLabel={kindColumnLabel}
              addedDateColumnLabel={addedDateColumnLabel}
              folderKindLabel={folderKindLabel}
              fileKindFallbackLabel={fileKindFallbackLabel}
              path={localPath}
              items={localEntries}
              loading={localLoading}
              error={localError}
              selectedPath={selectedBrowserPath}
              autoFocus
              onPathChange={onPathChange}
              onRefresh={onRefresh}
              onGoUp={onGoUp}
              onGoHome={onGoHome}
              onOpenDir={onOpenDir}
              onSelectEntry={onSelectEntry}
            />
          </div>

          <div
            className="local-terminal-split-workspace__resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize preview workspace"
            onPointerDown={handleResizeStart}
          >
            <span className="local-terminal-split-workspace__resizer-handle" />
            <button
              type="button"
              className="local-terminal-split-workspace__resizer-toggle"
              onClick={(event) => {
                event.stopPropagation();
                if (previewLayout === "previewOnly") {
                  expandNavigator();
                } else {
                  collapseNavigator();
                }
              }}
              aria-label={previewLayout === "previewOnly" ? "Show file list" : "Hide file list"}
              title={previewLayout === "previewOnly" ? "Show file list" : "Hide file list"}
            >
              {previewLayout === "previewOnly" ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            </button>
          </div>

          <div className="local-terminal-split-workspace__pane local-terminal-split-workspace__pane--preview">
            <LocalFilePreviewPane
              dark
              title={previewTitle}
              emptyLabel={emptyPreviewLabel}
              loadingLabel={previewLoadingLabel}
              unsupportedLabel={unsupportedPreviewLabel}
              truncatedLabel={truncatedPreviewLabel}
              archiveEntriesLabel={archiveEntriesLabel}
              formatCodeLabel={formatCodeLabel}
              renderMarkdownLabel={renderMarkdownLabel}
              showRawLabel={showRawLabel}
              loading={previewLoading}
              error={previewError}
              preview={preview}
            />
          </div>
        </div>
      ) : (
        <div className="local-terminal-workspace__terminal-pane">
          <div className="terminal-frame-shell terminal-frame-shell--workspace" style={{ background: terminalBackground }}>
            <div
              className="terminal-frame terminal-frame--workspace"
              ref={onTerminalMount}
              onMouseDown={onFocusTerminal}
              style={{ background: terminalBackground }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
