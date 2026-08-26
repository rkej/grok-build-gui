import assert from "node:assert/strict";
import { test } from "node:test";
import { groupSessionsByWorkspace, pinnedThreads } from "../src/renderer/workspace-groups.ts";
import type { SessionSummary } from "../src/shared/protocol.js";

const session = (partial: Partial<SessionSummary> & Pick<SessionSummary, "sessionId" | "cwd">): SessionSummary => ({
  title: partial.sessionId,
  summary: "",
  modelId: "grok-4",
  createdAt: null,
  updatedAt: "",
  numMessages: 0,
  activity: "idle",
  ...partial,
});

test("groupSessionsByWorkspace pins and archives per cwd", () => {
  const groups = groupSessionsByWorkspace(
    [
      session({ sessionId: "a", cwd: "/proj", pinned: true }),
      session({ sessionId: "b", cwd: "/proj" }),
      session({ sessionId: "c", cwd: "/proj", archived: true }),
      session({ sessionId: "d", cwd: "/other" }),
    ],
    "/proj",
    "/proj",
    ["/proj", "/other"],
  );
  assert.equal(groups[0]?.cwd, "/proj");
  assert.deepEqual(groups[0]?.pinned.map((row) => row.sessionId), ["a"]);
  assert.deepEqual(groups[0]?.active.map((row) => row.sessionId), ["b"]);
  assert.deepEqual(groups[0]?.archived.map((row) => row.sessionId), ["c"]);
  assert.equal(groups[1]?.cwd, "/other");
});

test("groupSessionsByWorkspace preserves workspace drag order", () => {
  const groups = groupSessionsByWorkspace(
    [
      session({ sessionId: "a", cwd: "/alpha" }),
      session({ sessionId: "b", cwd: "/beta" }),
    ],
    "/beta",
    "/alpha",
    ["/beta", "/alpha"],
  );
  assert.deepEqual(groups.map((group) => group.cwd), ["/beta", "/alpha"]);
});

test("child sessions appear as ordinary threads, not a nested worker list", () => {
  const groups = groupSessionsByWorkspace(
    [
      session({ sessionId: "parent", cwd: "/proj", title: "Orchestrator" }),
      session({ sessionId: "child", cwd: "/proj", parentSessionId: "parent", kind: "subagent", title: "Run tests" }),
    ],
    "/proj",
    "/proj",
    ["/proj"],
  );
  assert.deepEqual(groups[0]?.active.map((row) => row.sessionId), ["parent", "child"]);
});

test("pinnedThreads follows saved pin order", () => {
  const rows = pinnedThreads(
    [
      session({ sessionId: "a", cwd: "/proj", pinned: true, updatedAt: "2026-01-02" }),
      session({ sessionId: "b", cwd: "/proj", pinned: true, updatedAt: "2026-01-03" }),
      session({ sessionId: "c", cwd: "/other", pinned: true, updatedAt: "2026-01-04" }),
    ],
    ["c", "a", "b"],
  );
  assert.deepEqual(rows.map((row) => row.sessionId), ["c", "a", "b"]);
});
