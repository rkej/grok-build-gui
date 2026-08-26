import assert from "node:assert/strict";
import { test } from "node:test";
import { isHttpUrl } from "../src/shared/url.js";

test("isHttpUrl allows http(s) only", () => {
  assert.equal(isHttpUrl("https://x.ai"), true);
  assert.equal(isHttpUrl("http://localhost:5178"), true);
  assert.equal(isHttpUrl("file:///etc/passwd"), false);
  assert.equal(isHttpUrl("javascript:alert(1)"), false);
  assert.equal(isHttpUrl("not a url"), false);
});
