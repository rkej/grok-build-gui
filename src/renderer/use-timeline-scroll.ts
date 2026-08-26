import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { TranscriptItem } from "../shared/protocol";
import { hasUnseenTimelineActivity, transcriptActivityKey } from "./timeline-activity";

const NEAR_BOTTOM_PX = 32;
const SCROLL_INTENT_MS = 750;

type TimelineScrollOptions = {
  readonly sessionKey: string;
  readonly items: readonly TranscriptItem[];
  readonly running: boolean;
  readonly enabled: boolean;
  readonly paneRef: RefObject<HTMLDivElement | null>;
};

function followMarker(itemCount: number, running: boolean): string {
  return `${itemCount}:${running ? "1" : "0"}`;
}

/**
 * Keeps the transcript pinned during streaming without fighting deliberate user
 * scrolling. Jump-to-latest is reserved for activity that arrived after the
 * user left the live tail — not for "there are already messages below."
 */
export function useTimelineScroll({ sessionKey, items, running, enabled, paneRef }: TimelineScrollOptions) {
  const pinnedRef = useRef(true);
  const intentUntilRef = useRef(0);
  const lastSessionRef = useRef<string | null>(null);
  const followMarkerRef = useRef("");
  const activityKey = transcriptActivityKey(items, running);
  const activityKeyRef = useRef(activityKey);
  const seenKeyRef = useRef(activityKey);
  const alignFrameRef = useRef<number | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  activityKeyRef.current = activityKey;

  const isNearBottom = useCallback((pane: HTMLDivElement) => {
    return pane.scrollHeight - pane.scrollTop - pane.clientHeight <= NEAR_BOTTOM_PX;
  }, []);

  const syncJumpToLatest = useCallback((pinned: boolean) => {
    setShowJumpToLatest(hasUnseenTimelineActivity(pinned, activityKeyRef.current, seenKeyRef.current));
  }, []);

  const markSeen = useCallback(() => {
    seenKeyRef.current = activityKeyRef.current;
    setShowJumpToLatest(false);
  }, []);

  const alignBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const pane = paneRef.current;
    if (!pane) return;
    if (behavior === "smooth") pane.scrollTo({ top: pane.scrollHeight, behavior });
    else pane.scrollTop = pane.scrollHeight;
    pinnedRef.current = true;
    markSeen();
  }, [markSeen, paneRef, sessionKey]);

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
    if (pinned) markSeen();
    else syncJumpToLatest(false);
  }, [alignBottom, enabled, isNearBottom, markSeen, paneRef, sessionKey, syncJumpToLatest]);

  const handleContentHeightChange = useCallback(() => {
    if (!enabled) return;
    if (!pinnedRef.current) return;
    if (alignFrameRef.current != null) cancelAnimationFrame(alignFrameRef.current);
    alignFrameRef.current = requestAnimationFrame(() => {
      alignFrameRef.current = null;
      if (pinnedRef.current) alignBottom();
    });
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

    const nextFollow = followMarker(items.length, running);
    const sessionChanged = lastSessionRef.current !== sessionKey;
    if (sessionChanged) {
      lastSessionRef.current = sessionKey;
      followMarkerRef.current = nextFollow;
      pinnedRef.current = true;
      alignBottom();
      return;
    }

    if (pinnedRef.current) {
      if (nextFollow !== followMarkerRef.current) {
        followMarkerRef.current = nextFollow;
        alignBottom();
      } else {
        seenKeyRef.current = activityKey;
      }
      return;
    }

    followMarkerRef.current = nextFollow;
    syncJumpToLatest(false);
  }, [alignBottom, enabled, activityKey, items.length, paneRef, running, sessionKey, syncJumpToLatest]);

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
