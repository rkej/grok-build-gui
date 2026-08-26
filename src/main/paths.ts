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

export function userConfigPath(): string {
  return path.join(grokHome(), "config.toml");
}

export function sessionDir(sessionId: string, cwd: string): string {
  return path.join(grokHome(), "sessions", encodeURIComponent(cwd), sessionId);
}
