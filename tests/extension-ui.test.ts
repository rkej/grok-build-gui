import assert from "node:assert/strict";
import { test } from "node:test";
import { parseExtensionDialog } from "../src/main/extension-ui.ts";
import { parentIdFromSessionRow } from "../src/main/session-parent.ts";

test("parseExtensionDialog maps confirm/select/input/editor kinds", () => {
  assert.deepEqual(parseExtensionDialog("session/ui", 1, { kind: "confirm", title: "Go?", message: "Proceed" }), {
    kind: "confirm",
    requestId: 1,
    title: "Go?",
    message: "Proceed",
  });
  assert.deepEqual(parseExtensionDialog("_x.ai/host_ui", 2, { kind: "select", title: "Pick", options: ["a", { name: "b" }] }), {
    kind: "select",
    requestId: 2,
    title: "Pick",
    options: ["a", "b"],
  });
  assert.equal(parseExtensionDialog("elicitation/create", 3, { title: "Name", placeholder: "repo" })?.kind, "input");
  assert.equal(parseExtensionDialog("session/request_ui", 4, { multiline: true, initialValue: "notes" })?.kind, "editor");
});

test("parseExtensionDialog ignores unrelated ACP requests", () => {
  assert.equal(parseExtensionDialog("fs/read_text_file", 9, { path: "/tmp/x" }), null);
});

test("parentIdFromSessionRow reads grok session meta shapes", () => {
  assert.equal(parentIdFromSessionRow({ parentSessionId: "p1" }), "p1");
  assert.equal(parentIdFromSessionRow({ _meta: { "x.ai/session": { parent_session_id: "p2" } } }), "p2");
  assert.equal(parentIdFromSessionRow({ title: "plain" }), undefined);
});
