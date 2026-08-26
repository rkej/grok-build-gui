import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRelativeTime, formatRunningLabel } from "../src/renderer/string-utils.ts";

test("formatRelativeTime covers nearby buckets", () => {
  const now = Date.now();
  assert.equal(formatRelativeTime(new Date(now).toISOString()), "now");
  assert.equal(formatRelativeTime(new Date(now - 5 * 60_000).toISOString()), "5m");
  assert.equal(formatRelativeTime(new Date(now - 3 * 60 * 60_000).toISOString()), "3h");
  assert.equal(formatRelativeTime(""), "");
});

test("formatRunningLabel ticks in seconds then minutes", () => {
  assert.equal(formatRunningLabel(null), "Working…");
  assert.equal(formatRunningLabel(Date.now() - 12_000), "Working for 12s");
  assert.equal(formatRunningLabel(Date.now() - 125_000), "Working for 2m 5s");
});
