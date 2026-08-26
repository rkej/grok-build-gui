import assert from "node:assert/strict";
import { test } from "node:test";
import { hasUnseenTimelineActivity, transcriptActivityKey } from "../src/renderer/timeline-activity.ts";
import type { TranscriptItem } from "../src/shared/protocol.ts";

const user = (id: string, text: string): TranscriptItem => ({ id, kind: "user", text, at: 1 });
const assistant = (id: string, text: string, streaming = false): TranscriptItem => ({
  id,
  kind: "assistant",
  text,
  at: 2,
  streaming,
});
const thought = (id: string, text: string, streaming = false): TranscriptItem => ({
  id,
  kind: "thought",
  text,
  at: 3,
  streaming,
});
const tool = (id: string, status: string, extra?: { title?: string; rawOutput?: unknown; content?: unknown }): TranscriptItem => ({
  id,
  kind: "tool",
  at: 4,
  tool: {
    toolCallId: id,
    title: extra?.title ?? "read_file",
    name: "read_file",
    status,
    rawOutput: extra?.rawOutput,
    content: extra?.content,
  },
});
const plan = (id: string, statuses: string[]): TranscriptItem => ({
  id,
  kind: "plan",
  at: 5,
  entries: statuses.map((status, index) => ({ id: `p${index}`, content: "step", status: status as "pending" | "in_progress" | "completed" })),
});

test("scrolling away from already-rendered rows is not unseen activity", () => {
  const key = transcriptActivityKey([user("u1", "hi"), assistant("a1", "hello")], false);
  assert.equal(hasUnseenTimelineActivity(true, key, key), false);
  assert.equal(hasUnseenTimelineActivity(false, key, key), false);
});

test("new messages after leaving the tail count as unseen activity", () => {
  const seen = transcriptActivityKey([user("u1", "hi")], false);
  const current = transcriptActivityKey([user("u1", "hi"), assistant("a1", "hello")], false);
  assert.notEqual(current, seen);
  assert.equal(hasUnseenTimelineActivity(false, current, seen), true);
  assert.equal(hasUnseenTimelineActivity(true, current, seen), false);
});

test("streaming text growth is an update even without a new row", () => {
  const seen = transcriptActivityKey([assistant("a1", "Hel", true)], true);
  const current = transcriptActivityKey([assistant("a1", "Hello", true)], true);
  assert.notEqual(current, seen);
  assert.equal(hasUnseenTimelineActivity(false, current, seen), true);
});

test("thought streaming is an update", () => {
  const seen = transcriptActivityKey([thought("h1", "think", true)], true);
  const current = transcriptActivityKey([thought("h1", "thinking more", true)], true);
  assert.notEqual(current, seen);
});

test("tool status and live output updates change the activity key", () => {
  const pending = transcriptActivityKey([tool("t1", "pending")], true);
  const running = transcriptActivityKey([tool("t1", "running")], true);
  const streamed = transcriptActivityKey([tool("t1", "running", { rawOutput: "partial…" })], true);
  const done = transcriptActivityKey([tool("t1", "completed")], false);
  assert.notEqual(pending, running);
  assert.notEqual(running, streamed);
  assert.notEqual(streamed, done);
});

test("plan progress changes the activity key", () => {
  const seen = transcriptActivityKey([plan("p1", ["in_progress", "pending"])], true);
  const current = transcriptActivityKey([plan("p1", ["completed", "in_progress"])], true);
  assert.notEqual(current, seen);
});

test("identical transcripts produce the same key", () => {
  const items: TranscriptItem[] = [
    user("u1", "fix it"),
    thought("h1", "ok"),
    tool("t1", "completed"),
    assistant("a1", "done"),
  ];
  assert.equal(transcriptActivityKey(items, false), transcriptActivityKey(items, false));
});

test("running state is part of the activity key", () => {
  const items = [user("u1", "go")];
  assert.notEqual(transcriptActivityKey(items, true), transcriptActivityKey(items, false));
});
