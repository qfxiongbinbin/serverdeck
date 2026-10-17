import { X } from "lucide-react";

type RemoteFileEditorLabels = {
  title: string;
  pathLabel: string;
  sizeLabel: (size: string) => string;
  unsavedHint: string;
  savedHint: string;
  save: string;
  saving: string;
  cancel: string;
};

type RemoteFileEditorModalProps = {
  open: boolean;
  path: string;
  content: string;
  originalContent: string;
  sizeLabel: string;
  busy: boolean;
  saved: boolean;
  labels: RemoteFileEditorLabels;
  onChange: (content: string) => void;
  onSave: () => void;
  onClose: () => void;
};

// author: BrianXiong
// time: 2026/10/18/02:40:00
export function RemoteFileEditorModal({
  open,
  path,
  content,
  originalContent,
  sizeLabel,
  busy,
  saved,
  labels,
  onChange,
  onSave,
  onClose
}: RemoteFileEditorModalProps) {
  if (!open) {
    return null;
  }

  const dirty = content !== originalContent;

  return (
    <div className="update-modal-backdrop" onMouseDown={onClose}>
      <section
        className="update-modal update-modal--project remote-editor"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="update-modal__header">
          <div>
            <div className="drawer-eyebrow">{labels.title}</div>
            <h3 className="remote-editor__path">{path}</h3>
            <span>
              {labels.pathLabel} · {labels.sizeLabel(sizeLabel)} ·{" "}
              {saved && !dirty ? labels.savedHint : labels.unsavedHint}
            </span>
          </div>

          <button type="button" className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="remote-editor__body">
          <textarea
            className="remote-editor__textarea"
            value={content}
            spellCheck={false}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>

        <div className="project-form__actions project-form__actions--modal">
          <button type="button" className="secondary-button" onClick={onClose}>
            {labels.cancel}
          </button>
          <button type="button" className="primary-button" disabled={busy || !dirty} onClick={onSave}>
            {busy ? labels.saving : labels.save}
          </button>
        </div>
      </section>
    </div>
  );
}
