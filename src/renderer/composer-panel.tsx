import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent, type KeyboardEvent, ReactNode, RefObject } from "react";
import type { AppSnapshot, ComposerAttachment, ContextUsage, PermissionMode, SlashOption } from "../shared/protocol";
import { buildExtensionDockModel, ExtensionDialog, ExtensionDock, PermissionDialog } from "./extension-session-ui";
import {
  ArrowUpIcon,
  FileIcon,
  ModelIcon,
  PlusIcon,
  ReasoningIcon,
  SettingsIcon,
  SkillIcon,
  SparkIcon,
  StatusIcon,
  StopSquareIcon,
} from "./icons";
import { mentionCandidatePath } from "./composer-navigation";
import { slashCommandKey, type SlashItem } from "./slash-completion";

export type ComposerMenu = "none" | "model" | "effort" | "perm";
export type ComposerDeliveryMode = "steer" | "followUp";
export type { SlashItem };

export function permissionLabel(mode: PermissionMode): string {
  if (mode === "always-approve") return "always";
  if (mode === "plan") return "plan";
  if (mode === "auto") return "auto";
  return "ask";
}

export function ComposerPanel({
  state,
  draft,
  composerRef,
  selectorRef,
  slashOpen,
  slashItems,
  slashOptions,
  slashOptionTitle,
  selectedSlashOption,
  selectedSlashCommand,
  mentionOpen,
  mentionHits,
  selectedMentionIndex,
  openMenu,
  setOpenMenu,
  efforts,
  placeholder,
  extraHint,
  leading,
  onDraftChange,
  onKeyDown,
  onSubmit,
  onCancel,
  onPickSlash,
  onPickSlashOption,
  onPickMention,
  attachments,
  onPickAttachments,
  onRemoveAttachment,
  editingQueuedMessageId,
  onEditQueuedMessage,
  onCancelQueuedEdit,
  onRemoveQueuedMessage,
  onSteerQueuedMessage,
}: {
  state: AppSnapshot;
  draft: string;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  selectorRef: RefObject<HTMLSpanElement | null>;
  slashOpen: boolean;
  slashItems: SlashItem[];
  slashOptions?: SlashOption[];
  slashOptionTitle?: string;
  selectedSlashOption?: string;
  selectedSlashCommand?: string;
  mentionOpen: boolean;
  mentionHits: any[];
  selectedMentionIndex?: number;
  openMenu: ComposerMenu;
  setOpenMenu: (v: ComposerMenu) => void;
  efforts: { id: string; value: string; label: string }[];
  placeholder: string;
  extraHint?: ReactNode;
  leading?: ReactNode;
  onDraftChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (mode?: ComposerDeliveryMode) => void;
  onCancel: () => void;
  onPickSlash: (name: string) => void;
  onPickSlashOption?: (option: SlashOption) => void;
  onPickMention: (path: string) => void;
  attachments: readonly ComposerAttachment[];
  onPickAttachments: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  editingQueuedMessageId?: string | null;
  onEditQueuedMessage: (id: string) => void;
  onCancelQueuedEdit: () => void;
  onRemoveQueuedMessage: (id: string) => void;
  onSteerQueuedMessage: (id: string) => void;
}) {
  const hasInput = draft.trim().length > 0 || attachments.length > 0;
  const stop = state.running && !hasInput;
  const modelName = state.models.find((m) => m.modelId === state.currentModelId)?.name ?? state.currentModelId ?? "Choose model";
  const effortLabel = efforts.find((e) => e.value === state.effort)?.label ?? state.effort;
  const [dockOpen, setDockOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menusRef = useRef<HTMLDivElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dock = buildExtensionDockModel(state);

  useEffect(() => {
    menusRef.current?.querySelector<HTMLElement>(
      ".slash-menu__item--active, .slash-menu__option--active, .mention-menu__item--active",
    )?.scrollIntoView({ block: "nearest" });
  }, [selectedSlashCommand, selectedSlashOption, selectedMentionIndex]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    onPickAttachments(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files ?? []);
    if (files.length === 0) return;
    event.preventDefault();
    onPickAttachments(files);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.files.length === 0) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length) onPickAttachments(files);
  };

  return (
    <div className="conversation conversation--composer">
      {leading}
      {state.pendingPermission ? (
        <PermissionDialog
          request={state.pendingPermission}
          onRespond={(optionId) => void window.grokApp.approve(optionId)}
        />
      ) : null}
      {state.pendingExtensionDialog ? (
        <ExtensionDialog
          dialog={state.pendingExtensionDialog}
          onRespond={(response) => void window.grokApp.respondExtensionUi(response)}
        />
      ) : null}
      {dock ? <ExtensionDock dock={dock} expanded={dockOpen} onToggle={() => setDockOpen((open) => !open)} /> : null}

      {state.queue.length > 0 || editingQueuedMessageId ? (
        <div className="queued-composer-messages" data-testid="queued-composer-messages">
          {editingQueuedMessageId ? (
            <div className="queued-composer-messages__editing" data-testid="queued-composer-editing">
              <span>Editing queued message</span>
              <button type="button" onClick={onCancelQueuedEdit}>Cancel</button>
            </div>
          ) : null}
          {state.queue.map((entry) => (
            <div className={`queued-composer-message ${entry.id === editingQueuedMessageId ? "queued-composer-message--editing" : ""}`} key={entry.id}>
              <div className="queued-composer-message__header">
                <span className="queued-composer-message__text">{entry.text}</span>
                <div className="queued-composer-message__actions">
                  {entry.mode !== "steer" ? (
                    <button type="button" disabled={entry.source === "remote"} title={entry.source === "remote" ? "Managed by the Grok CLI" : undefined} onClick={() => onSteerQueuedMessage(entry.id)}>Steer</button>
                  ) : null}
                  <button type="button" disabled={entry.source === "remote"} title={entry.source === "remote" ? "Managed by the Grok CLI" : undefined} onClick={() => onEditQueuedMessage(entry.id)}>Edit</button>
                  <button type="button" disabled={entry.source === "remote"} title={entry.source === "remote" ? "Managed by the Grok CLI" : undefined} onClick={() => onRemoveQueuedMessage(entry.id)} aria-label={`Delete queued message ${entry.text || entry.id}`}>Delete</button>
                </div>
              </div>
              {entry.attachments && entry.attachments.length > 0 ? (
                <div className="queued-composer-message__attachments">
                  {entry.attachments.map((attachment, index) => (
                    <div className={`queued-composer-attachment queued-composer-attachment--${attachment.kind}`} key={`${entry.id}:${attachment.name}:${index}`}>
                      {attachment.kind === "image" && attachment.data ? (
                        <img className="queued-composer-attachment__preview" src={`data:${attachment.mimeType};base64,${attachment.data}`} alt={attachment.name} />
                      ) : <span className="queued-composer-attachment__icon"><FileIcon /></span>}
                      <span className="queued-composer-attachment__name">{attachment.name}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div
        className={`composer__surface ${dragActive ? "composer__surface--drag-active" : ""}`}
        data-testid="composer-surface"
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
      >
        {dragActive ? <div className="composer__drop-indicator">Drop images or files to attach</div> : null}
        {(slashOpen || mentionOpen || (slashOptions && slashOptions.length > 0)) ? (
          <div className="composer__menus" ref={menusRef}>
            {slashOptions && slashOptions.length > 0 ? (
              <div className="slash-menu slash-menu--options" data-testid="slash-options-menu">
                <div className="slash-menu__search">{slashOptionTitle ?? "Choose"}</div>
                {slashOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`slash-menu__option ${selectedSlashOption === option.value ? "slash-menu__option--active" : ""}`}
                    type="button"
                    onClick={() => onPickSlashOption?.(option)}
                  >
                    <span className="slash-menu__option-title">{option.label}</span>
                    <span className="slash-menu__option-description">{option.description}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {slashOpen ? (
              <div className="slash-menu" data-testid="slash-menu">
                {runtimeItems.length > 0 ? (
                  <div className="slash-menu__section">
                    <div className="slash-menu__section-title slash-menu__section-title--runtime">
                      <span className="slash-menu__section-icon"><SparkIcon /></span>
                      <span>Skills & commands</span>
                    </div>
                    {runtimeItems.slice(0, 8).map((command) => (
                      <button
                        key={`runtime:${command.name}`}
                        className={`slash-menu__item slash-menu__item--skill ${selectedSlashCommand === slashCommandKey(command) ? "slash-menu__item--active" : ""}`}
                        type="button"
                        onClick={() => onPickSlash(command.name)}
                      >
                        <span className="slash-menu__icon"><SkillIcon /></span>
                        <span className="slash-menu__content slash-menu__content--skill">
                          <span className="slash-menu__line">
                            <span className="slash-menu__title">{command.title}</span>
                            <span className="slash-menu__skill-badge">skill</span>
                          </span>
                          <span className="slash-menu__description">{command.description}</span>
                          <span className="slash-menu__command slash-menu__command--skill">/{command.name}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="slash-menu__section">
                  <div className="slash-menu__section-title slash-menu__section-title--host">
                    <span className="slash-menu__section-icon"><SettingsIcon /></span>
                    <span>App commands</span>
                  </div>
                  {hostItems.map((command) => (
                    <button key={command.name} className={`slash-menu__item ${selectedSlashCommand === slashCommandKey(command) ? "slash-menu__item--active" : ""}`} type="button" onClick={() => onPickSlash(command.name)}>
                      <span className="slash-menu__icon">{slashIcon(command.name)}</span>
                      <span className="slash-menu__content">
                        <span className="slash-menu__line">
                          <span className="slash-menu__title">{command.title}</span>
                          <span className="slash-menu__command">/{command.name}</span>
                        </span>
                        <span className="slash-menu__description">{command.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {mentionOpen ? (
              <div className="mention-menu" data-testid="mention-menu">
                <div className="mention-menu__section">
                  <div className="mention-menu__section-title">Files</div>
                  {mentionHits.length === 0 ? (
                    <div className="slash-menu__empty">
                      <div className="slash-menu__empty-title">No matches</div>
                      <div className="slash-menu__empty-description">Type more of the path to search the workspace.</div>
                    </div>
                  ) : (
                    mentionHits.slice(0, 12).map((node, index) => {
                      const path = mentionCandidatePath(node);
                      return (
                        <button key={`${path}-${index}`} className={`mention-menu__item ${selectedMentionIndex === index ? "mention-menu__item--active" : ""}`} type="button" onClick={() => onPickMention(path)}>
                          <span className="mention-menu__icon"><FileIcon /></span>
                          <span className="mention-menu__content">
                            <span className="mention-menu__file">
                              <span className="mention-menu__filename">{path.split("/").pop()}</span>
                              <span className="mention-menu__dirname">{path}</span>
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <textarea
          ref={composerRef}
          className="composer__textarea"
          aria-label="Composer"
          data-testid="composer"
          rows={1}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />

        {attachments.length > 0 ? (
          <div className="composer__attachments" data-testid="composer-attachments">
            {attachments.map((attachment) => (
              <div className={`composer-attachment composer-attachment--${attachment.kind}`} key={attachment.id}>
                {attachment.kind === "image" && attachment.data ? (
                  <img className="composer-attachment__preview" src={`data:${attachment.mimeType};base64,${attachment.data}`} alt={attachment.name} />
                ) : <span className="composer-attachment__icon"><FileIcon /></span>}
                <span className="composer-attachment__name">{attachment.name}</span>
                <button type="button" className="composer-attachment__remove" aria-label={`Remove ${attachment.name}`} onClick={() => onRemoveAttachment(attachment.id)}>×</button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="composer__footer">
          <div className="composer__footer-row">
            <div className={`composer__hint ${extraHint ? "new-thread__hint" : ""}`}>
              <UsageMeter usage={state.usage} />
              {extraHint}
              {extraHint ? <span className="new-thread__hint-separator">·</span> : (
                <>
                  {state.running ? "Working · Enter to queue · Cmd+Enter to steer" : "Enter to send · Shift+Enter for newline"}
                  {" · "}
                </>
              )}
              <span className="model-selector" ref={selectorRef}>
                <SelectorMenu
                  open={openMenu === "model"}
                  label={modelName || "Choose model"}
                  title="Model"
                  onToggle={() => setOpenMenu(openMenu === "model" ? "none" : "model")}
                >
                  {state.models.map((model) => (
                    <button
                      key={model.modelId}
                      className={`model-selector__item${model.modelId === state.currentModelId ? " model-selector__item--active" : ""}`}
                      type="button"
                      onClick={() => {
                        void window.grokApp.setModel(model.modelId);
                        setOpenMenu("none");
                      }}
                    >
                      <span className="model-selector__item-label">{model.name}</span>
                      {model.modelId === state.currentModelId ? <span className="model-selector__item-meta">active</span> : null}
                    </button>
                  ))}
                </SelectorMenu>
                <SelectorMenu
                  open={openMenu === "effort"}
                  label={effortLabel}
                  title="Thinking Level"
                  onToggle={() => setOpenMenu(openMenu === "effort" ? "none" : "effort")}
                >
                  {efforts.map((effort) => (
                    <button
                      key={effort.id}
                      className={`model-selector__item${effort.value === state.effort ? " model-selector__item--active" : ""}`}
                      type="button"
                      onClick={() => {
                        void window.grokApp.setEffort(effort.value);
                        setOpenMenu("none");
                      }}
                    >
                      <span className="model-selector__item-label">{effort.label}</span>
                    </button>
                  ))}
                </SelectorMenu>
                <SelectorMenu
                  open={openMenu === "perm"}
                  label={permissionLabel(state.permissionMode)}
                  title="Permission"
                  onToggle={() => setOpenMenu(openMenu === "perm" ? "none" : "perm")}
                >
                  {([
                    ["ask", "ask"],
                    ["plan", "plan"],
                    ["auto", "auto"],
                    ["always-approve", "always"],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      className={`model-selector__item${state.permissionMode === id ? " model-selector__item--active" : ""}`}
                      type="button"
                      onClick={() => {
                        void window.grokApp.setMode(id);
                        setOpenMenu("none");
                      }}
                    >
                      <span className="model-selector__item-label">{label}</span>
                      {state.permissionMode === id ? <span className="model-selector__item-meta">active</span> : null}
                    </button>
                  ))}
                </SelectorMenu>
              </span>
            </div>
            <div className="composer__actions">
              <button aria-label="Attach files" className="icon-button composer__attach" type="button" onClick={() => fileInputRef.current?.click()}>
                <PlusIcon />
              </button>
              <input ref={fileInputRef} className="sr-only" type="file" multiple onChange={onFileChange} />
              <button
                aria-label={stop ? "Stop run" : "Send message"}
                className="button button--primary button--cta-icon"
                data-testid="send"
                type="button"
                disabled={!stop && !hasInput}
                onClick={stop ? onCancel : () => onSubmit()}
              >
                {stop ? <StopSquareIcon /> : <ArrowUpIcon />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectorMenu({
  open,
  label,
  title,
  onToggle,
  children,
}: {
  open: boolean;
  label: string;
  title: string;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <span className="model-selector__anchor">
      <button className="model-selector__badge" type="button" onClick={onToggle}>
        {label}
      </button>
      {open ? (
        <div className="model-selector__dropdown">
          <div className="model-selector__group-title">{title}</div>
          {children}
        </div>
      ) : null}
    </span>
  );
}

function UsageMeter({ usage }: { readonly usage: ContextUsage | null }) {
  if (!usage || !usage.total) return null;
  const pct = Math.max(0, Math.min(100, usage.usagePct || Math.round((usage.used / usage.total) * 100)));
  return (
    <span className="usage-meter" title={`${usage.used.toLocaleString()} / ${usage.total.toLocaleString()} thread context tokens`}>
      <span className="usage-meter__bar">
        <span className="usage-meter__fill" style={{ width: `${pct}%` }} />
      </span>
      <span>{pct}%</span>
    </span>
  );
}

function slashIcon(name: string) {
  if (name === "model") return <ModelIcon />;
  if (name === "effort") return <ReasoningIcon />;
  if (name === "plan" || name === "auto" || name === "always-approve") return <StatusIcon />;
  if (name === "skills") return <SkillIcon />;
  return <SparkIcon />;
}
