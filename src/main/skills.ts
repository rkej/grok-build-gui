import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CreateSkillInput, SkillRecord } from "../shared/protocol.js";
import { grokHome, userConfigPath } from "./paths.js";
import { runGrokJson } from "./grok-cli.js";
import { readTomlStringArray, writeTomlStringArray } from "./toml-edit.js";

const SKILL_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const PRIORITY: Record<string, number> = {
  local: 50,
  project: 40,
  user: 30,
  config: 25,
  plugin: 20,
  server: 15,
  bundled: 10,
  unknown: 0,
};

export function isValidSkillName(name: string): boolean {
  return SKILL_NAME_RE.test(name) && name.length >= 2 && name.length <= 64;
}

export async function discoverSkills(opts: { cwd: string; grokBin: string }): Promise<SkillRecord[]> {
  const disabled = new Set(readDisabledSkillNames());
  const byName = new Map<string, SkillRecord>();
  for (const skill of scanSkillFiles(opts.cwd)) {
    const current = byName.get(skill.name);
    if (!current || skillPriority(skill.source) >= skillPriority(current.source)) {
      byName.set(skill.name, withEnabled(skill, disabled));
    }
  }
  const inspected = await inspectSkills(opts);
  for (const skill of inspected) {
    const current = byName.get(skill.name);
    if (!current) {
      byName.set(skill.name, withEnabled(skill, disabled));
      continue;
    }
    byName.set(skill.name, withEnabled({
      ...current,
      ...skill,
      filePath: skill.filePath || current.filePath,
      source: skill.source || current.source,
      description: skill.description || current.description,
    }, disabled));
  }
  return [...byName.values()].sort((a, b) => {
    const source = skillPriority(b.source) - skillPriority(a.source);
    if (source !== 0) return source;
    return a.name.localeCompare(b.name);
  });
}

export function createSkill(cwd: string, input: CreateSkillInput): SkillRecord {
  const name = input.name.trim().toLowerCase();
  if (!isValidSkillName(name)) {
    throw new Error("Skill names must be 2–64 characters: lowercase letters, digits, and hyphens, starting and ending with a letter or digit.");
  }
  const description = input.description.trim();
  if (!description) throw new Error("A description is required so Grok knows when to use the skill.");
  const root = input.scope === "user" ? path.join(grokHome(), "skills") : path.join(projectSkillRoot(cwd), ".grok", "skills");
  const dir = path.join(root, name);
  const filePath = path.join(dir, "SKILL.md");
  if (existsSync(filePath)) throw new Error(`A skill named "${name}" already exists at ${filePath}.`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, renderSkillMarkdown(name, description, input.body), "utf8");
  return {
    name,
    description,
    enabled: true,
    source: input.scope === "user" ? "user" : "project",
    filePath,
    slashCommand: `/${name}`,
    manageable: true,
  };
}

export function setSkillEnabled(name: string, enabled: boolean): void {
  const configPath = userConfigPath();
  const current = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  const disabled = new Set(readTomlStringArray(current, "skills", "disabled"));
  if (enabled) disabled.delete(name);
  else disabled.add(name);
  const next = writeTomlStringArray(current, "skills", "disabled", [...disabled].sort());
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, next, "utf8");
}

export function deleteSkill(filePath: string): void {
  if (!filePath) throw new Error("Missing skill path.");
  const resolved = path.resolve(filePath);
  if (!isManageableSkillPath(resolved)) {
    throw new Error("Only user or project skills can be deleted from the GUI.");
  }
  const dir = path.basename(resolved) === "SKILL.md" ? path.dirname(resolved) : resolved;
  if (!existsSync(dir)) throw new Error("Skill folder is already gone.");
  rmSync(dir, { recursive: true, force: true });
}

export function isManageableSkillPath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const userSkills = path.join(path.resolve(grokHome()), "skills");
  if (isInside(userSkills, resolved)) return true;
  const normalized = resolved.split(path.sep).join("/");
  return /\/(\.grok|\.agents)\/skills\//.test(normalized) && !normalized.includes("/plugins/");
}

