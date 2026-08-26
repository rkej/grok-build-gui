import type { KeyboardEvent, ReactNode, RefObject } from "react";
import type { AppSnapshot, ComposerAttachment, SlashOption } from "../shared/protocol";
import { ComposerPanel, type ComposerMenu, type SlashItem } from "./composer-panel";
import { GrokMark } from "./icons";

export function NewThreadView({
  state,
  draft,
  composerRef,
  selectorRef,
  slashOpen,
  slashItems,
  slashOptions,
  slashOptionTitle,
  selectedSlashOption,
  mentionOpen,
  mentionHits,
  openMenu,
  setOpenMenu,
  efforts,
  environment,
  workspaces,
  onSelectWorkspace,
  onSelectEnvironment,
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
  mentionOpen: boolean;
  mentionHits: any[];
  openMenu: ComposerMenu;
  setOpenMenu: (v: ComposerMenu) => void;
  efforts: { id: string; value: string; label: string }[];
  environment: "local" | "worktree";
  workspaces: readonly string[];
  onSelectWorkspace: (cwd: string) => void;
  onSelectEnvironment: (environment: "local" | "worktree") => void;
  onDraftChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (mode?: "steer" | "followUp") => void;
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
  if (!state.cwd) {
    return (
      <section className="canvas canvas--empty">
        <div className="empty-panel">
          <div className="session-header__eyebrow">New thread</div>
          <h1>Open a folder to begin</h1>
          <p>Select a repository from the sidebar first, then start a local or worktree-backed thread.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="canvas canvas--new-thread">
      <div className="new-thread">
        <div className="new-thread__hero">
          <div className="new-thread__logo" data-testid="new-thread-logo">
            <GrokMark />
          </div>
          <div className="new-thread__eyebrow">New thread</div>
          <h1 className="new-thread__title">Let&apos;s build</h1>
          <label className="new-thread__workspace-picker">
            <span className="sr-only">Workspace</span>
            <select
              className="new-thread__workspace"
              value={state.cwd}
              onChange={(event) => onSelectWorkspace(event.target.value)}
            >
              {workspaces.map((cwd) => (
                <option key={cwd} value={cwd}>
                  {cwd}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="new-thread__composer composer">
          <ComposerPanel
            state={state}
            draft={draft}
            composerRef={composerRef}
            selectorRef={selectorRef}
            slashOpen={slashOpen}
            slashItems={slashItems}
            slashOptions={slashOptions}
            slashOptionTitle={slashOptionTitle}
            selectedSlashOption={selectedSlashOption}
            mentionOpen={mentionOpen}
            mentionHits={mentionHits}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            efforts={efforts}
            placeholder="Ask Grok anything, use / for commands and skills"
            extraHint={(
              <div className="new-thread__environment-group">
                <EnvironmentButton active={environment === "local"} onClick={() => onSelectEnvironment("local")}>
                  Local
                </EnvironmentButton>
                <EnvironmentButton active={environment === "worktree"} onClick={() => onSelectEnvironment("worktree")}>
                  Worktree
                </EnvironmentButton>
              </div>
            )}
            onDraftChange={onDraftChange}
            onKeyDown={onKeyDown}
            onSubmit={onSubmit}
            onCancel={onCancel}
            onPickSlash={onPickSlash}
            onPickSlashOption={onPickSlashOption}
            onPickMention={onPickMention}
            attachments={attachments}
            onPickAttachments={onPickAttachments}
            onRemoveAttachment={onRemoveAttachment}
            editingQueuedMessageId={editingQueuedMessageId}
            onEditQueuedMessage={onEditQueuedMessage}
            onCancelQueuedEdit={onCancelQueuedEdit}
            onRemoveQueuedMessage={onRemoveQueuedMessage}
            onSteerQueuedMessage={onSteerQueuedMessage}
          />
        </div>
      </div>
    </section>
  );
}

function EnvironmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`new-thread__environment ${active ? "new-thread__environment--active" : ""}`}
      type="button"
      onClick={onClick}
    >
      <span>{children}</span>
    </button>
  );
}
