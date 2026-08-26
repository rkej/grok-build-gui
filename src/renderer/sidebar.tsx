import { useState, type DragEvent, type MouseEvent } from "react";
import type {
  AccountUsage,
  AppView,
  AuthState,
  SessionSummary,
} from "../shared/protocol";
import {
  ArchiveIcon,
  ChevronDownIcon,
  ExtensionIcon,
  FolderIcon,
  PinIcon,
  PlusIcon,
  RestoreIcon,
  SettingsIcon,
  SkillIcon,
  WorktreeIcon,
} from "./icons";
import type { WorkspaceGroup } from "./workspace-groups";

export type { WorkspaceGroup };

export function cwdName(cwd: string): string {
  const parts = cwd.split("/")?.filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}

export function workspaceDisplayName(cwd: string, names?: Record<string, string>): string {
  const custom = names?.[cwd]?.trim();
  return custom || cwdName(cwd);
}

export function relTime(iso?: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function indicator(s: SessionSummary): "running" | "failed" | "unseen" | "none" {
  if (s.activity === "working") return "running";
  if (s.activity === "failed") return "failed";
  if (s.unseen || s.activity === "needs-input" || s.activity === "blocked") return "unseen";
  return "none";
}

export function Sidebar({
  view,
  cwd,
  groups,
  accountUsage,
  auth,
  pinnedAll,
  activeSessionId,
  archivedOpen,
  collapsedWorkspaces,
  workspaceMenu,
  threadMenu,
  renamingId,
  renamingWorkspace,
  workspaceNames = {},
  permanentWorktrees = {},
  onNewThread,
  onSetView,
  onPickFolder,
  onSelectWorkspace,
  onToggleWorkspace,
  onToggleWorkspaceMenu,
  onOpenFolder,
  onCreateWorktree,
  onRemoveWorktree,
  onRemoveWorkspace,
  onStartWorkspaceRename,
  onCommitWorkspaceRename,
  onCancelWorkspaceRename,
  onSelectSession,
  onToggleThreadMenu,
  onToggleArchived,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onMarkRead,
  onCopySessionId,
  onReorderWorkspaces,
  onReorderPinned,
}: {
  readonly view: AppView;
  readonly cwd: string;
  readonly groups: readonly WorkspaceGroup[];
  readonly accountUsage: AccountUsage;
  readonly auth: AuthState;
  readonly pinnedAll: readonly SessionSummary[];
  readonly activeSessionId: string | null;
  readonly archivedOpen: Record<string, boolean>;
  readonly collapsedWorkspaces: Record<string, boolean>;
  readonly workspaceMenu: string | null;
  readonly threadMenu: string | null;
  readonly renamingId: string | null;
  readonly renamingWorkspace: string | null;
  readonly workspaceNames: Record<string, string>;
  readonly permanentWorktrees: Record<string, string>;
  readonly onNewThread: () => void;
  readonly onSetView: (view: AppView) => void;
  readonly onPickFolder: () => void;
  readonly onSelectWorkspace: (cwd: string) => void;
  readonly onToggleWorkspace: (cwd: string) => void;
  readonly onToggleWorkspaceMenu: (cwd: string) => void;
  readonly onOpenFolder: (cwd: string) => void;
  readonly onCreateWorktree: (cwd: string) => void;
  readonly onRemoveWorktree: (cwd: string) => void;
  readonly onRemoveWorkspace: (cwd: string) => void;
  readonly onStartWorkspaceRename: (cwd: string) => void;
  readonly onCommitWorkspaceRename: (cwd: string, name: string) => void;
  readonly onCancelWorkspaceRename: () => void;
  readonly onSelectSession: (session: SessionSummary) => void;
  readonly onToggleThreadMenu: (sessionId: string) => void;
  readonly onToggleArchived: (cwd: string) => void;
  readonly onStartRename: (sessionId: string) => void;
  readonly onCommitRename: (sessionId: string, title: string) => void;
  readonly onCancelRename: () => void;
  readonly onMarkRead: (sessionId: string) => void;
  readonly onCopySessionId: (sessionId: string) => void;
  readonly onReorderWorkspaces?: (order: string[]) => void;
  readonly onReorderPinned?: (order: string[]) => void;
}) {
  const canCreateThread = groups.length > 0;
  const [dragId, setDragId] = useState<string | null>(null);
  const move = (list: string[], from: string, to: string) => {
    const next = list.filter((id) => id !== from);
    const index = next.indexOf(to);
    if (index === -1) return list;
    next.splice(index, 0, from);
    return next;
  };
  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <button
          className="sidebar__new"
          type="button"
          disabled={!canCreateThread}
          title={canCreateThread ? undefined : "Open a folder first"}
          onClick={onNewThread}
        >
          <PlusIcon />
          <span>New thread</span>
        </button>
        <nav className="sidebar__nav">
          <button
            className={`sidebar__nav-item ${view === "threads" || view === "new-thread" ? "sidebar__nav-item--active" : ""}`}
            type="button"
            onClick={() =>
              onSetView(activeSessionId ? "threads" : "new-thread")
            }
          >
            <FolderIcon />
            <span>Threads</span>
          </button>
          <button
            className={`sidebar__nav-item ${view === "skills" ? "sidebar__nav-item--active" : ""}`}
            type="button"
            onClick={() => onSetView("skills")}
          >
            <SkillIcon />
            <span>Skills</span>
          </button>
          <button
            className={`sidebar__nav-item ${view === "mcp" ? "sidebar__nav-item--active" : ""}`}
            type="button"
            onClick={() => onSetView("mcp")}
          >
            <ExtensionIcon />
            <span>Extensions</span>
          </button>
          <button
            className={`sidebar__nav-item ${view === "settings" ? "sidebar__nav-item--active" : ""}`}
            type="button"
            onClick={() => onSetView("settings")}
          >
            <SettingsIcon />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      <div className="sidebar__section">
        <div className="section__head">
          <span>Threads</span>
          <div className="section__tools">
            <div className="shortcut-tooltip-wrap">
              <button
                aria-label="Open folder"
                className="icon-button"
                type="button"
                onClick={onPickFolder}
              >
                <FolderIcon />
              </button>
              <span className="shortcut-tooltip" role="tooltip">
                <span>Open folder</span>
              </span>
            </div>
          </div>
        </div>

        <div className="sidebar__section-body">
          {groups.length === 0 ? (
          <div className="empty-state" data-testid="empty-state">
            <h2>No folders yet</h2>
            <p>
              Open a project folder to start building a workspace and session
              list.
            </p>
            <button
              className="button button--primary"
              type="button"
              onClick={onPickFolder}
            >
              Open first folder
            </button>
          </div>
        ) : (
          <div className="workspace-list" data-testid="workspace-list">
            {pinnedAll.length > 0 && (
              <section
                className="pinned-thread-group"
                aria-label="Pinned threads"
              >
                <div className="pinned-thread-group__head">
                  <PinIcon filled />
                  <span>Pinned</span>
                </div>
                <div className="session-list session-list--pinned">
                  {pinnedAll.map((s) => (
                    <ThreadRow
                      key={`pin:${s.sessionId}`}
                      s={s}
                      active={s.sessionId === activeSessionId}
                      menu={threadMenu === s.sessionId}
                      renaming={renamingId === s.sessionId}
                      showContext
                      draggable
                      onDragStart={() => setDragId(`pinned:${s.sessionId}`)}
                      onDragEnd={() => setDragId(null)}
                      onDropRow={() => {
                        const from = dragId?.startsWith("pinned:")
                          ? dragId.slice(7)
                          : "";
                        if (!from || from === s.sessionId) return;
                        onReorderPinned?.(
                          move(
                            pinnedAll.map((row) => row.sessionId),
                            from,
                            s.sessionId,
                          ),
                        );
                      }}
                      onSelect={() => onSelectSession(s)}
                      onMenu={() => onToggleThreadMenu(s.sessionId)}
                      onStartRename={() => onStartRename(s.sessionId)}
                      onCommitRename={(title) =>
                        onCommitRename(s.sessionId, title)
                      }
                      onCancelRename={onCancelRename}
                      onMarkRead={() => onMarkRead(s.sessionId)}
                      onCopySessionId={() => onCopySessionId(s.sessionId)}
                    />
                  ))}
                </div>
              </section>
            )}

            {groups.map((g) => {
              const isCollapsed = Boolean(collapsedWorkspaces[g.cwd]);
              const linkedWorktree = permanentWorktrees[g.cwd];
              const displayName = workspaceDisplayName(g.cwd, workspaceNames);
              return (
                <section className="workspace-group" key={g.cwd}>
                  <div
                    className={`workspace-row ${g.cwd === cwd ? "workspace-row--active" : ""}`}
                    draggable={renamingWorkspace !== g.cwd}
                    onDragStart={() => setDragId(`ws:${g.cwd}`)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      const from = dragId?.startsWith("ws:")
                        ? dragId.slice(3)
                        : "";
                      if (!from || from === g.cwd) return;
                      onReorderWorkspaces?.(
                        move(
                          groups.map((row) => row.cwd),
                          from,
                          g.cwd,
                        ),
                      );
                    }}
                  >
                    <button
                      aria-expanded={!isCollapsed}
                      aria-label={isCollapsed ? `Expand ${displayName}` : `Collapse ${displayName}`}
                      className="workspace-row__collapse"
                      type="button"
                      onClick={() => onToggleWorkspace(g.cwd)}
                    >
                      <span
                        className="workspace-row__icon"
                        data-collapsed={isCollapsed ? "" : undefined}
                      >
                        <span className="workspace-row__icon-chevron">
                          <ChevronDownIcon />
                        </span>
                        <span className="workspace-row__icon-folder">
                          <FolderIcon />
                        </span>
                      </span>
                    </button>
                    <button
                      className="workspace-row__select workspace-row__select--draggable"
                      type="button"
                      onClick={() => onSelectWorkspace(g.cwd)}
                    >
                      <span className="workspace-row__name">
                        {displayName}
                      </span>
                    </button>
                    <span className="workspace-row__menu-wrap">
                      <button
                        aria-label={`Workspace actions for ${displayName}`}
                        aria-haspopup="menu"
                        aria-expanded={workspaceMenu === g.cwd}
                        className="icon-button workspace-row__menu-button"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleWorkspaceMenu(g.cwd);
                        }}
                      >
                        …
                      </button>
                      {workspaceMenu === g.cwd && (
                        <div className="workspace-menu" role="menu">
                          <button
                            className="workspace-menu__item"
                            type="button"
                            onClick={() => onOpenFolder(g.cwd)}
                          >
                            Open folder
                          </button>
                          {linkedWorktree ? (
                            <button
                              className="workspace-menu__item workspace-menu__item--danger"
                              type="button"
                              onClick={() => onRemoveWorktree(g.cwd)}
                            >
                              Remove worktree
                            </button>
                          ) : (
                            <button
                              className="workspace-menu__item"
                              type="button"
                              onClick={() => onCreateWorktree(g.cwd)}
                            >
                              Create permanent worktree
                            </button>
                          )}
                          <button
                            className="workspace-menu__item"
                            type="button"
                            onClick={() => onStartWorkspaceRename(g.cwd)}
                          >
                            Edit name
                          </button>
                          <button
                            className="workspace-menu__item workspace-menu__item--danger"
                            type="button"
                            onClick={() => onRemoveWorkspace(g.cwd)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </span>
                  </div>
                  {renamingWorkspace === g.cwd ? (
                    <form
                      className="workspace-rename"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const next = new FormData(event.currentTarget).get("title");
                        if (typeof next === "string") onCommitWorkspaceRename(g.cwd, next);
                      }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        autoFocus
                        aria-label={`Rename ${displayName}`}
                        className="workspace-rename__input"
                        defaultValue={displayName}
                        name="title"
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            onCancelWorkspaceRename();
                          }
                        }}
                      />
                      <div className="workspace-rename__actions">
                        <button className="workspace-rename__button" type="button" onClick={onCancelWorkspaceRename}>
                          Cancel
                        </button>
                        <button className="workspace-rename__button workspace-rename__button--primary" type="submit">
                          Save
                        </button>
                      </div>
                    </form>
                  ) : null}
                  {!isCollapsed && (
                    <>
                      <div className="session-list">
                        {g.active.map((s) => (
                          <ThreadRow
                            key={s.sessionId}
                            s={s}
                            active={s.sessionId === activeSessionId}
                            menu={threadMenu === s.sessionId}
                            renaming={renamingId === s.sessionId}
                            onSelect={() => onSelectSession(s)}
                            onMenu={() => onToggleThreadMenu(s.sessionId)}
                            onStartRename={() => onStartRename(s.sessionId)}
                            onCommitRename={(title) =>
                              onCommitRename(s.sessionId, title)
                            }
                            onCancelRename={onCancelRename}
                            onMarkRead={() => onMarkRead(s.sessionId)}
                            onCopySessionId={() => onCopySessionId(s.sessionId)}
                          />
                        ))}
                      </div>
                      {g.archived.length > 0 && (
                        <div className="archived-thread-group">
                          <button
                            className="archived-thread-group__toggle"
                            type="button"
                            aria-expanded={Boolean(archivedOpen[g.cwd])}
                            onClick={() => onToggleArchived(g.cwd)}
                          >
                            <span
                              className={`archived-thread-group__chevron ${archivedOpen[g.cwd] ? "archived-thread-group__chevron--open" : ""}`}
                            >
                              <ChevronDownIcon />
                            </span>
                            <span>Archived</span>
                            <span className="archived-thread-group__count">
                              {g.archived.length}
                            </span>
                          </button>
                          {archivedOpen[g.cwd] && (
                            <div className="session-list session-list--archived">
                              {g.archived.map((s) => (
                                <ThreadRow
                                  key={s.sessionId}
                                  s={s}
                                  active={s.sessionId === activeSessionId}
                                  menu={threadMenu === s.sessionId}
                                  renaming={renamingId === s.sessionId}
                                  archived
                                  onSelect={() => onSelectSession(s)}
                                  onMenu={() => onToggleThreadMenu(s.sessionId)}
                                  onStartRename={() =>
                                    onStartRename(s.sessionId)
                                  }
                                  onCommitRename={(title) =>
                                    onCommitRename(s.sessionId, title)
                                  }
                                  onCancelRename={onCancelRename}
                                  onMarkRead={() => onMarkRead(s.sessionId)}
                                  onCopySessionId={() => onCopySessionId(s.sessionId)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </section>
              );
            })}
          </div>
          )}
        </div>
      </div>
      <UsageFooter accountUsage={accountUsage} auth={auth} />
    </aside>
  );
}

function UsageFooter({
  accountUsage,
  auth,
}: {
  readonly accountUsage: AccountUsage;
  readonly auth: AuthState;
}) {
  const usedPct = accountUsage?.usedPct;
  const remainingPct =
    accountUsage?.remainingPct ??
    (usedPct != null ? Math.max(0, 100 - usedPct) : undefined);
  const periodLabel = accountUsage?.period === "monthly" ? "month" : "week";
  const title =
    accountUsage?.period === "monthly" ? "Monthly usage" : "Weekly usage";
  const tone =
    remainingPct == null
      ? "ok"
      : remainingPct <= 10
        ? "critical"
        : remainingPct <= 25
          ? "warn"
          : "ok";
  const plan = accountUsage?.label || auth.subscriptionTier;
  const reset = formatReset(accountUsage?.resets);
  const products = (accountUsage?.products ?? [])
    .filter((row) => row.usedPct > 0)
    .slice(0, 4)
    .map((row) => `${row.label} ${row.usedPct}%`)
    .join(" · ");

  let primary = "Fetching weekly limit…";
  if (remainingPct != null)
    primary = `${remainingPct}% left this ${periodLabel}`;
  else if (usedPct != null) primary = `${usedPct}% used this ${periodLabel}`;
  else if (!auth.authenticated) primary = "Sign in to see weekly usage";

  const metaParts = [
    plan || null,
    usedPct != null ? `${usedPct}% used` : null,
    remainingPct == null && usedPct == null && accountUsage?.resets
      ? "limit pending"
      : null,
    reset,
  ]?.filter(Boolean);

  return (
    <div className="sidebar__footer sidebar-usage" data-tone={tone}>
      <div className="sidebar-usage__label">{title}</div>
      {remainingPct != null ? (
        <div className="sidebar-usage__bar" aria-hidden="true">
          <span
            className="sidebar-usage__fill"
            style={{ width: `${remainingPct}%` }}
          />
        </div>
      ) : (
        <div
          className="sidebar-usage__bar sidebar-usage__bar--empty"
          aria-hidden="true"
        >
          <span className="sidebar-usage__fill" style={{ width: "0%" }} />
        </div>
      )}
      <div className="sidebar-usage__primary">{primary}</div>
      {metaParts.length > 0 ? (
        <div className="sidebar-usage__meta">{metaParts.join(" · ")}</div>
      ) : null}
      {products ? <div className="sidebar-usage__meta">{products}</div> : null}
    </div>
  );
}

function formatReset(iso?: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return `resets ${iso}`;
  const ms = t - Date.now();
  const date = new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
  });
  if (ms <= 0) return `resets ${date}`;
  const hours = ms / 3_600_000;
  if (hours < 1) return `resets in ${Math.max(1, Math.round(ms / 60_000))}m`;
  if (hours < 48) return `resets in ${Math.round(hours)}h`;
  return `resets in ${Math.round(hours / 24)}d`;
}

function ThreadRow({
  s,
  active,
  menu,
  archived,
  renaming,
  showContext,
  draggable,
  onDragStart,
  onDragEnd,
  onDropRow,
  onSelect,
  onMenu,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onMarkRead,
  onCopySessionId,
}: {
  s: SessionSummary;
  active: boolean;
  menu: boolean;
  archived?: boolean;
  renaming?: boolean;
  showContext?: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDropRow?: () => void;
  onSelect: () => void;
  onMenu: () => void;
  onStartRename: () => void;
  onCommitRename: (title: string) => void;
  onCancelRename: () => void;
  onMarkRead: () => void;
  onCopySessionId: () => void;
}) {
  const variant = indicator(s);
  if (renaming) {
    return (
      <form
        className="workspace-rename session-rename"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new FormData(event.currentTarget).get("title");
          if (typeof next === "string" && next.trim())
            onCommitRename(next.trim());
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          className="workspace-rename__input"
          defaultValue={s.title || "New thread"}
          name="title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancelRename();
            }
          }}
        />
        <div className="workspace-rename__actions">
          <button
            className="workspace-rename__button"
            type="button"
            onClick={onCancelRename}
          >
            Cancel
          </button>
          <button
            className="workspace-rename__button workspace-rename__button--primary"
            type="submit"
          >
            Save
          </button>
        </div>
      </form>
    );
  }
  return (
    <>
      <div
        className={`session-row ${active ? "session-row--active" : ""} ${s.pinned ? "session-row--pinned" : ""}`}
        data-sidebar-indicator={variant}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={(event: DragEvent) => {
          if (draggable) event.preventDefault();
        }}
        onDrop={(event: DragEvent) => {
          event.preventDefault();
          onDropRow?.();
        }}
        onClick={onSelect}
        onContextMenu={(e: MouseEvent) => {
          e.preventDefault();
          onMenu();
        }}
      >
        <button className="session-row__select" type="button">
          <span className="session-row__leading" aria-hidden="true">
            {variant === "running" ? (
              <span className="session-row__status session-row__status--running" />
            ) : null}
            {variant === "failed" ? (
              <span className="session-row__status session-row__status--failed" />
            ) : null}
            {variant === "unseen" ? (
              <span className="session-row__status session-row__status--unseen" />
            ) : null}
          </span>
          <span className="session-row__body">
            <span className="session-row__title-line">
              <span className="session-row__title">
                {s.title || "New thread"}
              </span>
            </span>
            {showContext ? (
              <span className="session-row__context">{cwdName(s.cwd)}</span>
            ) : null}
            {s.summary ? (
              <span className="session-row__preview">{s.summary}</span>
            ) : null}
          </span>
        </button>
        <span className="session-row__trailing">
          {s.isWorktree ? (
            <span className="session-row__workspace-icon" aria-hidden="true" title="Worktree">
              <WorktreeIcon />
            </span>
          ) : null}
          <span className="session-row__time">{relTime(s.updatedAt)}</span>
          <span className="session-row__action-cluster">
            {!archived ? (
              <button
                className="icon-button session-row__action session-row__pin-action"
                type="button"
                aria-label={s.pinned ? "Unpin" : "Pin"}
                aria-pressed={Boolean(s.pinned)}
                onClick={(e) => {
                  e.stopPropagation();
                  void window.grokApp.pin(s.sessionId, !s.pinned);
                }}
              >
                <PinIcon filled={Boolean(s.pinned)} />
              </button>
            ) : null}
            <button
              className="icon-button session-row__action"
              type="button"
              aria-label={archived ? "Restore" : "Archive"}
              onClick={(e) => {
                e.stopPropagation();
                void window.grokApp.archive(s.sessionId, !archived);
              }}
            >
              {archived ? <RestoreIcon /> : <ArchiveIcon />}
            </button>
            <span className="session-row__menu-wrap">
              <button
                aria-label={`Thread actions for ${s.title || "New thread"}`}
                aria-haspopup="menu"
                aria-expanded={menu}
                className="icon-button session-row__action session-row__menu-button"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMenu();
                }}
              >
                …
              </button>
              {menu ? (
                <div
                  className="workspace-menu session-row__menu"
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="workspace-menu__item"
                    type="button"
                    onClick={onStartRename}
                  >
                    <span>Rename thread</span>
                    <span className="workspace-menu__shortcut">⇧⌘R</span>
                  </button>
                  <button
                    className="workspace-menu__item"
                    type="button"
                    onClick={() =>
                      void window.grokApp.archive(s.sessionId, !archived)
                    }
                  >
                    {archived ? "Restore" : "Archive"}
                  </button>
                  {s.unseen ? (
                    <button
                      className="workspace-menu__item"
                      type="button"
                      onClick={onMarkRead}
                    >
                      Mark as read
                    </button>
                  ) : null}
                  <button
                    className="workspace-menu__item"
                    type="button"
                    onClick={onCopySessionId}
                  >
                    Copy session id
                  </button>
                  <button
                    className="workspace-menu__item workspace-menu__item--danger"
                    type="button"
                    onClick={() => void window.grokApp.deleteSession(s.sessionId)}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </span>
          </span>
        </span>
      </div>
    </>
  );
}
