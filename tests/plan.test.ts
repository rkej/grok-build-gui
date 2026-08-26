import assert from "node:assert/strict";
import { test } from "node:test";
import { mergePlanEntries, parsePlanEntries, planProgress } from "../src/shared/plan.js";

test("parsePlanEntries reads todo arrays and empty todos objects", () => {
  const entries = parsePlanEntries({
    todos: [
      { id: "1", content: "Explore", status: "completed" },
      { id: "2", content: "Ship", status: "in_progress" },
    ],
  });
  assert.equal(entries.length, 2);
  assert.equal(entries[0]?.status, "completed");
  assert.equal(entries[1]?.status, "in_progress");
  assert.deepEqual(parsePlanEntries({ todos: {} }), []);
});

test("mergePlanEntries updates by id when merge is true", () => {
  const current = parsePlanEntries([
    { id: "1", content: "Explore", status: "in_progress" },
    { id: "2", content: "Ship", status: "pending" },
  ]);
  const next = mergePlanEntries(current, parsePlanEntries([{ id: "1", content: "Explore", status: "completed" }]), true);
  assert.equal(next[0]?.status, "completed");
  assert.equal(next[1]?.status, "pending");
});

test("planProgress treats cancelled items as inactive", () => {
  const progress = planProgress(parsePlanEntries([
    { id: "1", content: "A", status: "completed" },
    { id: "2", content: "B", status: "cancelled" },
    { id: "3", content: "C", status: "in_progress" },
  ]));
  assert.equal(progress.total, 2);
  assert.equal(progress.done, 1);
  assert.equal(progress.cancelled, 1);
  assert.equal(progress.currentIndex, 2);
});
