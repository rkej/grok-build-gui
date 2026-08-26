import assert from "node:assert/strict";
import { test } from "node:test";
import { activityFromLive, resolveSessionActivity } from "../src/main/session-meta.ts";

test("session activity accepts server running aliases", () => {
  assert.equal(activityFromLive({ activity: "working" }), "working");
  assert.equal(activityFromLive({ status: "running" }), "working");
  assert.equal(activityFromLive({ state: "in_progress" }), "working");
});

test("session activity survives navigation and prefers newer live state", () => {
  assert.equal(resolveSessionActivity({ activity: "working" }, undefined), "working");
  assert.equal(resolveSessionActivity({ activity: "working" }, { activity: "completed" }), "completed");
  assert.equal(resolveSessionActivity({ activity: "completed" }, undefined, true), "working");
});

test("session activity keeps working when live upserts omit or idle the status", () => {
  assert.equal(
    resolveSessionActivity({ activity: "working" }, { sessionId: "abc", title: "Thread" }),
    "working",
  );
  assert.equal(
    resolveSessionActivity({ status: "running" }, { activity: "idle" }),
    "working",
  );
  assert.equal(
    resolveSessionActivity({ activity: "idle" }, { activity: "working" }),
    "working",
  );
});
