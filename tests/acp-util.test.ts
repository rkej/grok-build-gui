import assert from "node:assert/strict";
import { test } from "node:test";
import { asArray, unwrap } from "../src/shared/acp-util.js";

test("unwrap peels a result envelope", () => {
  assert.equal(unwrap({ result: 3 }), 3);
  assert.deepEqual(unwrap({ sessionId: "a" }), { sessionId: "a" });
});

test("asArray returns empty for non-arrays", () => {
  assert.deepEqual(asArray([1, 2]), [1, 2]);
  assert.deepEqual(asArray(null), []);
  assert.deepEqual(asArray({}), []);
});
