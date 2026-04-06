import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { FileArchive, FileCode2, FileImage, FileText } from "lucide-react";
import { readLocalFilePreview, type LocalFilePreview } from "../../lib/api";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { detectCodePreviewMeta, formatCodeText, highlightCodeToHtml, isMarkdownPreview, resolveMarkdownUrl } from "../../lib/codePreview";
import { formatFileSize } from "../../lib/fileBrowser";

type LocalFilePreviewPaneProps = {
  title: string;
  emptyLabel: string;
  loadingLabel: string;
  unsupportedLabel: string;
  truncatedLabel: string;
  archiveEntriesLabel: string;
  formatCodeLabel: string;
  renderMarkdownLabel: string;
  showRawLabel: string;
  loading: boolean;
  error: string;
  preview: LocalFilePreview | null;
  dark?: boolean;
};

type MarkdownImageProps = {
  src?: string;
  alt?: string;
  baseFilePath?: string;
} & ImgHTMLAttributes<HTMLImageElement>;

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
// time: 2026/04/06/10:58:37
function MarkdownImage({ src = "", alt = "", baseFilePath, ...props }: MarkdownImageProps) {
  const [imageUrl, setImageUrl] = useState(src);

  useEffect(() => {
    const resolved = resolveMarkdownUrl(src, { baseFilePath });
    if (!resolved.localPath) {
      setImageUrl(resolved.url ?? src);
      return;
    }

    let cancelled = false;
    let objectUrl = "";

    void readLocalFilePreview(resolved.localPath)
      .then((preview) => {
        if (!preview.bytes || cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(
          new Blob([new Uint8Array(preview.bytes)], { type: preview.mimeType ?? "application/octet-stream" })
        );
        setImageUrl(objectUrl);
      })
      .catch(() => {
        setImageUrl(resolved.url ?? src);
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [baseFilePath, src]);

  return <img src={imageUrl} alt={alt} {...props} />;
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
  renderMarkdownLabel,
  showRawLabel,
  loading,
  error,
  preview,
  dark
}: LocalFilePreviewPaneProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [formatted, setFormatted] = useState(false);
  const [markdownRendered, setMarkdownRendered] = useState(false);

  const codePreviewMeta = preview ? detectCodePreviewMeta(preview.name) : { isCode: false, language: "plaintext" as const };
  const markdownPreview = preview?.kind === "text" && isMarkdownPreview(preview.name, preview.mimeType);
  const rawText = preview?.text ?? "";
  const displayText = codePreviewMeta.isCode && formatted ? formatCodeText(rawText, codePreviewMeta.language) : rawText;
  const highlightedHtml = codePreviewMeta.isCode ? highlightCodeToHtml(displayText, codePreviewMeta.language) : "";

  useEffect(() => {
    setFormatted(false);
    setMarkdownRendered(markdownPreview);
  }, [markdownPreview, preview?.path]);

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
          {markdownPreview ? (
            <button type="button" className="terminal-mini-button" onClick={() => setMarkdownRendered((current) => !current)}>
              {markdownRendered ? showRawLabel : renderMarkdownLabel}
            </button>
          ) : null}
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
            {markdownPreview && markdownRendered ? (
              <div className="local-preview-pane__markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    img: ({ src = "", alt = "", ...props }) => (
                      <MarkdownImage src={src} alt={alt} baseFilePath={preview?.path} {...props} />
                    ),
                    a: ({ href = "", children, ...props }) => {
                      const resolved = resolveMarkdownUrl(href, { baseFilePath: preview?.path });
                      return (
                        <a href={resolved.url ?? href} target="_blank" rel="noreferrer" {...props}>
                          {children}
                        </a>
                      );
                    },
                    code: ({ className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || "");
                      const source = String(children).replace(/\n$/, "");

                      if (!match) {
                        return <code {...props}>{children}</code>;
                      }

                      const html = highlightCodeToHtml(source, detectCodePreviewMeta(`file.${match[1]}`).language);
                      return (
                        <pre className="local-preview-pane__text local-preview-pane__text--code local-preview-pane__markdown-code">
                          <code dangerouslySetInnerHTML={{ __html: html }} />
                        </pre>
                      );
                    }
                  }}
                >
                  {rawText}
                </ReactMarkdown>
              </div>
            ) : codePreviewMeta.isCode ? (
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
