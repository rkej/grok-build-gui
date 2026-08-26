import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { FilePreview, FileTreeNode } from "../shared/protocol.js";
import { resolveInside } from "../shared/workspace-path.js";

const SKIP = new Set([
  ".git",
  "node_modules",
  "dist",
  "out",
  "build",
  ".next",
  ".cache",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  ".turbo",
  ".idea",
]);

const MAX_NODES = 2500;
const MAX_DEPTH = 8;
const MAX_FILE_BYTES = 400_000;

export function listTree(cwd: string): FileTreeNode[] {
  if (!cwd || !existsSync(cwd)) return [];
  let count = 0;
  const walk = (dir: string, depth: number): FileTreeNode[] => {
    if (depth > MAX_DEPTH || count >= MAX_NODES) return [];
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return [];
    }
    const nodes: FileTreeNode[] = [];
    const sorted = entries
      .filter((name) => !SKIP.has(name) && name !== ".DS_Store")
      .sort((a, b) => a.localeCompare(b));
    for (const name of sorted) {
      if (count >= MAX_NODES) break;
      const full = path.join(dir, name);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      const rel = path.relative(cwd, full) || name;
      count += 1;
      if (stat.isDirectory()) {
        nodes.push({ name, path: rel, type: "dir", children: walk(full, depth + 1) });
      } else if (stat.isFile()) {
        nodes.push({ name, path: rel, type: "file" });
      }
    }
    return nodes;
  };
  return walk(cwd, 0);
}

export function readWorkspaceFile(cwd: string, relPath: string): FilePreview {
  const resolved = resolveInside(cwd, relPath);
  if (!resolved) {
    return { path: relPath, error: "Path is outside the workspace." };
  }
  if (!existsSync(resolved)) {
    return { path: relPath, error: "File not found." };
  }
  let stat;
  try {
    stat = statSync(resolved);
  } catch (err) {
    return { path: relPath, error: err instanceof Error ? err.message : String(err) };
  }
  if (stat.isDirectory()) {
    return { path: relPath, error: "That path is a directory." };
  }
  if (stat.size > MAX_FILE_BYTES) {
    return { path: relPath, truncated: true, text: readFileSync(resolved, { encoding: "utf8" }).slice(0, MAX_FILE_BYTES), language: languageFor(relPath) };
  }
  const buf = readFileSync(resolved);
  if (buf.includes(0)) {
    return { path: relPath, binary: true };
  }
  return { path: relPath, text: buf.toString("utf8"), language: languageFor(relPath) };
}

function languageFor(filePath: string): string | undefined {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    css: "css",
    md: "markdown",
    py: "python",
    rs: "rust",
    go: "go",
    sh: "bash",
    zsh: "bash",
    yml: "yaml",
    yaml: "yaml",
    html: "xml",
    svg: "xml",
  };
  return map[ext];
}
