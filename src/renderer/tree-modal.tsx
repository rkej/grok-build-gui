import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { RewindPoint } from "../shared/protocol";

export function TreeModal({
  points,
  loading,
  submitting,
  error,
  onClose,
  onRewind,
}: {
  readonly points: readonly RewindPoint[];
  readonly loading: boolean;
  readonly submitting: boolean;
  readonly error?: string;
  readonly onClose: () => void;
  readonly onRewind: (index: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const rows = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return points.filter((point) => {
      if (tokens.length === 0) return true;
      const haystack = `${point.label} ${point.preview ?? ""}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [points, search]);

  const currentIndex = points.length > 0 ? points[points.length - 1]?.index : null;
  const currentSelected = selectedIndex != null && selectedIndex === currentIndex;

  useEffect(() => {
    searchRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedIndex(null);
      return;
    }
    if (!rows.some((row) => row.index === selectedIndex)) {
      setSelectedIndex(rows[rows.length - 1]?.index ?? rows[0]?.index ?? null);
    }
  }, [rows, selectedIndex]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!submitting) onClose();
      return;
    }
    if (rows.length === 0) return;
    const current = Math.max(0, rows.findIndex((row) => row.index === selectedIndex));
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex(rows[Math.min(rows.length - 1, current + 1)]?.index ?? selectedIndex);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex(rows[Math.max(0, current - 1)]?.index ?? selectedIndex);
      return;
    }
    if (event.key === "Enter" && selectedIndex != null && !currentSelected && !submitting) {
      event.preventDefault();
      onRewind(selectedIndex);
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
        aria-modal="true"
        className="tree-modal"
        data-testid="tree-modal"
        role="dialog"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="tree-modal__header">
          <div>
            <div className="tree-modal__eyebrow">Session tree</div>
            <h2 className="tree-modal__title">Browse rewind points</h2>
          </div>
          <button
            aria-label="Close tree modal"
            className="tree-modal__close"
            disabled={submitting}
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {error ? (
          <div className="tree-modal__error error-banner" data-testid="tree-modal-error">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="tree-modal__loading" data-testid="tree-modal-loading">
            Loading rewind points…
          </div>
        ) : (
          <>
            <div className="tree-modal__search-row">
              <input
                ref={searchRef}
                autoFocus
                aria-label="Search rewind points"
                className="tree-modal__search"
                data-testid="tree-modal-search"
                placeholder="Search turns"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="tree-modal__meta">
                {points.length === 0
                  ? "This thread has no rewind points yet."
                  : "Grok does not keep a branch graph. These are the turns you can rewind to."}
              </div>
            </div>

            <div className="tree-modal__list" data-testid="tree-modal-list">
              {rows.length === 0 ? (
                <div className="tree-modal__empty">No matching turns.</div>
              ) : (
                rows.map((point, position) => {
                  const isSelected = point.index === selectedIndex;
                  const isCurrent = point.index === currentIndex;
                  const marker = isCurrent ? "• " : "  ";
                  const preview = point.preview?.trim().replace(/\s+/g, " ") ?? "";
                  const line = `${position === rows.length - 1 ? "└─ " : "├─ "}${marker}${point.label}${preview ? `: ${preview}` : ""}${isCurrent ? "  ← current" : ""}`;
                  return (
                    <div
                      className={`tree-row ${isSelected ? "tree-row--selected" : ""} ${isCurrent ? "tree-row--active" : ""}`}
                      key={`${point.index}:${point.label}`}
                    >
                      <button className="tree-row__toggle tree-row__toggle--hidden" tabIndex={-1} type="button" />
                      <button
                        className="tree-row__content"
                        data-tree-selected={isSelected ? "true" : undefined}
                        type="button"
                        onClick={() => setSelectedIndex(point.index)}
                        onDoubleClick={() => {
                          if (!isCurrent && !submitting) onRewind(point.index);
                        }}
                      >
                        <span className="tree-row__line">{line}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="tree-modal__footer">
              <div className="tree-modal__hint">
                {submitting ? "Rewinding…" : "Rewinding jumps the live thread back to that turn."}
              </div>
              <div className="tree-modal__actions">
                <button className="button button--secondary" type="button" disabled={submitting} onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="button button--primary"
                  disabled={selectedIndex == null || currentSelected || submitting}
                  type="button"
                  onClick={() => {
                    if (selectedIndex != null) onRewind(selectedIndex);
                  }}
                >
                  {currentSelected ? "Already here" : submitting ? "Rewinding…" : "Rewind here"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
