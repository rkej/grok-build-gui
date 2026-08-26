export type ThreadHistory = {
  readonly entries: readonly string[];
  readonly index: number;
};

export const EMPTY_THREAD_HISTORY: ThreadHistory = { entries: [], index: -1 };

/** Add a thread visit and discard any forward branch, like browser history. */
export function visitThread(history: ThreadHistory, sessionId: string): ThreadHistory {
  if (!sessionId || history.entries[history.index] === sessionId) return history;
  const entries = [...history.entries.slice(0, history.index + 1), sessionId];
  return { entries, index: entries.length - 1 };
}

export function threadHistoryTarget(
  history: ThreadHistory,
  direction: -1 | 1,
  availableSessionIds: ReadonlySet<string>,
): { history: ThreadHistory; sessionId: string } | null {
  for (
    let index = history.index + direction;
    index >= 0 && index < history.entries.length;
    index += direction
  ) {
    const sessionId = history.entries[index];
    if (sessionId && availableSessionIds.has(sessionId)) {
      return { history: { ...history, index }, sessionId };
    }
  }
  return null;
}

export function canNavigateThreadHistory(
  history: ThreadHistory,
  direction: -1 | 1,
  availableSessionIds: ReadonlySet<string>,
): boolean {
  return threadHistoryTarget(history, direction, availableSessionIds) !== null;
}