function withEnabled(skill: SkillRecord, disabled: Set<string>): SkillRecord {
  return { ...skill, enabled: skill.enabled !== false && !disabled.has(skill.name) };
}

function skillPriority(source: string): number {
  const key = source.startsWith("plugin") ? "plugin" : source;
  return PRIORITY[key] ?? 0;
}

function readDisabledSkillNames(): string[] {
  const configPath = userConfigPath();
  if (!existsSync(configPath)) return [];
  try {
    return readTomlStringArray(readFileSync(configPath, "utf8"), "skills", "disabled");
  } catch {
    return [];
  }
}

async function inspectSkills(opts: { cwd: string; grokBin: string }): Promise<SkillRecord[]> {
  const json = await runGrokJson<any>(opts.grokBin, ["inspect", "--json"], { cwd: opts.cwd || undefined, timeoutMs: 6_000 });
  if (!json) return [];
  const rows = skillRows(json.skills ?? json.Skills ?? json.inventory?.skills);
  return rows.map((row) => skillFromInspect(row)).filter((row): row is SkillRecord => Boolean(row?.name));
}

function skillRows(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([name, row]) =>
      row && typeof row === "object" ? { name, ...(row as object) } : { name },
    );
  }
  return [];
}

function skillFromInspect(row: any): SkillRecord | null {
  const name = String(row?.name ?? row?.id ?? "").trim();
  if (!name) return null;
  const sourceRaw = row?.source;
  const source =
    typeof sourceRaw === "string"
      ? sourceRaw
      : String(sourceRaw?.kind ?? sourceRaw?.type ?? sourceRaw?.name ?? "unknown");
  const filePath = String(row?.filePath ?? row?.path ?? sourceRaw?.path ?? "").trim() || undefined;
  const enabled = row?.enabled !== false && row?.disabled !== true;
  return {
    name,
    description: String(row?.description ?? "").trim() || undefined,
    enabled,
    source: source.replace(/^plugin:\s*/i, "plugin"),
    filePath,
    slashCommand: String(row?.invocableAs ?? row?.slashCommand ?? `/${name}`),
    disableModelInvocation: Boolean(row?.disableModelInvocation ?? row?.["disable-model-invocation"]),
    userInvocable: row?.userInvocable,
    manageable: isUserOrProjectSource(source),
  };
}

function scanSkillFiles(cwd: string): SkillRecord[] {
  const skills: SkillRecord[] = [];
  for (const root of skillRoots(cwd)) {
    if (!existsSync(root.dir)) continue;
    for (const filePath of findSkillFiles(root.dir, 5)) {
      const parsed = readSkillFile(filePath, root.source);
      if (parsed) skills.push(parsed);
    }
  }
  return skills;
}

function skillRoots(cwd: string): { dir: string; source: string }[] {
  const home = grokHome();
  const resolvedCwd = cwd ? path.resolve(cwd) : "";
  const repo = resolvedCwd ? findGitRoot(resolvedCwd) : null;
  const roots: { dir: string; source: string }[] = [
    { dir: path.join(home, "bundled", "skills"), source: "bundled" },
    { dir: path.join(home, "skills"), source: "user" },
    { dir: path.join(os.homedir(), ".claude", "skills"), source: "user" },
    { dir: path.join(os.homedir(), ".cursor", "skills"), source: "user" },
    { dir: path.join(home, "plugins"), source: "plugin" },
  ];
  for (const dir of [repo, resolvedCwd].filter(Boolean) as string[]) {
    const source = repo && dir === repo ? "project" : "local";
    roots.push(
      { dir: path.join(dir, ".grok", "skills"), source },
      { dir: path.join(dir, ".agents", "skills"), source },
      { dir: path.join(dir, ".claude", "skills"), source },
      { dir: path.join(dir, ".cursor", "skills"), source },
      { dir: path.join(dir, ".grok", "plugins"), source: "plugin" },
    );
  }
  return roots;
}

