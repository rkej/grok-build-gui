import assert from "node:assert/strict";
import { test } from "node:test";
import { parseContextUsage } from "../src/main/usage.js";

test("parseContextUsage reads used/total and clamps percent", () => {
  const usage = parseContextUsage({ used: 250, total: 1000 });
  assert.equal(usage?.used, 250);
  assert.equal(usage?.total, 1000);
  assert.equal(usage?.usagePct, 25);
  assert.equal(usage?.remaining, 750);
  assert.equal(parseContextUsage({ hello: true }), null);
});
