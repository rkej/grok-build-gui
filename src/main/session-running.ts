import { closeSync, fstatSync, openSync, readSync } from "node:fs";

const READ_CHUNK_BYTES = 64 * 1024;
const MAX_UNFINISHED_TURN_AGE_MS = 6 * 60 * 60 * 1000;

type TurnBoundary = "started" | "finished";

export function turnBoundaryFromUpdateLine(line: string): TurnBoundary | null {
  if (!line.includes("user_message_chunk") && !line.includes("turn_completed") && !line.includes("response_completed")) {
    return null;
  }
  try {
    const row = JSON.parse(line) as { params?: { update?: { sessionUpdate?: unknown } } };
    const kind = row.params?.update?.sessionUpdate;
    if (kind === "user_message_chunk") return "started";
    if (kind === "turn_completed" || kind === "response_completed") return "finished";
  } catch {
    // A partial final line is expected while another process writes.
  }
  return null;
}

/**
 * Infer cross-process activity from the session JSONL source of truth. The ACP
 * session list has no activity field, so the newest turn boundary is the only
 * reliable signal for threads owned by another Grok process.
 */
export function sessionUpdateFileAppearsWorking(file: string, now = Date.now()): boolean {
  let fd: number | null = null;
  try {
    fd = openSync(file, "r");
    const stat = fstatSync(fd);
    if (now - stat.mtimeMs > MAX_UNFINISHED_TURN_AGE_MS) return false;

    let position = stat.size;
    let leadingFragment = "";
    while (position > 0) {
      const start = Math.max(0, position - READ_CHUNK_BYTES);
      const buffer = Buffer.allocUnsafe(position - start);
      readSync(fd, buffer, 0, buffer.length, start);
      const parts = `${buffer.toString("utf8")}${leadingFragment}`.split("\n");
      leadingFragment = parts.shift() ?? "";
      for (let index = parts.length - 1; index >= 0; index -= 1) {
        const boundary = turnBoundaryFromUpdateLine(parts[index] ?? "");
        if (boundary) return boundary === "started";
      }
      position = start;
    }
    return turnBoundaryFromUpdateLine(leadingFragment) === "started";
  } catch {
    return false;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}
