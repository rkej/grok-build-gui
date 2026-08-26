import { closeSync, existsSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { net } from "electron";
import type { AccountUsage } from "../shared/protocol.js";

const PROXY_CREDITS = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
const PROXY_MONTHLY = "https://cli-chat-proxy.grok.com/v1/billing";
const PROXY_SETTINGS = "https://cli-chat-proxy.grok.com/v1/settings";
const TOKEN_ENDPOINT = "https://auth.x.ai/oauth2/token";
const ACP_BILLING_METHODS = ["x.ai/billing", "_x.ai/billing"];

function grokHome(): string {
  return process.env.GROK_HOME || path.join(homedir(), ".grok");
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function money(value: unknown): number | undefined {
  if (value && typeof value === "object" && "val" in (value as object)) {
    return num((value as { val?: unknown }).val);
  }
  return num(value);
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function periodKind(raw: unknown): "weekly" | "monthly" | undefined {
  const text = String(raw ?? "");
  if (/week/i.test(text)) return "weekly";
  if (/month/i.test(text)) return "monthly";
  return undefined;
}

function pickPercent(obj: any): number | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of ["creditUsagePercent", "usedPercent", "usedPct", "usagePercent"]) {
    if (key in obj) {
      const value = money(obj[key]);
      if (value != null) return value;
    }
  }
  return undefined;
}

type AuthEntry = {
  key?: string;
  email?: string;
  expires_at?: string;
  auth_mode?: string;
  refresh_token?: string;
  oidc_issuer?: string;
  oidc_client_id?: string;
};

type AuthFile = Record<string, AuthEntry>;

function authPath(): string {
  return path.join(grokHome(), "auth.json");
}

function readAuthFile(): { scope: string; entry: AuthEntry } | null {
  try {
    const raw = JSON.parse(readFileSync(authPath(), "utf8")) as AuthFile;
    const entries = Object.entries(raw);
    const preferred = entries.filter(([scope]) => scope.startsWith("https://auth.x.ai"));
    const pool = (preferred.length ? preferred : entries).filter(([, entry]) => Boolean(entry?.key || entry?.refresh_token));
    const fresh = pool.find(([, entry]) => {
      if (!entry.expires_at) return Boolean(entry.key);
      const exp = Date.parse(entry.expires_at);
      return Number.isNaN(exp) || exp > Date.now() + 60_000;
    });
    const chosen = fresh ?? pool[0];
    if (!chosen) return null;
    return { scope: chosen[0], entry: chosen[1] };
  } catch {
    return null;
  }
}

function persistTokens(scope: string, accessToken: string, refreshToken: string | undefined, expiresIn: number | undefined): void {
  try {
    const file = authPath();
    const raw = JSON.parse(readFileSync(file, "utf8")) as AuthFile;
    const entry = raw[scope] ?? {};
    entry.key = accessToken;
    if (refreshToken) entry.refresh_token = refreshToken;
    if (expiresIn && expiresIn > 0) {
      entry.expires_at = new Date(Date.now() + expiresIn * 1000).toISOString();
    }
    raw[scope] = entry;
    writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`, { mode: 0o600 });
  } catch {
    // Grok CLI owns this file; billing still uses the in-memory token.
  }
}

async function http(opts: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
}): Promise<{ status: number; json: any; text: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  const init = {
    method: opts.method ?? "GET",
    headers: opts.headers,
    body: opts.body,
    signal: ctrl.signal,
  } as RequestInit;
  try {
    const run = async (fn: typeof fetch) => {
      const raced = await Promise.race([
        fn(opts.url, init),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("timeout")), opts.timeoutMs + 250);
        }),
      ]);
      const text = await raced.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { status: raced.status, json, text };
    };
    try {
      return await run(net.fetch.bind(net) as typeof fetch);
    } catch {
      return await run(fetch);
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function refreshOidcToken(scope: string, entry: AuthEntry): Promise<string | null> {
  if (!entry.refresh_token || !entry.oidc_client_id) return null;
  const issuer = (entry.oidc_issuer || "https://auth.x.ai").replace(/\/$/, "");
  const url = issuer === "https://auth.x.ai" ? TOKEN_ENDPOINT : `${issuer}/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: entry.refresh_token,
    client_id: entry.oidc_client_id,
  }).toString();
  const res = await http({
    url,
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "grok-build-gui",
    },
    body,
    timeoutMs: 8_000,
  });
  const access = String(res?.json?.access_token ?? "").trim();
  if (!res || res.status >= 400 || !access) return null;
  persistTokens(scope, access, typeof res.json.refresh_token === "string" ? res.json.refresh_token : undefined, num(res.json.expires_in));
  return access;
}

