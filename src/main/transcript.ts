import { extractTodosFromTool, isPlanTool, mergePlanEntries, parsePlanEntries } from "../shared/plan.js";
import type { PlanEntry, SlashCommand, ToolCallState, TranscriptItem } from "../shared/protocol.js";
import { parseSlashCommands } from "./session-meta.js";

/**
 * Live `session/update` folding and JSONL replay share this reducer.
 *
 * Session files under `~/.grok/sessions/<encoded-cwd>/<id>/updates.jsonl` are
 * the source of truth. Opening a thread replays that file; streaming then
 * continues from the same shape.
 */
export type TranscriptFold = {
  items: TranscriptItem[];
  toolIndex: Map<string, number>;
  assistantIndex: number | null;
  thoughtIndex: number | null;
};

export type FoldMode = "live" | "replay";

export type FoldHooks = {
  nextId: (prefix: string) => string;
  mode?: FoldMode;
  showThoughts?: boolean;
  streaming?: boolean;
  at?: number;
  onPlanEntries?: (entries: PlanEntry[], merge: boolean) => void;
  onTool?: (tool: ToolCallState) => ToolCallState;
  onCommands?: (commands: SlashCommand[]) => void;
  onMode?: (modeId: string) => void;
  onTurnComplete?: () => void;
};

export function createFold(): TranscriptFold {
  return {
    items: [],
    toolIndex: new Map(),
    assistantIndex: null,
    thoughtIndex: null,
  };
}

export function normalizeTool(raw: unknown, nextId: (prefix: string) => string): ToolCallState {
  const record = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const tool = record.toolCall ?? record;
  const content = tool.content;
  const diff = Array.isArray(content)
    ? content.find((block: { type?: string }) => block?.type === "diff") ?? null
    : tool.diff ?? null;
  return {
    toolCallId: tool.toolCallId ?? tool.id ?? nextId("tool"),
    title: tool.title ?? tool.kind ?? tool.name ?? "tool",
    kind: tool.kind,
    status: tool.status ?? "pending",
    name: tool.name ?? tool._meta?.["x.ai/tool"]?.name ?? tool.tool,
    rawInput: tool.rawInput ?? tool.input ?? tool.arguments,
    rawOutput: tool.rawOutput ?? tool.output,
    content: tool.content,
    meta: tool._meta,
    locations: tool.locations,
    diff,
  };
}

function ingestPlan(fold: TranscriptFold, tool: ToolCallState, hooks: FoldHooks, at: number): boolean {
  const extracted = extractTodosFromTool(tool);
  if (!extracted && !isPlanTool(tool)) return false;
  if (extracted?.entries.length) {
    hooks.onPlanEntries?.(extracted.entries, extracted.merge);
    const last = [...fold.items].reverse().find((item) => item.kind === "plan");
    if (last && last.kind === "plan") {
      last.entries = mergePlanEntries(last.entries, extracted.entries, extracted.merge);
      last.at = at;
    } else {
      fold.items.push({ id: hooks.nextId("p"), kind: "plan", entries: extracted.entries, at });
    }
  }
  return true;
}

function rebuildToolIndex(fold: TranscriptFold): void {
  fold.toolIndex.clear();
  fold.items.forEach((item, index) => {
    if (item.kind === "tool") fold.toolIndex.set(item.tool.toolCallId, index);
  });
}

