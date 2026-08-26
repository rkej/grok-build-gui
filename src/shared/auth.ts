import { isHttpUrl } from "./url.js";
import type { AuthState } from "./protocol.js";

const AUTH_MESSAGE =
  /auth_required|authentication required|not authenticated|unauthoriz|unauthenticated|please (?:log|sign) in|invalid(?:_|\s+)(?:access[_\s-])?token|expired(?:_|\s+)(?:access[_\s-])?token|auth(?:entication)? (?:failed|expired|missing)|no (?:cached )?credential|cached_token/i;

/** Signed-out AuthState. Extra fields overlay the defaults. */
export function signedOutAuth(partial: Partial<AuthState> = {}): AuthState {
  return {
    authenticated: false,
    signingIn: false,
    error: null,
    loginUrl: null,
    deviceCode: null,
    ...partial,
    authenticated: false,
  };
}

export function authFromAuthenticateResult(result: unknown, methodId?: string): AuthState {
  const raw = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
  const nested =
    raw.result && typeof raw.result === "object" ? (raw.result as Record<string, unknown>) : raw;
  const meta =
    nested._meta && typeof nested._meta === "object"
      ? (nested._meta as Record<string, unknown>)
      : nested;
  const teamName = meta.team_name ?? meta.teamName;
  const subscription = meta.subscription_tier ?? meta.subscriptionTier;
  return {
    authenticated: true,
    signingIn: false,
    methodId: methodId ?? (typeof meta.methodId === "string" ? meta.methodId : undefined),
    email: typeof meta.email === "string" ? meta.email : undefined,
    teamName: typeof teamName === "string" ? teamName : null,
    subscriptionTier: typeof subscription === "string" ? subscription : undefined,
    error: null,
    loginUrl: null,
    deviceCode: null,
  };
}

export function isAuthError(err: unknown): boolean {
  if (err == null) return false;
  const row = err as { code?: unknown; message?: unknown; data?: unknown };
  const code = Number(row.code);
  if (code === 401) return true;
  const message = String(row.message ?? (err instanceof Error ? err.message : err));
  if (AUTH_MESSAGE.test(message)) return true;
  if (row.data && typeof row.data === "object") {
    const data = row.data as Record<string, unknown>;
    const nested = String(data.code ?? data.error ?? data.reason ?? data.message ?? "");
    if (AUTH_MESSAGE.test(nested)) return true;
  }
  return false;
}

export function parseGrokLoginOutput(text: string): { url?: string; deviceCode?: string } {
  const urls = [...text.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)].map((match) =>
    match[0].replace(/[.,;:]+$/, ""),
  );
  const preferred =
    urls.find((url) => /auth\.x\.ai|accounts\.x\.ai|grok\.com|\bx\.ai\//i.test(url)) ??
    urls[urls.length - 1];
  const url = preferred && isHttpUrl(preferred) ? preferred : undefined;
  const deviceCode = text.match(
    /(?:enter(?:\s+the)?\s+code|user[_-]?code|device[_-]?code)[:\s]+([A-Z0-9][-A-Z0-9]{3,})/i,
  )?.[1];
  return { url, deviceCode };
}
