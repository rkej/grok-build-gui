import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { AppSnapshot, ExtensionDialog as ExtensionDialogRecord, ExtensionUiResponse, PermissionRequest } from "../shared/protocol";
import { ChevronDownIcon, ChevronRightIcon } from "./icons";

export function buildExtensionDockModel(state: AppSnapshot): { summaryText: string; bodyText: string } | undefined {
  const lines: string[] = [];
  for (const server of state.mcp) {
    const status = server.status ?? (server.enabled === false ? "off" : "ready");
    lines.push(`${server.displayName ?? server.name}: ${status}`);
  }
  for (const plugin of state.plugins) {
    lines.push(`${plugin.name}: ${plugin.enabled === false ? "off" : "on"}`);
  }
  if (!lines.length) return undefined;
  return {
    summaryText: state.pendingPermission
      ? `Permission needed · ${state.pendingPermission.toolCall.title}`
      : lines[0] ?? "Extensions",
    bodyText: lines.join("\n"),
  };
}

export function ExtensionDock({
  dock,
  expanded,
  onToggle,
}: {
  readonly dock: { summaryText: string; bodyText: string };
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <div className={`extension-dock ${expanded ? "extension-dock--expanded" : ""}`}>
      <button
        aria-expanded={expanded}
        className="extension-dock__toggle"
        type="button"
        title={dock.summaryText}
        onClick={onToggle}
      >
        <span className="extension-dock__summary">{dock.summaryText}</span>
        <span className="extension-dock__chevron" aria-hidden="true">
          {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </span>
      </button>
      {expanded ? <pre className="extension-dock__body">{dock.bodyText}</pre> : null}
    </div>
  );
}

export function PermissionDialog({
  request,
  onRespond,
}: {
  readonly request: PermissionRequest;
  readonly onRespond: (optionId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="extension-dialog-backdrop">
      <div className="extension-dialog" role="dialog" aria-modal="true" aria-labelledby="permission-dialog-title">
        <div className="extension-dialog__title" id="permission-dialog-title">
          Permission needed
        </div>
        <p className="extension-dialog__body">{request.toolCall.title}</p>
        <div className="extension-dialog__actions">
          {request.options.map((option) => (
            <button
              key={option.optionId}
              className={`button ${/allow|approve|yes/i.test(option.name) ? "button--primary" : "button--secondary"}`}
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                onRespond(option.optionId);
              }}
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ExtensionDialog({
  dialog,
  onRespond,
}: {
  readonly dialog: ExtensionDialogRecord;
  readonly onRespond: (response: ExtensionUiResponse) => void;
}) {
  const [draft, setDraft] = useState(dialog.kind === "input" || dialog.kind === "editor" ? dialog.initialValue ?? "" : "");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (dialog.kind === "input" || dialog.kind === "editor") setDraft(dialog.initialValue ?? "");
    else setDraft("");
  }, [dialog]);

  const cancel = () => onRespond({ requestId: dialog.requestId, cancelled: true });
  const submit = () => {
    if (dialog.kind === "confirm") {
      onRespond({ requestId: dialog.requestId, confirmed: true });
      return;
    }
    if (dialog.kind === "input" || dialog.kind === "editor") {
      onRespond({ requestId: dialog.requestId, value: draft });
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      if (dialog.kind === "confirm" || dialog.kind === "input" || dialog.kind === "editor") {
        event.preventDefault();
        submit();
      }
    }
  };

  return (
    <div className="extension-dialog-backdrop">
      <div
        ref={dialogRef}
        className="extension-dialog"
        role="dialog"
        aria-modal="true"
        data-testid="extension-dialog"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="extension-dialog__title">{dialog.title}</div>
        {dialog.kind === "confirm" ? <p className="extension-dialog__body">{dialog.message}</p> : null}
        {dialog.kind === "select" ? (
          <div className="extension-dialog__options">
            {dialog.options.map((option) => (
              <button
                key={option}
                className="extension-dialog__option"
                type="button"
                onClick={() => onRespond({ requestId: dialog.requestId, value: option })}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
        {dialog.kind === "input" ? (
          <input
            autoFocus
            className="skills-search"
            placeholder={dialog.placeholder ?? "Enter a value"}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : null}
        {dialog.kind === "editor" ? (
          <textarea
            autoFocus
            className="extension-dialog__editor"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : null}
        <div className="extension-dialog__actions">
          <button className="button button--secondary" type="button" data-testid="extension-dialog-cancel" onClick={cancel}>
            Cancel
          </button>
          {dialog.kind === "confirm" ? (
            <button className="button button--primary" type="button" data-testid="extension-dialog-confirm" onClick={submit}>
              Confirm
            </button>
          ) : null}
          {dialog.kind === "input" || dialog.kind === "editor" ? (
            <button className="button button--primary" type="button" data-testid="extension-dialog-submit" onClick={submit}>
              Submit
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
