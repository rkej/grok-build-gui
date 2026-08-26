import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldApplySnapshot } from "../src/shared/snapshot-order.ts";

test("snapshot revisions reject stale updates within one main-process instance", () => {
  assert.equal(shouldApplySnapshot({ instanceId: "a", rev: 5 }, { instanceId: "a", rev: 4 }), false);
  assert.equal(shouldApplySnapshot({ instanceId: "a", rev: 5 }, { instanceId: "a", rev: 5 }), true);
});

test("snapshot revisions reset when the main-process store restarts", () => {
  assert.equal(shouldApplySnapshot({ instanceId: "old", rev: 99 }, { instanceId: "new", rev: 1 }), true);
});
