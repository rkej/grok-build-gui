import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

export function ManageDialog({
  eyebrow,
  title,
  error,
  busy,
  onClose,
  children,
  footer,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly error?: string;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLInputElement>("input, textarea, select")?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="tree-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="tree-modal tree-modal--compact manage-dialog"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="tree-modal__header">
          <div>
            <div className="tree-modal__eyebrow">{eyebrow}</div>
            <h2 className="tree-modal__title">{title}</h2>
          </div>
          <button aria-label="Close" className="tree-modal__close" type="button" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>
        {error ? <div className="tree-modal__error error-banner">{error}</div> : null}
        <div className="manage-dialog__body">{children}</div>
        <div className="tree-modal__footer">
          <div className="tree-modal__actions">{footer}</div>
        </div>
      </div>
    </div>
  );
}
