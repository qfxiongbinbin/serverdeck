import { Eye } from "lucide-react";
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
        <div className="local-terminal-split-workspace">
          <div className="local-terminal-split-workspace__pane local-terminal-split-workspace__pane--navigator">
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
              showRawLabel={showRawLabel}
              loading={previewLoading}
              error={previewError}
              preview={preview}
            />
          </div>
        </div>
      ) : (
        <div className="local-terminal-workspace__terminal-pane">
          <div
            className="terminal-frame terminal-frame--workspace"
            ref={onTerminalMount}
            onMouseDown={onFocusTerminal}
            style={{ background: terminalBackground }}
          />
        </div>
      )}
    </section>
  );
}
