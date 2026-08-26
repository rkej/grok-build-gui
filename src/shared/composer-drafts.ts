export const MAX_COMPOSER_DRAFT_CHARS = 20_000;
export const MAX_COMPOSER_DRAFTS = 40;

export function clipComposerDraft(text: string): string {
  if (text.length <= MAX_COMPOSER_DRAFT_CHARS) return text;
  return text.slice(0, MAX_COMPOSER_DRAFT_CHARS);
}

export function composerDraftKey(
  sessionId: string | null | undefined,
  cwd: string,
  isNewThread: boolean,
): string {
  if (isNewThread || !sessionId) return `new:${cwd || "none"}`;
  return sessionId;
}

export function putComposerDraft(
  map: Record<string, string> | undefined,
  key: string,
  text: string,
): Record<string, string> {
  const next = { ...(map ?? {}) };
  const clipped = clipComposerDraft(text);
  if (!clipped.trim()) {
    delete next[key];
    return next;
  }
  delete next[key];
  next[key] = clipped;
  const keys = Object.keys(next);
  const extra = keys.length - MAX_COMPOSER_DRAFTS;
  if (extra > 0) {
    for (const id of keys.slice(0, extra)) delete next[id];
  }
  return next;
}
