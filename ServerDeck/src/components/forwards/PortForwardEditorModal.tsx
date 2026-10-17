import { X } from "lucide-react";
import type { PortForward, SavedHost } from "../../lib/api";

type PortForwardEditorLabels = {
  eyebrow: string;
  newTitle: string;
  editTitle: string;
  description: string;
  label: string;
  kind: string;
  kindLocal: string;
  kindRemote: string;
  kindDynamic: string;
  host: string;
  bindHost: string;
  bindPort: string;
  targetHost: string;
  targetPort: string;
  autoStart: string;
  autoStartDescription: string;
  cancel: string;
  save: string;
};

type PortForwardEditorModalProps = {
  open: boolean;
  mode: "new" | "edit";
  draft: PortForward;
  hosts: SavedHost[];
  labels: PortForwardEditorLabels;
  onClose: () => void;
  onSave: () => void;
  onDraftChange: (draft: PortForward) => void;
};

// author: BrianXiong
// time: 2026/10/18/00:10:00
export function PortForwardEditorModal({
  open,
  mode,
  draft,
  hosts,
  labels,
  onClose,
  onSave,
  onDraftChange
}: PortForwardEditorModalProps) {
  if (!open) {
    return null;
  }

  const isDynamic = draft.kind === "dynamic";

  return (
    <div className="update-modal-backdrop" onMouseDown={onClose}>
      <section className="update-modal update-modal--project" onMouseDown={(event) => event.stopPropagation()}>
        <div className="update-modal__header">
          <div>
            <div className="drawer-eyebrow">{labels.eyebrow}</div>
            <h3>{mode === "edit" ? labels.editTitle : labels.newTitle}</h3>
            <span>{labels.description}</span>
          </div>

          <button type="button" className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="project-form project-form--modal">
          <label>
            <span>{labels.label}</span>
            <input
              value={draft.label}
              onChange={(event) => onDraftChange({ ...draft, label: event.target.value })}
            />
          </label>

          <label>
            <span>{labels.host}</span>
            <select
              value={draft.hostId}
              onChange={(event) => onDraftChange({ ...draft, hostId: event.target.value })}
            >
              <option value="">—</option>
              {hosts.map((host) => (
                <option key={host.id} value={host.id}>
                  {host.label.trim() || host.address} ({host.address})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{labels.kind}</span>
            <select
              value={draft.kind}
              onChange={(event) => onDraftChange({ ...draft, kind: event.target.value as PortForward["kind"] })}
            >
              <option value="local">{labels.kindLocal}</option>
              <option value="remote">{labels.kindRemote}</option>
              <option value="dynamic">{labels.kindDynamic}</option>
            </select>
          </label>

          <label>
            <span>{labels.bindHost}</span>
            <input
              value={draft.bindHost}
              placeholder="127.0.0.1"
              onChange={(event) => onDraftChange({ ...draft, bindHost: event.target.value })}
            />
          </label>

          <label>
            <span>{labels.bindPort}</span>
            <input
              value={draft.bindPort || ""}
              onChange={(event) => onDraftChange({ ...draft, bindPort: Number(event.target.value || "0") })}
            />
          </label>

          {isDynamic ? null : (
            <>
              <label>
                <span>{labels.targetHost}</span>
                <input
                  value={draft.targetHost}
                  placeholder="127.0.0.1"
                  onChange={(event) => onDraftChange({ ...draft, targetHost: event.target.value })}
                />
              </label>

              <label>
                <span>{labels.targetPort}</span>
                <input
                  value={draft.targetPort || ""}
                  onChange={(event) => onDraftChange({ ...draft, targetPort: Number(event.target.value || "0") })}
                />
              </label>
            </>
          )}

          <label>
            <span>{labels.autoStart}</span>
            <small>{labels.autoStartDescription}</small>
            <input
              type="checkbox"
              className="project-toggle-field"
              checked={draft.autoStart}
              onChange={(event) => onDraftChange({ ...draft, autoStart: event.target.checked })}
            />
          </label>
        </div>

        <div className="project-form__actions project-form__actions--modal">
          <button type="button" className="secondary-button" onClick={onClose}>
            {labels.cancel}
          </button>
          <button type="button" className="primary-button" onClick={onSave}>
            {labels.save}
          </button>
        </div>
      </section>
    </div>
  );
}
