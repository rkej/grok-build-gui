import { app, BrowserWindow, dialog, Menu, Notification, nativeTheme, shell } from "electron";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AppStore } from "./store.js";
import { registerIpc } from "./ipc.js";
import { applyPosixPathDefaults } from "./paths.js";
import { TerminalHost } from "./terminal.js";
import { ipc } from "../shared/ipc.js";
import { isHttpUrl } from "../shared/url.js";

applyPosixPathDefaults();

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
  for (const name of ["index.cjs", "index.js", "index.mjs"]) {
    const candidate = path.join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return path.join(dir, "index.mjs");
}

function resolveAppIcon(): string | undefined {
  const candidates = [
    path.join(process.resourcesPath ?? "", "icon.png"),
    path.join(__dirname, "../../resources/icon.png"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function rendererIndexPath(): string {
  return path.normalize(path.join(__dirname, "../renderer/index.html"));
}

function isAppNavigationUrl(url: string): boolean {
  const dev = process.env.ELECTRON_RENDERER_URL;
  if (dev) {
    try {
      return new URL(url).origin === new URL(dev).origin;
    } catch {
      return false;
    }
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "file:") return false;
    return path.normalize(fileURLToPath(parsed)) === rendererIndexPath();
  } catch {
    return false;
  }
}

function openExternalIfHttp(url: string): void {
  if (!isHttpUrl(url)) return;
  void shell.openExternal(url);
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: "Grok Build",
    icon: resolveAppIcon(),
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1a1b1e" : "#eceef3",
    show: false,
    webPreferences: {
      preload: resolvePreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppNavigationUrl(url)) openExternalIfHttp(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (isAppNavigationUrl(url)) return;
    event.preventDefault();
    openExternalIfHttp(url);
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
    void win.loadFile(rendererIndexPath());
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
        { type: "separator" },
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => win?.webContents.send(ipc.openSettings),
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

app.setName("Grok Build");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

app.whenReady().then(async () => {
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
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("before-quit", () => {
  store.agentTerminals.dispose();
  terminal.stop();
  store.client.stop();
});
}
