import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { AppView, SessionSummary } from "../shared/protocol";
import { ArrowLeftIcon, ArrowRightIcon, DiffIcon, FileIcon, PromptRailIcon, TerminalIcon } from "./icons";

export function Topbar({
  view,
  workspaceName,
  sessionTitle,
  environmentLabel,
  environmentOpen,
  environments,
  onToggleEnvironment,
  onSelectEnvironment,
  terminalVisible,
  onToggleTerminal,
  changesVisible,
  onToggleChanges,
  filesVisible,
  onToggleFiles,
  promptRailVisible,
  onTogglePromptRail,
  panelsAvailable = true,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
}: {
  readonly view: AppView;
  readonly workspaceName: string;
  readonly sessionTitle?: string;
  readonly environmentLabel: string;
  readonly environmentOpen: boolean;
  readonly environments: readonly { id: string; label: string }[];
  readonly onToggleEnvironment: () => void;
  readonly onSelectEnvironment: (id: string) => void;
  readonly terminalVisible: boolean;
  readonly onToggleTerminal: () => void;
  readonly changesVisible: boolean;
  readonly onToggleChanges: () => void;
  readonly filesVisible: boolean;
  readonly onToggleFiles: () => void;
  readonly promptRailVisible: boolean;
  readonly onTogglePromptRail: () => void;
  readonly panelsAvailable?: boolean;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly onGoBack: () => void;
  readonly onGoForward: () => void;
}) {
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
  const mod = isMac ? "⌘" : "Ctrl+";
  const onTitleDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement | null)?.closest(".topbar__actions")) return;
    void window.grokApp.toggleWindowMaximize();
  };

  return (
    <header className="topbar" data-testid="topbar" onDoubleClick={onTitleDoubleClick}>
      <div className="topbar__leading">
        <nav className="topbar__history" aria-label="Thread history">
          <TopbarActionButton
            disabled={!canGoBack}
            icon={<ArrowLeftIcon />}
            label="Previous thread"
            shortcut={`${mod}[`}
            onClick={onGoBack}
          />
          <TopbarActionButton
            disabled={!canGoForward}
            icon={<ArrowRightIcon />}
            label="Next thread"
            shortcut={`${mod}]`}
            onClick={onGoForward}
          />
        </nav>
        <div className="topbar__title">
          <span className="topbar__workspace">{workspaceName || "Open a folder to begin"}</span>
        {(view === "threads" || view === "new-thread") && (
          <>
            <span className="topbar__separator">/</span>
            <div className="environment-picker">
              <button
                aria-expanded={environmentOpen}
                aria-haspopup="menu"
                className="environment-picker__button"
                type="button"
                onClick={onToggleEnvironment}
              >
                {environmentLabel}
              </button>
              {environmentOpen ? (
                <div className="workspace-menu environment-picker__menu">
                  {environments.map((entry) => (
                    <button
                      className="workspace-menu__item"
                      key={entry.id}
                      type="button"
                      onClick={() => onSelectEnvironment(entry.id)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}
        {view === "threads" && sessionTitle ? (
          <>
            <span className="topbar__separator">/</span>
            <span className="topbar__session">{sessionTitle}</span>
          </>
        ) : view === "new-thread" ? (
          <>
            <span className="topbar__separator">/</span>
            <span className="topbar__session">New thread</span>
          </>
        ) : null}
        </div>
      </div>

      <div className="topbar__actions">
        <TopbarActionButton
          active={terminalVisible}
          disabled={!panelsAvailable}
          icon={<TerminalIcon />}
          label="Toggle terminal"
          shortcut={`${mod}J`}
          onClick={onToggleTerminal}
        />
        <TopbarActionButton
          active={changesVisible}
          disabled={!panelsAvailable}
          icon={<DiffIcon />}
          label="Toggle changes"
          shortcut={`${mod}D`}
          onClick={onToggleChanges}
        />
        <TopbarActionButton
          active={filesVisible}
          disabled={!panelsAvailable}
          icon={<FileIcon />}
          label="Toggle files"
          onClick={onToggleFiles}
        />
        <TopbarActionButton
          active={promptRailVisible}
          icon={<PromptRailIcon />}
          label={promptRailVisible ? "Hide prompt navigation" : "Show prompt navigation"}
          onClick={onTogglePromptRail}
        />
      </div>
    </header>
  );
}

function TopbarActionButton({
  label,
  icon,
  active = false,
  disabled = false,
  shortcut,
  onClick,
}: {
  readonly label: string;
  readonly icon: ReactNode;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly shortcut?: string;
  readonly onClick: () => void;
}) {
  return (
    <div className="shortcut-tooltip-wrap topbar__tooltip-wrap">
      <button
        aria-label={label}
        className={`icon-button topbar__icon ${active ? "icon-button--active" : ""}`}
        type="button"
        disabled={disabled}
        onClick={onClick}
      >
        {icon}
      </button>
      <span className="shortcut-tooltip topbar__tooltip" role="tooltip">
        <span>{label}</span>
        {shortcut ? <kbd>{shortcut}</kbd> : null}
      </span>
    </div>
  );
}

export function sessionDisplayTitle(session?: SessionSummary | null): string {
  return session?.title || "New thread";
}
