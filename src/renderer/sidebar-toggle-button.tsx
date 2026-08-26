import type { ReactNode } from "react";
import { ArrowLeftIcon, ArrowRightIcon, SidebarToggleIcon } from "./icons";

export function SidebarToggleButton({
  collapsed,
  shortcutLabel,
  previousShortcutLabel,
  nextShortcutLabel,
  canGoBack,
  canGoForward,
  onToggle,
  onGoBack,
  onGoForward,
}: {
  readonly collapsed: boolean;
  readonly shortcutLabel: string;
  readonly previousShortcutLabel: string;
  readonly nextShortcutLabel: string;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly onToggle: () => void;
  readonly onGoBack: () => void;
  readonly onGoForward: () => void;
}) {
  return (
    <nav className="titlebar-navigation" aria-label="Window and thread navigation">
      <TitlebarNavigationButton
        label="Toggle sidebar"
        shortcutLabel={shortcutLabel}
        icon={<SidebarToggleIcon />}
        pressed={!collapsed}
        testId="sidebar-toggle"
        onClick={onToggle}
      />
      <TitlebarNavigationButton
        label="Previous thread"
        shortcutLabel={previousShortcutLabel}
        icon={<ArrowLeftIcon />}
        disabled={!canGoBack}
        onClick={onGoBack}
      />
      <TitlebarNavigationButton
        label="Next thread"
        shortcutLabel={nextShortcutLabel}
        icon={<ArrowRightIcon />}
        disabled={!canGoForward}
        onClick={onGoForward}
      />
    </nav>
  );
}

function TitlebarNavigationButton({
  label,
  shortcutLabel,
  icon,
  pressed,
  disabled,
  testId,
  onClick,
}: {
  readonly label: string;
  readonly shortcutLabel: string;
  readonly icon: ReactNode;
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  readonly testId?: string;
  readonly onClick: () => void;
}) {
  return (
    <div className="shortcut-tooltip-wrap titlebar-navigation__item">
      <button
        aria-label={label}
        aria-pressed={pressed}
        className="icon-button titlebar-navigation__button"
        data-testid={testId}
        disabled={disabled}
        type="button"
        onClick={onClick}
      >
        {icon}
      </button>
      <span className="shortcut-tooltip titlebar-navigation__tooltip" role="tooltip">
        <span>{label}</span>
        <kbd>{shortcutLabel}</kbd>
      </span>
    </div>
  );
}
