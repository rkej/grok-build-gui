import assert from "node:assert/strict";
import { test } from "node:test";
import { rankFileMentions } from "../src/shared/file-mentions.ts";
import type { FileTreeNode } from "../src/shared/protocol.js";

const tree: FileTreeNode[] = [
  {
    name: "src",
    path: "src",
    type: "dir",
    children: [
      { name: "App.tsx", path: "src/renderer/App.tsx", type: "file" },
      { name: "application.ts", path: "src/main/application.ts", type: "file" },
    ],
  },
  { name: "README.md", path: "README.md", type: "file" },
];

test("file mentions rank basename matches before path and subsequence matches", () => {
  assert.deepEqual(rankFileMentions(tree, "app").map((row) => row.path), [
    "src/renderer/App.tsx",
    "src/main/application.ts",
  ]);
  assert.deepEqual(rankFileMentions(tree, "rdm").map((row) => row.path), ["README.md"]);
});

test("file mentions flatten directories and honor the result limit", () => {
  assert.deepEqual(rankFileMentions(tree, "", 2).map((row) => row.path), [
    "src/renderer/App.tsx",
    "src/main/application.ts",
  ]);
});
