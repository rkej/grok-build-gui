/**
 * Decide whether an ACP notification belongs to the thread currently on screen.
 *
 * Grok usually sends `params.sessionId`. Some `_x.ai/*` events nest it, and a
 * few in-flight chunks omit it entirely — those must not land on a different
 * thread after the user switches.
 */
export function sessionIdFromParams(params: Record<string, unknown> | undefined | null): string | null {
  if (!params) return null;
  const direct = readId(params.sessionId) ?? readId(params.session_id);
  if (direct) return direct;
  const update = asRecord(params.update);
  if (update) {
    const nested = readId(update.sessionId) ?? readId(update.session_id);
    if (nested) return nested;
  }
  const meta = asRecord(params._meta);
  if (meta) {
    const fromMeta = readId(meta.sessionId) ?? readId(meta.session_id);
    if (fromMeta) return fromMeta;
  }
  return null;
}

export function isForActiveSession(
  params: Record<string, unknown> | undefined | null,
  activeSessionId: string | null,
  inFlightSessionIds: ReadonlySet<string>,
): boolean {
  if (!activeSessionId) return false;
  const sessionId = sessionIdFromParams(params);
  if (sessionId) return sessionId === activeSessionId;
  // Once more than one prompt is in flight, an unscoped chunk cannot be
  // attributed safely. Dropping it is preferable to showing another thread's
  // response in the active chat.
  return inFlightSessionIds.size === 1 && inFlightSessionIds.has(activeSessionId);
}

export function isActiveSessionLoad(
  loading: { sessionId: string; epoch: number } | null,
  activeSessionId: string | null,
  sessionEpoch: number,
): boolean {
  return Boolean(
    loading
    && loading.sessionId === activeSessionId
    && loading.epoch === sessionEpoch,
  );
}

function readId(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
