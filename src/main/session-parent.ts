import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SessionActivity, SessionSummary } from "../shared/protocol.js";
import { sessionDir } from "./paths.js";

export function parentIdFromSessionRow(row: Record<string, any> | undefined | null): string | undefined {
  if (!row) return undefined;
  const meta = row._meta ?? {};
  const session = meta["x.ai/session"] ?? meta.session ?? {};
  return firstId(
    row.parentSessionId,
    row.parent_session_id,
    meta.parentSessionId,
    meta.parent_session_id,
    session.parentSessionId,
    session.parent_session_id,
    session.parent?.sessionId,
    session.parent?.session_id,
  );
}

export function parentIdFromDisk(sessionId: string, cwd: string): string | undefined {
  const metaPath = path.join(sessionDir(sessionId, cwd), "meta.json");
  if (!existsSync(metaPath)) return undefined;
  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Record<string, any>;
    return firstId(
      meta.parent_session_id,
      meta.parentSessionId,
      meta.parent?.session_id,
      meta.parent?.sessionId,
    );
  } catch {
    return undefined;
  }
}

export function listSubagentChildren(sessionId: string, cwd: string): { sessionId: string; parentSessionId: string; title?: string }[] {
  const dir = path.join(sessionDir(sessionId, cwd), "subagents");
  if (!existsSync(dir)) return [];
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const children: { sessionId: string; parentSessionId: string; title?: string }[] = [];
  for (const name of names) {
    const metaPath = path.join(dir, name, "meta.json");
    if (!existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Record<string, any>;
      const childId = firstId(meta.child_session_id, meta.sessionId, meta.session_id, name);
      const parentId = firstId(meta.parent_session_id, meta.parentSessionId, sessionId) ?? sessionId;
      if (!childId) continue;
      children.push({
        sessionId: childId,
        parentSessionId: parentId,
        title: typeof meta.title === "string"
          ? meta.title
          : typeof meta.name === "string"
            ? meta.name
            : typeof meta.description === "string"
              ? meta.description
              : typeof meta.subagent_type === "string"
                ? meta.subagent_type
                : undefined,
      });
    } catch {}
  }
  return children;
}

export function childSessionStub(
  child: { sessionId: string; parentSessionId: string; title?: string },
  cwd: string,
): SessionSummary {
  return {
    sessionId: child.sessionId,
    cwd,
    title: child.title?.trim() || "Subagent",
    summary: "",
    modelId: "",
    createdAt: null,
    updatedAt: "",
    numMessages: 0,
    activity: "idle" as SessionActivity,
    kind: "subagent",
    parentSessionId: child.parentSessionId,
  };
}

function firstId(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}
