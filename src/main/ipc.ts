import { ipcMain, shell, type BrowserWindow } from "electron";
import { ipc } from "../shared/ipc.js";
import { isHttpUrl } from "../shared/url.js";
import { isInside } from "../shared/workspace-path.js";
import { grokHome } from "./paths.js";
import type { AppStore } from "./store.js";
import type { TerminalHost } from "./terminal.js";

type IpcDeps = {
  store: AppStore;
  terminal: TerminalHost;
  getWindow: () => BrowserWindow | null;
  pickFolder: () => Promise<string | null>;
};

/** Typed IPC surface. Keep this the only Node boundary the renderer talks to. */
export function registerIpc({ store, terminal, getWindow, pickFolder }: IpcDeps): void {
  ipcMain.handle(ipc.state, () => store.snapshot());
  ipcMain.handle(ipc.transcript, () => store.transcriptSnapshot());
  ipcMain.handle(ipc.loadToolContent, (_e, toolCallId: string) => store.loadToolContent(toolCallId));
  ipcMain.handle(ipc.pickFolder, () => pickFolder());
  ipcMain.handle(ipc.setCwd, (_e, cwd: string) => store.setCwd(cwd, { asRoot: true }));
  ipcMain.handle(ipc.removeWorkspace, (_e, cwd: string) => store.removeWorkspace(cwd));
  ipcMain.handle(ipc.newSession, (_e, prompt?: string, opts?: { worktree?: boolean; yolo?: boolean }) =>
    store.newSession(prompt, opts),
  );
  ipcMain.handle(ipc.openSession, (_e, sessionId: string, cwd?: string) => store.openSession(sessionId, cwd));
  ipcMain.handle(ipc.prompt, (_e, text: string, attachments?: import("../shared/protocol.js").ComposerAttachment[], opts?: { deliverAs?: "steer" | "followUp" }) => store.prompt(text, attachments, opts));
  ipcMain.handle(ipc.editQueuedMessage, (_e, id: string, text: string, attachments?: import("../shared/protocol.js").ComposerAttachment[]) => store.editQueuedMessage(id, text, attachments));
  ipcMain.handle(ipc.removeQueuedMessage, async (_e, id: string) => {
    await store.removeQueuedMessage(id);
    return store.snapshot();
  });
  ipcMain.handle(ipc.steerQueuedMessage, (_e, id: string) => store.steerQueuedMessage(id));
  ipcMain.handle(ipc.cancel, () => store.cancel());
  ipcMain.handle(ipc.setModel, (_e, modelId: string) => store.setModel(modelId));
  ipcMain.handle(ipc.setMode, (_e, modeId: string) => store.setMode(modeId));
  ipcMain.handle(ipc.setEffort, (_e, effort: string) => store.setEffort(effort));
  ipcMain.handle(ipc.rename, (_e, sessionId: string, title: string) => store.rename(sessionId, title));
  ipcMain.handle(ipc.deleteSession, (_e, sessionId: string) => store.deleteSession(sessionId));
  ipcMain.handle(ipc.fork, (_e, opts?: { worktree?: boolean }) => store.fork(undefined, opts));
  ipcMain.handle(ipc.forkFrom, (_e, itemId: string, opts?: { worktree?: boolean }) => store.fork(itemId, opts));
  ipcMain.handle(ipc.reorderWorkspaces, (_e, order: string[]) => store.reorderWorkspaces(order));
  ipcMain.handle(ipc.reorderPinned, (_e, order: string[]) => store.reorderPinned(order));
  ipcMain.handle(ipc.extensionUiRespond, (_e, response: import("../shared/protocol.js").ExtensionUiResponse) => store.respondExtensionUi(response));
  ipcMain.handle(ipc.compact, (_e, note?: string) => store.compact(note));
  ipcMain.handle(ipc.rewind, (_e, index: number) => store.rewindTo(index));
  ipcMain.handle(ipc.rewindPoints, () => store.listRewindPoints());
  ipcMain.handle(ipc.slash, (_e, name: string, args?: string) => store.runSlash(name, args));
  ipcMain.handle(ipc.fuzzy, (_e, query: string) => store.fuzzySearch(query));
  ipcMain.handle(ipc.approve, (_e, optionId: string) => store.approvePermission(optionId));
  ipcMain.handle(ipc.pin, (_e, sessionId: string, pinned: boolean) => store.pin(sessionId, pinned));
  ipcMain.handle(ipc.archive, (_e, sessionId: string, archived: boolean) => store.archive(sessionId, archived));
  ipcMain.handle(ipc.setGui, (_e, partial) => store.setGui(partial));
  ipcMain.handle(ipc.login, () => store.login());
  ipcMain.handle(ipc.refresh, async () => {
    await store.refreshSessions();
    if (store.activeSessionId) await store.refreshSessionExtras(store.activeSessionId);
    await store.refreshGit();
    await store.refreshCatalogs();
    return store.snapshot();
  });
  ipcMain.handle(ipc.createSkill, (_e, input: import("../shared/protocol.js").CreateSkillInput) => store.createSkill(input));
  ipcMain.handle(ipc.setSkillEnabled, (_e, name: string, enabled: boolean) => store.setSkillEnabled(name, enabled));
  ipcMain.handle(ipc.deleteSkill, (_e, filePath: string) => store.deleteSkill(filePath));
  ipcMain.handle(ipc.addMcp, (_e, input: import("../shared/protocol.js").AddMcpInput) => store.addMcp(input));
  ipcMain.handle(ipc.setMcpEnabled, (_e, name: string, enabled: boolean) => store.setMcpEnabled(name, enabled));
  ipcMain.handle(ipc.removeMcp, (_e, name: string, scope?: "user" | "project") => store.removeMcp(name, scope));
  ipcMain.handle(ipc.installPlugin, (_e, source: string, trust: boolean) => store.installPlugin(source, trust));
  ipcMain.handle(ipc.setPluginEnabled, (_e, name: string, enabled: boolean) => store.setPluginEnabled(name, enabled));
  ipcMain.handle(ipc.uninstallPlugin, (_e, name: string) => store.uninstallPlugin(name));
  ipcMain.handle(ipc.openExternal, (_e, url: string) => {
    if (!isHttpUrl(url)) throw new Error("Only http(s) URLs can be opened.");
    return shell.openExternal(url);
  });
  ipcMain.handle(ipc.openPath, (_e, p: string) => {
    if (!isInside(store.cwd, p) && !isInside(grokHome(), p)) {
      throw new Error("Path is outside the workspace.");
    }
    return shell.openPath(p);
  });
  ipcMain.handle(ipc.gitDiff, (_e, filePath: string, staged?: boolean) => store.gitDiff(filePath, Boolean(staged)));
  ipcMain.handle(ipc.gitStage, (_e, filePath: string) => store.gitStage(filePath));
  ipcMain.handle(ipc.gitUnstage, (_e, filePath: string) => store.gitUnstage(filePath));
  ipcMain.handle(ipc.gitDiscard, (_e, filePath: string) => store.gitDiscard(filePath));
  ipcMain.handle(ipc.listFiles, () => store.listFiles());
  ipcMain.handle(ipc.readFile, (_e, relPath: string) => store.readFile(relPath));
  ipcMain.handle(ipc.selectEnvironment, (_e, id: string) => store.selectEnvironment(id));
  ipcMain.handle(ipc.terminalStart, (_e, cwd?: string) => {
    const win = getWindow();
    const target = cwd || store.cwd;
    terminal.start(
      target,
      (data) => win?.webContents.send(ipc.terminalData, data),
      (code) => win?.webContents.send(ipc.terminalExit, code),
    );
    return { cwd: terminal.cwd };
  });
  ipcMain.handle(ipc.terminalWrite, (_e, data: string) => {
    terminal.write(data);
  });
  ipcMain.handle(ipc.terminalStop, () => {
    terminal.stop();
  });
}
