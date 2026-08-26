import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authFromAuthenticateResult,
  isAuthError,
  parseGrokLoginOutput,
  signedOutAuth,
} from "../src/shared/auth.js";

test("isAuthError matches ACP and HTTP auth failures", () => {
  assert.equal(isAuthError({ code: 401, message: "nope" }), true);
  assert.equal(isAuthError(Object.assign(new Error("Authentication required"), { code: -32000 })), true);
  assert.equal(isAuthError(new Error("auth_required")), true);
  assert.equal(isAuthError({ message: "session/new", data: { reason: "unauthenticated" } }), true);
  assert.equal(isAuthError(new Error("ACP timeout: session/prompt")), false);
  assert.equal(isAuthError(new Error("ENOENT")), false);
});

test("parseGrokLoginOutput prefers the auth URL and device code", () => {
  const parsed = parseGrokLoginOutput(
    "Opening browser...\nIf it did not open, visit https://auth.x.ai/device\nEnter code: ABCD-1234\n",
  );
  assert.equal(parsed.url, "https://auth.x.ai/device");
  assert.equal(parsed.deviceCode, "ABCD-1234");
  assert.equal(parseGrokLoginOutput("see https://example.com/docs.").url, "https://example.com/docs");
  assert.equal(parseGrokLoginOutput("javascript:alert(1)").url, undefined);
});

test("authFromAuthenticateResult reads _meta fields", () => {
  const auth = authFromAuthenticateResult(
    { _meta: { email: "dev@x.ai", team_name: "xAI", subscription_tier: "SuperGrok" } },
    "cached_token",
  );
  assert.equal(auth.authenticated, true);
  assert.equal(auth.email, "dev@x.ai");
  assert.equal(auth.teamName, "xAI");
  assert.equal(auth.subscriptionTier, "SuperGrok");
  assert.equal(auth.methodId, "cached_token");
});

test("signedOutAuth always clears authenticated", () => {
  const auth = signedOutAuth({ authenticated: true, signingIn: true, error: "nope" });
  assert.equal(auth.authenticated, false);
  assert.equal(auth.signingIn, true);
  assert.equal(auth.error, "nope");
});
