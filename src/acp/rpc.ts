import { EventEmitter } from "node:events";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";

export type JsonRpcId = number | string;
export type JsonRpcMessage = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

export class JsonRpcStream extends EventEmitter {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private rl: readline.Interface | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly proc: ChildProcessWithoutNullStreams) {
    super();
    this.rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
    this.rl.on("line", (line) => this.onLine(line));
    proc.stderr.on("data", (buf: Buffer) => {
      const text = buf.toString("utf8");
      this.emit("stderr", text);
    });
    proc.on("exit", (code, signal) => {
      const err = new Error(`Grok agent exited (${code ?? signal ?? "unknown"})`);
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
      this.emit("exit", { code, signal });
    });
  }

  request<T = unknown>(method: string, params?: unknown, timeoutMs = 120_000): Promise<T> {
    const id = this.nextId++;
    const msg: JsonRpcMessage = { jsonrpc: "2.0", id, method, params };
    const p = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`ACP timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value as T);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
    });
    this.write(msg);
    return p;
  }

  notify(method: string, params?: unknown): void {
    this.write({ jsonrpc: "2.0", method, params });
  }

  respond(id: JsonRpcId, result: unknown): void {
    this.write({ jsonrpc: "2.0", id, result });
  }

  respondError(id: JsonRpcId, code: number, message: string, data?: unknown): void {
    this.write({ jsonrpc: "2.0", id, error: { code, message, data } });
  }

  dispose(): void {
    this.rl?.close();
    for (const p of this.pending.values()) p.reject(new Error("ACP disposed"));
    this.pending.clear();
  }

  private write(msg: JsonRpcMessage): void {
    const line = `${JSON.stringify(msg)}\n`;
    this.writeChain = this.writeChain.then(() => {
      return new Promise<void>((resolve, reject) => {
        if (!this.proc.stdin.writable) {
          reject(new Error("ACP stdin closed"));
          return;
        }
        this.proc.stdin.write(line, (err) => (err ? reject(err) : resolve()));
      });
    }).catch((err) => {
      this.emit("error", err);
    });
  }

  private onLine(line: string): void {
    if (!line) return;
    let msg: JsonRpcMessage;
    try {
      msg = JSON.parse(line) as JsonRpcMessage;
    } catch {
      this.emit("bad-line", line);
      return;
    }
    const kind = classifyMessage(msg);
    if (kind === "response") {
      const id = typeof msg.id === "number" ? msg.id : Number(msg.id);
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      if (msg.error) {
        pending.reject(Object.assign(new Error(msg.error.message), { code: msg.error.code, data: msg.error.data }));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }
    if (kind === "server-request") {
      this.emit("server-request", msg);
      return;
    }
    if (kind === "notification") {
      this.emit("notification", msg);
    }
  }
}

export function classifyMessage(msg: JsonRpcMessage): "response" | "server-request" | "notification" | "invalid" {
  if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined) && !msg.method) return "response";
  if (msg.method && msg.id !== undefined && msg.result === undefined && msg.error === undefined) return "server-request";
  if (msg.method) return "notification";
  return "invalid";
}
