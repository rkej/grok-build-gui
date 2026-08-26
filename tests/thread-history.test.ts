import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_THREAD_HISTORY,
  canNavigateThreadHistory,
  threadHistoryTarget,
  visitThread,
} from "../src/renderer/thread-history.js";

test("thread history records visits and ignores the current thread", () => {
  const first = visitThread(EMPTY_THREAD_HISTORY, "a");
  const second = visitThread(first, "b");

  assert.deepEqual(second, { entries: ["a", "b"], index: 1 });
  assert.equal(visitThread(second, "b"), second);
});

test("visiting a thread after going back replaces the forward branch", () => {
  const visited = visitThread(visitThread(visitThread(EMPTY_THREAD_HISTORY, "a"), "b"), "c");
  const back = threadHistoryTarget(visited, -1, new Set(["a", "b", "c"]));
  assert.ok(back);

  assert.deepEqual(visitThread(back.history, "d"), { entries: ["a", "b", "d"], index: 2 });
});

test("navigation skips sessions that are no longer available", () => {
  const visited = visitThread(visitThread(visitThread(EMPTY_THREAD_HISTORY, "a"), "deleted"), "c");
  const available = new Set(["a", "c"]);
  const back = threadHistoryTarget(visited, -1, available);

  assert.equal(back?.sessionId, "a");
  assert.equal(back?.history.index, 0);
  assert.equal(canNavigateThreadHistory(back!.history, -1, available), false);
  assert.equal(canNavigateThreadHistory(back!.history, 1, available), true);
});
