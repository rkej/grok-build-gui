import { homedir } from "node:os";
import path from "node:path";

/**
 * Grok CLI home. Session JSONL (`~/.grok/sessions`) is the source of truth
 * for transcripts. This GUI also writes chrome state to `gui-state.json`.
 */
export function grokHome(): string {
  return process.env.GROK_HOME || path.join(homedir(), ".grok");
}

export function guiStatePath(): string {
  return path.join(grokHome(), "gui-state.json");
}

export function authPath(): string {
  return path.join(grokHome(), "auth.json");
}

/** Owner-only file for an API key pasted in this desktop shell. */
export function guiApiKeyPath(): string {
  return path.join(grokHome(), "gui-api-key");
}

export function userConfigPath(): string {
  return path.join(grokHome(), "config.toml");
}

export function sessionDir(sessionId: string, cwd: string): string {
  return path.join(grokHome(), "sessions", encodeURIComponent(cwd), sessionId);
}

/**
 * Packaged Electron apps inherit a stripped PATH. Prepend the directories
 * where `grok` and Homebrew binaries usually live so the agent child and
 * the integrated terminal can find them.
 */
export function posixPathWithDefaults(
  current: string,
  home = homedir(),
  platform = process.platform,
): { path: string; changed: boolean } {
  if (platform === "win32") return { path: current, changed: false };
  const extras = [
    path.join(home, ".grok", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  const parts = current.split(path.delimiter).filter(Boolean);
  const seen = new Set(parts);
  const prefix: string[] = [];
  for (const dir of extras) {
    if (seen.has(dir)) continue;
    prefix.push(dir);
    seen.add(dir);
  }
  if (!prefix.length) return { path: current, changed: false };
  return { path: [...prefix, ...parts].join(path.delimiter), changed: true };
}

export function applyPosixPathDefaults(): void {
  const next = posixPathWithDefaults(process.env.PATH ?? "");
  if (next.changed) process.env.PATH = next.path;
}
