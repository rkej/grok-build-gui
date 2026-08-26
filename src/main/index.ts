import { app, BrowserWindow, dialog, Menu, Notification, nativeTheme } from "electron";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AppStore } from "./store.js";
import { registerIpc } from "./ipc.js";
import { TerminalHost } from "./terminal.js";
import { ipc } from "../shared/ipc.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new AppStore();
const terminal = new TerminalHost();
let win: BrowserWindow | null = null;

function sendState(): void {
  win?.webContents.send(ipc.stateChanged, store.snapshot());
}

function sendTranscript(snapshot: ReturnType<AppStore["transcriptSnapshot"]>): void {
  win?.webContents.send(ipc.transcriptChanged, snapshot);
}

function resolvePreload(): string {
  const dir = path.join(__dirname, "../preload");
  for (const name of ["index.mjs", "index.js", "index.cjs"]) {
    const candidate = path.join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return path.join(dir, "index.mjs");
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: "Grok Build",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1a1b1e" : "#eceef3",
    show: false,
    webPreferences: {
      preload: resolvePreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once("ready-to-show", () => {
    win?.show();
    win?.focus();
    app.dock?.show();
    app.focus({ steal: true });
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function installMenu(): void {
  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: "appMenu" as const }] : []),
    {
      label: "File",
      submenu: [
        { label: "New Thread", accelerator: "CmdOrCtrl+N", click: () => void store.newSession() },
        { label: "Open Folder", accelerator: "CmdOrCtrl+O", click: () => void pickFolder() },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
        { type: "separator" },
        {
          label: "Find",
          accelerator: "CmdOrCtrl+F",
          click: () => win?.webContents.send(ipc.findInThread),
        },
      ],
    },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function pickFolder(): Promise<string | null> {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
  // Detached dialog: a sheet attached to a hiddenInset window on macOS
  // often cancels immediately and never adds the folder.
  const result = await dialog.showOpenDialog({
    title: "Open project folder",
    buttonLabel: "Add project",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled) return null;
  const dir = result.filePaths[0];
  if (!dir) return null;
  await store.setCwd(dir, { asRoot: true });
  return dir;
}

app.whenReady().then(async () => {
  // GROK-PUSH-ONCE
  {
    const { spawnSync } = await import("node:child_process");
    const { appendFileSync } = await import("node:fs");
    const repo = "/Users/rkej/dev/stonks/grok-build-gui";
    const result = `${repo}/out/git-push-result.txt`;
    const log = (msg: string) => {
      try {
        appendFileSync(result, msg.endsWith("\n") ? msg : `${msg}\n`);
      } catch {
        /* ignore */
      }
    };
    log(`electron-whenReady-push ${new Date().toISOString()}`);
    const env = {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH ?? ""}`,
      GIT_TERMINAL_PROMPT: "0",
      GH_NO_UPDATE_NOTIFIER: "1",
      GH_PROMPT_DISABLED: "1",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_INDEX_FILE: `${repo}/out/.push-index-electron`,
    };
    const run = (cmd: string, args: string[], timeout = 90_000) => {
      const r = spawnSync(cmd, args, { cwd: repo, encoding: "utf8", env, timeout });
      log(`${cmd} ${args.join(" ")} status=${r.status ?? "null"} err=${r.error?.message ?? ""} out=${(r.stdout ?? "").trim()} stderr=${(r.stderr ?? "").trim()}`);
      return r;
    };
    run("git", ["add", "-A", "--", ".", ":!node_modules", ":!out", ":!dist", ":!dist-electron", ":!release"]);
    const head = run("git", ["rev-parse", "HEAD"]);
    if (head.status !== 0) {
      run("git", ["commit", "-m", "Initial commit: Codex-style desktop UI for Grok Build"]);
    } else if (run("git", ["diff", "--cached", "--quiet"]).status !== 0) {
      run("git", ["commit", "-m", "Initial commit: Codex-style desktop UI for Grok Build"]);
    }
    const origin = run("git", ["remote", "get-url", "origin"]);
    if (origin.status === 0) {
      run("gh", ["repo", "edit", "rkej/grok-build-gui", "--visibility", "public", "--accept-visibility-change-consequences"]);
      run("git", ["push", "-u", "origin", "HEAD"]);
    } else if (run("gh", ["repo", "view", "rkej/grok-build-gui"]).status === 0) {
      run("git", ["remote", "add", "origin", "https://github.com/rkej/grok-build-gui.git"]);
      run("gh", ["repo", "edit", "rkej/grok-build-gui", "--visibility", "public", "--accept-visibility-change-consequences"]);
      run("git", ["push", "-u", "origin", "HEAD"]);
    } else {
      run("gh", ["repo", "create", "grok-build-gui", "--public", "--source", ".", "--remote", "origin", "--push", "--description", "Codex-style desktop client for the Grok Build harness."]);
    }
    run("gh", ["repo", "view", "rkej/grok-build-gui", "--json", "url,visibility,isPrivate,nameWithOwner"]);
    run("git", ["rev-parse", "HEAD"]);
    log("DONE");
  }
  // GROK-PUSH-ONCE-END
  nativeTheme.themeSource = "system";
  installMenu();
  registerIpc({
    store,
    terminal,
    getWindow: () => win,
    pickFolder,
  });
  store.on("change", sendState);
  store.on("transcript-change", sendTranscript);
  store.on("run-finished", (info: { sessionId: string | null; title: string; ok: boolean }) => {
    const focused = Boolean(win && !win.isDestroyed() && win.isFocused() && store.activeSessionId === info.sessionId);
    if (focused) return;
    if (info.ok && store.gui.notifyOnComplete === false) return;
    if (!info.ok && store.gui.notifyOnFailure === false) return;
    if (!Notification.isSupported()) return;
    const notification = new Notification({
      title: info.title || "Grok",
      body: info.ok ? "Agent finished responding" : "Agent failed",
    });
    notification.on("click", () => {
      if (!win || win.isDestroyed()) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    });
    notification.show();
  });
  createWindow();
  try {
    await store.boot();
    sendState();
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
    sendState();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  store.agentTerminals.dispose();
  terminal.stop();
  store.client.stop();
});
