import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSlashCommands } from "../src/main/session-meta.ts";
import {
  grokSlashItems,
  moveSlashSelection,
  slashCommandKey,
  slashMenuItems,
  slashTabCompletion,
} from "../src/renderer/slash-completion.ts";

test("Tab completion chooses the first command shown in the slash menu", () => {
  const compact = { name: "compact", section: "host" as const };
  const workflow = { name: "workflow", section: "host" as const };

  assert.equal(slashTabCompletion("/w", true, [compact, workflow]), compact);
  assert.equal(slashTabCompletion("/w", true, [compact, workflow], slashCommandKey(workflow)), workflow);
});

test("slash command selection follows advertised order and wraps", () => {
  const commands = [
    { name: "compact", section: "host" as const },
    { name: "context", section: "host" as const },
    { name: "workflow", section: "host" as const },
  ];
  const visible = slashMenuItems(commands);

  assert.deepEqual(visible.map((item) => item.name), ["compact", "context", "workflow"]);
  assert.equal(moveSlashSelection(commands, slashCommandKey(commands[0]!), -1), commands[2]);
  assert.equal(moveSlashSelection(commands, slashCommandKey(commands[2]!), 1), commands[0]);
});

test("Tab completion only applies to an open, single-token slash command", () => {
  const command = { name: "compact", section: "host" as const };

  assert.equal(slashTabCompletion("/mod", false, [command]), undefined);
  assert.equal(slashTabCompletion("hello", true, [command]), undefined);
  assert.equal(slashTabCompletion("/compact ", true, [command]), undefined);
  assert.equal(slashTabCompletion("/missing", true, []), undefined);
});

test("slash menu lists only Grok-advertised commands", () => {
  const items = grokSlashItems({
    commands: [
      { name: "compact", description: "Compress conversation history" },
      { name: "/context", description: "Show context usage" },
      { name: "compact", description: "duplicate" },
      { name: "", description: "ignored" },
    ],
    skills: [
      { name: "review", description: "Review the diff", slashCommand: "/review", enabled: true, userInvocable: true },
    ],
  });

  assert.deepEqual(items.map((item) => item.name), ["compact", "context"]);
  assert.equal(items.some((item) => item.name === "review" || item.name === "new" || item.name === "mcp"), false);
});

test("advertised skills keep a skill badge, extra local skills stay out of the menu", () => {
  const items = grokSlashItems({
    commands: [
      { name: "compact", description: "Compress conversation history" },
      { name: "review", description: "Review the current diff" },
    ],
    skills: [
      { name: "review", slashCommand: "/review", enabled: true, userInvocable: true },
      { name: "local-only", slashCommand: "/local-only", enabled: true, userInvocable: true },
    ],
  });

  assert.deepEqual(
    items.map((item) => ({ name: item.name, section: item.section })),
    [
      { name: "compact", section: "host" },
      { name: "review", section: "runtime" },
    ],
  );
});

test("parseSlashCommands keeps Grok ACP command names and hints", () => {
  const commands = parseSlashCommands([
    { name: "/compact", description: "Compress history", input: { hint: "optional context" } },
    { name: "always-approve", description: "Toggle always-approve" },
    { name: "compact", description: "duplicate" },
    { description: "missing name" },
  ]);

  assert.deepEqual(
    commands.map((command) => ({ name: command.name, hint: command.input?.hint ?? null })),
    [
      { name: "compact", hint: "optional context" },
      { name: "always-approve", hint: null },
    ],
  );
});
