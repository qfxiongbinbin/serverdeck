import { FolderOpen, X } from "lucide-react";

type ProjectDraft = {
  id: string;
  name: string;
  namespace: string;
  path: string;
  projectType: "local" | "server" | "hybrid";
};

type ProjectEditorModalProps = {
  open: boolean;
  mode: "new" | "edit";
  draft: ProjectDraft;
  projectsLabel: string;
  projectsDescription: string;
  editProjectLabel: string;
  newProjectLabel: string;
  projectNameLabel: string;
  projectNameDescription: string;
  projectNamespaceLabel: string;
  projectNamespaceDescription: string;
  projectTypeLabel: string;
  projectTypeDescription: string;
  localProjectLabel: string;
  serverProjectLabel: string;
  hybridProjectLabel: string;
  projectPathLabel: string;
  projectPathDescription: string;
  chooseDirectoryLabel: string;
  cancelLabel: string;
  saveProjectLabel: string;
  onClose: () => void;
  onSave: () => void;
  onPickPath: () => void;
  onDraftChange: (draft: ProjectDraft) => void;
};

// author: BrianXiong
// time: 2026/04/05/21:04:18
export function ProjectEditorModal({
  open,
  mode,
  draft,
  projectsLabel,
  projectsDescription,
  editProjectLabel,
  newProjectLabel,
  projectNameLabel,
  projectNameDescription,
  projectNamespaceLabel,
  projectNamespaceDescription,
  projectTypeLabel,
  projectTypeDescription,
  localProjectLabel,
  serverProjectLabel,
  hybridProjectLabel,
  projectPathLabel,
  projectPathDescription,
  chooseDirectoryLabel,
  cancelLabel,
  saveProjectLabel,
  onClose,
  onSave,
  onPickPath,
  onDraftChange
}: ProjectEditorModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="update-modal-backdrop" onMouseDown={onClose}>
      <section className="update-modal update-modal--project" onMouseDown={(event) => event.stopPropagation()}>
        <div className="update-modal__header">
          <div>
            <div className="drawer-eyebrow">{projectsLabel}</div>
            <h3>{mode === "edit" ? editProjectLabel : newProjectLabel}</h3>
            <span>{projectsDescription}</span>
          </div>

          <button type="button" className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="project-form project-form--modal">
          <label>
            <span>{projectNameLabel}</span>
            <small>{projectNameDescription}</small>
            <input
              value={draft.name}
              onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
            />
          </label>

          <label>
            <span>{projectNamespaceLabel}</span>
            <small>{projectNamespaceDescription}</small>
            <input
              value={draft.namespace}
              onChange={(event) => onDraftChange({ ...draft, namespace: event.target.value })}
            />
          </label>

          <label>
            <span>{projectTypeLabel}</span>
            <small>{projectTypeDescription}</small>
            <select
              value={draft.projectType}
              onChange={(event) => onDraftChange({ ...draft, projectType: event.target.value as ProjectDraft["projectType"] })}
            >
              <option value="local">{localProjectLabel}</option>
              <option value="server">{serverProjectLabel}</option>
              <option value="hybrid">{hybridProjectLabel}</option>
            </select>
          </label>

          <label>
            <span>{projectPathLabel}</span>
            <small>{projectPathDescription}</small>
            <div className="project-path-field">
              <input
                value={draft.path}
                onChange={(event) => onDraftChange({ ...draft, path: event.target.value })}
              />
              <button type="button" className="secondary-button secondary-button--compact" onClick={onPickPath}>
                <FolderOpen size={14} />
                {chooseDirectoryLabel}
              </button>
            </div>
          </label>
        </div>

        <div className="project-form__actions project-form__actions--modal">
          <button type="button" className="secondary-button" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className="primary-button" onClick={onSave}>
            {saveProjectLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
