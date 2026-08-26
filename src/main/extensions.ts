import type { AddMcpInput, McpServerRecord, PluginRecord } from "../shared/protocol.js";
import { runGrok, runGrokJson } from "./grok-cli.js";

const MCP_NAME_RE = /^[A-Za-z0-9_-]+$/;

export async function listMcpFromCli(bin: string, cwd: string): Promise<McpServerRecord[]> {
  const json = await runGrokJson<any>(bin, ["mcp", "list", "--json"], { cwd: cwd || undefined, timeoutMs: 15_000 });
  if (!json) return [];
  const rows = namedRows(json.servers ?? json.mcp_servers ?? json.mcpServers ?? json);
  return rows.map(mcpFromRow).filter((row): row is McpServerRecord => Boolean(row?.name));
}

export async function listPluginsFromCli(bin: string, cwd: string): Promise<PluginRecord[]> {
  const json = await runGrokJson<any>(bin, ["plugin", "list", "--json"], { cwd: cwd || undefined, timeoutMs: 15_000 });
  if (!json) return [];
  const rows = namedRows(json.plugins ?? json.installed ?? json);
  return rows.map(pluginFromRow).filter((row): row is PluginRecord => Boolean(row?.name));
}

export async function addMcpServer(bin: string, cwd: string, input: AddMcpInput): Promise<void> {
  const name = input.name.trim();
  if (!MCP_NAME_RE.test(name)) {
    throw new Error("MCP server names may only contain letters, numbers, hyphens, and underscores.");
  }
  const args = ["mcp", "add", "--scope", input.scope === "project" ? "project" : "user"];
  const transport = input.transport ?? (input.url ? "http" : "stdio");
  if (transport !== "stdio") args.push("--transport", transport);
  for (const [key, value] of Object.entries(input.env ?? {})) {
    if (!key.trim()) continue;
    args.push("-e", `${key}=${value}`);
  }
  for (const [key, value] of Object.entries(input.headers ?? {})) {
    if (!key.trim()) continue;
    args.push("--header", `${key}: ${value}`);
  }
  args.push(name);
  if (transport === "stdio") {
    const command = (input.command ?? "").trim();
    if (!command) throw new Error("A command is required for stdio MCP servers.");
    const commandParts = splitCommand(command);
    const extra = (input.args ?? []).map((part) => part.trim()).filter(Boolean);
    args.push("--", ...commandParts, ...extra);
  } else {
    const url = (input.url ?? "").trim();
    if (!url) throw new Error("A URL is required for HTTP/SSE MCP servers.");
    args.push(url);
  }
  await runGrok(bin, args, { cwd: cwd || undefined, timeoutMs: 90_000 });
}

export async function setMcpEnabled(bin: string, cwd: string, name: string, enabled: boolean): Promise<void> {
  await runGrok(bin, ["mcp", enabled ? "enable" : "disable", name], { cwd: cwd || undefined });
}

export async function removeMcpServer(bin: string, cwd: string, name: string, scope?: "user" | "project"): Promise<void> {
  const args = ["mcp", "remove", name];
  if (scope) args.push("--scope", scope);
  await runGrok(bin, args, { cwd: cwd || undefined });
}

export async function installPlugin(bin: string, cwd: string, source: string, trust: boolean): Promise<void> {
  const target = source.trim();
  if (!target) throw new Error("Enter a plugin source: owner/repo, a git URL, or a local path.");
  if (!trust) throw new Error("Installing a plugin enables its skills, hooks, and MCP servers. Confirm you trust this source.");
  await runGrok(bin, ["plugin", "install", target, "--trust"], { cwd: cwd || undefined, timeoutMs: 180_000 });
}

export async function setPluginEnabled(bin: string, cwd: string, name: string, enabled: boolean): Promise<void> {
  await runGrok(bin, ["plugin", enabled ? "enable" : "disable", name], { cwd: cwd || undefined });
}

export async function uninstallPlugin(bin: string, cwd: string, name: string): Promise<void> {
  await runGrok(bin, ["plugin", "uninstall", name, "--confirm"], { cwd: cwd || undefined, timeoutMs: 90_000 });
}

function mcpFromRow(row: any): McpServerRecord | null {
  const name = String(row?.name ?? row?.id ?? "").trim();
  if (!name) return null;
  const command = Array.isArray(row?.args) && row?.command
    ? [row.command, ...row.args].join(" ")
    : row?.command
      ? String(row.command)
      : undefined;
  return {
    name,
    displayName: row?.displayName ?? row?.title ?? name,
    enabled: row?.enabled ?? row?.session?.enabled,
    status: row?.status ?? row?.session?.status,
    source: row?.source ?? row?.origin,
    transport: row?.transport ?? (row?.url ? "http" : row?.command ? "stdio" : undefined),
    command,
    url: row?.url,
    scope: row?.scope,
  };
}

function pluginFromRow(row: any): PluginRecord | null {
  const name = String(row?.name ?? row?.id ?? "").trim();
  if (!name) return null;
  return {
    name,
    enabled: row?.enabled !== false,
    version: row?.version,
    source: row?.source ?? row?.marketplace ?? row?.origin,
    path: row?.path ?? row?.filePath,
    description: row?.description,
  };
}

function splitCommand(command: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i] ?? "";
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

function namedRows(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.name === "string") return [record];
    const entries = Object.entries(record);
    if (entries.some(([, row]) => row && typeof row === "object" && !Array.isArray(row))) {
      return entries.map(([name, row]) => (row && typeof row === "object" ? { name, ...(row as object) } : { name }));
    }
  }
  return [];
}