export function applySessionUpdate(
  fold: TranscriptFold,
  update: Record<string, any>,
  hooks: FoldHooks,
): "soon" | "now" | "skip" {
  const kind = update.sessionUpdate;
  const at = hooks.at ?? Date.now();
  const nextId = hooks.nextId;
  const replay = hooks.mode === "replay";

  if (kind === "user_message_chunk") {
    const text = extractUserText(update.content);
    const attachments = extractUserAttachments(update.content);
    const last = fold.items[fold.items.length - 1];
    if (last?.kind === "user") {
      // The GUI inserts the prompt immediately; ACP then echoes the same
      // user_message_chunk (sometimes twice via session/update and
      // _x.ai/session/update). Don't concatenate an echo onto the original.
      if (!text) {
        if (attachments.length) last.attachments = [...(last.attachments ?? []), ...attachments];
        return attachments.length ? "now" : "skip";
      }
      if (last.text === text || last.text.startsWith(text)) {
        if (attachments.length) last.attachments = attachments;
        return "skip";
      }
      if (text.startsWith(last.text)) {
        last.text = text;
        if (attachments.length) last.attachments = attachments;
        return "now";
      }
      last.text += text;
      if (attachments.length) last.attachments = [...(last.attachments ?? []), ...attachments];
    } else {
      fold.items.push({ id: nextId("u"), kind: "user", text, at, attachments: attachments.length ? attachments : undefined });
      if (replay) {
        fold.assistantIndex = null;
        fold.thoughtIndex = null;
      }
    }
    return "now";
  }

  if (kind === "agent_message_chunk") {
    const text = update.content?.text ?? "";
    if (fold.assistantIndex == null) {
      fold.assistantIndex = fold.items.length;
      fold.items.push({
        id: nextId("a"),
        kind: "assistant",
        text,
        at,
        ...(hooks.streaming ? { streaming: true } : {}),
      });
    } else {
      const item = fold.items[fold.assistantIndex];
      if (item?.kind === "assistant") item.text += text;
    }
    return hooks.streaming ? "soon" : "now";
  }

  if (kind === "agent_thought_chunk") {
    if (hooks.showThoughts === false) return "skip";
    const text = update.content?.text ?? "";
    if (fold.thoughtIndex == null) {
      fold.thoughtIndex = fold.items.length;
      fold.items.push({
        id: nextId("t"),
        kind: "thought",
        text,
        at,
        ...(hooks.streaming ? { streaming: true } : {}),
      });
    } else {
      const item = fold.items[fold.thoughtIndex];
      if (item?.kind === "thought") item.text += text;
    }
    return hooks.streaming ? "soon" : "now";
  }

  if (kind === "tool_call") {
    const normalized = normalizeTool(update, nextId);
    const tool = hooks.onTool?.(normalized) ?? normalized;
    if (ingestPlan(fold, tool, hooks, at)) {
      fold.toolIndex.set(tool.toolCallId, -1);
    } else {
      const idx = fold.items.length;
      fold.toolIndex.set(tool.toolCallId, idx);
      fold.items.push({ id: tool.toolCallId, kind: "tool", tool: maybeCompactCompletedTool(tool), at });
    }
    if (replay) fold.assistantIndex = null;
    return "now";
  }

  if (kind === "tool_call_update") {
    const id = update.toolCallId ?? update.toolCall?.toolCallId;
    const idx = id ? fold.toolIndex.get(id) : undefined;
    if (idx != null && idx >= 0) {
      const item = fold.items[idx];
      if (item?.kind === "tool") {
        const normalized = normalizeTool({ ...item.tool, ...update }, nextId);
        const merged = { ...item.tool, ...normalized };
        item.tool = maybeCompactCompletedTool(hooks.onTool?.(merged) ?? merged);
        if (ingestPlan(fold, item.tool, hooks, at)) {
          fold.items.splice(idx, 1);
          rebuildToolIndex(fold);
        }
      }
    } else {
      ingestPlan(fold, normalizeTool(update, nextId), hooks, at);
    }
    return "now";
  }

  if (kind === "plan") {
    const entries = parsePlanEntries(update.entries ?? update);
    if (entries.length) {
      hooks.onPlanEntries?.(entries, false);
      const last = [...fold.items].reverse().find((item) => item.kind === "plan");
      if (last && last.kind === "plan") last.entries = entries;
      else fold.items.push({ id: nextId("p"), kind: "plan", entries, at });
    }
    return "now";
  }

  if (kind === "auto_compact_started" || kind === "compaction_started") {
    fold.items.push({ id: nextId("s"), kind: "system", text: "Compacting conversation context…", at });
    return "now";
  }

  if (kind === "auto_compact_completed" || kind === "compaction_completed" || kind === "compaction_checkpoint") {
    fold.items.push({ id: nextId("s"), kind: "system", text: "Conversation context compacted", at });
    return "now";
  }

  if (kind === "subagent_spawned") {
    fold.items.push({ id: nextId("s"), kind: "system", text: "Subagent started", at });
    return "now";
  }

  if (kind === "subagent_finished") {
    fold.items.push({ id: nextId("s"), kind: "system", text: "Subagent finished", at });
    return "now";
  }

  if (kind === "available_commands_update") {
    hooks.onCommands?.(parseSlashCommands(update.availableCommands));
    return "now";
  }

  if (kind === "current_mode_update") {
    hooks.onMode?.(String(update.currentModeId ?? ""));
    return "now";
  }

  if (kind === "turn_completed") {
    if (fold.assistantIndex != null) {
      const item = fold.items[fold.assistantIndex];
      if (item?.kind === "assistant") item.streaming = false;
    }
    if (fold.thoughtIndex != null) {
      const item = fold.items[fold.thoughtIndex];
      if (item?.kind === "thought") item.streaming = false;
    }
    for (const item of fold.items) {
      if (item.kind === "tool") item.tool = compactToolForTransport(item.tool);
    }
    hooks.onTurnComplete?.();
    return "now";
  }

  return "skip";
}

