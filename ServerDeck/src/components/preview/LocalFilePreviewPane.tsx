import { useEffect, useState } from "react";
import { FileArchive, FileCode2, FileImage, FileText } from "lucide-react";
import type { LocalFilePreview } from "../../lib/api";
import { detectCodePreviewMeta, formatCodeText, highlightCodeToHtml } from "../../lib/codePreview";
import { formatFileSize } from "../../lib/fileBrowser";

type LocalFilePreviewPaneProps = {
  title: string;
  emptyLabel: string;
  loadingLabel: string;
  unsupportedLabel: string;
  truncatedLabel: string;
  archiveEntriesLabel: string;
  formatCodeLabel: string;
  showRawLabel: string;
  loading: boolean;
  error: string;
  preview: LocalFilePreview | null;
  dark?: boolean;
};

// author: BrianXiong
// time: 2026/04/05/12:19:04
function getPreviewIcon(kind: LocalFilePreview["kind"]) {
  switch (kind) {
    case "image":
      return FileImage;
    case "archive":
      return FileArchive;
    case "text":
      return FileCode2;
    default:
      return FileText;
  }
}

// author: BrianXiong
// time: 2026/04/05/12:19:04
export function LocalFilePreviewPane({
  title,
  emptyLabel,
  loadingLabel,
  unsupportedLabel,
  truncatedLabel,
  archiveEntriesLabel,
  formatCodeLabel,
  showRawLabel,
  loading,
  error,
  preview,
  dark
}: LocalFilePreviewPaneProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [formatted, setFormatted] = useState(false);

  const codePreviewMeta = preview ? detectCodePreviewMeta(preview.name) : { isCode: false, language: "plaintext" as const };
  const rawText = preview?.text ?? "";
  const displayText = codePreviewMeta.isCode && formatted ? formatCodeText(rawText, codePreviewMeta.language) : rawText;
  const highlightedHtml = codePreviewMeta.isCode ? highlightCodeToHtml(displayText, codePreviewMeta.language) : "";

  useEffect(() => {
    setFormatted(false);
  }, [preview?.path]);

  useEffect(() => {
    if (!preview?.bytes || preview.bytes.length === 0) {
      setBlobUrl(null);
      return;
    }

    const url = URL.createObjectURL(
      new Blob([new Uint8Array(preview.bytes)], { type: preview.mimeType ?? "application/octet-stream" })
    );
    setBlobUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [preview]);

  const PreviewIcon = preview ? getPreviewIcon(preview.kind) : FileText;

  return (
    <section className={`local-preview-pane ${dark ? "local-preview-pane--dark" : ""}`.trim()}>
      <div className="local-preview-pane__header">
        <div>
          <strong>{title}</strong>
          <span>{preview?.name ?? emptyLabel}</span>
        </div>
        <div className="local-preview-pane__header-actions">
          {preview?.kind === "text" && codePreviewMeta.isCode ? (
            <button type="button" className="terminal-mini-button" onClick={() => setFormatted((current) => !current)}>
              {formatted ? showRawLabel : formatCodeLabel}
            </button>
          ) : null}
          {preview ? (
            <span className="settings-pill">{formatFileSize(preview.size)}</span>
          ) : null}
        </div>
      </div>

      <div className="local-preview-pane__body">
        {loading ? <div className="browser-empty">{loadingLabel}</div> : null}
        {!loading && error ? <div className="browser-error">{error}</div> : null}
        {!loading && !error && !preview ? (
          <div className="local-preview-pane__empty">
            <PreviewIcon size={18} />
            <span>{emptyLabel}</span>
          </div>
        ) : null}
        {!loading && !error && preview?.kind === "text" ? (
          <div className="local-preview-pane__content">
            {preview.truncated ? <div className="local-preview-pane__notice">{truncatedLabel}</div> : null}
            {codePreviewMeta.isCode ? (
              <pre className="local-preview-pane__text local-preview-pane__text--code">
                <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
              </pre>
            ) : (
              <pre className="local-preview-pane__text">{displayText}</pre>
            )}
          </div>
        ) : null}
        {!loading && !error && preview?.kind === "image" && blobUrl ? (
          <div className="local-preview-pane__media-wrap">
            <img className="local-preview-pane__image" src={blobUrl} alt={preview.name} />
          </div>
        ) : null}
        {!loading && !error && preview?.kind === "pdf" && blobUrl ? (
          <iframe className="local-preview-pane__pdf" src={blobUrl} title={preview.name} />
        ) : null}
        {!loading && !error && preview?.kind === "archive" ? (
          <div className="local-preview-pane__content">
            <div className="local-preview-pane__notice">{archiveEntriesLabel}</div>
            <div className="local-preview-pane__archive-list">
              {(preview.archiveEntries ?? []).map((entry) => (
                <div key={entry} className="local-preview-pane__archive-item">
                  {entry}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {!loading && !error && preview?.kind === "unsupported" ? (
          <div className="local-preview-pane__empty">
            <PreviewIcon size={18} />
            <span>{preview.detail || unsupportedLabel}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
