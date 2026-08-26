import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

const NEAR_BOTTOM_PX = 32;
const SCROLL_INTENT_MS = 750;

type TimelineScrollOptions = {
  readonly sessionKey: string;
  readonly itemCount: number;
  readonly running: boolean;
  readonly enabled: boolean;
  readonly paneRef: RefObject<HTMLDivElement | null>;
};

/**
 * Keeps the transcript pinned during streaming without fighting deliberate user
 * scrolling. This is intentionally state-light: the virtualized list owns row
 * measurement, while this hook owns only the scroll contract.
 */
export function useTimelineScroll({ sessionKey, itemCount, running, enabled, paneRef }: TimelineScrollOptions) {
  const pinnedRef = useRef(true);
  const intentUntilRef = useRef(0);
  const lastSessionRef = useRef<string | null>(null);
  const markerRef = useRef("");
  const alignFrameRef = useRef<number | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const isNearBottom = useCallback((pane: HTMLDivElement) => {
    return pane.scrollHeight - pane.scrollTop - pane.clientHeight <= NEAR_BOTTOM_PX;
  }, []);

  const alignBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const pane = paneRef.current;
    if (!pane) return;
    if (behavior === "smooth") pane.scrollTo({ top: pane.scrollHeight, behavior });
    else pane.scrollTop = pane.scrollHeight;
    pinnedRef.current = true;
    setShowJumpToLatest(false);
  }, [paneRef, sessionKey]);

  const handleTimelineScrollIntent = useCallback(() => {
    intentUntilRef.current = performance.now() + SCROLL_INTENT_MS;
  }, []);

  const handleTimelineScroll = useCallback(() => {
    const pane = paneRef.current;
    if (!pane || !enabled || !sessionKey) return;
    const pinned = isNearBottom(pane);
    const deliberate = performance.now() <= intentUntilRef.current;

    // A layout change can briefly report a non-bottom position while the user is
    // still pinned. Only preserve that state when it was not caused by intent.
    if (!pinned && pinnedRef.current && !deliberate) {
      alignBottom();
      return;
    }

    pinnedRef.current = pinned;
    setShowJumpToLatest(!pinned);
  }, [alignBottom, enabled, isNearBottom, paneRef, sessionKey]);

  const handleContentHeightChange = useCallback(() => {
    if (!enabled) return;
    if (pinnedRef.current) {
      if (alignFrameRef.current != null) cancelAnimationFrame(alignFrameRef.current);
      alignFrameRef.current = requestAnimationFrame(() => {
        alignFrameRef.current = null;
        if (pinnedRef.current) alignBottom();
      });
    } else {
      setShowJumpToLatest(true);
    }
  }, [alignBottom, enabled]);

  const jumpToLatest = useCallback(() => {
    pinnedRef.current = true;
    intentUntilRef.current = performance.now() + SCROLL_INTENT_MS;
    alignBottom("smooth");
  }, [alignBottom]);

  useLayoutEffect(() => {
    if (!enabled) return;
    const pane = paneRef.current;
    if (!pane) return;

    const sessionChanged = lastSessionRef.current !== sessionKey;
    if (sessionChanged) {
      lastSessionRef.current = sessionKey;
      pinnedRef.current = true;
      alignBottom();
      markerRef.current = "";
      return;
    }

    const marker = `${itemCount}:${running ? "running" : "idle"}`;
    if (marker === markerRef.current) return;
    markerRef.current = marker;
    if (pinnedRef.current) alignBottom();
    else setShowJumpToLatest(true);
  }, [alignBottom, enabled, isNearBottom, itemCount, paneRef, running, sessionKey]);

  useEffect(() => () => {
    if (alignFrameRef.current != null) cancelAnimationFrame(alignFrameRef.current);
  }, []);

  return {
    handleTimelineScroll,
    handleTimelineScrollIntent,
    handleContentHeightChange,
    showJumpToLatest,
    jumpToLatest,
  };
}
