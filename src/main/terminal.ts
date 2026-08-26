import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { homedir } from "node:os";

export class TerminalHost {
  private child: ChildProcessWithoutNullStreams | null = null;
  cwd = "";

  get running(): boolean {
    return Boolean(this.child && this.child.exitCode == null);
  }

  start(
    cwd: string,
    onData: (chunk: string) => void,
    onExit: (code: number | null) => void,
  ): void {
    this.stop();
    this.cwd = cwd || homedir();
    const shell = process.env.SHELL || "/bin/zsh";
    const env = {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
    };

    const child = process.platform === "darwin"
      ? spawn("script", ["-q", "/dev/null", shell, "-i"], {
          cwd: this.cwd,
          env,
          stdio: ["pipe", "pipe", "pipe"],
        })
      : spawn(shell, ["-i"], {
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
    const child = this.child;
    if (!child?.stdin.writable) return;
    try {
      child.stdin.write(data);
    } catch {}
  }

  stop(): void {
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
}
