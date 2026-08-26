import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  clampSidebarWidth,
} from "../src/shared/layout.ts";

test("clampSidebarWidth keeps the default in range", () => {
  assert.equal(clampSidebarWidth(DEFAULT_SIDEBAR_WIDTH), DEFAULT_SIDEBAR_WIDTH);
});

test("clampSidebarWidth enforces min and max", () => {
  assert.equal(clampSidebarWidth(40), MIN_SIDEBAR_WIDTH);
  assert.equal(clampSidebarWidth(900, 1600), MAX_SIDEBAR_WIDTH);
});

test("clampSidebarWidth caps against a narrow viewport", () => {
  assert.equal(clampSidebarWidth(480, 600), Math.round(600 * 0.45));
});

test("clampSidebarWidth treats invalid numbers as the default", () => {
  assert.equal(clampSidebarWidth(Number.NaN), DEFAULT_SIDEBAR_WIDTH);
});
