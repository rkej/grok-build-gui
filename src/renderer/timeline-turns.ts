import type { TranscriptItem, ToolCallState } from "../shared/protocol";
import { isWriteTool, toolLabel, toolName } from "./tool-format";

const MIN_WORKED_DURATION_MS = 1_000;

export type TimelineTurnMarker = {
  kind: "turn-marker";
  id: string;
  durationMs: number;
};

export type ToolActionBucketId = "read" | "edit" | "search" | "explore" | "run" | "fetch" | "other";

export type TimelineToolBucket = {
  kind: "tool-bucket";
  id: string;
  bucket: ToolActionBucketId;
  summary: string;
  tools: Extract<TranscriptItem, { kind: "tool" }>[];
  failed: boolean;
};

export type TimelineToolGroup = {
  kind: "tool-group";
  id: string;
  summary: string;
  tools: Extract<TranscriptItem, { kind: "tool" }>[];
  buckets: TimelineToolBucket[];
  failed: boolean;
};

export type DisplayTimelineItem = (TranscriptItem | TimelineTurnMarker | TimelineToolGroup | TimelineToolBucket) & {
  indent?: number;
};

export function buildDisplayTimelineItems(items: readonly TranscriptItem[]): DisplayTimelineItem[] {
  const result: DisplayTimelineItem[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item) continue;

    if (item.kind === "tool" && !isLiveTool(item)) {
      const tools: Extract<TranscriptItem, { kind: "tool" }>[] = [item];
      let next = index + 1;
      while (next < items.length) {
        const candidate = items[next];
        if (!candidate || candidate.kind !== "tool" || isLiveTool(candidate)) break;
        tools.push(candidate);
        next += 1;
      }
      if (tools.length > 1) {
        const groupId = `tool-group:${tools[0]?.id ?? index}`;
        result.push({
          kind: "tool-group",
          id: groupId,
          summary: summarizeToolActions(tools.map((row) => row.tool)),
          tools,
          buckets: buildToolBuckets(groupId, tools),
          failed: tools.some((row) => isFailedTool(row)),
        });
        index = next - 1;
      } else {
        result.push(item);
      }
    } else {
      result.push(item);
    }

    if (item.kind !== "user") continue;
    let end = 0;
    for (let next = index + 1; next < items.length; next += 1) {
      const nextItem = items[next];
      if (!nextItem) continue;
      if (nextItem.kind === "user") break;
      if (nextItem.at) end = Math.max(end, nextItem.at);
    }
    const durationMs = end - item.at;
    if (!end || durationMs < MIN_WORKED_DURATION_MS) continue;
    result.push({ kind: "turn-marker", id: `turn-marker:${item.id}`, durationMs });
  }
  return result;
}

export function summarizeToolActions(tools: readonly ToolCallState[]): string {
  if (tools.length === 0) return "Worked";
  const buckets = buildToolBuckets("summary", tools.map((tool, index) => ({
    id: String(index),
    kind: "tool" as const,
    at: 0,
    tool,
  })));
  return buckets.map((bucket) => bucket.summary).join(" · ");
}

export function buildToolBuckets(
  groupId: string,
  tools: readonly Extract<TranscriptItem, { kind: "tool" }>[],
): TimelineToolBucket[] {
  const grouped = new Map<ToolActionBucketId, Extract<TranscriptItem, { kind: "tool" }>[]>();
  for (const item of tools) {
    const bucket = actionBucket(item.tool);
    const list = grouped.get(bucket) ?? [];
    list.push(item);
    grouped.set(bucket, list);
  }
  const order: ToolActionBucketId[] = ["read", "edit", "search", "explore", "run", "fetch", "other"];
  return order.flatMap((bucket) => {
    const rows = grouped.get(bucket);
    if (!rows?.length) return [];
    return [{
      kind: "tool-bucket" as const,
      id: `${groupId}:${bucket}`,
      bucket,
      summary: summarizeBucket(bucket, rows),
      tools: rows,
      failed: rows.some((row) => isFailedTool(row)),
    }];
  });
}

function summarizeBucket(
  bucket: ToolActionBucketId,
  tools: readonly Extract<TranscriptItem, { kind: "tool" }>[],
): string {
  if (tools.length === 1) return toolLabel(tools[0]!.tool);
  if (bucket === "read") return `Read ${tools.length} files`;
  if (bucket === "edit") return `Edited ${tools.length} files`;
  if (bucket === "search") return `Searched ${tools.length} times`;
  if (bucket === "explore") return `Explored ${tools.length} times`;
  if (bucket === "run") return `Ran ${tools.length} commands`;
  if (bucket === "fetch") return `Fetched ${tools.length} pages`;
  return `${tools.length} other actions`;
}

export function formatWorkedDuration(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

function actionBucket(tool: ToolCallState): ToolActionBucketId {
  const name = toolName(tool);
  if (isWriteTool(name)) return "edit";
  if (/grep|search/i.test(name) && !/replace/i.test(name)) return "search";
  if (/glob|list_dir|\bls\b/i.test(name)) return "explore";
  if (/^read(_file)?$/i.test(name) || /read|view|cat/i.test(name)) return "read";
  if (/bash|shell|terminal|command|exec/i.test(name)) return "run";
  if (/web_fetch|open_page|fetch|web_search/i.test(name)) return "fetch";
  return "other";
}

export function flattenDisplayItems(
  items: readonly DisplayTimelineItem[],
  expandedGroups: Readonly<Record<string, boolean>>,
  expandedBuckets: Readonly<Record<string, boolean>>,
): DisplayTimelineItem[] {
  const visible: DisplayTimelineItem[] = [];
  for (const item of items) {
    if (item.kind !== "tool-group") {
      visible.push(item);
      continue;
    }
    visible.push(item);
    if (!expandedGroups[item.id]) continue;
    if (item.buckets.length <= 1) {
      for (const tool of item.tools) visible.push({ ...tool, indent: 1 });
      continue;
    }
    for (const bucket of item.buckets) {
      if (bucket.tools.length === 1) {
        const only = bucket.tools[0];
        if (only) visible.push({ ...only, indent: 1 });
        continue;
      }
      visible.push({ ...bucket, indent: 1 });
      if (expandedBuckets[bucket.id]) {
        for (const tool of bucket.tools) visible.push({ ...tool, indent: 2 });
      }
    }
  }
  return visible;
}

function isLiveTool(item: Extract<TranscriptItem, { kind: "tool" }>): boolean {
  return !/^(completed|success|failed|error|done)$/i.test(item.tool.status ?? "");
}

function isFailedTool(item: Extract<TranscriptItem, { kind: "tool" }>): boolean {
  const status = item.tool.status;
  return status === "failed" || status === "error";
}
