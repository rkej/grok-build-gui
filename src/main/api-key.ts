import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { normalizeApiKey } from "../shared/auth.js";
import { grokHome, guiApiKeyPath } from "./paths.js";

export function loadStoredApiKey(): string | null {
  try {
    const key = normalizeApiKey(readFileSync(guiApiKeyPath(), "utf8"));
    return key || null;
  } catch {
    return null;
  }
}

export function persistApiKey(key: string): void {
  mkdirSync(grokHome(), { recursive: true });
  const file = guiApiKeyPath();
  writeFileSync(file, `${key}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(file, 0o600);
  } catch {
    // Best-effort on filesystems that ignore mode.
  }
}

/** Prefer a launch-time env key; otherwise load one pasted in this shell. */
export function applyStoredApiKey(): void {
  if (process.env.XAI_API_KEY?.trim()) return;
  const key = loadStoredApiKey();
  if (key) process.env.XAI_API_KEY = key;
}
