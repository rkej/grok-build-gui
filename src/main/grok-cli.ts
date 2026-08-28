import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;
export const GROK_INSTALL_SH = "https://x.ai/cli/install.sh";
export const GROK_INSTALL_PS1 = "https://x.ai/cli/install.ps1";

export async function runGrok(
  bin: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number },
): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      cwd: opts?.cwd,
      encoding: "utf8",
      timeout: opts?.timeoutMs ?? 60_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout || stderr || "";
  } catch (err) {
    const detail = grokError(err);
    throw new Error(detail);
  }
}

export async function runGrokJson<T = unknown>(
  bin: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number },
): Promise<T | null> {
  try {
    const raw = await runGrok(bin, args, opts);
    return parseLeadingJson<T>(raw);
  } catch {
    return null;
  }
}

export function isMissingGrokBinary(err: unknown): boolean {
  if (err == null) return false;
  const row = err as { code?: unknown; message?: unknown };
  if (String(row.code ?? "") === "ENOENT") return true;
  const message = String(row.message ?? (err instanceof Error ? err.message : err));
  return /not installed|not found|ENOENT|spawn grok/i.test(message);
}

export async function installGrokCli(): Promise<void> {
  const win = process.platform === "win32";
  const url = win ? GROK_INSTALL_PS1 : GROK_INSTALL_SH;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download the Grok CLI installer (${res.status}).`);
  const body = await res.text();
  if (!body.trim()) throw new Error("The Grok CLI installer was empty.");
  const dir = mkdtempSync(path.join(os.tmpdir(), "grok-cli-install-"));
  const file = path.join(dir, win ? "install.ps1" : "install.sh");
  writeFileSync(file, body, { encoding: "utf8", mode: 0o700 });
  try {
    if (win) {
      await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", file], {
        timeout: INSTALL_TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      });
    } else {
      await execFileAsync("bash", [file], {
        timeout: INSTALL_TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
      });
    }
  } catch (err) {
    throw new Error(grokError(err) || "Grok CLI install failed.");
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore temp cleanup
    }
  }
}

export function grokError(err: unknown): string {
  if (!err || typeof err !== "object") return String(err ?? "grok command failed");
  const row = err as { stderr?: string; stdout?: string; message?: string };
  return [row.stderr, row.stdout, row.message].filter(Boolean).join("\n").trim() || "grok command failed";
}

export function parseLeadingJson<T = unknown>(raw: string): T | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const objectAt = trimmed.indexOf("{");
  const arrayAt = trimmed.indexOf("[");
  let start = -1;
  if (objectAt >= 0 && arrayAt >= 0) start = Math.min(objectAt, arrayAt);
  else start = Math.max(objectAt, arrayAt);
  if (start < 0) return null;
  const slice = trimmed.slice(start);
  try {
    return JSON.parse(slice) as T;
  } catch {
    return null;
  }
}
