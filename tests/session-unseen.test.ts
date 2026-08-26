import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionHasUnseenUpdate } from "../src/shared/session-unseen.ts";

test("the active session is never unseen", () => {
  assert.equal(
    sessionHasUnseenUpdate({
      sessionId: "a",
      activeSessionId: "a",
      activity: "needs-input",
      updatedAt: "2026-01-02T00:00:00.000Z",
      lastSeen: "2026-01-01T00:00:00.000Z",
    }),
    false,
  );
});

test("needs-input and blocked threads show as unseen", () => {
  assert.equal(
    sessionHasUnseenUpdate({
      sessionId: "a",
      activeSessionId: "b",
      activity: "blocked",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }),
    true,
  );
});

test("idle threads are unseen only after an update past lastSeen", () => {
  assert.equal(
    sessionHasUnseenUpdate({
      sessionId: "a",
      activeSessionId: "b",
      activity: "idle",
      updatedAt: "2026-01-02T00:00:00.000Z",
    }),
    false,
  );
  assert.equal(
    sessionHasUnseenUpdate({
      sessionId: "a",
      activeSessionId: "b",
      activity: "idle",
      updatedAt: "2026-01-02T00:00:00.000Z",
      lastSeen: "2026-01-01T00:00:00.000Z",
    }),
    true,
  );
  assert.equal(
    sessionHasUnseenUpdate({
      sessionId: "a",
      activeSessionId: "b",
      activity: "idle",
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastSeen: "2026-01-02T00:00:00.000Z",
    }),
    false,
  );
});
