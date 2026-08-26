import type { ContextUsage } from "../shared/protocol.js";

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

/** Parse a context-window usage blob from `session/info` or turn completion. */
export function parseContextUsage(raw: unknown): ContextUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, any>;
  const used = num(record.used ?? record.totalTokens ?? record.total_tokens ?? record.contextTokensUsed);
  const total = num(record.total ?? record.contextWindowTokens ?? record.limit ?? record.max);
  if (used == null && total == null) return null;
  const usedTokens = used ?? 0;
  const totalTokens = total && total > 0 ? total : 500000;
  const remaining = num(record.freeTokens ?? record.remaining ?? record.left) ?? Math.max(0, totalTokens - usedTokens);
  const usagePct = num(record.usagePct) ?? Math.round((usedTokens / totalTokens) * 100);
  return {
    used: usedTokens,
    total: totalTokens,
    usagePct: Math.max(0, Math.min(100, usagePct)),
    remainingPct: Math.max(0, Math.min(100, Math.round((remaining / totalTokens) * 100))),
    freeTokens: remaining,
    remaining,
    categories: record.usageCategories ?? record.categories,
  };
}
