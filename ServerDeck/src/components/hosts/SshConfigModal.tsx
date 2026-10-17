import { X } from "lucide-react";
import type { SshConfigEntry, SshConfigPreview } from "../../lib/api";

type SshConfigModalLabels = {
  eyebrow: string;
  title: string;
  description: string;
  fileLabel: string;
  missingFile: string;
  empty: string;
  selectAll: string;
  clearAll: string;
  importLabel: string;
  importingLabel: string;
  cancelLabel: string;
  stateNew: string;
  stateUpdated: string;
  stateUnchanged: string;
  viaJump: string;
  noSelection: string;
};

type SshConfigModalProps = {
  open: boolean;
  preview: SshConfigPreview | null;
  selectedAliases: string[];
  busy: boolean;
  labels: SshConfigModalLabels;
  onClose: () => void;
  onToggleAlias: (alias: string) => void;
  onToggleAll: (selectAll: boolean) => void;
  onImport: () => void;
};

// author: BrianXiong
// time: 2026/10/18/00:35:00
function stateLabel(entry: SshConfigEntry, labels: SshConfigModalLabels) {
  if (entry.state === "new") {
    return labels.stateNew;
  }
  if (entry.state === "updated") {
    return labels.stateUpdated;
  }
  return labels.stateUnchanged;
}

export function SshConfigModal({
  open,
  preview,
  selectedAliases,
  busy,
  labels,
  onClose,
  onToggleAlias,
  onToggleAll,
  onImport
}: SshConfigModalProps) {
  if (!open) {
    return null;
  }

  const entries = preview?.entries ?? [];
  const selectableAliases = entries.filter((entry) => entry.state !== "unchanged").map((entry) => entry.alias);
  const allSelected = selectableAliases.length > 0 && selectableAliases.every((alias) => selectedAliases.includes(alias));

  return (
    <div className="update-modal-backdrop" onMouseDown={onClose}>
      <section className="update-modal update-modal--project" onMouseDown={(event) => event.stopPropagation()}>
        <div className="update-modal__header">
          <div>
            <div className="drawer-eyebrow">{labels.eyebrow}</div>
            <h3>{labels.title}</h3>
            <span>{labels.description}</span>
          </div>

          <button type="button" className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="ssh-config-body">
          <div className="ssh-config-file">
            <span>{labels.fileLabel}</span>
            <code>{preview?.configPath || "~/.ssh/config"}</code>
          </div>

          {preview && !preview.exists ? <div className="ssh-config-hint">{labels.missingFile}</div> : null}

          {preview?.exists && entries.length === 0 ? <div className="ssh-config-hint">{labels.empty}</div> : null}

          {entries.length > 0 ? (
            <>
              <div className="ssh-config-toolbar">
                <button
                  type="button"
                  className="secondary-button secondary-button--compact"
                  onClick={() => onToggleAll(!allSelected)}
                >
                  {allSelected ? labels.clearAll : labels.selectAll}
                </button>
                {selectedAliases.length === 0 ? <span className="ssh-config-hint">{labels.noSelection}</span> : null}
              </div>

              <div className="ssh-config-list">
                {entries.map((entry) => {
                  const disabled = entry.state === "unchanged";
                  const checked = selectedAliases.includes(entry.alias);

                  return (
                    <label
                      key={entry.alias}
                      className={`ssh-config-row ${disabled ? "ssh-config-row--muted" : ""}`.trim()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled || busy}
                        onChange={() => onToggleAlias(entry.alias)}
                      />
                      <span className={`ssh-config-state ssh-config-state--${entry.state}`}>{stateLabel(entry, labels)}</span>
                      <span className="ssh-config-alias">{entry.alias}</span>
                      <span className="ssh-config-meta">
                        {entry.user}@{entry.hostName}:{entry.port}
                        {entry.proxyJump ? ` · ${labels.viaJump} ${entry.proxyJump}` : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        <div className="project-form__actions project-form__actions--modal">
          <button type="button" className="secondary-button" onClick={onClose}>
            {labels.cancelLabel}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={busy || selectedAliases.length === 0}
            onClick={onImport}
          >
            {busy ? labels.importingLabel : labels.importLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
