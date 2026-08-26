import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ToolCallState, TranscriptItem } from "../shared/protocol";
import { SparkIcon } from "./icons";
import { ThreadSearchBar } from "./thread-search";
import { TimelineItem } from "./timeline-item";
import { buildDisplayTimelineItems, flattenDisplayItems, type DisplayTimelineItem } from "./timeline-turns";

const OVERSCAN_PX = 720;
const ROW_GAP_PX = 14;
const VIRTUALIZATION_THRESHOLD = 80;

export const ConversationTimeline = memo(function ConversationTimeline({
  items,
  running,
  runningLabel,
  error,
  paneRef,
  expandedTools,
  promptRailVisible,
  showThoughts,
  loadingTools,
  loadedToolContent,
  transcriptLoading,
  threadSearch,
  onToggleTool,
  onViewFileInDiff,
  onFork,
  onTimelineScroll,
  onTimelineScrollIntent,
  onContentHeightChange,
  showJumpToLatest,
  onJumpToLatest,
}: {
  readonly items: readonly TranscriptItem[];
  readonly running: boolean;
  readonly runningLabel?: string;
  readonly error: string | null;
  readonly paneRef: RefObject<HTMLDivElement | null>;
  readonly expandedTools: Record<string, boolean>;
  readonly promptRailVisible: boolean;
  readonly showThoughts?: boolean;
  readonly loadingTools: Record<string, boolean>;
  readonly loadedToolContent?: Record<string, ToolCallState>;
  readonly transcriptLoading: boolean;
  readonly threadSearch?: {
    isOpen: boolean;
    query: string;
    matchCount: number;
    activeIndex: number;
    inputRef: RefObject<HTMLInputElement | null>;
    search: (query: string) => void;
    goToMatch: (direction: 1 | -1) => void;
    close: () => void;
  };
  readonly onToggleTool: (id: string) => void;
  readonly onViewFileInDiff?: (path: string) => void;
  readonly onFork?: (itemId: string) => void;
  readonly onTimelineScroll?: () => void;
  readonly onTimelineScrollIntent?: () => void;
  readonly onContentHeightChange?: () => void;
  readonly showJumpToLatest?: boolean;
  readonly onJumpToLatest?: () => void;
}) {
  const displayItems = useMemo(() => buildDisplayTimelineItems(items), [items]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedBuckets, setExpandedBuckets] = useState<Record<string, boolean>>({});
  const visibleItems = useMemo(
    () => flattenDisplayItems(displayItems, expandedGroups, expandedBuckets),
    [displayItems, expandedGroups, expandedBuckets],
  );
  const isExpanded = (item: DisplayTimelineItem) => {
    if (item.kind === "tool-group") return Boolean(expandedGroups[item.id]);
    if (item.kind === "tool-bucket") return Boolean(expandedBuckets[item.id]);
    if (item.kind === "tool") return Boolean(expandedTools[item.id]);
    return false;
  };
  const toggleItem = useCallback((item: DisplayTimelineItem) => {
    if (item.kind === "tool-group") {
      setExpandedGroups((current) => ({ ...current, [item.id]: !current[item.id] }));
      return;
    }
    if (item.kind === "tool-bucket") {
      setExpandedBuckets((current) => ({ ...current, [item.id]: !current[item.id] }));
      return;
    }
    onToggleTool(item.id);
  }, [onToggleTool]);
  const prompts = useMemo(
    () =>
      items
        .filter((item): item is Extract<TranscriptItem, { kind: "user" }> => item.kind === "user")
        .map((item, index) => ({
          id: item.id,
          turnNumber: index + 1,
          preview: promptPreview(item.text),
        })),
    [items],
  );
  const searchOpen = Boolean(threadSearch?.isOpen);
  const hasUnreliableVirtualizedHeights = items.some(
    (item) =>
      (item.kind === "user" || item.kind === "assistant")
      && (item.text.length > 2000 || (item.kind === "user" && Boolean(item.attachments?.length))),
  );
  const shouldVirtualize =
    !searchOpen && visibleItems.length > VIRTUALIZATION_THRESHOLD && !hasUnreliableVirtualizedHeights;

  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane || !onContentHeightChange) return undefined;
    const timeline = pane.querySelector<HTMLElement>(".timeline");
    if (!timeline) return undefined;
    const observer = new ResizeObserver(() => onContentHeightChange());
    observer.observe(timeline);
    return () => observer.disconnect();
  }, [visibleItems.length, onContentHeightChange, paneRef, transcriptLoading]);

  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane || !onTimelineScroll) return undefined;
    pane.addEventListener("scroll", onTimelineScroll, { passive: true });
    return () => pane.removeEventListener("scroll", onTimelineScroll);
  }, [onTimelineScroll, paneRef]);

  const scrollTo = (id: string) => {
    const pane = paneRef.current;
    const target = pane?.querySelector<HTMLElement>(`[data-message-id="${cssEscape(id)}"]`);
    onTimelineScrollIntent?.();
    if (pane && target) {
      const paneRect = pane.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      pane.scrollTo({ top: Math.max(0, pane.scrollTop + (targetRect.top - paneRect.top) - 16), behavior: "smooth" });
      return;
    }
    const index = visibleItems.findIndex((item) => item.id === id);
    if (!pane || index < 0) return;
    const estimatedTop = visibleItems.slice(0, index).reduce((total, item) => total + estimateHeight(item) + ROW_GAP_PX, 0);
    pane.scrollTop = Math.max(0, estimatedTop - 16);
    window.requestAnimationFrame(() => {
      const mounted = pane.querySelector<HTMLElement>(`[data-message-id="${cssEscape(id)}"]`);
      if (!mounted) return;
      const paneRect = pane.getBoundingClientRect();
      const targetRect = mounted.getBoundingClientRect();
      pane.scrollTo({ top: Math.max(0, pane.scrollTop + (targetRect.top - paneRect.top) - 16), behavior: "smooth" });
    });
  };

  return (
    <div className="conversation-timeline">
      {error ? <div className="error-banner">{error}</div> : null}
      <div
        className="timeline-surface timeline-pane timeline-pane--thread"
        ref={paneRef}
        data-testid="timeline-pane"
        onPointerDown={onTimelineScrollIntent}
        onWheel={onTimelineScrollIntent}
      >
        <div className="timeline-pane__content">
          {threadSearch?.isOpen ? (
            <ThreadSearchBar
              query={threadSearch.query}
              matchCount={threadSearch.matchCount}
              activeIndex={threadSearch.activeIndex}
              inputRef={threadSearch.inputRef}
              onSearch={threadSearch.search}
              onNext={() => threadSearch.goToMatch(1)}
              onPrev={() => threadSearch.goToMatch(-1)}
              onClose={threadSearch.close}
            />
          ) : null}
          {transcriptLoading ? (
            <div className="timeline" data-testid="transcript-loading">
              <TranscriptSkeleton />
            </div>
          ) : items.length === 0 && !running ? (
            <div className="timeline" data-testid="transcript">
              <TranscriptEmptyState />
            </div>
          ) : shouldVirtualize ? (
            <VirtualizedTranscript
              displayItems={visibleItems}
              paneRef={paneRef}
              expandedTools={expandedTools}
              expandedGroups={expandedGroups}
              expandedBuckets={expandedBuckets}
              showThoughts={showThoughts}
              loadingTools={loadingTools}
              loadedToolContent={loadedToolContent}
              running={running}
              runningLabel={runningLabel}
              onToggleItem={toggleItem}
              onViewFileInDiff={onViewFileInDiff}
              onFork={onFork}
              onContentHeightChange={onContentHeightChange}
            />
          ) : (
            <div className="timeline" data-testid="transcript">
              {visibleItems.map((item) => {
                const expanded = isExpanded(item);
                return (
                  <TimelineItem
                    key={item.id}
                    item={hydrateItem(item, expanded, loadedToolContent)}
                    expanded={expanded}
                    showThoughts={showThoughts}
                    loading={item.kind === "tool" ? Boolean(loadingTools[item.id]) : false}
                    onToggle={toggleItem}
                    onViewFileInDiff={onViewFileInDiff}
                    onFork={item.kind === "assistant" ? onFork : undefined}
                  />
                );
              })}
              {running ? (
                <div className="timeline-activity">
                  <span className="timeline-activity__label">{runningLabel ?? "Working…"}</span>
                </div>
              ) : null}
            </div>
          )}
          {showJumpToLatest ? (
            <button className="timeline-jump" data-testid="timeline-jump" type="button" onClick={onJumpToLatest}>
              New activity below
            </button>
          ) : null}
        </div>
        {promptRailVisible && prompts.length > 1 ? (
          <nav className="timeline-context-rail" data-testid="timeline-context-rail" aria-label="Prompts in this thread">
            <div className="timeline-context-rail__title">Prompts</div>
            <ol className="timeline-context-rail__list">
              {prompts.map((prompt) => (
                <li key={prompt.id}>
                  <button type="button" className="timeline-context-rail__item" data-testid="timeline-context-rail-item" title={prompt.preview} onClick={() => scrollTo(prompt.id)}>
                    <span className="timeline-context-rail__index">{prompt.turnNumber}</span>
                    <span className="timeline-context-rail__text">{prompt.preview}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </div>
    </div>
  );
});

function VirtualizedTranscript({
  displayItems,
  paneRef,
  expandedTools,
  expandedGroups,
  expandedBuckets,
  showThoughts,
  loadingTools,
  loadedToolContent,
  running,
  runningLabel,
  onToggleItem,
  onViewFileInDiff,
  onFork,
  onContentHeightChange,
}: {
  readonly displayItems: readonly DisplayTimelineItem[];
  readonly paneRef: RefObject<HTMLDivElement | null>;
  readonly expandedTools: Record<string, boolean>;
  readonly expandedGroups: Record<string, boolean>;
  readonly expandedBuckets: Record<string, boolean>;
  readonly showThoughts?: boolean;
  readonly loadingTools: Record<string, boolean>;
  readonly loadedToolContent?: Record<string, ToolCallState>;
  readonly running?: boolean;
  readonly runningLabel?: string;
  readonly onToggleItem: (item: DisplayTimelineItem) => void;
  readonly onViewFileInDiff?: (path: string) => void;
  readonly onFork?: (itemId: string) => void;
  readonly onContentHeightChange?: () => void;
}) {
  const heightsRef = useRef(new Map<string, number>());
  const [version, setVersion] = useState(0);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 800 });

  const onHeightChange = useCallback((id: string, height: number) => {
    const next = Math.max(1, Math.ceil(height));
    if (heightsRef.current.get(id) === next) return;
    heightsRef.current.set(id, next);
    setVersion((value) => value + 1);
    onContentHeightChange?.();
  }, [onContentHeightChange]);

  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) return undefined;
    const sync = () => {
      setViewport((current) =>
        current.scrollTop === pane.scrollTop && current.height === pane.clientHeight
          ? current
          : { scrollTop: pane.scrollTop, height: pane.clientHeight },
      );
    };
    sync();
    pane.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(pane);
    return () => {
      pane.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [paneRef]);

  // The scroll controller may pin the pane after this list mounts. A
  // programmatic scroll can happen in the same frame as the first measurement,
  // so take a second snapshot after the transcript size changes or the list
  // would render rows for the old viewport and look empty.
  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) return undefined;
    const frame = window.requestAnimationFrame(() => {
      setViewport((current) =>
        current.scrollTop === pane.scrollTop && current.height === pane.clientHeight
          ? current
          : { scrollTop: pane.scrollTop, height: pane.clientHeight },
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [displayItems.length, paneRef]);

  useLayoutEffect(() => {
    const ids = new Set(displayItems.map((item) => item.id));
    let removed = false;
    for (const id of heightsRef.current.keys()) {
      if (ids.has(id)) continue;
      heightsRef.current.delete(id);
      removed = true;
    }
    if (removed) setVersion((value) => value + 1);
  }, [displayItems]);

  void version;
  const rowHeights = displayItems.map((item) => heightsRef.current.get(item.id) ?? estimateHeight(item));
  const offsets: number[] = [];
  let total = 0;
  for (let i = 0; i < rowHeights.length; i += 1) {
    offsets[i] = total;
    total += rowHeights[i] ?? 0;
    if (i < rowHeights.length - 1) total += ROW_GAP_PX;
  }
  const startOffset = Math.max(0, viewport.scrollTop - OVERSCAN_PX);
  const endOffset = viewport.scrollTop + viewport.height + OVERSCAN_PX;
  const start = findStartIndex(offsets, rowHeights, startOffset);
  const end = findEndIndex(offsets, endOffset);

  return (
    <>
      <div className="timeline timeline--virtualized" data-testid="transcript" style={{ height: `${total}px` }}>
        {displayItems.slice(start, end).map((item, offset) => {
          const index = start + offset;
          const expanded = item.kind === "tool-group"
            ? Boolean(expandedGroups[item.id])
            : item.kind === "tool-bucket"
              ? Boolean(expandedBuckets[item.id])
              : item.kind === "tool"
                ? Boolean(expandedTools[item.id])
                : false;
          return (
            <MeasuredRow
              key={item.id}
              item={hydrateItem(item, expanded, loadedToolContent)}
              top={offsets[index] ?? 0}
              expanded={expanded}
              showThoughts={showThoughts}
              loading={item.kind === "tool" ? Boolean(loadingTools[item.id]) : false}
              onHeightChange={onHeightChange}
              onToggle={onToggleItem}
              onViewFileInDiff={onViewFileInDiff}
              onFork={item.kind === "assistant" ? onFork : undefined}
            />
          );
        })}
      </div>
      {running ? (
        <div className="timeline-activity">
          <span className="timeline-activity__label">{runningLabel ?? "Working…"}</span>
        </div>
      ) : null}
    </>
  );
}

function findStartIndex(offsets: readonly number[], heights: readonly number[], target: number): number {
  let low = 0;
  let high = offsets.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if ((offsets[mid] ?? 0) + (heights[mid] ?? 0) < target) low = mid + 1;
    else high = mid - 1;
  }
  return Math.max(0, Math.min(offsets.length - 1, low));
}

