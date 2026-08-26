import assert from "node:assert/strict";
import { test } from "node:test";
import { moveSlashSelection, slashCommandKey, slashMenuItems, slashTabCompletion } from "../src/renderer/slash-completion.ts";

test("Tab completion chooses the first command shown in the slash menu", () => {
  const host = { name: "model", section: "host" as const };
  const runtime = { name: "my-skill", section: "runtime" as const };

  assert.equal(slashTabCompletion("/m", true, [host, runtime]), runtime);
  assert.equal(slashTabCompletion("/m", true, [host, runtime], slashCommandKey(host)), host);
});

test("slash command selection follows visible menu order and wraps", () => {
  const runtime = Array.from({ length: 10 }, (_, index) => ({ name: `skill-${index}`, section: "runtime" as const }));
  const host = { name: "model", section: "host" as const };
  const visible = slashMenuItems([host, ...runtime]);

  assert.deepEqual(visible.map((item) => item.name), [...runtime.slice(0, 8).map((item) => item.name), "model"]);
  assert.equal(moveSlashSelection([host, ...runtime], slashCommandKey(runtime[0]!), -1), host);
  assert.equal(moveSlashSelection([host, ...runtime], slashCommandKey(host), 1), runtime[0]);
});

test("Tab completion only applies to an open, single-token slash command", () => {
  const command = { name: "model", section: "host" as const };

  assert.equal(slashTabCompletion("/mod", false, [command]), undefined);
  assert.equal(slashTabCompletion("hello", true, [command]), undefined);
  assert.equal(slashTabCompletion("/model ", true, [command]), undefined);
  assert.equal(slashTabCompletion("/missing", true, []), undefined);
});
