import assert from "node:assert/strict";
import { test } from "node:test";
import { AgentTerminalManager } from "../src/main/agent-terminals.ts";

test("agent terminals execute commands and expose output and exit status", async () => {
  const manager = new AgentTerminalManager();
  const { terminalId } = manager.create(
    {
      sessionId: "session-1",
      command: process.execPath,
      args: ["-e", "process.stdout.write('shell-ok')"],
    },
    process.cwd(),
  );

  const exit = await manager.waitForExit(terminalId);
  const output = manager.output(terminalId);
  manager.release(terminalId);

  assert.deepEqual(exit, { exitCode: 0, signal: null });
  assert.equal(output.output, "shell-ok");
  assert.deepEqual(output.exitStatus, exit);
});

test("agent terminal output stays within the requested byte limit", async () => {
  const manager = new AgentTerminalManager();
  const { terminalId } = manager.create(
    {
      sessionId: "session-2",
      command: process.execPath,
      args: ["-e", "process.stdout.write('0123456789')"],
      outputByteLimit: 4,
    },
    process.cwd(),
  );

  await manager.waitForExit(terminalId);
  const output = manager.output(terminalId);
  manager.release(terminalId);

  assert.equal(output.output, "6789");
  assert.equal(output.truncated, true);
});
