import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { JsonRpcStream, type JsonRpcMessage } from "./rpc.js";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "resource_link"; uri: string; name?: string; mimeType?: string; _meta?: unknown }
  | Record<string, unknown>;

export function resolveGrokBin(): string {
  const candidates = [
    process.env.GROK_BIN,
    path.join(os.homedir(), ".grok", "bin", "grok"),
    "/usr/local/bin/grok",
    "/opt/homebrew/bin/grok",
  ].filter((x): x is string => Boolean(x));
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "grok";
}

export class GrokAcpClient extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null;
  rpc: JsonRpcStream | null = null;
  grokBin = resolveGrokBin();
  connected = false;
  initializeResult: any = null;
  lastAuthMethodId: string | null = null;

  async start(): Promise<void> {
    if (this.rpc) return;
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GROK_SANDBOX: process.env.GROK_SANDBOX || "off",
    };
    delete env.ELECTRON_RUN_AS_NODE;
    this.proc = spawn(this.grokBin, ["agent", "--no-leader", "stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });
    this.rpc = new JsonRpcStream(this.proc);
    this.rpc.on("notification", (msg: JsonRpcMessage) => this.emit("notification", msg));
    this.rpc.on("server-request", (msg: JsonRpcMessage) => this.emit("server-request", msg));
    this.rpc.on("exit", (info) => {
      this.connected = false;
      this.emit("exit", info);
    });
    this.rpc.on("stderr", (text: string) => this.emit("stderr", text));

    this.initializeResult = await this.rpc.request("initialize", {
      protocolVersion: 1,
      clientInfo: { name: "grok-build-gui", title: "Grok Build", version: "0.1.0" },
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
    });
    this.connected = true;
  }

  preferredAuthMethodIds(): string[] {
    const advertised = (Array.isArray(this.initializeResult?.authMethods) ? this.initializeResult.authMethods : [])
      .map((method: { id?: unknown }) => (typeof method?.id === "string" ? method.id : ""))
      .filter(Boolean) as string[];
    const allow = (id: string) => advertised.length === 0 || advertised.includes(id);
    const ids: string[] = [];
    if (allow("cached_token")) ids.push("cached_token");
    if (process.env.XAI_API_KEY && allow("xai.api_key")) ids.push("xai.api_key");
    if (!ids.length) ids.push("cached_token");
    return ids;
  }

  async authenticateCached(): Promise<any> {
    if (!this.rpc) throw new Error("ACP not started");
    let lastErr: unknown;
    for (const methodId of this.preferredAuthMethodIds()) {
      try {
        const result = await this.rpc.request("authenticate", { methodId }, 15_000);
        this.lastAuthMethodId = methodId;
        return result;
      } catch (err) {
        lastErr = err;
      }
    }
    this.emit("auth-needed", lastErr);
    throw lastErr instanceof Error ? lastErr : new Error("Authentication required");
  }

  request<T = any>(method: string, params?: unknown, timeoutMs?: number): Promise<T> {
    if (!this.rpc) throw new Error("ACP not started");
    return this.rpc.request<T>(method, params, timeoutMs);
  }

  notify(method: string, params?: unknown): void {
    this.rpc?.notify(method, params);
  }

  respond(id: number | string, result: unknown): void {
    this.rpc?.respond(id, result);
  }

  respondError(id: number | string, code: number, message: string, data?: unknown): void {
    this.rpc?.respondError(id, code, message, data);
  }

  stop(): void {
    this.rpc?.dispose();
    this.rpc = null;
    this.proc?.kill();
    this.proc = null;
    this.connected = false;
  }
}

export function unwrap<T = any>(result: any): T {
  if (result && typeof result === "object" && "result" in result && result.result !== undefined) {
    return result.result as T;
  }
  return result as T;
}

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
