import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { sessionUpdateFileAppearsWorking, turnBoundaryFromUpdateLine } from "../src/main/session-running.js";

function update(sessionUpdate: string): string {
  return JSON.stringify({ method: "session/update", params: { update: { sessionUpdate } } });
}

test("turn boundaries ignore tool output and recognize starts and finishes", () => {
  assert.equal(turnBoundaryFromUpdateLine(update("user_message_chunk")), "started");
  assert.equal(turnBoundaryFromUpdateLine(update("turn_completed")), "finished");
  assert.equal(turnBoundaryFromUpdateLine(update("response_completed")), "finished");
  assert.equal(turnBoundaryFromUpdateLine(update("tool_call_update")), null);
});

test("an unfinished persisted turn is treated as cross-process activity", (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "grok-session-running-"));
  t.after(() => rmSync(dir, { recursive: true }));
  const file = path.join(dir, "updates.jsonl");
  writeFileSync(file, [update("turn_completed"), update("user_message_chunk"), update("tool_call_update")].join("\n"));
  assert.equal(sessionUpdateFileAppearsWorking(file), true);

  writeFileSync(file, [update("user_message_chunk"), update("agent_message_chunk"), update("turn_completed")].join("\n"));
  assert.equal(sessionUpdateFileAppearsWorking(file), false);
});
