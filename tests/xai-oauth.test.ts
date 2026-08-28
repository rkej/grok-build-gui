import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { persistOidcTokens } from "../src/main/auth-file.js";
import {
  buildAuthorizeUrl,
  createPkce,
  emailFromIdToken,
  grokAuthScope,
  isLoopbackBindError,
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_REDIRECT_URI,
} from "../src/main/xai-oauth-core.js";

test("buildAuthorizeUrl uses PKCE S256 and the Grok CLI loopback redirect", () => {
  const url = new URL(buildAuthorizeUrl({ challenge: "abc", state: "st", nonce: "nn" }));
  assert.equal(url.origin, "https://auth.x.ai");
  assert.equal(url.searchParams.get("client_id"), XAI_OAUTH_CLIENT_ID);
  assert.equal(url.searchParams.get("redirect_uri"), XAI_OAUTH_REDIRECT_URI);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("code_challenge"), "abc");
  assert.equal(url.searchParams.get("plan"), "generic");
});

test("createPkce returns a verifier and matching challenge", () => {
  const pkce = createPkce();
  assert.ok(pkce.verifier.length > 20);
  assert.ok(pkce.challenge.length > 20);
  assert.notEqual(pkce.verifier, pkce.challenge);
});

test("emailFromIdToken reads an unsigned JWT payload", () => {
  const payload = Buffer.from(JSON.stringify({ email: "dev@x.ai" }), "utf8").toString("base64url");
  assert.equal(emailFromIdToken(`eyJhbGciOiJub25lIn0.${payload}.x`), "dev@x.ai");
  assert.equal(emailFromIdToken("not-a-jwt"), undefined);
});

test("isLoopbackBindError matches address-in-use failures", () => {
  assert.equal(isLoopbackBindError(Object.assign(new Error("listen"), { code: "EADDRINUSE" })), true);
  assert.equal(isLoopbackBindError(new Error("ACP timeout")), false);
});

test("persistOidcTokens merges into the Grok CLI auth.json slot", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gb-auth-"));
  const file = path.join(dir, "auth.json");
  writeFileSync(file, JSON.stringify({ other: { key: "keep-me" } }));
  persistOidcTokens(
    { accessToken: "access-1", refreshToken: "refresh-1", expiresIn: 120, email: "dev@x.ai" },
    file,
  );
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, { key?: string; email?: string; other?: string; auth_mode?: string }>;
  assert.equal(raw.other?.key, "keep-me");
  const entry = raw[grokAuthScope()];
  assert.equal(entry?.key, "access-1");
  assert.equal(entry?.email, "dev@x.ai");
  assert.equal(entry?.auth_mode, "oidc");
});
