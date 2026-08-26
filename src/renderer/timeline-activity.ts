import type { PlanEntry, ToolCallState, TranscriptItem } from "../shared/protocol";

/**
 * Compact fingerprint of transcript content that changes when a turn actually
 * updates — new rows, streaming text, tool status/output, plan progress —
 * rather than when the user merely scrolls away from already-rendered rows.
 */
export function transcriptActivityKey(items: readonly TranscriptItem[], running: boolean): string {
  let out = running ? "1" : "0";
  out += `:${items.length}`;
  for (const item of items) {
    out += `|${itemFingerprint(item)}`;
  }
  return out;
}

export function hasUnseenTimelineActivity(pinned: boolean, currentKey: string, seenKey: string): boolean {
  return !pinned && currentKey !== seenKey;
}

function itemFingerprint(item: TranscriptItem): string {
  switch (item.kind) {
    case "user":
    case "system":
      return `${item.id}:${item.kind}:${item.text.length}`;
    case "assistant":
    case "thought":
      return `${item.id}:${item.kind}:${item.text.length}:${item.streaming ? 1 : 0}`;
    case "tool":
      return `${item.id}:tool:${toolFingerprint(item.tool)}`;
    case "plan":
      return `${item.id}:plan:${planFingerprint(item.entries)}`;
  }
}

function toolFingerprint(tool: ToolCallState): string {
  return `${tool.status}:${tool.title.length}:${payloadHint(tool.rawOutput)}:${payloadHint(tool.content)}:${tool.diff?.newText?.length ?? 0}`;
}

function planFingerprint(entries: readonly PlanEntry[]): string {
  return entries.map((entry) => `${entry.id ?? ""}:${entry.status}`).join(",");
}

function payloadHint(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) return value.length;
  return 1;
}
