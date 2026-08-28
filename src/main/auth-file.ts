import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { authPath, grokHome } from "./paths.js";
import { grokAuthScope, type XaiOAuthTokens, XAI_OAUTH_CLIENT_ID, XAI_OAUTH_ISSUER } from "./xai-oauth-core.js";

type AuthEntry = {
  key?: string;
  email?: string;
  expires_at?: string;
  auth_mode?: string;
  refresh_token?: string;
  oidc_issuer?: string;
  oidc_client_id?: string;
  create_time?: string;
  [key: string]: unknown;
};

type AuthFile = Record<string, AuthEntry>;

function readAuthFile(file: string): AuthFile {
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as AuthFile;
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

/** Merge OIDC tokens into Grok CLI's ~/.grok/auth.json (0600). */
export function persistOidcTokens(tokens: XaiOAuthTokens, file = authPath()): void {
  mkdirSync(dirname(file) || grokHome(), { recursive: true });
  const scope = grokAuthScope();
  const current = readAuthFile(file);
  const previous = current[scope] ?? {};
  const expiresIn = tokens.expiresIn && tokens.expiresIn > 0 ? tokens.expiresIn : 3600;
  current[scope] = {
    ...previous,
    auth_mode: "oidc",
    key: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? previous.refresh_token,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    oidc_issuer: XAI_OAUTH_ISSUER,
    oidc_client_id: XAI_OAUTH_CLIENT_ID,
    email: tokens.email ?? previous.email,
    create_time: typeof previous.create_time === "string" ? previous.create_time : new Date().toISOString(),
  };
  writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(file, 0o600);
  } catch {
    // Best-effort on filesystems that ignore mode.
  }
}
