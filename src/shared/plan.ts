import type { PlanEntry, PlanStatus } from "./protocol.js";

function asStatus(value: unknown): PlanStatus {
  const text = String(value ?? "").toLowerCase();
  if (text === "completed" || text === "complete" || text === "done" || text === "success") return "completed";
  if (text === "in_progress" || text === "in-progress" || text === "running" || text === "active") return "in_progress";
  if (text === "cancelled" || text === "canceled" || text === "skipped") return "cancelled";
  return "pending";
}

export function parsePlanEntries(raw: unknown): PlanEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const entries: PlanEntry[] = [];
    raw.forEach((row, index) => {
      if (typeof row === "string" && row.trim()) {
        entries.push({ id: String(index + 1), content: row.trim(), status: "pending" });
        return;
      }
      if (!row || typeof row !== "object") return;
      const record = row as Record<string, unknown>;
      const content = String(record.content ?? record.title ?? record.text ?? record.label ?? "").trim();
      if (!content) return;
      entries.push({
        id: record.id != null ? String(record.id) : content,
        content,
        status: asStatus(record.status),
        priority: record.priority != null ? String(record.priority) : undefined,
      });
    });
    return entries;
  }
  if (typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  if ("todos" in record) return parsePlanEntries(record.todos);
  if ("entries" in record) return parsePlanEntries(record.entries);
  if ("Tasks" in record) return parsePlanEntries(record.Tasks);
  const values = Object.entries(record);
  if (values.length && values.every(([, value]) => value && typeof value === "object")) {
    return values.flatMap(([id, value]) => {
      const row = value as Record<string, unknown>;
      const content = String(row.content ?? row.title ?? row.text ?? "").trim();
      if (!content) return [];
      return [{ id, content, status: asStatus(row.status), priority: row.priority != null ? String(row.priority) : undefined }];
    });
  }
  return [];
}

export function mergePlanEntries(current: PlanEntry[], incoming: PlanEntry[], merge: boolean): PlanEntry[] {
  if (!merge || current.length === 0) return incoming.length ? incoming : current;
  const next = current.map((entry) => ({ ...entry }));
  for (const entry of incoming) {
    const idx = next.findIndex((row) => (entry.id && row.id === entry.id) || row.content === entry.content);
    if (idx >= 0) next[idx] = { ...next[idx], ...entry };
    else next.push(entry);
  }
  return next;
}

export function isPlanTool(tool: { title?: string; name?: string; kind?: string; meta?: any; rawInput?: any } | null | undefined): boolean {
  if (!tool) return false;
  const meta = tool.meta?.["x.ai/tool"] ?? tool.meta?.["x.ai/tool"];
  if (meta?.kind === "plan" || meta?.name === "todo_write") return true;
  if (tool.kind === "plan" || (tool.kind === "think" && /plan/i.test(tool.title ?? ""))) return true;
  return /todo_write|updating plan|^plan$/i.test(`${tool.title ?? ""} ${tool.name ?? ""}`);
}

export function extractTodosFromTool(tool: any): { entries: PlanEntry[]; merge: boolean } | null {
  if (!tool) return null;
  const input = tool.rawInput ?? tool.input ?? tool.arguments;
  const output = tool.rawOutput ?? tool.content;
  const outputTodos = output?.TodosUpdated?.todos ?? output?.todos ?? output?.result?.todos;
  const inputTodos = input?.todos ?? input?.entries;
  const entries = parsePlanEntries(outputTodos ?? inputTodos);
  if (!entries.length) return isPlanTool(tool) ? { entries: [], merge: Boolean(input?.merge) } : null;
  return { entries, merge: Boolean(input?.merge) };
}

export function planProgress(entries: PlanEntry[]): {
  done: number;
  cancelled: number;
  total: number;
  pct: number;
  current?: PlanEntry;
  currentIndex: number;
} {
  const active = entries.filter((entry) => entry.status !== "cancelled");
  const done = active.filter((entry) => entry.status === "completed").length;
  const cancelled = entries.length - active.length;
  const total = active.length;
  const currentIndex = entries.findIndex((entry) => entry.status === "in_progress");
  const pendingIndex = currentIndex < 0 ? entries.findIndex((entry) => entry.status === "pending") : currentIndex;
  return {
    done,
    cancelled,
    total,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
    current: pendingIndex >= 0 ? entries[pendingIndex] : undefined,
    currentIndex: pendingIndex,
  };
}
