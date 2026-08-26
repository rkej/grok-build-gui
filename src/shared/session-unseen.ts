import type { SessionActivity } from "./protocol";

export function sessionHasUnseenUpdate(input: {
  sessionId: string;
  activeSessionId: string | null;
  activity: SessionActivity;
  updatedAt?: string | null;
  lastSeen?: string;
}): boolean {
  if (input.sessionId === input.activeSessionId) return false;
  if (input.activity === "needs-input" || input.activity === "blocked") return true;
  if (!input.lastSeen || !input.updatedAt) return false;
  const updated = Date.parse(input.updatedAt);
  const seen = Date.parse(input.lastSeen);
  if (Number.isNaN(updated) || Number.isNaN(seen)) return false;
  return updated > seen;
}
