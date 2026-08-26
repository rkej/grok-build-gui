import assert from "node:assert/strict";
import { test } from "node:test";
import { putLoadedToolRecord } from "../src/shared/loaded-tool-cache.ts";

test("putLoadedToolRecord evicts the oldest payloads past the cap", () => {
  let current: Record<string, number> = {};
  const evicted: string[] = [];
  for (let index = 1; index <= 10; index += 1) {
    const result = putLoadedToolRecord(current, String(index), index, 8);
    current = result.next;
    evicted.push(...result.evicted);
  }
  assert.deepEqual(Object.keys(current), ["3", "4", "5", "6", "7", "8", "9", "10"]);
  assert.deepEqual(evicted, ["1", "2"]);
});

test("putLoadedToolRecord refreshes an existing id as newest", () => {
  const first = putLoadedToolRecord({ a: 1, b: 2 }, "a", 11, 2);
  assert.deepEqual(Object.keys(first.next), ["b", "a"]);
  const second = putLoadedToolRecord(first.next, "c", 3, 2);
  assert.deepEqual(Object.keys(second.next), ["a", "c"]);
  assert.deepEqual(second.evicted, ["b"]);
});
