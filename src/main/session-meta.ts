import { asArray } from "../shared/acp-util.js";
import type { ModelInfo, SessionSummary, SlashCommand } from "../shared/protocol.js";

export function parseModels(raw: unknown): ModelInfo[] {
  return asArray<Record<string, any>>(raw).map((model) => ({
    modelId: model.modelId,
    name: model.name ?? model.modelId,
    description: model.description,
    contextTokens: model._meta?.totalContextTokens ?? 0,
    supportsReasoningEffort: Boolean(model._meta?.supportsReasoningEffort),
    reasoningEffort: model._meta?.reasoningEffort,
    reasoningEfforts: asArray(model._meta?.reasoningEfforts),
  }));
}

export function parseSlashCommands(raw: unknown): SlashCommand[] {
  const seen = new Set<string>();
  const commands: SlashCommand[] = [];
  for (const row of asArray<Record<string, any>>(raw)) {
    const name = String(row?.name ?? "").replace(/^\//, "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const hint = row?.input?.hint;
    commands.push({
      name,
      description: String(row?.description ?? "").trim(),
      input: typeof hint === "string" && hint.trim() ? { hint: hint.trim() } : row?.input ?? null,
    });
  }
  return commands;
}

export function sessionTitle(session: { title?: string; summary?: string; session_summary?: string }): string {
  return (session.title || session.summary || session.session_summary || "New thread").trim() || "New thread";
}

export function activityFromLive(meta: { activity?: string; status?: string; state?: string } | undefined): SessionSummary["activity"] {
  const activity = meta?.activity ?? meta?.status ?? meta?.state;
  if (activity === "running" || activity === "in_progress" || activity === "in-progress") return "working";
  if (activity === "working" || activity === "needs-input" || activity === "blocked" || activity === "completed" || activity === "failed") {
    return activity;
  }
  return "idle";
}

export function resolveSessionActivity(
  listed: { activity?: string; status?: string; state?: string } | undefined,
  live: { activity?: string; status?: string; state?: string } | undefined,
  inFlight = false,
): SessionSummary["activity"] {
  if (inFlight) return "working";
  return activityFromLive(live ?? listed);
}
