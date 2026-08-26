import assert from "node:assert/strict";
import { test } from "node:test";
import { pickAllowOption, shouldAutoApprove } from "../src/main/permissions.js";
import type { PermissionRequest } from "../src/shared/protocol.js";

const request = (title: string, name = title): PermissionRequest => ({
  requestId: 1,
  sessionId: "s",
  toolCall: { toolCallId: "t", title, status: "pending", name },
  options: [
    { optionId: "allow", name: "Allow", kind: "allow_once" },
    { optionId: "reject", name: "Reject", kind: "reject_once" },
  ],
});

test("pickAllowOption prefers always, then once", () => {
  assert.equal(pickAllowOption([{ optionId: "x", name: "Reject", kind: "reject_once" }, { optionId: "y", name: "Allow", kind: "allow_once" }]), "y");
  assert.equal(pickAllowOption([{ optionId: "a", name: "Always", kind: "allow_always" }, { optionId: "b", name: "Allow", kind: "allow_once" }]), "a");
});

test("shouldAutoApprove in auto mode allows read-ish tools only", () => {
  const auto = { yoloArmed: false, permissionMode: "auto" as const, currentModeId: "auto" };
  assert.equal(shouldAutoApprove(request("Read src/main.ts", "read"), auto), true);
  assert.equal(shouldAutoApprove(request("Edited src/main.ts", "write"), auto), false);
  assert.equal(shouldAutoApprove(request("Read src/main.ts", "read"), { yoloArmed: false, permissionMode: "ask", currentModeId: "ask" }), false);
  assert.equal(shouldAutoApprove(request("Edited src/main.ts", "write"), { yoloArmed: true, permissionMode: "always-approve", currentModeId: "yolo" }), true);
});