function extractUserText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!content || typeof content !== "object") return "";
  if (Array.isArray(content)) return content.filter((part) => part && typeof part === "object" && (part as Record<string, unknown>).type === "text").map((part) => String((part as Record<string, unknown>).text ?? "")).join("");
  return String((content as Record<string, unknown>).text ?? "");
}

function extractUserAttachments(content: unknown): NonNullable<Extract<TranscriptItem, { kind: "user" }>["attachments"]> {
  type UserAttachment = NonNullable<Extract<TranscriptItem, { kind: "user" }>["attachments"]>[number];
  const parts = Array.isArray(content) ? content : [content];
  return parts.flatMap((part, index): UserAttachment[] => {
    if (!part || typeof part !== "object") return [];
    const record = part as Record<string, unknown>;
    if (record.type === "image" && typeof record.data === "string") {
      return [{ id: `replayed-image-${index}`, name: `Image ${index + 1}`, kind: "image" as const, mimeType: String(record.mimeType ?? "image/png"), data: record.data }];
    }
    if (record.type === "resource_link" && typeof record.uri === "string") {
      return [{ id: `replayed-file-${index}`, name: String(record.name ?? record.uri.split("/").pop() ?? "File"), kind: "file" as const, mimeType: String(record.mimeType ?? "application/octet-stream"), path: record.uri }];
    }
    return [];
  });
}

export function replayJsonl(
  text: string,
  nextId: (prefix: string) => string,
  options: { showThoughts?: boolean; lazyToolContent?: boolean } = {},
): TranscriptItem[] {
  const fold = createFold();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let msg: { params?: { update?: Record<string, any> }; update?: Record<string, any>; timestamp?: number };
    try {
      msg = JSON.parse(line) as typeof msg;
    } catch {
      continue;
    }
    const update = msg.params?.update ?? msg.update;
    if (!update) continue;
    const stamp = msg.timestamp ?? Date.now();
    const at = stamp * (String(stamp).length < 13 ? 1000 : 1);
    applySessionUpdate(fold, update, {
      nextId,
      mode: "replay",
      showThoughts: options.showThoughts ?? true,
      streaming: false,
      at,
      onTool: options.lazyToolContent ? compactToolForTransport : undefined,
    });
  }
  return fold.items;
}

const LABEL_INPUT_KEYS = [
  "target_file",
  "file_path",
  "filePath",
  "path",
  "filename",
  "uri",
  "pattern",
  "query",
  "q",
  "command",
  "cmd",
  "url",
  "prompt",
  "glob",
];

export function isTerminalToolStatus(status: string | undefined): boolean {
  return /^(completed|success|failed|error|done)$/i.test(status ?? "");
}

export function maybeCompactCompletedTool(tool: ToolCallState): ToolCallState {
  if (!isTerminalToolStatus(tool.status)) return tool;
  return compactToolForTransport(tool);
}

export function compactToolForTransport(tool: ToolCallState): ToolCallState {
  const hasContent = tool.hasContent ?? Boolean(
    tool.rawInput !== undefined || tool.rawOutput !== undefined || tool.content !== undefined || tool.diff,
  );
  return {
    toolCallId: tool.toolCallId,
    title: tool.title,
    kind: tool.kind,
    status: tool.status,
    name: tool.name,
    rawInput: pickLabelInput(tool.rawInput),
    locations: tool.locations?.slice(0, 4),
    hasContent,
    contentLoaded: false,
  };
}

function pickLabelInput(value: unknown): unknown {
  if (typeof value === "string") return value.length > 160 ? `${value.slice(0, 159)}…` : value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const next: Record<string, string> = {};
  for (const key of LABEL_INPUT_KEYS) {
    const field = record[key];
    if (typeof field !== "string" || !field.trim()) continue;
    next[key] = field.length > 160 ? `${field.slice(0, 159)}…` : field;
    if (Object.keys(next).length >= 3) break;
  }
  return Object.keys(next).length ? next : undefined;
}
