import { contextBridge, ipcRenderer } from "electron";
import { ipc } from "../shared/ipc";
import type {
  AppSnapshot,
  AddMcpInput,
  CreateSkillInput,
  FilePreview,
  FileTreeNode,
  GitDiff,
  ExtensionUiResponse,
  GuiState,
  PermissionMode,
  RewindPoint,
  SkillRecord,
  ToolCallState,
  TranscriptSnapshot,
} from "../shared/protocol";

export type GrokDesktopApi = {
  getState: () => Promise<AppSnapshot>;
  onState: (listener: (state: AppSnapshot) => void) => () => void;
  getTranscript: () => Promise<TranscriptSnapshot>;
  onTranscript: (listener: (snapshot: TranscriptSnapshot) => void) => () => void;
  loadToolContent: (toolCallId: string) => Promise<ToolCallState | null>;
  pickFolder: () => Promise<string | null>;
  setCwd: (cwd: string) => Promise<void>;
  removeWorkspace: (cwd: string) => Promise<void>;
  newSession: (prompt?: string, opts?: { worktree?: boolean; yolo?: boolean }) => Promise<string>;
  openSession: (sessionId: string, cwd?: string) => Promise<void>;
  prompt: (text: string, attachments?: readonly import("../shared/protocol").ComposerAttachment[], opts?: { deliverAs?: "steer" | "followUp" }) => Promise<AppSnapshot>;
  editQueuedMessage: (id: string, text: string, attachments?: readonly import("../shared/protocol").ComposerAttachment[]) => Promise<AppSnapshot>;
  removeQueuedMessage: (id: string) => Promise<AppSnapshot>;
  steerQueuedMessage: (id: string) => Promise<AppSnapshot>;
  cancel: () => Promise<AppSnapshot>;
  setModel: (modelId: string) => Promise<void>;
  setMode: (modeId: PermissionMode | string) => Promise<void>;
  setEffort: (effort: string) => Promise<void>;
  rename: (sessionId: string, title: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  fork: (itemId?: string, opts?: { worktree?: boolean }) => Promise<void>;
  reorderWorkspaces: (order: string[]) => Promise<void>;
  reorderPinned: (order: string[]) => Promise<void>;
  compact: (note?: string) => Promise<void>;
  rewind: (index: number) => Promise<void>;
  rewindPoints: () => Promise<RewindPoint[]>;
  slash: (name: string, args?: string) => Promise<void>;
  fuzzy: (query: string) => Promise<any>;
  approve: (optionId: string) => Promise<void>;
  respondExtensionUi: (response: ExtensionUiResponse) => Promise<void>;
  onFindInThread: (listener: () => void) => () => void;
  onOpenSettings: (listener: () => void) => () => void;
  onOpenNewThread: (listener: () => void) => () => void;
  onRenameCurrentThread: (listener: () => void) => () => void;
  toggleWindowMaximize: () => Promise<void>;
  pin: (sessionId: string, pinned: boolean) => Promise<void>;
  archive: (sessionId: string, archived: boolean) => Promise<void>;
  markRead: (sessionId: string) => Promise<void>;
  renameWorkspace: (cwd: string, name: string) => Promise<void>;
  createWorktree: (cwd: string) => Promise<string>;
  removeWorktree: (cwd: string) => Promise<void>;
  copyText: (text: string) => Promise<void>;
  setComposerDraft: (key: string, text: string) => Promise<void>;
  setGui: (partial: Partial<GuiState>) => Promise<void>;
  login: () => Promise<void>;
  cancelLogin: () => Promise<void>;
  loginWithApiKey: (key: string) => Promise<void>;
  retryCli: () => Promise<void>;
  refresh: () => Promise<AppSnapshot>;
  openExternal: (url: string) => Promise<void>;
  openPath: (p: string) => Promise<void>;
  gitDiff: (filePath: string, staged?: boolean) => Promise<GitDiff>;
  gitStage: (filePath: string) => Promise<void>;
  gitUnstage: (filePath: string) => Promise<void>;
  gitDiscard: (filePath: string) => Promise<void>;
  listFiles: () => Promise<FileTreeNode[]>;
  readFile: (relPath: string) => Promise<FilePreview>;
  selectEnvironment: (id: string) => Promise<void>;
  createSkill: (input: CreateSkillInput) => Promise<SkillRecord>;
  setSkillEnabled: (name: string, enabled: boolean) => Promise<void>;
  deleteSkill: (filePath: string) => Promise<void>;
  addMcp: (input: AddMcpInput) => Promise<void>;
  setMcpEnabled: (name: string, enabled: boolean) => Promise<void>;
  removeMcp: (name: string, scope?: "user" | "project") => Promise<void>;
  installPlugin: (source: string, trust: boolean) => Promise<void>;
  setPluginEnabled: (name: string, enabled: boolean) => Promise<void>;
  uninstallPlugin: (name: string) => Promise<void>;
  terminalStart: (cwd?: string, size?: { cols: number; rows: number }) => Promise<{ cwd: string; pty: boolean }>;
  terminalWrite: (data: string) => Promise<void>;
  terminalResize: (cols: number, rows: number) => Promise<void>;
  terminalStop: () => Promise<void>;
  onTerminalData: (listener: (data: string) => void) => () => void;
  onTerminalExit: (listener: (code: number | null) => void) => () => void;
};

const api: GrokDesktopApi = {
  getState: () => ipcRenderer.invoke(ipc.state),
  onState: (listener) => {
    const handler = (_e: Electron.IpcRendererEvent, state: AppSnapshot) => listener(state);
    ipcRenderer.on(ipc.stateChanged, handler);
    return () => ipcRenderer.removeListener(ipc.stateChanged, handler);
  },
  getTranscript: () => ipcRenderer.invoke(ipc.transcript),
  onTranscript: (listener) => {
    const handler = (_e: Electron.IpcRendererEvent, snapshot: TranscriptSnapshot) => listener(snapshot);
    ipcRenderer.on(ipc.transcriptChanged, handler);
    return () => ipcRenderer.removeListener(ipc.transcriptChanged, handler);
  },
  loadToolContent: (toolCallId) => ipcRenderer.invoke(ipc.loadToolContent, toolCallId),
  pickFolder: () => ipcRenderer.invoke(ipc.pickFolder),
  setCwd: (cwd) => ipcRenderer.invoke(ipc.setCwd, cwd),
  removeWorkspace: (cwd) => ipcRenderer.invoke(ipc.removeWorkspace, cwd),
  newSession: (prompt, opts) => ipcRenderer.invoke(ipc.newSession, prompt, opts),
  openSession: (sessionId, cwd) => ipcRenderer.invoke(ipc.openSession, sessionId, cwd),
  prompt: (text, attachments, opts) => ipcRenderer.invoke(ipc.prompt, text, attachments, opts),
  editQueuedMessage: (id, text, attachments) => ipcRenderer.invoke(ipc.editQueuedMessage, id, text, attachments),
  removeQueuedMessage: (id) => ipcRenderer.invoke(ipc.removeQueuedMessage, id),
  steerQueuedMessage: (id) => ipcRenderer.invoke(ipc.steerQueuedMessage, id),
  cancel: () => ipcRenderer.invoke(ipc.cancel),
  setModel: (modelId) => ipcRenderer.invoke(ipc.setModel, modelId),
  setMode: (modeId) => ipcRenderer.invoke(ipc.setMode, modeId),
  setEffort: (effort) => ipcRenderer.invoke(ipc.setEffort, effort),
  rename: (sessionId, title) => ipcRenderer.invoke(ipc.rename, sessionId, title),
  deleteSession: (sessionId) => ipcRenderer.invoke(ipc.deleteSession, sessionId),
  fork: (itemId, opts) => itemId ? ipcRenderer.invoke(ipc.forkFrom, itemId, opts) : ipcRenderer.invoke(ipc.fork, opts),
  reorderWorkspaces: (order) => ipcRenderer.invoke(ipc.reorderWorkspaces, order),
  reorderPinned: (order) => ipcRenderer.invoke(ipc.reorderPinned, order),
  compact: (note) => ipcRenderer.invoke(ipc.compact, note),
  rewind: (index) => ipcRenderer.invoke(ipc.rewind, index),
  rewindPoints: () => ipcRenderer.invoke(ipc.rewindPoints),
  slash: (name, args) => ipcRenderer.invoke(ipc.slash, name, args),
  fuzzy: (query) => ipcRenderer.invoke(ipc.fuzzy, query),
  approve: (optionId) => ipcRenderer.invoke(ipc.approve, optionId),
  respondExtensionUi: (response) => ipcRenderer.invoke(ipc.extensionUiRespond, response),
  onFindInThread: (listener) => {
    const handler = () => listener();
    ipcRenderer.on(ipc.findInThread, handler);
    return () => ipcRenderer.removeListener(ipc.findInThread, handler);
  },
  onOpenSettings: (listener) => {
    const handler = () => listener();
    ipcRenderer.on(ipc.openSettings, handler);
    return () => ipcRenderer.removeListener(ipc.openSettings, handler);
  },
  onOpenNewThread: (listener) => {
    const handler = () => listener();
    ipcRenderer.on(ipc.openNewThread, handler);
    return () => ipcRenderer.removeListener(ipc.openNewThread, handler);
  },
  onRenameCurrentThread: (listener) => {
    const handler = () => listener();
    ipcRenderer.on(ipc.renameCurrentThread, handler);
    return () => ipcRenderer.removeListener(ipc.renameCurrentThread, handler);
  },
  toggleWindowMaximize: () => ipcRenderer.invoke(ipc.toggleWindowMaximize),
  pin: (sessionId, pinned) => ipcRenderer.invoke(ipc.pin, sessionId, pinned),
  archive: (sessionId, archived) => ipcRenderer.invoke(ipc.archive, sessionId, archived),
  markRead: (sessionId) => ipcRenderer.invoke(ipc.markRead, sessionId),
  renameWorkspace: (cwd, name) => ipcRenderer.invoke(ipc.renameWorkspace, cwd, name),
  createWorktree: (cwd) => ipcRenderer.invoke(ipc.createWorktree, cwd),
  removeWorktree: (cwd) => ipcRenderer.invoke(ipc.removeWorktree, cwd),
  copyText: (text) => ipcRenderer.invoke(ipc.copyText, text),
  setComposerDraft: (key, text) => ipcRenderer.invoke(ipc.setComposerDraft, key, text),
  setGui: (partial) => ipcRenderer.invoke(ipc.setGui, partial),
  login: () => ipcRenderer.invoke(ipc.login),
  cancelLogin: () => ipcRenderer.invoke(ipc.cancelLogin),
  loginWithApiKey: (key) => ipcRenderer.invoke(ipc.loginWithApiKey, key),
  retryCli: () => ipcRenderer.invoke(ipc.retryCli),
  refresh: () => ipcRenderer.invoke(ipc.refresh),
  openExternal: (url) => ipcRenderer.invoke(ipc.openExternal, url),
  openPath: (p) => ipcRenderer.invoke(ipc.openPath, p),
  gitDiff: (filePath, staged) => ipcRenderer.invoke(ipc.gitDiff, filePath, staged),
  gitStage: (filePath) => ipcRenderer.invoke(ipc.gitStage, filePath),
  gitUnstage: (filePath) => ipcRenderer.invoke(ipc.gitUnstage, filePath),
  gitDiscard: (filePath) => ipcRenderer.invoke(ipc.gitDiscard, filePath),
  listFiles: () => ipcRenderer.invoke(ipc.listFiles),
  readFile: (relPath) => ipcRenderer.invoke(ipc.readFile, relPath),
  selectEnvironment: (id) => ipcRenderer.invoke(ipc.selectEnvironment, id),
  createSkill: (input) => ipcRenderer.invoke(ipc.createSkill, input),
  setSkillEnabled: (name, enabled) => ipcRenderer.invoke(ipc.setSkillEnabled, name, enabled),
  deleteSkill: (filePath) => ipcRenderer.invoke(ipc.deleteSkill, filePath),
  addMcp: (input) => ipcRenderer.invoke(ipc.addMcp, input),
  setMcpEnabled: (name, enabled) => ipcRenderer.invoke(ipc.setMcpEnabled, name, enabled),
  removeMcp: (name, scope) => ipcRenderer.invoke(ipc.removeMcp, name, scope),
  installPlugin: (source, trust) => ipcRenderer.invoke(ipc.installPlugin, source, trust),
  setPluginEnabled: (name, enabled) => ipcRenderer.invoke(ipc.setPluginEnabled, name, enabled),
  uninstallPlugin: (name) => ipcRenderer.invoke(ipc.uninstallPlugin, name),
  terminalStart: (cwd, size) => ipcRenderer.invoke(ipc.terminalStart, cwd, size),
  terminalWrite: (data) => ipcRenderer.invoke(ipc.terminalWrite, data),
  terminalResize: (cols, rows) => ipcRenderer.invoke(ipc.terminalResize, cols, rows),
  terminalStop: () => ipcRenderer.invoke(ipc.terminalStop),
  onTerminalData: (listener) => {
    const handler = (_e: Electron.IpcRendererEvent, data: string) => listener(data);
    ipcRenderer.on(ipc.terminalData, handler);
    return () => ipcRenderer.removeListener(ipc.terminalData, handler);
  },
  onTerminalExit: (listener) => {
    const handler = (_e: Electron.IpcRendererEvent, code: number | null) => listener(code);
    ipcRenderer.on(ipc.terminalExit, handler);
    return () => ipcRenderer.removeListener(ipc.terminalExit, handler);
  },
};

contextBridge.exposeInMainWorld("grokApp", api);
