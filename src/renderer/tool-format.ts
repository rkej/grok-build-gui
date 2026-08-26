import type { ToolCallState } from "../shared/protocol";

export function toolName(tool: ToolCallState): string {
  const meta = (tool.meta as { ["x.ai/tool"]?: { name?: string; kind?: string } } | undefined)?.["x.ai/tool"];
  return (tool.name || meta?.name || tool.title || "tool").replace(/^grok_build\./, "");
}

export function isWriteTool(name: string): boolean {
  return /write|edit|patch|apply|search_replace/i.test(name);
}

export function extractFilename(input: unknown): string {
  if (typeof input === "string" && looksLikePath(input)) return input;
  if (!isRecord(input)) return "";
  for (const key of ["target_file", "file_path", "filePath", "path", "filename", "uri"]) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function shortenPath(filePath: string): string {
  const parts = filePath.split("/").filter(Boolean);
  if (parts.length <= 3) return filePath;
  return parts.slice(-3).join("/");
}

export function toolLabel(tool: ToolCallState): string {
  const name = toolName(tool);
  const input = tool.rawInput;
  const file = extractFilename(input);
  const short = file ? shortenPath(file) : "";
  const detail = inputLabel(input);

  if (isWriteTool(name) && short) return `Edited ${short}`;
  if (/^read(_file)?$/i.test(name) || (/read/i.test(name) && Boolean(short))) return short ? `Read ${short}` : "Read a file";
  if (/grep|search/i.test(name) && !/replace/i.test(name)) return detail ? `Searched ${detail}` : `Searched with ${name}`;
  if (/glob|list_dir|ls/i.test(name)) return detail ? `Explored ${detail}` : `Explored files with ${name}`;
  if (/web_fetch|open_page|fetch/i.test(name)) return detail ? `Fetched ${detail}` : `Ran ${name}`;
  if (/web_search/i.test(name)) return detail ? `Searched ${detail}` : "Searched the web";
  if (/bash|shell|terminal|command|exec/i.test(name)) return detail ? `Ran ${detail}` : `Ran ${name}`;
  if (/subagent|spawn/i.test(name)) return detail ? `Started ${detail}` : "Started subagent";
  if (detail) return `Ran ${name}: ${detail}`;
  return name === tool.title ? `Ran ${name}` : tool.title;
}

export function toolDetail(tool: ToolCallState): string | undefined {
  const status = tool.status;
  if (status === "failed" || status === "error") {
    return detailFromOutput(tool.rawOutput ?? tool.content);
  }
  return undefined;
}

export function extractDiffFromTool(tool: ToolCallState): string | undefined {
  if (tool.diff && typeof tool.diff === "object" && (tool.diff.oldText != null || tool.diff.newText != null)) {
    return unifiedFromSides(tool.diff.path || extractFilename(tool.rawInput), tool.diff.oldText, tool.diff.newText);
  }
  return extractDiffFromOutput(tool.content) ?? extractDiffFromOutput(tool.rawOutput);
}

export function extractDiffFromOutput(output: unknown): string | undefined {
  if (typeof output === "string" && (output.includes("@@") || output.startsWith("diff "))) return output;
  if (!isRecord(output)) return undefined;
  if (typeof output.diff === "string") return output.diff;
  if (isRecord(output.details) && typeof output.details.diff === "string") return output.details.diff;
  if (output.type === "diff") {
    return unifiedFromSides(String(output.path ?? "file"), String(output.oldText ?? ""), String(output.newText ?? ""));
  }
  if (Array.isArray(output.content) || Array.isArray(output)) {
    const parts: unknown[] = Array.isArray(output.content)
      ? output.content
      : (Array.isArray(output) ? (output as unknown as unknown[]) : []);
    for (const part of parts) {
      if (!isRecord(part)) continue;
      if (part.type === "diff") {
        return unifiedFromSides(String(part.path ?? "file"), String(part.oldText ?? ""), String(part.newText ?? ""));
      }
      const nested = extractDiffFromOutput(part.content ?? part);
      if (nested) return nested;
    }
  }
  return undefined;
}

export function formatToolBody(tool: ToolCallState): string {
  const output = unwrapText(tool.content) || unwrapText(tool.rawOutput);
  if (output) return output;
  const command = inputLabel(tool.rawInput, ["command", "cmd"]);
  if (command && /bash|shell|terminal|command/i.test(toolName(tool))) return command;
  return "";
}

export function countDiffStats(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) added += 1;
    else if (line.startsWith("-") && !line.startsWith("---")) removed += 1;
  }
  return { added, removed };
}

function inputLabel(input: unknown, keys = ["pattern", "query", "q", "command", "cmd", "url", "prompt", "description", "target_file", "file_path", "path", "glob"]): string | undefined {
  if (typeof input === "string") return truncate(input, 80);
  if (!isRecord(input)) return undefined;
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      const text = key === "target_file" || key === "file_path" || key === "path" ? shortenPath(value.trim()) : value.trim();
      return truncate(text, 80);
    }
  }
  return undefined;
}

function detailFromOutput(output: unknown): string | undefined {
  const text = unwrapText(output);
  if (text) return truncate(text, 160);
  if (output == null) return undefined;
  if (isRecord(output)) {
    const err = stringProp(output, "error") ?? stringProp(output, "message") ?? stringProp(output, "stderr");
    if (err) return truncate(err, 160);
  }
  return undefined;
}

function unwrapText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value) return "";
  if (Array.isArray(value)) {
    return value.map((part) => unwrapText(part)).filter(Boolean).join("\n").trim();
  }
  if (!isRecord(value)) return "";
  if (typeof value.text === "string") return value.text;
  if (typeof value.stdout === "string" || typeof value.stderr === "string") {
    return [value.stdout, value.stderr].filter((part) => typeof part === "string" && part.trim()).join("\n\n");
  }
  if (typeof value.output === "string") return value.output;
  if (Array.isArray(value.content)) return unwrapText(value.content);
  if (value.content) return unwrapText(value.content);
  if (value.type === "text" && typeof value.text === "string") return value.text;
  return "";
}

function unifiedFromSides(path: string, oldText?: string, newText?: string): string {
  const left = (oldText ?? "").split("\n");
  const right = (newText ?? "").split("\n");
  const lines = [`--- a/${path}`, `+++ b/${path}`];
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) {
    if (left[i] === right[i]) lines.push(` ${left[i] ?? ""}`);
    else {
      if (left[i] != null) lines.push(`-${left[i]}`);
      if (right[i] != null) lines.push(`+${right[i]}`);
    }
  }
  return lines.join("\n");
}

function looksLikePath(value: string): boolean {
  return value.includes("/") || /\.\w+$/.test(value);
}

function truncate(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
}

function stringProp(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
