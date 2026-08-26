import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_COMPOSER_DRAFTS,
  MAX_COMPOSER_DRAFT_CHARS,
  clipComposerDraft,
  composerDraftKey,
  putComposerDraft,
} from "../src/shared/composer-drafts.ts";

test("clipComposerDraft caps stored drafts", () => {
  assert.equal(clipComposerDraft("hello"), "hello");
  assert.equal(clipComposerDraft("x".repeat(MAX_COMPOSER_DRAFT_CHARS + 12)).length, MAX_COMPOSER_DRAFT_CHARS);
});

test("composerDraftKey uses a per-folder new-thread slot", () => {
  assert.equal(composerDraftKey("abc", "/proj", false), "abc");
  assert.equal(composerDraftKey("abc", "/proj", true), "new:/proj");
  assert.equal(composerDraftKey(null, "/proj", false), "new:/proj");
});

test("putComposerDraft drops empty text and evicts the oldest keys", () => {
  let map: Record<string, string> = {};
  for (let i = 0; i < MAX_COMPOSER_DRAFTS + 3; i += 1) {
    map = putComposerDraft(map, `s${i}`, `draft ${i}`);
  }
  assert.equal(Object.keys(map).length, MAX_COMPOSER_DRAFTS);
  assert.equal(map.s0, undefined);
  assert.equal(map.s3, "draft 3");
  map = putComposerDraft(map, "s3", "   ");
  assert.equal(map.s3, undefined);
});
