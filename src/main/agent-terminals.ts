import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";

type ExitStatus = { exitCode: number | null; signal: NodeJS.Signals | null };

type AgentTerminal = {
  id: string;
  sessionId: string;
  child: ChildProcess;
  output: string;
  outputByteLimit: number;
  truncated: boolean;
  exitStatus: ExitStatus | null;
  waiters: ((status: ExitStatus) => void)[];
};

const DEFAULT_OUTPUT_BYTE_LIMIT = 1_000_000;
const MAX_OUTPUT_BYTE_LIMIT = 8_000_000;

export class AgentTerminalManager {
  private readonly terminals = new Map<string, AgentTerminal>();

  create(params: Record<string, any>, fallbackCwd: string): { terminalId: string } {
    const command = typeof params.command === "string" ? params.command : "";
    if (!command) throw new Error("terminal/create requires a command");
    const args = Array.isArray(params.args)
      ? params.args.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const env = { ...process.env };
    for (const entry of Array.isArray(params.env) ? params.env : []) {
      if (entry && typeof entry.name === "string" && typeof entry.value === "string") env[entry.name] = entry.value;
    }
    delete env.ELECTRON_RUN_AS_NODE;
    const cwd = typeof params.cwd === "string" && params.cwd.startsWith("/") ? params.cwd : fallbackCwd;
    const child = spawn(command, args, { cwd, env, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const terminal: AgentTerminal = {
      id: `term_${randomUUID()}`,
      sessionId: typeof params.sessionId === "string" ? params.sessionId : "",
      child,
      output: "",
      outputByteLimit: normalizeLimit(params.outputByteLimit),
      truncated: false,
      exitStatus: null,
      waiters: [],
    };
    this.terminals.set(terminal.id, terminal);
    child.stdout?.on("data", (chunk: Buffer | string) => this.append(terminal, chunk));
    child.stderr?.on("data", (chunk: Buffer | string) => this.append(terminal, chunk));
    child.once("error", (error) => {
      this.append(terminal, `\n${error.message}\n`);
      this.finish(terminal, { exitCode: 1, signal: null });
    });
    child.once("exit", (exitCode, signal) => this.finish(terminal, { exitCode, signal }));
    return { terminalId: terminal.id };
  }

  output(id: string): { output: string; truncated: boolean; exitStatus: ExitStatus | null } {
    const terminal = this.require(id);
    return { output: terminal.output, truncated: terminal.truncated, exitStatus: terminal.exitStatus };
  }

  async waitForExit(id: string): Promise<ExitStatus> {
    const terminal = this.require(id);
    if (terminal.exitStatus) return terminal.exitStatus;
    return new Promise((resolve) => terminal.waiters.push(resolve));
  }

  kill(id: string): void {
    const terminal = this.require(id);
    if (terminal.exitStatus || !terminal.child.pid) return;
    try { terminal.child.kill("SIGTERM"); } catch {}
  }

  release(id: string): void {
    const terminal = this.require(id);
    if (!terminal.exitStatus) {
      try { terminal.child.kill("SIGTERM"); } catch {}
    }
    this.terminals.delete(id);
  }

  dispose(): void {
    for (const terminal of this.terminals.values()) {
      if (!terminal.exitStatus) {
        try { terminal.child.kill("SIGTERM"); } catch {}
      }
    }
    this.terminals.clear();
  }

  private require(id: string): AgentTerminal {
    const terminal = this.terminals.get(id);
    if (!terminal) throw new Error(`Unknown terminal: ${id}`);
    return terminal;
  }

  private append(terminal: AgentTerminal, chunk: Buffer | string): void {
    terminal.output += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    const bytes = Buffer.from(terminal.output, "utf8");
    if (bytes.byteLength <= terminal.outputByteLimit) return;
    terminal.truncated = true;
    if (terminal.outputByteLimit === 0) {
      terminal.output = "";
      return;
    }
    const retained = bytes.subarray(-terminal.outputByteLimit);
    let start = 0;
    while (start < retained.length && (retained[start]! & 0xc0) === 0x80) start += 1;
    terminal.output = retained.subarray(start).toString("utf8");
  }

  private finish(terminal: AgentTerminal, status: ExitStatus): void {
    if (terminal.exitStatus) return;
    terminal.exitStatus = status;
    for (const resolve of terminal.waiters.splice(0)) resolve(status);
  }
}

function normalizeLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_OUTPUT_BYTE_LIMIT;
  return Math.max(0, Math.min(MAX_OUTPUT_BYTE_LIMIT, Math.floor(value)));
}
