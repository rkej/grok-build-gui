import assert from "node:assert/strict";
import test from "node:test";
import { formatMessageTimestamp } from "../src/renderer/string-utils.ts";

test("formats a same-day message as a clock time", () => {
  const now = new Date(2026, 7, 26, 15, 4, 0).getTime();
  const at = new Date(2026, 7, 26, 9, 30, 0).getTime();
  assert.equal(
    formatMessageTimestamp(at, now),
    new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(at)),
  );
});

test("includes the date for messages on another day this year", () => {
  const now = new Date(2026, 7, 26, 15, 4, 0).getTime();
  const at = new Date(2026, 7, 20, 9, 30, 0).getTime();
  const formatted = formatMessageTimestamp(at, now);
  assert.match(formatted, /20/);
  assert.equal(formatted.includes("2026"), false);
});

test("includes the year for messages from another year", () => {
  const now = new Date(2026, 7, 26, 15, 4, 0).getTime();
  const at = new Date(2025, 7, 20, 9, 30, 0).getTime();
  assert.match(formatMessageTimestamp(at, now), /2025/);
});

test("returns an empty string for missing timestamps", () => {
  assert.equal(formatMessageTimestamp(0), "");
  assert.equal(formatMessageTimestamp(Number.NaN), "");
});
