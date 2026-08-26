import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { resolveInside } from "../src/shared/workspace-path.js";

const root = path.resolve("/tmp/workspace-path-root");

test("resolveInside allows files inside the workspace", () => {
  assert.equal(resolveInside(root, "src/main.ts"), path.join(root, "src/main.ts"));
  assert.equal(resolveInside(root, root), root);
});

test("resolveInside rejects path traversal and siblings", () => {
  assert.equal(resolveInside(root, "../etc/passwd"), null);
  assert.equal(resolveInside(root, path.join(root, "..", "other")), null);
  assert.equal(resolveInside("", "src/main.ts"), null);
});