function findEndIndex(offsets: readonly number[], target: number): number {
  let low = 0;
  let high = offsets.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if ((offsets[mid] ?? 0) <= target) low = mid + 1;
    else high = mid - 1;
  }
  return Math.min(offsets.length, Math.max(low + 1, 1));
}

function MeasuredRow({
  item,
  top,
  expanded,
  showThoughts,
  loading,
  onHeightChange,
  onToggle,
  onViewFileInDiff,
  onFork,
}: {
  readonly item: DisplayTimelineItem;
  readonly top: number;
  readonly expanded: boolean;
  readonly showThoughts?: boolean;
  readonly loading?: boolean;
  readonly onHeightChange: (id: string, height: number) => void;
  readonly onToggle: (item: DisplayTimelineItem) => void;
  readonly onViewFileInDiff?: (path: string) => void;
  readonly onFork?: (itemId: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => onHeightChange(item.id, el.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, loading, item, onHeightChange]);

  return (
    <div className="timeline__virtual-row" ref={ref} data-message-id={item.id} style={{ transform: `translateY(${top}px)` }}>
      <TimelineItem
        item={item}
        expanded={expanded}
        showThoughts={showThoughts}
        loading={loading}
        onToggle={onToggle}
        onViewFileInDiff={onViewFileInDiff}
        onFork={onFork}
      />
    </div>
  );
}

function hydrateItem(
  item: DisplayTimelineItem,
  expanded: boolean,
  loadedToolContent: Record<string, ToolCallState> | undefined,
): DisplayTimelineItem {
  if (!expanded || item.kind !== "tool" || !loadedToolContent) return item;
  const loaded = loadedToolContent[item.id] ?? loadedToolContent[item.tool.toolCallId];
  if (!loaded) return item;
  return { ...item, tool: { ...item.tool, ...loaded, contentLoaded: true } };
}

function estimateHeight(item: DisplayTimelineItem): number {
  if (item.kind === "turn-marker") return 32;
  if (item.kind === "user" || item.kind === "assistant") {
    const attachmentHeight = item.kind === "user" && item.attachments?.some((attachment) => attachment.kind === "image")
      ? 120
      : item.kind === "user" && item.attachments?.length
        ? 56
        : 0;
    const textLength = Math.max(item.text.length, 1);
    return 48 + attachmentHeight + Math.min(240, Math.ceil(textLength / 90) * 20);
  }
  if (item.kind === "tool") return 28;
  if (item.kind === "tool-group" || item.kind === "tool-bucket") return 28;
  if (item.kind === "plan") return 140;
  return 38;
}

function TranscriptEmptyState() {
  return (
    <div className="transcript-empty" data-testid="transcript-empty">
      <span className="transcript-empty__glyph" aria-hidden="true">
        <SparkIcon />
      </span>
      <p className="transcript-empty__title">Start the conversation</p>
      <p className="transcript-empty__hint">Send a prompt below to begin this session.</p>
    </div>
  );
}

function TranscriptSkeleton() {
  return (
    <div className="transcript-skeleton" data-testid="transcript-skeleton" aria-hidden="true">
      <div className="transcript-skeleton__row transcript-skeleton__row--user"><span className="skeleton-line" style={{ width: "42%" }} /></div>
      <div className="transcript-skeleton__row">
        <span className="skeleton-line" style={{ width: "88%" }} />
        <span className="skeleton-line" style={{ width: "94%" }} />
        <span className="skeleton-line" style={{ width: "66%" }} />
      </div>
      <div className="transcript-skeleton__row transcript-skeleton__row--tool"><span className="skeleton-line skeleton-line--tool" style={{ width: "38%" }} /></div>
      <div className="transcript-skeleton__row">
        <span className="skeleton-line" style={{ width: "80%" }} />
        <span className="skeleton-line" style={{ width: "72%" }} />
      </div>
      <span className="sr-only">Loading transcript…</span>
    </div>
  );
}

function promptPreview(text: string): string {
  const firstLine = text.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? "";
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine || "Prompt";
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}
