import { X } from "lucide-react";
import type { AiProviderConfig } from "../../lib/api";

type AiProviderEditorModalProps = {
  open: boolean;
  mode: "new" | "edit";
  draft: AiProviderConfig;
  aiLabel: string;
  aiDescription: string;
  newAiProviderLabel: string;
  editAiProviderLabel: string;
  aiProviderNameLabel: string;
  aiProviderNameDescription: string;
  aiProviderTypeLabel: string;
  aiProviderTypeDescription: string;
  aiProviderBaseUrlLabel: string;
  aiProviderBaseUrlDescription: string;
  aiProviderApiKeyLabel: string;
  aiProviderApiKeyDescription: string;
  aiProviderModelLabel: string;
  aiProviderModelDescription: string;
  fetchModelsLabel: string;
  enabledModelsLabel: string;
  enabledModelsDescription: string;
  noModelsFetchedLabel: string;
  fetchModelsError: string;
  fetchModelsLoading: boolean;
  aiProviderEnabledLabel: string;
  aiProviderEnabledDescription: string;
  openaiCompatibleLabel: string;
  anthropicLabel: string;
  geminiLabel: string;
  openrouterLabel: string;
  azureOpenaiLabel: string;
  cancelLabel: string;
  saveLabel: string;
  onClose: () => void;
  onSave: () => void;
  onFetchModels: () => void;
  onDraftChange: (draft: AiProviderConfig) => void;
};

// author: BrianXiong
// time: 2026/04/06/12:08:30
export function AiProviderEditorModal({
  open,
  mode,
  draft,
  aiLabel,
  aiDescription,
  newAiProviderLabel,
  editAiProviderLabel,
  aiProviderNameLabel,
  aiProviderNameDescription,
  aiProviderTypeLabel,
  aiProviderTypeDescription,
  aiProviderBaseUrlLabel,
  aiProviderBaseUrlDescription,
  aiProviderApiKeyLabel,
  aiProviderApiKeyDescription,
  aiProviderModelLabel,
  aiProviderModelDescription,
  fetchModelsLabel,
  enabledModelsLabel,
  enabledModelsDescription,
  noModelsFetchedLabel,
  fetchModelsError,
  fetchModelsLoading,
  aiProviderEnabledLabel,
  aiProviderEnabledDescription,
  openaiCompatibleLabel,
  anthropicLabel,
  geminiLabel,
  openrouterLabel,
  azureOpenaiLabel,
  cancelLabel,
  saveLabel,
  onClose,
  onSave,
  onFetchModels,
  onDraftChange
}: AiProviderEditorModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="update-modal-backdrop" onMouseDown={onClose}>
      <section className="update-modal update-modal--project" onMouseDown={(event) => event.stopPropagation()}>
        <div className="update-modal__header">
          <div>
            <div className="drawer-eyebrow">{aiLabel}</div>
            <h3>{mode === "edit" ? editAiProviderLabel : newAiProviderLabel}</h3>
            <span>{aiDescription}</span>
          </div>

          <button type="button" className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="project-form project-form--modal">
          <label>
            <span>{aiProviderNameLabel}</span>
            <small>{aiProviderNameDescription}</small>
            <input value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} />
          </label>

          <label>
            <span>{aiProviderTypeLabel}</span>
            <small>{aiProviderTypeDescription}</small>
            <select value={draft.providerType} onChange={(event) => onDraftChange({ ...draft, providerType: event.target.value as AiProviderConfig["providerType"] })}>
              <option value="custom-openai">{openaiCompatibleLabel}</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">{anthropicLabel}</option>
              <option value="gemini">{geminiLabel}</option>
              <option value="openrouter">{openrouterLabel}</option>
              <option value="azure-openai">{azureOpenaiLabel}</option>
            </select>
          </label>

          <label>
            <span>{aiProviderBaseUrlLabel}</span>
            <small>{aiProviderBaseUrlDescription}</small>
            <input value={draft.baseUrl} onChange={(event) => onDraftChange({ ...draft, baseUrl: event.target.value })} />
          </label>

          <label>
            <span>{aiProviderApiKeyLabel}</span>
            <small>{aiProviderApiKeyDescription}</small>
            <input type="password" value={draft.apiKey} onChange={(event) => onDraftChange({ ...draft, apiKey: event.target.value })} />
          </label>

          <label>
            <span>{aiProviderModelLabel}</span>
            <small>{aiProviderModelDescription}</small>
            <div className="project-path-field">
              <input value={draft.model} onChange={(event) => onDraftChange({ ...draft, model: event.target.value })} />
              <button type="button" className="secondary-button secondary-button--compact" onClick={onFetchModels}>
                {fetchModelsLoading ? `${fetchModelsLabel}...` : fetchModelsLabel}
              </button>
            </div>
          </label>

          <div className="project-toggle-field">
            <span>{enabledModelsLabel}</span>
            <small>{enabledModelsDescription}</small>
            <div className="ai-model-list">
              {draft.availableModels.length ? (
                draft.availableModels.map((model) => (
                  <div key={model} className="ai-model-list__item">
                    <div className="ai-model-list__item-body">
                      <strong>{model}</strong>
                      {draft.model === model ? <span>{aiProviderModelLabel}</span> : null}
                    </div>
                    <label className="preview-switch preview-switch--inline">
                      <input
                        type="checkbox"
                        checked={draft.enabledModels.includes(model)}
                        onChange={(event) => {
                          const enabledModels = event.target.checked
                            ? [...draft.enabledModels, model]
                            : draft.enabledModels.filter((item) => item !== model);
                          onDraftChange({
                            ...draft,
                            enabledModels,
                            model: enabledModels.includes(draft.model) ? draft.model : enabledModels[0] ?? draft.model
                          });
                        }}
                      />
                      <span className="preview-switch__track">
                        <span className="preview-switch__thumb" />
                      </span>
                    </label>
                  </div>
                ))
              ) : (
                <div className="topbar-popover__empty">{fetchModelsError || noModelsFetchedLabel}</div>
              )}
            </div>
          </div>

          <label className="project-toggle-field">
            <span>{aiProviderEnabledLabel}</span>
            <small>{aiProviderEnabledDescription}</small>
            <label className="preview-switch preview-switch--inline">
              <input type="checkbox" checked={draft.enabled} onChange={(event) => onDraftChange({ ...draft, enabled: event.target.checked })} />
              <span className="preview-switch__track">
                <span className="preview-switch__thumb" />
              </span>
            </label>
          </label>
        </div>

        <div className="project-form__actions project-form__actions--modal">
          <button type="button" className="secondary-button" onClick={onClose}>{cancelLabel}</button>
          <button type="button" className="primary-button" onClick={onSave}>{saveLabel}</button>
        </div>
      </section>
    </div>
  );
}
