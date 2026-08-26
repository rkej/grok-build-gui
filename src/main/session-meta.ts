import { asArray } from "../shared/acp-util.js";
import type { ModelInfo, SessionSummary } from "../shared/protocol.js";

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

export function sessionTitle(session: { title?: string; summary?: string; session_summary?: string }): string {
  return (session.title || session.summary || session.session_summary || "New thread").trim() || "New thread";
}

export function activityFromLive(meta: { activity?: string } | undefined): SessionSummary["activity"] {
  const activity = meta?.activity;
  if (activity === "working" || activity === "needs-input" || activity === "blocked" || activity === "completed" || activity === "failed") {
    return activity;
  }
  return "idle";
}
