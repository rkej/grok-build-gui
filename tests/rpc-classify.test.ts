import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyMessage } from "../src/acp/rpc.js";

test("classifyMessage distinguishes response, server request, and notification", () => {
  assert.equal(classifyMessage({ jsonrpc: "2.0", id: 1, result: {} }), "response");
  assert.equal(classifyMessage({ jsonrpc: "2.0", id: 1, error: { code: -1, message: "no" } }), "response");
  assert.equal(classifyMessage({ jsonrpc: "2.0", id: 2, method: "session/request_permission", params: {} }), "server-request");
  assert.equal(classifyMessage({ jsonrpc: "2.0", method: "session/update", params: {} }), "notification");
  assert.equal(classifyMessage({ jsonrpc: "2.0", id: 3 }), "invalid");
});
