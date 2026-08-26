import assert from "node:assert/strict";
import { test } from "node:test";
import { applySessionUpdate, compactToolForTransport, createFold } from "../src/main/transcript.js";

function apply(fold: ReturnType<typeof createFold>, update: Record<string, unknown>): void {
  applySessionUpdate(fold, update, {
    nextId: (prefix) => `${prefix}-${fold.items.length + 1}`,
  });
}

test("removing a tool row keeps later tool updates attached to the right row", () => {
  const fold = createFold();
  apply(fold, { sessionUpdate: "tool_call", toolCallId: "first", title: "shell", status: "completed" });
  apply(fold, { sessionUpdate: "tool_call", toolCallId: "second", title: "shell", status: "pending" });

  // A tool can be reclassified as the plan writer when its update arrives.
  apply(fold, {
    sessionUpdate: "tool_call_update",
    toolCallId: "first",
    title: "Updating plan",
    rawInput: { todos: [{ id: "1", content: "Ship", status: "in_progress" }] },
  });
  apply(fold, { sessionUpdate: "tool_call_update", toolCallId: "second", status: "completed" });

  assert.equal(fold.items.filter((item) => item.kind === "tool").length, 1);
  const remaining = fold.items.find((item) => item.kind === "tool");
  assert.equal(remaining?.kind, "tool");
  assert.equal(remaining?.tool.toolCallId, "second");
  assert.equal(remaining?.tool.status, "completed");
});

test("completed tools drop payloads in the live fold so summaries stay compact", () => {
  const fold = createFold();
  apply(fold, {
    sessionUpdate: "tool_call",
    toolCallId: "read-1",
    title: "read_file",
    name: "read_file",
    status: "completed",
    rawInput: { target_file: "src/a.ts", contents: "x".repeat(4000) },
    rawOutput: "x".repeat(8000),
  });
  const item = fold.items.find((row) => row.kind === "tool");
  assert.equal(item?.kind, "tool");
  if (item?.kind !== "tool") return;
  assert.equal(item.tool.contentLoaded, false);
  assert.equal(item.tool.hasContent, true);
  assert.equal(item.tool.rawOutput, undefined);
  assert.equal((item.tool.rawInput as { target_file?: string }).target_file, "src/a.ts");
  assert.equal((item.tool.rawInput as { contents?: string }).contents, undefined);
});

test("running tools keep live payloads until they complete", () => {
  const fold = createFold();
  apply(fold, {
    sessionUpdate: "tool_call",
    toolCallId: "bash-1",
    title: "bash",
    name: "bash",
    status: "running",
    rawInput: { command: "ls" },
    rawOutput: "pending…",
  });
  const running = fold.items.find((row) => row.kind === "tool");
  assert.equal(running?.kind, "tool");
  if (running?.kind !== "tool") return;
  assert.equal(running.tool.rawOutput, "pending…");
  assert.notEqual(running.tool.contentLoaded, false);

  apply(fold, {
    sessionUpdate: "tool_call_update",
    toolCallId: "bash-1",
    status: "completed",
    rawOutput: "a.ts\nb.ts\n",
  });
  const done = fold.items.find((row) => row.kind === "tool");
  assert.equal(done?.kind, "tool");
  if (done?.kind !== "tool") return;
  assert.equal(done.tool.contentLoaded, false);
  assert.equal(done.tool.rawOutput, undefined);
  assert.equal(done.tool.hasContent, true);
});

test("compactToolForTransport keeps only label fields", () => {
  const compacted = compactToolForTransport({
    toolCallId: "edit-1",
    title: "search_replace",
    name: "search_replace",
    status: "completed",
    rawInput: { target_file: "src/b.ts", old_string: "a".repeat(200), new_string: "b".repeat(200) },
    rawOutput: "patched",
    diff: { path: "src/b.ts", oldText: "a", newText: "b" },
    meta: { huge: true },
  });
  assert.equal(compacted.contentLoaded, false);
  assert.equal(compacted.hasContent, true);
  assert.equal(compacted.rawOutput, undefined);
  assert.equal(compacted.diff, undefined);
  assert.equal(compacted.meta, undefined);
  assert.equal((compacted.rawInput as { target_file?: string }).target_file, "src/b.ts");
});
