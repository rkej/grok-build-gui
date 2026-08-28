import { createHash, randomBytes } from "node:crypto";

/** Public Grok CLI OAuth client. Not a secret; xAI allowlists this id for loopback PKCE. */
export const XAI_OAUTH_CLIENT_ID =
  process.env.GROK_OAUTH_CLIENT_ID?.trim() || "b1a00492-073a-47ea-816f-4c329264a828";
export const XAI_OAUTH_ISSUER = "https://auth.x.ai";
export const XAI_AUTHORIZE_URL = `${XAI_OAUTH_ISSUER}/oauth2/authorize`;
export const XAI_TOKEN_URL = `${XAI_OAUTH_ISSUER}/oauth2/token`;
export const XAI_DEVICE_CODE_URL = `${XAI_OAUTH_ISSUER}/oauth2/device/code`;
export const XAI_USERINFO_URL = `${XAI_OAUTH_ISSUER}/oauth2/userinfo`;
export const XAI_DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
export const XAI_OAUTH_SCOPE = "openid profile email offline_access grok-cli:access api:access";
export const XAI_OAUTH_HOST = "127.0.0.1";
export const XAI_OAUTH_PORT = 56121;
export const XAI_OAUTH_REDIRECT_PATH = "/callback";
export const XAI_OAUTH_REDIRECT_URI = `http://${XAI_OAUTH_HOST}:${XAI_OAUTH_PORT}${XAI_OAUTH_REDIRECT_PATH}`;
export const XAI_OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

export type XaiOAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  email?: string;
};

export type XaiOAuthProgress = {
  loginUrl?: string;
  deviceCode?: string;
};

export function grokAuthScope(clientId = XAI_OAUTH_CLIENT_ID, issuer = XAI_OAUTH_ISSUER): string {
  return `${issuer}::${clientId}`;
}

export function base64Url(bytes: Buffer | Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function emailFromIdToken(idToken: string | undefined): string | undefined {
  if (!idToken) return undefined;
  const parts = idToken.split(".");
  if (parts.length < 2 || !parts[1]) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { email?: unknown };
    return typeof payload.email === "string" ? payload.email : undefined;
  } catch {
    return undefined;
  }
}

export function buildAuthorizeUrl(input: {
  challenge: string;
  state: string;
  nonce: string;
  clientId?: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId ?? XAI_OAUTH_CLIENT_ID,
    redirect_uri: XAI_OAUTH_REDIRECT_URI,
    scope: XAI_OAUTH_SCOPE,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
    state: input.state,
    nonce: input.nonce,
    plan: "generic",
    referrer: "grok-build-gui",
  });
  return `${XAI_AUTHORIZE_URL}?${params.toString()}`;
}

export function isLoopbackBindError(err: unknown): boolean {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
  if (code === "EADDRINUSE" || code === "EACCES" || code === "EADDRNOTAVAIL") return true;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /listen|EADDRINUSE|address already in use|permission denied/i.test(message);
}
