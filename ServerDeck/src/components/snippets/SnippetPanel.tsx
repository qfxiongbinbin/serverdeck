import { useEffect, useMemo, useState } from "react";
import { Play, TerminalSquare, X } from "lucide-react";
import type { SavedHost, SnippetRecord } from "../../lib/api";

type SnippetPanelLabels = {
  title: string;
  description: string;
  newSnippet: string;
  editSnippet: string;
  name: string;
  content: string;
  contentPlaceholder: string;
  host: string;
  anyHost: string;
  dangerous: string;
  dangerousHint: string;
  variables: string;
  run: string;
  paste: string;
  pasteHint: string;
  empty: string;
  emptyDescription: string;
  cancel: string;
  save: string;
  deleteLabel: string;
  confirmDelete: string;
  confirmRun: string;
};

type SnippetPanelProps = {
  open: boolean;
  snippets: SnippetRecord[];
  hosts: SavedHost[];
  labels: SnippetPanelLabels;
  busy: boolean;
  pendingDeleteId: string;
  pendingRunId: string;
  onClose: () => void;
  onSave: (snippet: SnippetRecord) => void;
  onDelete: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onRun: (snippet: SnippetRecord, mode: "run" | "paste") => void;
};

// author: BrianXiong
// time: 2026/10/18/01:40:00
function extractVariables(content: string): string[] {
  const found = Array.from(content.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)).map((match) => match[1]);
  return Array.from(new Set(found));
}

const blankSnippet: SnippetRecord = {
  id: "",
  name: "",
  content: "",
  hostId: null,
  dangerous: false
};

export function SnippetPanel({
  open,
  snippets,
  hosts,
  labels,
  busy,
  pendingDeleteId,
  pendingRunId,
  onClose,
  onSave,
  onDelete,
  onRequestDelete,
  onRun
}: SnippetPanelProps) {
  const [draft, setDraft] = useState<SnippetRecord | null>(null);

  useEffect(() => {
    if (!open) {
      setDraft(null);
    }
  }, [open]);

  const hostNameById = useMemo(() => {
    const map = new Map<string, string>();
    hosts.forEach((host) => {
      map.set(host.id, host.label.trim() || host.address);
    });
    return map;
  }, [hosts]);

  if (!open) {
    return null;
  }

  return (
    <div className="update-modal-backdrop" onMouseDown={onClose}>
      <section className="update-modal update-modal--project snippet-panel" onMouseDown={(event) => event.stopPropagation()}>
        <div className="update-modal__header">
          <div>
            <div className="drawer-eyebrow">{labels.title}</div>
            <h3>{draft ? (draft.id ? labels.editSnippet : labels.newSnippet) : labels.title}</h3>
            <span>{labels.description}</span>
          </div>

          <button type="button" className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {draft ? (
          <div className="project-form project-form--modal">
            <label>
              <span>{labels.name}</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>

            <label>
              <span>{labels.host}</span>
              <select
                value={draft.hostId ?? ""}
                onChange={(event) => setDraft({ ...draft, hostId: event.target.value || null })}
              >
                <option value="">{labels.anyHost}</option>
                {hosts.map((host) => (
                  <option key={host.id} value={host.id}>
                    {host.label.trim() || host.address}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{labels.content}</span>
              <textarea
                className="snippet-textarea"
                rows={6}
                value={draft.content}
                placeholder={labels.contentPlaceholder}
                onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              />
            </label>

            <div className="snippet-hint">{labels.dangerousHint}</div>

            <div className="project-form__actions project-form__actions--modal">
              <button type="button" className="secondary-button" onClick={() => setDraft(null)}>
                {labels.cancel}
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={busy || !draft.name.trim() || !draft.content.trim()}
                onClick={() => {
                  onSave(draft);
                  setDraft(null);
                }}
              >
                {labels.save}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="settings-panel__toolbar snippet-toolbar">
              <button type="button" className="primary-button" onClick={() => setDraft({ ...blankSnippet })}>
                {labels.newSnippet}
              </button>
            </div>

            <div className="snippet-list">
              {snippets.length === 0 ? (
                <div className="project-empty-state">
                  <strong>{labels.empty}</strong>
                  <span>{labels.emptyDescription}</span>
                </div>
              ) : (
                snippets.map((snippet) => {
                  const variables = extractVariables(snippet.content);
                  const pendingDelete = pendingDeleteId === snippet.id;
                  const pendingRun = pendingRunId === snippet.id;

                  return (
                    <div key={snippet.id} className="snippet-row">
                      <div className="snippet-row__body">
                        <div className="snippet-row__titleline">
                          <strong>{snippet.name}</strong>
                          {snippet.dangerous ? <span className="snippet-badge snippet-badge--danger">{labels.dangerous}</span> : null}
                          {snippet.hostId ? (
                            <span className="snippet-badge">{hostNameById.get(snippet.hostId) ?? labels.anyHost}</span>
                          ) : null}
                        </div>
                        <div className="snippet-row__content">{snippet.content}</div>
                        {variables.length ? (
                          <div className="snippet-row__vars">
                            {labels.variables}
                            {variables.map((variable) => (
                              <code key={variable}>{`{{${variable}}}`}</code>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="snippet-row__actions">
                        <button
                          type="button"
                          className={snippet.dangerous ? "danger-button" : "primary-button"}
                          onClick={() => onRun(snippet, "run")}
                        >
                          <Play size={14} />
                          {pendingRun ? labels.confirmRun : labels.run}
                        </button>
                        <button
                          type="button"
                          className="row-button"
                          title={labels.pasteHint}
                          onClick={() => onRun(snippet, "paste")}
                        >
                          <TerminalSquare size={14} />
                          {labels.paste}
                        </button>
                        <button type="button" className="row-button" onClick={() => setDraft(snippet)}>
                          {labels.editSnippet}
                        </button>
                        {pendingDelete ? (
                          <button type="button" className="danger-button" onClick={() => onDelete(snippet.id)}>
                            {labels.confirmDelete}
                          </button>
                        ) : (
                          <button type="button" className="row-button" onClick={() => onRequestDelete(snippet.id)}>
                            {labels.deleteLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
