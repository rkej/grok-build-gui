import type { RefObject } from "react";

export function ThreadSearchBar({
  query,
  matchCount,
  activeIndex,
  inputRef,
  onSearch,
  onNext,
  onPrev,
  onClose,
}: {
  readonly query: string;
  readonly matchCount: number;
  readonly activeIndex: number;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly onSearch: (query: string) => void;
  readonly onNext: () => void;
  readonly onPrev: () => void;
  readonly onClose: () => void;
}) {
  return (
    <div className="thread-search-bar" data-testid="thread-search-bar">
      <input
        ref={inputRef}
        className="thread-search-bar__input"
        type="text"
        placeholder="Search thread..."
        value={query}
        onChange={(event) => onSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) onPrev();
            else onNext();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      />
      <span className="thread-search-bar__count">
        {query ? (matchCount > 0 ? `${activeIndex + 1} / ${matchCount}` : "0 results") : ""}
      </span>
      <div className="thread-search-bar__actions">
        <button aria-label="Previous match" className="icon-button" type="button" disabled={matchCount === 0} onClick={onPrev}>
          ▲
        </button>
        <button aria-label="Next match" className="icon-button" type="button" disabled={matchCount === 0} onClick={onNext}>
          ▼
        </button>
        <button aria-label="Close search" className="icon-button" type="button" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  );
}
