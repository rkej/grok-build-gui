import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { net } from "electron";
import { isHttpUrl } from "../shared/url.js";

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

const FORM_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent": "grok-build-gui",
} as const;

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

function cancelledError(): Error {
  return new Error("Sign-in cancelled.");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw cancelledError();
}

async function postForm(url: string, body: URLSearchParams): Promise<{ status: number; json: Record<string, unknown>; text: string }> {
  const init: RequestInit = {
    method: "POST",
    headers: FORM_HEADERS,
    body: body.toString(),
  };
  const run = async (fn: typeof fetch) => {
    const res = await fn(url, init);
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      json = {};
    }
    return { status: res.status, json, text };
  };
  try {
    return await run(net.fetch.bind(net) as typeof fetch);
  } catch {
    return await run(fetch);
  }
}

function tokensFromResponse(json: Record<string, unknown>): XaiOAuthTokens {
  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  if (!accessToken) throw new Error("xAI token response was missing an access token.");
  const refreshToken = typeof json.refresh_token === "string" ? json.refresh_token : undefined;
  const expiresIn = typeof json.expires_in === "number" && Number.isFinite(json.expires_in) ? json.expires_in : undefined;
  const email =
    emailFromIdToken(typeof json.id_token === "string" ? json.id_token : undefined) ??
    (typeof json.email === "string" ? json.email : undefined);
  return { accessToken, refreshToken, expiresIn, email };
}

const SUCCESS_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Grok Build</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#1a1b1e;color:#f4f4f5}.c{text-align:center;padding:2rem}p{color:#8b8d94}</style>
</head><body><div class="c"><h1>Signed in</h1><p>You can close this tab and return to Grok Build.</p></div>
<script>setTimeout(()=>window.close(),1200)</script></body></html>`;

function errorHtml(message: string): string {
  const safe = message.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Grok Build</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#1a1b1e;color:#f4f4f5}.c{text-align:center;padding:2rem}p{color:#e05467}</style>
</head><body><div class="c"><h1>Sign-in failed</h1><p>${safe}</p></div></body></html>`;
}

function startLoopback(state: string, signal: AbortSignal): Promise<{ code: Promise<string> }> {
  return new Promise((resolveListen, rejectListen) => {
    let settled = false;
    let listening = false;
    let server: Server | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let resolveCode: (code: string) => void;
    let rejectCode: (err: Error) => void;
    const code = new Promise<string>((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });

    const finish = (err?: Error, authCode?: string) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      if (timer) clearTimeout(timer);
      const closing = server;
      server = undefined;
      closing?.close();
      if (authCode) resolveCode(authCode);
      else rejectCode(err ?? cancelledError());
    };
    const onAbort = () => finish(cancelledError());

    server = createServer((req, res) => {
      if (settled) {
        res.writeHead(410, { "Content-Type": "text/plain" });
        res.end("Already handled");
        return;
      }
      let url: URL;
      try {
        url = new URL(req.url || "/", `http://${XAI_OAUTH_HOST}:${XAI_OAUTH_PORT}`);
      } catch {
        res.writeHead(400);
        res.end("Bad request");
        return;
      }
      if (url.pathname !== XAI_OAUTH_REDIRECT_PATH) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const oauthError = url.searchParams.get("error");
      const errDesc = url.searchParams.get("error_description");
      const authCode = url.searchParams.get("code");
      const gotState = url.searchParams.get("state");
      if (oauthError) {
        const message = (errDesc || oauthError).trim() || "OAuth error";
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(errorHtml(message));
        finish(new Error(message));
        return;
      }
      if (!authCode) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(errorHtml("Missing authorization code"));
        finish(new Error("Missing authorization code"));
        return;
      }
      if (gotState !== state) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(errorHtml("State mismatch"));
        finish(new Error("OAuth state mismatch"));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(SUCCESS_HTML);
      finish(undefined, authCode);
    });
    server.once("error", (err) => {
      if (!listening) {
        const closing = server;
        server = undefined;
        closing?.close();
        rejectListen(err);
        return;
      }
      finish(err instanceof Error ? err : new Error(String(err)));
    });
    if (signal.aborted) {
      rejectListen(cancelledError());
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    server.listen(XAI_OAUTH_PORT, XAI_OAUTH_HOST, () => {
      listening = true;
      timer = setTimeout(() => finish(new Error("Sign-in timed out. Try again.")), XAI_OAUTH_TIMEOUT_MS);
      resolveListen({ code });
    });
  });
}

