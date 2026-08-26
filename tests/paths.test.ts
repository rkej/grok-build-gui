import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { posixPathWithDefaults } from "../src/main/paths.ts";

test("posixPathWithDefaults prepends grok and Homebrew bins", () => {
  const home = "/Users/demo";
  const next = posixPathWithDefaults("/usr/bin:/bin", home, "darwin");
  assert.equal(next.changed, true);
  assert.equal(
    next.path,
    ["/Users/demo/.grok/bin", "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(path.delimiter),
  );
});

test("posixPathWithDefaults is a no-op when extras are already first", () => {
  const home = "/Users/demo";
  const current = ["/Users/demo/.grok/bin", "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"].join(path.delimiter);
  const next = posixPathWithDefaults(current, home, "darwin");
  assert.equal(next.changed, false);
  assert.equal(next.path, current);
});

test("posixPathWithDefaults leaves Windows PATH alone", () => {
  const next = posixPathWithDefaults("C:\\Windows", "C:\\Users\\demo", "win32");
  assert.equal(next.changed, false);
  assert.equal(next.path, "C:\\Windows");
});
