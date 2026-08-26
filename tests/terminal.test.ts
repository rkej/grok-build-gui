import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { pipeFallbackLaunch, TerminalHost, terminalChildEnv, type PtyHandle } from "../src/main/terminal.ts";

test("macOS pipe fallback does not invoke BSD script", () => {
  const launch = pipeFallbackLaunch("/bin/zsh");
  assert.equal(launch.command, "/bin/zsh");
  assert.deepEqual(launch.args, ["-l"]);
  assert.notEqual(launch.command, "script");
});

test("terminal child env is a real TTY-looking environment without Electron flags", () => {
  const env = terminalChildEnv({
    PATH: "/usr/bin",
    ELECTRON_RUN_AS_NODE: "1",
    EMPTY: undefined,
  });
  assert.equal(env.TERM, "xterm-256color");
  assert.equal(env.COLORTERM, "truecolor");
  assert.equal(env.PATH, "/usr/bin");
  assert.equal(env.ELECTRON_RUN_AS_NODE, undefined);
  assert.equal("EMPTY" in env, false);
});

test("TerminalHost prefers a PTY when spawn is available", () => {
  const writes: string[] = [];
  let onData: ((chunk: string) => void) | undefined;
  let onExit: ((event: { exitCode: number }) => void) | undefined;
  let killed = false;
  const handle: PtyHandle = {
    write(data) { writes.push(data); },
    resize() {},
    kill() { killed = true; },
    onData(listener) { onData = listener; },
    onExit(listener) { onExit = listener; },
  };
  const host = new TerminalHost({
    ptySpawn: (file, args, options) => {
      assert.equal(file, "/bin/zsh");
      assert.deepEqual(args, ["-l"]);
      assert.equal(options.cwd, "/tmp/workspace");
      assert.equal(options.cols, 100);
      assert.equal(options.rows, 30);
      return handle;
    },
    spawn() { throw new Error("pipe fallback should not run when a PTY is available"); },
    shell: "/bin/zsh",
  });

  const chunks: string[] = [];
  const exits: Array<number | null> = [];
  host.start("/tmp/workspace", (chunk) => chunks.push(chunk), (code) => exits.push(code), { cols: 100, rows: 30 });
  assert.equal(host.usingPty, true);
  assert.equal(host.running, true);

  onData?.("hello");
  host.write("ls\n");
  onExit?.({ exitCode: 0 });
  host.stop();

  assert.deepEqual(chunks, ["hello"]);
  assert.deepEqual(writes, ["ls\n"]);
  assert.deepEqual(exits, [0]);
  assert.equal(killed, true);
  assert.equal(host.usingPty, false);
});

test("TerminalHost pipe fallback never launches script", () => {
  const spawned: Array<{ command: string; args: string[] }> = [];
  const child = new FakeChild();
  const host = new TerminalHost({
    ptySpawn: null,
    spawn: (command, args) => {
      spawned.push({ command, args });
      return child as never;
    },
    shell: "/bin/zsh",
    env: { SHELL: "/bin/zsh", PATH: "/usr/bin" },
  });

  const chunks: string[] = [];
  host.start("/tmp/workspace", (chunk) => chunks.push(chunk), () => {});
  child.stdout.emit("data", Buffer.from("ok\n"));
  host.write("pwd\n");
  child.emit("exit", 0);

  assert.deepEqual(spawned, [{ command: "/bin/zsh", args: ["-l"] }]);
  assert.equal(host.usingPty, false);
  assert.equal(child.stdin.writes.join(""), "pwd\n");
  assert.deepEqual(chunks, ["ok\n"]);
});

class FakeChild extends EventEmitter {
  readonly stdin = {
    writable: true,
    writes: [] as string[],
    write(data: string) {
      this.writes.push(data);
      return true;
    },
  };
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  exitCode: number | null = null;
  kill(): boolean {
    this.emit("exit", 0);
    return true;
  }
}
