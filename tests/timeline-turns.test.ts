import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDisplayTimelineItems, flattenDisplayItems, summarizeToolActions } from "../src/renderer/timeline-turns.ts";
import type { ToolCallState, TranscriptItem } from "../src/shared/protocol.js";

const tool = (id: string, name: string, status = "completed"): Extract<TranscriptItem, { kind: "tool" }> => ({
  id,
  kind: "tool",
  at: 1_000,
  tool: {
    toolCallId: id,
    title: name,
    name,
    status,
  } satisfies ToolCallState,
});

test("summarizeToolActions keeps mixed singleton actions on one line", () => {
  const summary = summarizeToolActions([
    { toolCallId: "1", title: "read", name: "read_file", status: "completed", rawInput: { target_file: "src/a.ts" } },
    { toolCallId: "2", title: "edit", name: "search_replace", status: "completed", rawInput: { target_file: "src/b.ts" } },
  ]);
  assert.equal(summary, "Read src/a.ts · Edited src/b.ts");
});

test("summarizeToolActions counts longer runs", () => {
  const tools: ToolCallState[] = Array.from({ length: 5 }, (_, index) => ({
    toolCallId: String(index),
    title: "read",
    name: "read_file",
    status: "completed",
    rawInput: { target_file: `src/${index}.ts` },
  }));
  assert.equal(summarizeToolActions(tools), "Read 5 files");
});

test("buildDisplayTimelineItems groups consecutive completed tools", () => {
  const items = buildDisplayTimelineItems([
    { id: "u1", kind: "user", text: "fix it", at: 0 },
    tool("t1", "read_file"),
    tool("t2", "search_replace"),
    tool("t3", "bash"),
    { id: "a1", kind: "assistant", text: "done", at: 2_000 },
  ]);
  const group = items.find((item) => item.kind === "tool-group");
  assert.equal(group?.kind, "tool-group");
  if (group?.kind !== "tool-group") return;
  assert.equal(group.tools.length, 3);
  assert.match(group.summary, /Read|Edited|Ran/);
  assert.ok(group.buckets.length >= 2);
});

test("tool groups nest same-kind actions under bucket summaries", () => {
  const items = buildDisplayTimelineItems([
    tool("t1", "read_file"),
    tool("t2", "read_file"),
    tool("t3", "read_file"),
    tool("t4", "search_replace"),
    tool("t5", "bash"),
  ]);
  const group = items.find((item) => item.kind === "tool-group");
  assert.equal(group?.kind, "tool-group");
  if (group?.kind !== "tool-group") return;
  const read = group.buckets.find((bucket) => bucket.bucket === "read");
  assert.equal(read?.summary, "Read 3 files");
  assert.equal(read?.tools.length, 3);
});

test("live tools stay ungrouped so the current action remains visible", () => {
  const items = buildDisplayTimelineItems([
    tool("t1", "read_file"),
    tool("t2", "bash", "running"),
  ]);
  assert.equal(items[0]?.kind, "tool");
  assert.equal(items[1]?.kind, "tool");
});

test("flattenDisplayItems keeps collapsed summaries as a single row", () => {
  const items = buildDisplayTimelineItems([
    tool("t1", "read_file"),
    tool("t2", "read_file"),
    tool("t3", "search_replace"),
    tool("t4", "search_replace"),
    tool("t5", "bash"),
  ]);
  const group = items.find((item) => item.kind === "tool-group");
  assert.equal(group?.kind, "tool-group");
  if (group?.kind !== "tool-group") return;
  const collapsed = flattenDisplayItems(items, {}, {});
  assert.equal(collapsed.filter((item) => item.kind === "tool").length, 0);
  assert.equal(collapsed.filter((item) => item.kind === "tool-group").length, 1);
  assert.equal(collapsed.filter((item) => item.kind === "tool-bucket").length, 0);
});

test("flattenDisplayItems expands groups into virtualized sibling rows", () => {
  const items = buildDisplayTimelineItems([
    tool("t1", "read_file"),
    tool("t2", "read_file"),
    tool("t3", "search_replace"),
    tool("t4", "search_replace"),
    tool("t5", "bash"),
  ]);
  const group = items.find((item) => item.kind === "tool-group");
  assert.equal(group?.kind, "tool-group");
  if (group?.kind !== "tool-group") return;
  const expanded = flattenDisplayItems(items, { [group.id]: true }, {});
  assert.ok(expanded.some((item) => item.kind === "tool-group"));
  assert.ok(expanded.some((item) => item.kind === "tool-bucket"));
  assert.equal(expanded.filter((item) => item.kind === "tool" && item.indent === 1).length, 1);

  const read = group.buckets.find((bucket) => bucket.bucket === "read");
  assert.ok(read);
  const nested = flattenDisplayItems(items, { [group.id]: true }, { [read!.id]: true });
  assert.equal(nested.filter((item) => item.kind === "tool" && item.indent === 2).length, 2);
});