function findSkillFiles(root: string, maxDepth: number): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth < 0) return;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    if (entries.includes("SKILL.md")) {
      out.push(path.join(dir, "SKILL.md"));
      return;
    }
    for (const name of entries) {
      if (name === "node_modules" || name === ".git" || name.startsWith(".")) continue;
      const next = path.join(dir, name);
      try {
        if (statSync(next).isDirectory()) walk(next, depth - 1);
      } catch {
        continue;
      }
    }
  };
  walk(root, maxDepth);
  return out;
}

function readSkillFile(filePath: string, source: string): SkillRecord | null {
  try {
    const raw = readFileSync(filePath, "utf8");
    const { fields, body } = parseFrontmatter(raw);
    const dirName = path.basename(path.dirname(filePath));
    const name = normalizeSkillName(fields.name || dirName);
    if (!name) return null;
    const description = fields.description?.trim() || firstParagraph(body);
    return {
      name,
      description,
      enabled: true,
      source: source === "plugin" ? pluginSourceLabel(filePath) : source,
      filePath,
      slashCommand: `/${name}`,
      disableModelInvocation: isTruthy(fields["disable-model-invocation"]),
      userInvocable: fields["user-invocable"] ? isTruthy(fields["user-invocable"]) : true,
      manageable: isUserOrProjectSource(source),
    };
  } catch {
    return null;
  }
}

function pluginSourceLabel(filePath: string): string {
  const parts = filePath.split(path.sep);
  const skillsAt = parts.lastIndexOf("skills");
  const pluginName = skillsAt > 0 ? parts[skillsAt - 1] : "";
  return pluginName ? `plugin:${pluginName}` : "plugin";
}

function parseFrontmatter(content: string): { fields: Record<string, string>; body: string } {
  if (!content.startsWith("---")) return { fields: {}, body: content };
  const end = content.indexOf("\n---", 3);
  if (end < 0) return { fields: {}, body: content };
  const raw = content.slice(3, end).replace(/^\r?\n/, "");
  const body = content.slice(end + 4).replace(/^\r?\n/, "");
  const fields: Record<string, string> = {};
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) {
      i += 1;
      continue;
    }
    const key = match[1] ?? "";
    let value = (match[2] ?? "").trim();
    if (value === ">" || value === "|" || value === ">-" || value === "|-") {
      const folded: string[] = [];
      i += 1;
      while (i < lines.length) {
        const next = lines[i] ?? "";
        if (next.trim() === "") {
          folded.push("");
          i += 1;
          continue;
        }
        if (/^\s/.test(next)) {
          folded.push(next.trim());
          i += 1;
          continue;
        }
        break;
      }
      fields[key] = folded.join(" ").replace(/\s+/g, " ").trim();
      continue;
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
    i += 1;
  }
  return { fields, body };
}

function firstParagraph(body: string): string | undefined {
  const text = body
    .split(/\n\s*\n/)
    .map((part) => part.replace(/^#+\s+/, "").trim())
    .find((part) => part.length > 0);
  return text || undefined;
}

function normalizeSkillName(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["true", "yes", "1"].includes(value.trim().toLowerCase());
}

function isUserOrProjectSource(source: string): boolean {
  return source === "user" || source === "project" || source === "local" || source === "config";
}

function projectSkillRoot(cwd: string): string {
  return findGitRoot(cwd) ?? path.resolve(cwd);
}

export function findGitRoot(cwd: string): string | null {
  let dir = path.resolve(cwd);
  while (true) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function renderSkillMarkdown(name: string, description: string, body?: string): string {
  const title = name
    .split("-")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
  const instructions = body?.trim() || `Follow this workflow whenever it applies.\n\n## Steps\n\n1. Clarify the request.\n2. Do the work described by this skill.\n3. Summarize what changed.`;
  return `---\nname: ${name}\ndescription: ${yamlFold(description)}\n---\n\n# ${title}\n\n${instructions}\n`;
}

function yamlFold(value: string): string {
  return JSON.stringify(value.replace(/\n+/g, " ").trim());
}

function isInside(root: string, candidate: string): boolean {
  const base = path.resolve(root);
  const resolved = path.resolve(candidate);
  const relative = path.relative(base, resolved);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
