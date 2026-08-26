import assert from "node:assert/strict";
import { test } from "node:test";
import { canSettleSessionFromNotification, isActiveSessionLoad, isForActiveSession, sessionIdFromParams } from "../src/main/session-scope.js";

test("sessionIdFromParams reads top-level, nested update, and _meta", () => {
  assert.equal(sessionIdFromParams({ sessionId: "a" }), "a");
  assert.equal(sessionIdFromParams({ session_id: "b" }), "b");
  assert.equal(sessionIdFromParams({ update: { sessionId: "c" } }), "c");
  assert.equal(sessionIdFromParams({ _meta: { sessionId: "d" } }), "d");
  assert.equal(sessionIdFromParams({ update: { sessionUpdate: "agent_message_chunk" } }), null);
});

test("isForActiveSession drops updates for another thread", () => {
  const inFlight = new Set(["a"]);
  assert.equal(isForActiveSession({ sessionId: "a" }, "a", inFlight), true);
  assert.equal(isForActiveSession({ sessionId: "b" }, "a", inFlight), false);
  assert.equal(isForActiveSession({ sessionId: "a" }, null, inFlight), false);
});

test("unscoped updates only apply while the active thread is in-flight", () => {
  const inFlight = new Set(["a"]);
  assert.equal(isForActiveSession({ update: { sessionUpdate: "agent_message_chunk" } }, "a", inFlight), true);
  assert.equal(isForActiveSession({ update: { sessionUpdate: "agent_message_chunk" } }, "b", inFlight), false);
  assert.equal(isForActiveSession({}, "a", new Set()), false);
  assert.equal(isForActiveSession({}, "a", new Set(["a", "b"])), false);
});

test("session load replay is suppressed only for the current thread epoch", () => {
  const loading = { sessionId: "a", epoch: 4 };
  assert.equal(isActiveSessionLoad(loading, "a", 4), true);
  assert.equal(isActiveSessionLoad(loading, "b", 4), false);
  assert.equal(isActiveSessionLoad(loading, "a", 5), false);
  assert.equal(isActiveSessionLoad(null, "a", 4), false);
});

test("turn completion cannot settle a prompt whose request is still in flight", () => {
  const inFlight = new Set(["a"]);
  assert.equal(canSettleSessionFromNotification("a", inFlight), false);
  assert.equal(canSettleSessionFromNotification("b", inFlight), true);
  assert.equal(canSettleSessionFromNotification(null, inFlight), false);
});