async function loginPkce(opts: {
  signal: AbortSignal;
  onProgress: (progress: XaiOAuthProgress) => void;
  openUrl: (url: string) => void;
}): Promise<XaiOAuthTokens> {
  const { verifier, challenge } = createPkce();
  const state = base64Url(randomBytes(32));
  const nonce = base64Url(randomBytes(32));
  const url = buildAuthorizeUrl({ challenge, state, nonce });
  const loopback = await startLoopback(state, opts.signal);
  opts.onProgress({ loginUrl: url });
  opts.openUrl(url);
  const code = await loopback.code;
  throwIfAborted(opts.signal);
  const res = await postForm(
    XAI_TOKEN_URL,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: XAI_OAUTH_REDIRECT_URI,
      client_id: XAI_OAUTH_CLIENT_ID,
      code_verifier: verifier,
    }),
  );
  if (res.status >= 400) {
    throw new Error(`xAI token exchange failed (${res.status})${res.text ? `: ${res.text.slice(0, 180)}` : ""}`);
  }
  const tokens = tokensFromResponse(res.json);
  if (!tokens.email) tokens.email = await fetchEmail(tokens.accessToken);
  return tokens;
}

async function fetchEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await (net.fetch.bind(net) as typeof fetch)(XAI_USERINFO_URL, {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}`, "User-Agent": "grok-build-gui" },
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { email?: unknown };
    return typeof json.email === "string" ? json.email : undefined;
  } catch {
    return undefined;
  }
}

async function loginDevice(opts: {
  signal: AbortSignal;
  onProgress: (progress: XaiOAuthProgress) => void;
  openUrl: (url: string) => void;
}): Promise<XaiOAuthTokens> {
  const started = await postForm(
    XAI_DEVICE_CODE_URL,
    new URLSearchParams({ client_id: XAI_OAUTH_CLIENT_ID, scope: XAI_OAUTH_SCOPE }),
  );
  if (started.status >= 400) {
    throw new Error(`xAI device code request failed (${started.status})`);
  }
  const deviceCode = typeof started.json.device_code === "string" ? started.json.device_code : "";
  const userCode = typeof started.json.user_code === "string" ? started.json.user_code : "";
  const verificationUri = typeof started.json.verification_uri === "string" ? started.json.verification_uri : "";
  const verificationUriComplete =
    typeof started.json.verification_uri_complete === "string" ? started.json.verification_uri_complete : verificationUri;
  if (!deviceCode || !userCode || !verificationUri) {
    throw new Error("xAI device code response was incomplete.");
  }
  const loginUrl = isHttpUrl(verificationUriComplete) ? verificationUriComplete : verificationUri;
  opts.onProgress({ loginUrl, deviceCode: userCode });
  if (isHttpUrl(loginUrl)) opts.openUrl(loginUrl);

  const expiresIn = typeof started.json.expires_in === "number" ? started.json.expires_in : 300;
  let intervalMs = Math.max(1000, (typeof started.json.interval === "number" ? started.json.interval : 5) * 1000);
  const deadline = Date.now() + expiresIn * 1000;
  while (Date.now() < deadline) {
    throwIfAborted(opts.signal);
    await sleep(intervalMs, opts.signal);
    throwIfAborted(opts.signal);
    const poll = await postForm(
      XAI_TOKEN_URL,
      new URLSearchParams({
        grant_type: XAI_DEVICE_GRANT,
        client_id: XAI_OAUTH_CLIENT_ID,
        device_code: deviceCode,
      }),
    );
    if (poll.status < 400 && poll.json.access_token) {
      const tokens = tokensFromResponse(poll.json);
      if (!tokens.email) tokens.email = await fetchEmail(tokens.accessToken);
      return tokens;
    }
    const err = String(poll.json.error ?? "");
    if (err === "authorization_pending") continue;
    if (err === "slow_down") {
      intervalMs += 5000;
      continue;
    }
    if (err === "access_denied" || err === "authorization_denied") throw new Error("Sign-in was denied.");
    if (err === "expired_token") throw new Error("The sign-in code expired. Try again.");
    throw new Error(`xAI device token exchange failed (${poll.status})`);
  }
  throw new Error("Sign-in timed out. Try again.");
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(cancelledError());
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(cancelledError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Browser PKCE loopback first. If 127.0.0.1:56121 cannot bind, fall back to
 * the RFC 8628 device-code grant and open the prefilled verification URL.
 */
export async function loginWithXaiOAuth(opts: {
  signal: AbortSignal;
  onProgress: (progress: XaiOAuthProgress) => void;
  openUrl: (url: string) => void;
}): Promise<XaiOAuthTokens> {
  throwIfAborted(opts.signal);
  try {
    return await loginPkce(opts);
  } catch (err) {
    if (opts.signal.aborted) throw cancelledError();
    if (!isLoopbackBindError(err)) throw err;
    return await loginDevice(opts);
  }
}
