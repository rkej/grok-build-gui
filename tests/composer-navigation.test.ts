import assert from "node:assert/strict";
import { test } from "node:test";
import { composerEscapeAction, mentionCandidatePath, moveSelectionIndex } from "../src/renderer/composer-navigation.ts";

test("menu selection starts at an edge and wraps", () => {
  assert.equal(moveSelectionIndex(3, -1, 1), 0);
  assert.equal(moveSelectionIndex(3, -1, -1), 2);
  assert.equal(moveSelectionIndex(3, 2, 1), 0);
  assert.equal(moveSelectionIndex(3, 0, -1), 2);
  assert.equal(moveSelectionIndex(0, 0, 1), -1);
});

test("mention candidates resolve path, name, and scalar shapes", () => {
  assert.equal(mentionCandidatePath({ path: "src/App.tsx" }), "src/App.tsx");
  assert.equal(mentionCandidatePath({ name: "README.md" }), "README.md");
  assert.equal(mentionCandidatePath("package.json"), "package.json");
});

test("Escape dismisses foreground composer UI before cancelling underlying work", () => {
  assert.equal(composerEscapeAction({ uiOpen: true, editingQueuedMessage: true, running: true }), "dismiss-ui");
  assert.equal(composerEscapeAction({ uiOpen: false, editingQueuedMessage: true, running: true }), "cancel-edit");
  assert.equal(composerEscapeAction({ uiOpen: false, editingQueuedMessage: false, running: true }), "cancel-run");
  assert.equal(composerEscapeAction({ uiOpen: false, editingQueuedMessage: false, running: false }), "none");
});
