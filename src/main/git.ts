import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { GitChange, GitDiff, GitState } from "../shared/protocol.js";
import { resolveInside } from "../shared/workspace-path.js";

const exec = promisify(execFile);

function confined(cwd: string, filePath: string): string {
  const resolved = resolveInside(cwd, filePath);
  if (!resolved) throw new Error(`Refusing to touch a path outside the workspace: ${filePath}`);
  return path.relative(path.resolve(cwd), resolved) || ".";
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  return stdout;
}

export async function inspectGit(cwd: string): Promise<GitState> {
  try {
    await git(cwd, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return { isRepo: false, changes: [] };
  }

  let branch: string | undefined;
  let upstream: string | undefined;
  let ahead = 0;
  let behind = 0;
  try {
    branch = (await git(cwd, ["branch", "--show-current"])).trim() || undefined;
  } catch {}
  try {
    const sb = (await git(cwd, ["status", "-sb"])).split("\n")[0] ?? "";
    const aheadMatch = sb.match(/ahead (\d+)/);
    const behindMatch = sb.match(/behind (\d+)/);
    ahead = aheadMatch ? Number(aheadMatch[1]) : 0;
    behind = behindMatch ? Number(behindMatch[1]) : 0;
    const tracking = sb.match(/## [^\s.]+(?:\.\.\.([^\s]+))?/);
    if (tracking?.[1]) upstream = tracking[1];
  } catch {}

  const numstat = new Map<string, { insertions: number; deletions: number }>();
  for (const args of [
    ["diff", "--numstat"],
    ["diff", "--cached", "--numstat"],
  ]) {
    try {
      const out = await git(cwd, args);
      for (const line of out.split("\n")) {
        const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
        if (!match) continue;
        const path = match[3] ?? "";
        const current = numstat.get(path) ?? { insertions: 0, deletions: 0 };
        current.insertions += match[1] === "-" ? 0 : Number(match[1]);
        current.deletions += match[2] === "-" ? 0 : Number(match[2]);
        numstat.set(path, current);
      }
    } catch {}
  }

  const changes: GitChange[] = [];
  try {
    const porcelain = await git(cwd, ["status", "--porcelain=v1", "-uall"]);
    for (const line of porcelain.split("\n")) {
      if (!line) continue;
      const code = line.slice(0, 2);
      const rawPath = line.slice(3);
      const path = rawPath.includes(" -> ") ? (rawPath.split(" -> ").pop() ?? rawPath) : rawPath;
      const staged = code[0] !== " " && code[0] !== "?";
      const unstaged = code[1] !== " ";
      const letter = (unstaged ? code[1] : code[0]) ?? " ";
      const status =
        code === "??" ? "untracked"
        : letter === "A" || letter === "C" ? "added"
        : letter === "D" ? "deleted"
        : letter === "R" ? "renamed"
        : "modified";
      const stats = numstat.get(path);
      changes.push({
        path,
        status,
        staged,
        unstaged: unstaged || code === "??",
        insertions: stats?.insertions,
        deletions: stats?.deletions,
      });
    }
  } catch {}

  return { isRepo: true, branch, upstream, ahead, behind, changes };
}

export async function diffFile(cwd: string, filePath: string, staged = false): Promise<GitDiff> {
  const target = confined(cwd, filePath);
  const args = staged
    ? ["diff", "--cached", "--", target]
    : ["diff", "HEAD", "--", target];
  let diff = "";
  try {
    diff = await git(cwd, args);
  } catch (err) {
    diff = err instanceof Error ? err.message : String(err);
  }
  if (!diff.trim()) {
    try {
      diff = await git(cwd, ["diff", "--", target]);
    } catch {}
  }
  if (!diff.trim()) {
    try {
      const contents = await git(cwd, ["show", `:${target}`]);
      if (!contents) {
        const untracked = await git(cwd, ["status", "--porcelain", "--", target]);
        if (untracked.startsWith("??")) {
          diff = `--- /dev/null\n+++ b/${target}\n@@ new file @@\n`;
        }
      }
    } catch {}
  }
  let insertions = 0;
  let deletions = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) insertions += 1;
    if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }
  return { path: filePath, diff, staged, insertions, deletions };
}

export async function stageFile(cwd: string, filePath: string): Promise<void> {
  await git(cwd, ["add", "--", confined(cwd, filePath)]);
}

export async function unstageFile(cwd: string, filePath: string): Promise<void> {
  await git(cwd, ["restore", "--staged", "--", confined(cwd, filePath)]);
}

export async function discardFile(cwd: string, filePath: string): Promise<void> {
  const target = confined(cwd, filePath);
  const status = await git(cwd, ["status", "--porcelain", "--", target]);
  if (status.startsWith("??")) {
    await exec("git", ["clean", "-f", "--", target], { cwd });
    return;
  }
  await git(cwd, ["restore", "--worktree", "--", target]);
}
