import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export type ForkEnvironment = "local" | "worktree";

export function ForkModal({
  preview,
  canUseWorktree,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  readonly preview?: string;
  readonly canUseWorktree: boolean;
  readonly submitting: boolean;
  readonly error?: string;
  readonly onClose: () => void;
  readonly onSubmit: (environment: ForkEnvironment) => void;
}) {
  const [environment, setEnvironment] = useState<ForkEnvironment>("local");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>("[data-fork-confirm='true']")?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !submitting) {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="tree-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="tree-modal tree-modal--compact"
        data-testid="fork-modal"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="tree-modal__header">
          <div>
            <div className="tree-modal__eyebrow">Fork conversation</div>
            <h2 className="tree-modal__title">Start a new thread</h2>
          </div>
          <button aria-label="Close fork modal" className="tree-modal__close" type="button" disabled={submitting} onClick={onClose}>
            ×
          </button>
        </div>
        {error ? <div className="tree-modal__error error-banner">{error}</div> : null}
        <div className="tree-modal__summary-step">
          <div className="tree-modal__summary-copy">
            Forks the conversation through this message into a new sidebar thread. The original thread stays untouched.
          </div>
          {preview ? <div className="fork-modal__preview" data-testid="fork-modal-preview">{preview}</div> : null}
          <div className="new-thread__environment-group" role="radiogroup" aria-label="Fork environment">
            <button
              type="button"
              className={`new-thread__environment ${environment === "local" ? "new-thread__environment--active" : ""}`}
              aria-pressed={environment === "local"}
              data-testid="fork-environment-local"
              onClick={() => setEnvironment("local")}
            >
              <span>Same worktree</span>
            </button>
            <button
              type="button"
              className={`new-thread__environment ${environment === "worktree" ? "new-thread__environment--active" : ""}`}
              aria-pressed={environment === "worktree"}
              data-testid="fork-environment-worktree"
              disabled={!canUseWorktree}
              onClick={() => setEnvironment("worktree")}
            >
              <span>New worktree</span>
            </button>
          </div>
          <div className="tree-modal__footer">
            <div className="tree-modal__hint">
              {environment === "worktree" ? "A fresh worktree is created for the fork." : "The fork opens in the same folder."}
            </div>
            <div className="tree-modal__actions">
              <button className="button button--secondary" type="button" disabled={submitting} onClick={onClose}>Cancel</button>
              <button className="button button--primary" type="button" data-fork-confirm="true" data-testid="fork-modal-confirm" disabled={submitting} onClick={() => onSubmit(environment)}>
                {submitting ? "Forking…" : "Fork thread"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
