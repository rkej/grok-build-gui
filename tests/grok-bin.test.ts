import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { grokBinCandidates, resolveGrokBin } from "../src/acp/client.js";
import { isMissingGrokBinary } from "../src/main/grok-cli.js";

test("grokBinCandidates prefers GROK_BIN and ~/.grok/bin", () => {
  const home = "/Users/demo";
  const env = { GROK_BIN: "/opt/custom/grok", PATH: "/usr/bin:/bin" };
  const candidates = grokBinCandidates(env, home, "darwin");
  assert.equal(candidates[0], "/opt/custom/grok");
  assert.ok(candidates.includes(path.join(home, ".grok", "bin", "grok")));
  assert.ok(candidates.includes(path.join("/usr/bin", "grok")));
});

test("resolveGrokBin returns null when nothing exists", () => {
  assert.equal(resolveGrokBin({}, "/missing", "darwin", () => false), null);
});

test("resolveGrokBin returns the first existing candidate", () => {
  const found = resolveGrokBin(
    { PATH: "/usr/bin" },
    "/Users/demo",
    "darwin",
    (file) => file === "/usr/bin/grok",
  );
  assert.equal(found, "/usr/bin/grok");
});

test("isMissingGrokBinary matches spawn ENOENT", () => {
  assert.equal(isMissingGrokBinary(Object.assign(new Error("spawn grok ENOENT"), { code: "ENOENT" })), true);
  assert.equal(isMissingGrokBinary(new Error("Grok CLI is not installed.")), true);
  assert.equal(isMissingGrokBinary(new Error("ACP timeout")), false);
});