async function resolveAccessToken(): Promise<string | null> {
  const auth = readAuthFile();
  if (!auth) return null;
  const exp = auth.entry.expires_at ? Date.parse(auth.entry.expires_at) : NaN;
  const fresh = auth.entry.key && (Number.isNaN(exp) || exp > Date.now() + 60_000);
  if (fresh) return auth.entry.key ?? null;
  const refreshed = await refreshOidcToken(auth.scope, auth.entry);
  if (refreshed) return refreshed;
  return auth.entry.key ?? null;
}

function billingHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "User-Agent": "grok-build-gui",
    ...extra,
  };
}

async function proxyGet(url: string, token: string, timeoutMs: number): Promise<any | null> {
  const withCliAuth = await http({
    url,
    headers: billingHeaders(token, { "x-xai-token-auth": "xai-grok-cli" }),
    timeoutMs,
  });
  if (withCliAuth?.status === 200) return withCliAuth.json;
  if (withCliAuth?.status && withCliAuth.status !== 401 && withCliAuth.status !== 403) return withCliAuth.json;
  const plain = await http({
    url,
    headers: billingHeaders(token),
    timeoutMs,
  });
  if (plain?.status === 200) return plain.json;
  return null;
}

function readLastBillingLog(): unknown | null {
  const file = path.join(grokHome(), "logs", "unified.jsonl");
  if (!existsSync(file)) return null;
  try {
    const stat = statSync(file);
    const size = Math.min(stat.size, 1024 * 1024);
    const buf = Buffer.alloc(size);
    const fd = openSync(file, "r");
    readSync(fd, buf, 0, size, Math.max(0, stat.size - size));
    closeSync(fd);
    const lines = buf.toString("utf8").split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.includes("billing: fetched credits config") && !line.includes("creditUsagePercent")) continue;
      try {
        const row = JSON.parse(line);
        const ctx = row.ctx ?? row;
        return {
          ...ctx,
          config: ctx.config ?? row.config,
          subscriptionTier: ctx.subscriptionTier ?? ctx.config?.subscriptionTier,
        };
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function parseWeeklyUsage(raw: any, source: string): AccountUsage {
  if (!raw || typeof raw !== "object") return null;
  const root = raw.result && typeof raw.result === "object" ? raw.result : raw;
  const config = root.config && typeof root.config === "object" ? root.config : root;
  const usage = config.usage && typeof config.usage === "object" ? config.usage : root.usage;
  const cycle = config.billingCycle && typeof config.billingCycle === "object"
    ? config.billingCycle
    : root.billingCycle;
  const currentPeriod = config.currentPeriod ?? root.currentPeriod ?? cycle;
  const billingHint = Boolean(
    currentPeriod
      || cycle
      || pickPercent(config) != null
      || pickPercent(root) != null
      || config.monthlyLimit
      || root.monthlyLimit
      || config.billingPeriodEnd
      || root.billingPeriodEnd
      || Array.isArray(config.productUsage),
  );

  const usedPctRaw = pickPercent(config) ?? pickPercent(root);
  const used = money(
    usage?.totalUsed
      ?? usage?.includedUsed
      ?? config.used
      ?? (billingHint ? root.used ?? root.spent ?? root.consumed : undefined),
  );
  const total = money(
    config.monthlyLimit
      ?? root.monthlyLimit
      ?? (billingHint ? config.quota ?? config.limit ?? config.allowance ?? root.total ?? root.quota : undefined),
  );
  const remaining = money(config.remaining ?? root.remaining ?? root.left ?? root.creditsRemaining ?? root.available)
    ?? (used != null && total != null ? Math.max(0, total - used) : undefined);
  const onDemandCap = money(config.onDemandCap ?? root.onDemandCap);
  const onDemandUsed = money(config.onDemandUsed ?? root.onDemandUsed);

  let usedPct: number | undefined;
  if (usedPctRaw != null) usedPct = clampPct(usedPctRaw);
  else if (used != null && total && total > 0) usedPct = clampPct((used / total) * 100);
  else if (onDemandCap && onDemandCap > 0 && onDemandUsed != null) usedPct = clampPct((onDemandUsed / onDemandCap) * 100);

  const resets = String(
    currentPeriod?.end
      ?? config.billingPeriodEnd
      ?? cycle?.billingPeriodEnd
      ?? root.billingPeriodEnd
      ?? root.resets
      ?? root.resetAt
      ?? root.periodEnd
      ?? "",
  ) || undefined;
  const period = periodKind(currentPeriod?.type ?? config.period ?? root.period ?? (resets ? "weekly" : undefined));
  const label = String(
    config.subscriptionTierDisplay
      ?? root.subscription_tier_display
      ?? root.subscriptionTierDisplay
      ?? config.subscriptionTier
      ?? root.subscriptionTier
      ?? root.label
      ?? root.plan
      ?? root.tier
      ?? "",
  ) || undefined;

  const products = (Array.isArray(config.productUsage) ? config.productUsage : Array.isArray(root.productUsage) ? root.productUsage : [])
    .map((row: any) => {
      const name = String(row?.product ?? row?.name ?? "").trim();
      const pct = money(row?.usagePercent ?? row?.usedPct ?? row?.percent);
      if (!name || pct == null) return null;
      return { label: name.replace(/^Grok/i, "").trim() || name, usedPct: clampPct(pct) };
    })
    .filter(Boolean) as { label: string; usedPct: number }[];

  const hasBillingShape = Boolean(
    billingHint
      || usedPctRaw != null
      || (onDemandCap != null && onDemandCap > 0)
      || Boolean(label && resets)
      || products.length > 0,
  );
  if (!hasBillingShape) return null;

  const remainingPct = usedPct != null ? clampPct(100 - usedPct) : undefined;
  if (usedPct == null && remaining == null && used == null && total == null && !resets && !label) return null;

  return {
    used,
    total,
    remaining,
    usedPct,
    remainingPct,
    unit: root.unit ?? config.unit,
    resets,
    period: period ?? (resets ? "weekly" : undefined),
    label,
    detail: root.detail ?? root.message,
    source,
    products: products.length ? products : undefined,
  };
}

function mergeUsage(live: AccountUsage, logs: AccountUsage): AccountUsage {
  if (!live) return logs;
  if (!logs) return live;
  const usedPct = live.usedPct ?? logs.usedPct;
  return {
    ...logs,
    ...live,
    used: live.used ?? logs.used,
    total: live.total ?? logs.total,
    remaining: live.remaining ?? logs.remaining,
    usedPct,
    remainingPct: usedPct != null ? clampPct(100 - usedPct) : live.remainingPct ?? logs.remainingPct,
    resets: live.resets || logs.resets,
    period: live.period || logs.period,
    label: live.label || logs.label,
    products: live.products?.length ? live.products : logs.products,
    source: live.source || logs.source,
  };
}

export function loggedWeeklyUsage(): AccountUsage {
  return parseWeeklyUsage(readLastBillingLog(), "logs");
}

async function fetchProxyBilling(token: string): Promise<AccountUsage> {
  const [credits, monthly, settings] = await Promise.all([
    proxyGet(PROXY_CREDITS, token, 12_000),
    proxyGet(PROXY_MONTHLY, token, 8_000),
    proxyGet(PROXY_SETTINGS, token, 2_500),
  ]);
  const fromCredits = parseWeeklyUsage(credits, "cli-proxy");
  if (fromCredits && fromCredits.usedPct == null && credits && (fromCredits.resets || fromCredits.period)) {
    fromCredits.usedPct = 0;
    fromCredits.remainingPct = 100;
  }
  const fromMonthly = parseWeeklyUsage(monthly, "cli-proxy-monthly");
  const merged = mergeUsage(fromCredits, fromMonthly);
  if (!merged) return null;
  const display = String(
    settings?.subscription_tier_display
      ?? settings?.subscriptionTierDisplay
      ?? credits?.config?.subscriptionTierDisplay
      ?? "",
  ).trim();
  if (display) merged.label = display;
  return merged;
}

export async function fetchWeeklyUsage(
  acpRequest?: (method: string, params?: Record<string, never>) => Promise<unknown>,
): Promise<AccountUsage> {
  const logs = loggedWeeklyUsage();
  const token = await resolveAccessToken();
  let live: AccountUsage = null;
  if (token) {
    live = await fetchProxyBilling(token);
    if (live?.usedPct == null) {
      const retried = await resolveAccessToken();
      if (retried && retried !== token) live = await fetchProxyBilling(retried);
    }
  }

  if (live?.usedPct == null && acpRequest) {
    for (const method of ACP_BILLING_METHODS) {
      try {
        const raw = await acpRequest(method, {});
        const parsed = parseWeeklyUsage(raw, `acp:${method}`);
        if (parsed) {
          live = mergeUsage(parsed, live);
          if (live?.usedPct != null) break;
        }
      } catch {
        continue;
      }
    }
  }

  return mergeUsage(live, logs);
}
