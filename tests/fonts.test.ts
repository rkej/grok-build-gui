import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MONO_FONT_STACKS,
  UI_FONT_STACKS,
  parseFontScale,
  parseMonoFontId,
  parseUiFontId,
} from "../src/shared/fonts.ts";

test("font parsers fall back to system defaults", () => {
  assert.equal(parseUiFontId("inter"), "inter");
  assert.equal(parseUiFontId("comic-sans"), "system");
  assert.equal(parseMonoFontId("jetbrains"), "jetbrains");
  assert.equal(parseMonoFontId(""), "system");
  assert.equal(parseFontScale(110), 110);
  assert.equal(parseFontScale(12), 100);
});

test("font stacks always keep a generic fallback", () => {
  for (const stack of Object.values(UI_FONT_STACKS)) {
    assert.match(stack, /sans-serif|serif/);
  }
  for (const stack of Object.values(MONO_FONT_STACKS)) {
    assert.match(stack, /monospace/);
  }
});
