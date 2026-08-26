import assert from "node:assert/strict";
import { test } from "node:test";
import { slashTabCompletion } from "../src/renderer/slash-completion.ts";

test("Tab completion chooses the first command shown in the slash menu", () => {
  const host = { name: "model", section: "host" as const };
  const runtime = { name: "my-skill", section: "runtime" as const };

  assert.equal(slashTabCompletion("/m", true, [host, runtime]), runtime);
});

test("Tab completion only applies to an open, single-token slash command", () => {
  const command = { name: "model", section: "host" as const };

  assert.equal(slashTabCompletion("/mod", false, [command]), undefined);
  assert.equal(slashTabCompletion("hello", true, [command]), undefined);
  assert.equal(slashTabCompletion("/model ", true, [command]), undefined);
  assert.equal(slashTabCompletion("/missing", true, []), undefined);
});
