import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";

export type PtyHandle = {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(listener: (data: string) => void): void;
  onExit(listener: (event: { exitCode: number; signal?: number }) => void): void;
};

const require = createRequire(import.meta.url);

export type PtySpawn = (
  file: string,
  args: string[] | string,
  options: {
    name?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
  },
) => PtyHandle;

export type TerminalSpawn = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams;

export type TerminalHostOptions = {
  ptySpawn?: PtySpawn | null;
  spawn?: TerminalSpawn;
  env?: NodeJS.ProcessEnv;
  shell?: string;
};

function ensurePtyHelperExecutable(): void {
  try {
    const pkgDir = path.dirname(require.resolve("node-pty/package.json"));
    const helpers = [
      path.join(pkgDir, "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper"),
      path.join(pkgDir, "build", "Release", "spawn-helper"),
    ];
    for (const file of helpers) {
      if (!existsSync(file)) continue;
      try { chmodSync(file, 0o755); } catch {}
    }
  } catch {}
}

function loadPtySpawn(): PtySpawn | null {
  try {
    ensurePtyHelperExecutable();
    const pty = require("node-pty") as { spawn?: PtySpawn };
    return typeof pty.spawn === "function" ? pty.spawn.bind(pty) : null;
  } catch {
    return null;
  }
}

export function pipeFallbackLaunch(shell: string): { command: string; args: string[] } {
  // BSD `script` calls tcgetattr(stdin). Electron stdio pipes are sockets, so
  // `script -q /dev/null` always fails with "Operation not supported on socket".
  return { command: shell, args: ["-l"] };
}

export function terminalChildEnv(source: NodeJS.ProcessEnv): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) env[key] = value;
  }
  delete env.ELECTRON_RUN_AS_NODE;
  env.TERM = "xterm-256color";
  env.COLORTERM = "truecolor";
  return env;
}

export class TerminalHost {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pty: PtyHandle | null = null;
  private cachedPtySpawn: PtySpawn | null | undefined;
  cwd = "";
  cols = 80;
  rows = 24;
  usingPty = false;

  constructor(private readonly options: TerminalHostOptions = {}) {}

  get running(): boolean {
    return Boolean(this.pty || (this.child && this.child.exitCode == null));
  }

  start(
    cwd: string,
    onData: (chunk: string) => void,
    onExit: (code: number | null) => void,
    size?: { cols?: number; rows?: number },
  ): void {
    this.stop();
    this.cwd = cwd || homedir();
    this.cols = Math.max(2, Math.floor(size?.cols ?? this.cols));
    this.rows = Math.max(1, Math.floor(size?.rows ?? this.rows));
    const shell = this.options.shell ?? this.options.env?.SHELL ?? (process.env.SHELL || "/bin/zsh");
    const env = terminalChildEnv(this.options.env ?? process.env);
    const ptySpawn = this.resolvePtySpawn();

    if (ptySpawn) {
      try {
        const handle = ptySpawn(shell, ["-l"], {
          name: "xterm-256color",
          cols: this.cols,
          rows: this.rows,
          cwd: this.cwd,
          env,
        });
        this.pty = handle;
        this.usingPty = true;
        handle.onData(onData);
        handle.onExit((event) => {
          if (this.pty !== handle) return;
          this.pty = null;
          this.usingPty = false;
          onExit(event.exitCode ?? 0);
        });
        return;
      } catch (err) {
        this.pty = null;
        this.usingPty = false;
        onData(`\r\n${err instanceof Error ? err.message : String(err)}\r\n`);
      }
    }

    this.usingPty = false;
    const launch = pipeFallbackLaunch(shell);
    const child = (this.options.spawn ?? spawn)(launch.command, launch.args, {
      cwd: this.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.child = child;
    const emit = (buf: Buffer | string) => onData(typeof buf === "string" ? buf : buf.toString("utf8"));
    child.stdout.on("data", emit);
    child.stderr.on("data", emit);
    child.on("exit", (code) => {
      if (this.child !== child) return;
      this.child = null;
      onExit(code);
    });
    child.on("error", (err) => {
      if (this.child !== child) return;
      onData(`\r\n${err.message}\r\n`);
      onExit(1);
    });
  }

  write(data: string): void {
    if (this.pty) {
      try { this.pty.write(data); } catch {}
      return;
    }
    const child = this.child;
    if (!child?.stdin.writable) return;
    try {
      child.stdin.write(data);
    } catch {}
  }

  resize(cols: number, rows: number): void {
    this.cols = Math.max(2, Math.floor(cols));
    this.rows = Math.max(1, Math.floor(rows));
    if (!this.pty) return;
    try {
      this.pty.resize(this.cols, this.rows);
    } catch {}
  }

  stop(): void {
    const handle = this.pty;
    if (handle) {
      this.pty = null;
      this.usingPty = false;
      try { handle.kill(); } catch {}
    }
    if (!this.child) return;
    const child = this.child;
    this.child = null;
    child.stdout.removeAllListeners();
    child.stderr.removeAllListeners();
    try {
      child.kill("SIGHUP");
    } catch {}
    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {}
    }, 400);
  }

  private resolvePtySpawn(): PtySpawn | null {
    if (this.options.ptySpawn !== undefined) return this.options.ptySpawn;
    if (this.cachedPtySpawn === undefined) this.cachedPtySpawn = loadPtySpawn();
    return this.cachedPtySpawn;
  }
}
