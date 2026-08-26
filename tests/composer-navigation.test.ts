import assert from "node:assert/strict";
import { test } from "node:test";
import { mentionCandidatePath, moveSelectionIndex } from "../src/renderer/composer-navigation.ts";

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
