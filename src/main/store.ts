import { EventEmitter } from "node:events";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { GrokAcpClient } from "../acp/client.js";
import { AcpMethod } from "../acp/methods.js";
import type { JsonRpcMessage } from "../acp/rpc.js";
import { asArray, unwrap } from "../shared/acp-util.js";
import { authFromAuthenticateResult, checkingAuth, isAuthError, parseGrokLoginOutput, signedOutAuth } from "../shared/auth.js";
import type {
  AppSnapshot,
  AccountUsage,
  AddMcpInput,
  AuthState,
  ContentBlock,
  ContextUsage,
  CreateSkillInput,
  ExtensionDialog,
  ExtensionUiResponse,
  FilePreview,
  FileTreeNode,
  GitDiff,
  GuiState,
  McpServerRecord,
  ModelInfo,
  PlanEntry,
  PermissionMode,
  PermissionRequest,
  PluginRecord,
  QueueEntry,
  RewindPoint,
  SessionSummary,
  SkillRecord,
  SlashCommand,
  ToolCallState,
  ComposerAttachment,
  TranscriptItem,
  TranscriptSnapshot,
} from "../shared/protocol.js";
import { mergePlanEntries, parsePlanEntries } from "../shared/plan.js";
import { discardFile, diffFile, inspectGit, stageFile, unstageFile } from "./git.js";
import { listTree, readWorkspaceFile } from "./files.js";
import { fetchWeeklyUsage, loggedWeeklyUsage, parseWeeklyUsage } from "./billing.js";
import { tryHandleFsRequest } from "./fs-bridge.js";
import { loadGuiState, saveGuiState } from "./gui-state.js";
import { pickAllowOption, shouldAutoApprove } from "./permissions.js";
import { parseExtensionDialog } from "./extension-ui.js";
import { sessionDir } from "./paths.js";
import { activityFromLive, parseModels, sessionTitle } from "./session-meta.js";
import { childSessionStub, listSubagentChildren, parentIdFromDisk, parentIdFromSessionRow } from "./session-parent.js";
import { isActiveSessionLoad, isForActiveSession, sessionIdFromParams } from "./session-scope.js";
import { MAX_LOADED_TOOL_PAYLOADS } from "../shared/loaded-tool-cache.js";
import { applySessionUpdate, compactToolForTransport, createFold, isTerminalToolStatus, normalizeTool, replayJsonl, type TranscriptFold } from "./transcript.js";
import { parseContextUsage } from "./usage.js";
import {
  addMcpServer,
  installPlugin,
  listMcpFromCli,
  listPluginsFromCli,
  removeMcpServer,
  setMcpEnabled,
  setPluginEnabled,
  uninstallPlugin,
} from "./extensions.js";
import { createSkill, deleteSkill, discoverSkills, setSkillEnabled } from "./skills.js";
import { AgentTerminalManager } from "./agent-terminals.js";
import { grokError } from "./grok-cli.js";

const execFileAsync = promisify(execFile);
const USAGE_POLL_MS = 3 * 60 * 1000;
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Main-process application store.
 *
 * Owns the ACP child, folds `session/update` into a renderer snapshot, and
 * never leaks Node/fs into the renderer. Session JSONL under ~/.grok/sessions
 * remains the source of truth.
 */
export class AppStore extends EventEmitter {
  readonly client = new GrokAcpClient();
  readonly agentTerminals = new AgentTerminalManager();
  gui = loadGuiState();
  connected = false;
  grokVersion: string | null = null;
  auth: AuthState = checkingAuth();
  private loginChild: ChildProcess | null = null;
  private loginPromise: Promise<void> | null = null;
  private loginCancelled = false;
  private reconnecting = false;
  cwd = process.cwd();
  models: ModelInfo[] = [];
  currentModelId = "";
  effort = "high";
  permissionMode: PermissionMode = "ask";
  yoloArmed = false;
  currentModeId: string | null = null;
  private permissionQueue: PermissionRequest[] = [];
  commands: SlashCommand[] = [];
  sessions: SessionSummary[] = [];
  activeSessionId: string | null = null;
  pendingPermission: PermissionRequest | null = null;
  pendingExtensionDialog: ExtensionDialog | null = null;
  private extensionDialogQueue: ExtensionDialog[] = [];
  private childParents = new Map<string, string>();
  private cancelledPrompts = new Set<string>();
  usage: ContextUsage | null = null;
  accountUsage: AccountUsage = null;
  queue: QueueEntry[] = [];
  private localQueue: QueueEntry[] = [];
  private remoteQueue: QueueEntry[] = [];
  private drainingQueue = false;
  running = false;
  git: AppSnapshot["git"] = { isRepo: false, changes: [] };
  worktrees: AppSnapshot["worktrees"] = [];
  mcp: AppSnapshot["mcp"] = [];
  plugins: AppSnapshot["plugins"] = [];
  skills: AppSnapshot["skills"] = [];
  plan: AppSnapshot["plan"] = null;
  announcements: AppSnapshot["announcements"] = [];
  error: string | null = null;
  liveById = new Map<string, any>();
  private transcript: TranscriptFold = createFold();
  private loadedToolCache = new Map<string, ToolCallState>();
  private loadedToolCacheOrder: string[] = [];
  private seq = 0;
  private rev = 0;
  /** Bumped on every thread switch so a slower `session/load` cannot clobber a newer one. */
  private sessionEpoch = 0;
  /** Suppresses the ACP history replay while `session/load` is in progress. */
  private loadingSession: { sessionId: string; epoch: number } | null = null;
  /** Prevents a slower session listing from replacing a newer listing. */
  private sessionsRefreshSeq = 0;
  /** Sessions with an in-flight `session/prompt`. Used to ignore unscoped stream chunks after a switch. */
  private inFlightPrompts = new Set<string>();
  private bumpTimer: ReturnType<typeof setTimeout> | null = null;
  private transcriptTimer: ReturnType<typeof setTimeout> | null = null;
  private usageTimer: ReturnType<typeof setInterval> | null = null;
  private usageRetry: ReturnType<typeof setTimeout> | null = null;
  private usageInFlight = false;

  get items(): TranscriptItem[] {
    return this.transcript.items;
  }

  snapshot(): AppSnapshot {
    return {
      connected: this.connected,
      grokBin: this.client.grokBin,
      grokVersion: this.grokVersion,
      auth: this.auth,
      cwd: this.cwd,
      models: this.models,
      currentModelId: this.currentModelId,
      effort: this.effort,
      permissionMode: this.displayPermissionMode(),
      currentModeId: this.currentModeId,
      commands: this.commands,
      sessions: this.sessions.map((s) => ({
        ...s,
        pinned: this.gui.pinned.includes(s.sessionId),
        archived: this.gui.archived.includes(s.sessionId) || Boolean(s.archived),
      })),
      activeSessionId: this.activeSessionId,
      // The transcript travels over its own IPC channel. Keeping it out of the
      // general snapshot avoids cloning the entire chat on every state change.
      items: [],
      pendingPermission: this.pendingPermission,
      pendingExtensionDialog: this.pendingExtensionDialog,
      usage: this.usage,
      accountUsage: this.accountUsage,
      queue: this.queue,
      running: Boolean(this.activeSessionId && (this.running || this.inFlightPrompts.has(this.activeSessionId))),
      git: this.git,
      worktrees: this.worktrees,
      mcp: this.mcp,
      plugins: this.plugins,
      skills: this.skills,
      plan: this.plan,
      announcements: this.announcements,
      error: this.error,
      gui: this.gui,
      rev: this.rev,
    };
  }

  private bump(): void {
    if (this.bumpTimer) {
      clearTimeout(this.bumpTimer);
      this.bumpTimer = null;
    }
    this.rev += 1;
    this.emit("change", this.snapshot());
  }

  private bumpSoon(): void {
    if (this.bumpTimer) return;
    this.bumpTimer = setTimeout(() => {
      this.bumpTimer = null;
      this.bump();
    }, 32);
  }

  transcriptSnapshot(): TranscriptSnapshot {
    return {
      sessionId: this.activeSessionId,
      items: this.transcript.items.map((item) => {
        if (item.kind === "assistant" || item.kind === "thought") {
          return item.streaming ? { ...item } : item;
        }
        if (item.kind !== "tool") return item;
        if (item.tool.contentLoaded === false) return item;
        if (!isTerminalToolStatus(item.tool.status)) return { ...item, tool: { ...item.tool } };
        return { ...item, tool: compactToolForTransport(item.tool) };
      }),
    };
  }

  private emitTranscriptChange(): void {
    if (this.transcriptTimer) {
      clearTimeout(this.transcriptTimer);
      this.transcriptTimer = null;
    }
    this.emit("transcript-change", this.transcriptSnapshot());
  }

  private emitTranscriptSoon(): void {
    if (this.transcriptTimer) return;
    this.transcriptTimer = setTimeout(() => {
      this.transcriptTimer = null;
      this.emit("transcript-change", this.transcriptSnapshot());
    }, 32);
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  private resetTranscript(): void {
    if (this.transcriptTimer) {
      clearTimeout(this.transcriptTimer);
      this.transcriptTimer = null;
    }
    this.transcript = createFold();
    this.loadedToolCache.clear();
    this.loadedToolCacheOrder = [];
  }

  private isForActiveSession(params: Record<string, unknown> | undefined | null): boolean {
    return isForActiveSession(params, this.activeSessionId, this.inFlightPrompts);
  }

  private adoptSession(sessionId: string, initialItems: TranscriptItem[] = []): number {
    const epoch = ++this.sessionEpoch;
    this.loadingSession = null;
    this.activeSessionId = sessionId;
    this.resetTranscript();
    this.transcript.items = initialItems;
    this.plan = null;
    this.localQueue = [];
    this.remoteQueue = [];
    this.syncQueue();
    this.error = null;
    this.running = this.inFlightPrompts.has(sessionId);
    this.rebuildTranscriptIndexes();
    this.adoptPermissions(sessionId);
    this.emitTranscriptChange();
    this.bump();
    return epoch;
  }

  private adoptPermissions(sessionId: string): void {
    if (this.pendingPermission && this.pendingPermission.sessionId !== sessionId) {
      this.permissionQueue.unshift(this.pendingPermission);
      this.pendingPermission = null;
    }
    const idx = this.permissionQueue.findIndex((request) => request.sessionId === sessionId);
    if (idx >= 0) {
      this.pendingPermission = this.permissionQueue[idx] ?? null;
      this.permissionQueue.splice(idx, 1);
    }
  }

  private applyCurrentModeUpdate(modeId: string): void {
    const id = modeId.trim();
    if (!id) return;
    if (id === "low" || id === "medium" || id === "high" || id === "xhigh") {
      this.effort = id;
      return;
    }
    this.currentModeId = id;
    if (id === "always-approve" || id === "yolo" || id === "bypassPermissions") {
      this.armYolo(true);
      this.permissionMode = "always-approve";
      this.flushAutoApprovals();
      return;
    }
    if (id === "plan") {
      this.permissionMode = "plan";
      return;
    }
    if (id === "auto") {
      this.armYolo(false);
      this.permissionMode = "auto";
      return;
    }
    if (id === "default" || id === "ask") {
      this.permissionMode = this.yoloArmed ? "always-approve" : "ask";
      this.flushAutoApprovals();
    }
  }

  async boot(): Promise<void> {
    if (this.gui.lastCwd && existsSync(this.gui.lastCwd)) this.cwd = this.gui.lastCwd;
    this.seedWorkspaces();
    if (this.gui.permissionMode) this.permissionMode = this.gui.permissionMode;
    this.yoloArmed = Boolean(this.gui.yoloArmed) || this.gui.permissionMode === "always-approve";
    try {
      const { stdout } = await execFileAsync(this.client.grokBin, ["--version"]);
      this.grokVersion = stdout.trim().split("\n")[0] ?? null;
    } catch {
      this.grokVersion = null;
    }
    this.client.on("notification", (msg) => this.onNotification(msg));
    this.client.on("server-request", (msg) => this.onServerRequest(msg));
    this.client.on("exit", () => {
      this.connected = false;
      if (this.reconnecting) return;
      this.error = "Grok agent process exited.";
      this.bump();
    });
    this.client.on("auth-needed", (err) => {
      this.maybeNoteAuthFailure(err);
    });
    await this.client.start();
    this.connected = true;
    this.applyInitializeResult(this.client.initializeResult);
    if (!(await this.applyCachedAuth())) {
      void this.login();
      await this.refreshGit();
      await this.refreshCatalogs();
      this.bump();
      return;
    }
    await this.hydrateAfterAuth();
    this.bump();
  }

  async refreshSessions(): Promise<void> {
    const refreshSeq = ++this.sessionsRefreshSeq;
    try {
      const listed = unwrap<any>(await this.client.request(AcpMethod.XaiSessionList, {}));
      if (refreshSeq !== this.sessionsRefreshSeq) return;
      const rows = asArray<any>(listed?.sessions ?? listed);
      const live = this.liveById;
      const sessions: SessionSummary[] = rows.map((s) => {
        const id = s.sessionId;
        const l = live.get(id);
        const cwd = s.cwd ?? this.cwd;
        const parentSessionId =
          parentIdFromSessionRow(s) ??
          this.childParents.get(id) ??
          parentIdFromDisk(id, cwd);
        if (parentSessionId) this.childParents.set(id, parentSessionId);
        return {
          sessionId: id,
          cwd,
          title: sessionTitle(s),
          summary: s.summary ?? "",
          modelId: s.modelId ?? l?.modelId ?? this.currentModelId,
          createdAt: s.createdAt ?? null,
          updatedAt: s.updatedAt ?? s.lastActiveAt ?? "",
          lastActiveAt: s.lastActiveAt,
          numMessages: s.numMessages ?? 0,
          activity: activityFromLive(l),
          yolo: l?.yolo,
          reasoningEffort: l?.reasoningEffort ?? s.reasoningEffort,
          isWorktree: l?.isWorktree ?? false,
          kind: s.kind ?? s._meta?.["x.ai/session"]?.kind ?? l?.kind,
          parentSessionId,
        };
      });
      const known = new Set(sessions.map((session) => session.sessionId));
      for (const session of [...sessions]) {
        for (const child of listSubagentChildren(session.sessionId, session.cwd)) {
          this.childParents.set(child.sessionId, child.parentSessionId);
          const existing = sessions.find((row) => row.sessionId === child.sessionId);
          if (existing) {
            existing.parentSessionId = existing.parentSessionId ?? child.parentSessionId;
            existing.kind = existing.kind ?? "subagent";
            continue;
          }
          if (known.has(child.sessionId)) continue;
          known.add(child.sessionId);
          sessions.push(childSessionStub(child, session.cwd));
        }
      }
      if (refreshSeq !== this.sessionsRefreshSeq) return;
      this.sessions = sessions;
    } catch (err) {
      if (refreshSeq !== this.sessionsRefreshSeq) return;
      if (this.maybeNoteAuthFailure(err)) return;
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  async setCwd(next: string, opts?: { asRoot?: boolean }): Promise<void> {
    this.cwd = next;
    this.gui.lastCwd = next;
    const isWorktree = this.worktrees.some((wt) => wt.path === next);
    if (opts?.asRoot || (!isWorktree && next)) {
      this.gui.rootCwd = next;
      this.rememberWorkspace(next, { front: true });
    }
    saveGuiState(this.gui);
    await this.refreshGit();
    await this.refreshCatalogs();
    this.bump();
  }

  rememberWorkspace(dir: string, opts?: { front?: boolean }): void {
    if (!dir) return;
    const current = this.gui.workspaces ?? [];
    if (current.includes(dir)) return;
    this.gui.workspaces = opts?.front === false ? [...current, dir] : [dir, ...current];
  }

  removeWorkspace(dir: string): void {
    this.gui.workspaces = (this.gui.workspaces ?? []).filter((item) => item !== dir);
    if (this.gui.rootCwd === dir) this.gui.rootCwd = this.gui.workspaces[0] ?? "";
    if (this.cwd === dir) this.cwd = this.gui.rootCwd || this.cwd;
    saveGuiState(this.gui);
    this.bump();
  }

  private seedWorkspaces(): void {
    const existing = this.gui.workspaces ?? [];
    for (const dir of [this.gui.rootCwd, this.gui.lastCwd, this.cwd]) {
      if (dir && existsSync(dir) && !existing.includes(dir)) existing.push(dir);
    }
    this.gui.workspaces = existing;
    saveGuiState(this.gui);
  }

  async selectEnvironment(id: string): Promise<void> {
    if (id === "local") {
      const root = this.gui.rootCwd || this.cwd;
      await this.setCwd(root, { asRoot: true });
      return;
    }
    const worktree = this.worktrees.find((wt) => wt.path === id);
    if (worktree?.sessionId) {
      await this.openSession(worktree.sessionId, worktree.path);
      return;
    }
    if (worktree?.path) {
      await this.setCwd(worktree.path);
      return;
    }
    await this.setCwd(id);
  }

  async newSession(prompt?: string, opts?: { worktree?: boolean; yolo?: boolean; permissionMode?: PermissionMode }): Promise<string> {
    const mode = opts?.permissionMode ?? this.permissionMode;
    if (opts?.yolo) this.armYolo(true);
    const params: Record<string, unknown> = { cwd: this.cwd, mcpServers: [], _meta: this.permissionMeta(mode) };
    let result: any;
    try {
      result = await this.client.request<any>(AcpMethod.SessionNew, params);
    } catch (err) {
      this.maybeNoteAuthFailure(err);
      throw err;
    }
    const sessionId = result.sessionId as string;
    this.applySessionMeta(result);
    const epoch = this.adoptSession(sessionId);
    this.rebuildTranscriptIndexes();
    await this.refreshSessions();
    if (epoch !== this.sessionEpoch) return sessionId;
    await this.refreshSessionExtras(sessionId);
    if (epoch !== this.sessionEpoch) return sessionId;
    if (opts?.worktree) {
      try {
        const created = unwrap<any>(await this.client.request(AcpMethod.XaiGitWorktreeCreate, { sessionId, cwd: this.cwd }));
        if (epoch !== this.sessionEpoch) return sessionId;
        const worktreePath = created?.path ?? created?.worktreePath;
        if (worktreePath) this.cwd = worktreePath;
        await this.refreshSessionExtras(sessionId);
        await this.refreshGit();
      } catch (err) {
        if (epoch === this.sessionEpoch) this.error = err instanceof Error ? err.message : String(err);
      }
    }
    if (epoch !== this.sessionEpoch) return sessionId;
    await this.applyLiveMode(sessionId, mode);
    if (epoch !== this.sessionEpoch) return sessionId;
    if (prompt?.trim()) await this.prompt(prompt);
    this.bump();
    return sessionId;
  }

  async openSession(sessionId: string, cwd?: string): Promise<void> {
    const targetCwd = cwd ?? this.sessions.find((s) => s.sessionId === sessionId)?.cwd ?? this.cwd;
    const initialItems = this.readPersistedTranscript(sessionId, targetCwd);
    this.cwd = targetCwd;
    const epoch = this.adoptSession(sessionId, initialItems);
    this.loadingSession = { sessionId, epoch };
    let result: any;
    try {
      result = await this.client.request<any>(AcpMethod.SessionLoad, {
        sessionId,
        cwd: targetCwd,
        mcpServers: [],
        _meta: this.permissionMeta(this.permissionMode),
      });
    } catch (error) {
      if (this.loadingSession?.epoch === epoch) this.loadingSession = null;
      this.maybeNoteAuthFailure(error);
      throw error;
    }
    if (epoch !== this.sessionEpoch) return;
    try {
      this.applySessionMeta(result);
      this.transcript = createFold();
      this.transcript.items = this.readPersistedTranscript(sessionId, targetCwd);
      this.rebuildTranscriptIndexes();
    } finally {
      if (this.loadingSession?.epoch === epoch) this.loadingSession = null;
    }
    // Publish the complete source-of-truth transcript before slower session
    // metadata, git, and mode requests. The ACP session/load replay is ignored
    // above so the renderer never watches history rebuild from oldest to newest.
    this.emitTranscriptChange();
    await this.refreshSessionExtras(sessionId);
    if (epoch !== this.sessionEpoch) return;
    await this.refreshGit();
    if (epoch !== this.sessionEpoch) return;
    await this.applyLiveMode(sessionId, this.permissionMode);
    if (epoch !== this.sessionEpoch) return;
    this.emitTranscriptChange();
    this.bump();
  }

  applySessionMeta(result: any): void {
    if (result?.models) {
      this.models = parseModels(result.models.availableModels);
      this.currentModelId = result.models.currentModelId ?? this.currentModelId;
    }
    const meta = result?._meta ?? {};
    if (meta.currentWorkingDirectory) this.cwd = meta.currentWorkingDirectory;
    const options = meta["x.ai/sessionConfig"]?.options ?? [];
    const effort = options.find((o: { category?: string; selected?: boolean; id?: string }) => o.category === "mode" && o.selected);
    if (effort?.id) this.effort = effort.id;
    this.git.isRepo = Boolean(meta.isGitRepo);
    if (meta.yoloMode === true) this.armYolo(true);
    if (meta.autoMode === true && !this.yoloArmed) this.permissionMode = "auto";
  }

  async prompt(
    text: string,
    attachments: readonly ComposerAttachment[] = [],
    opts?: { deliverAs?: "steer" | "followUp" },
  ): Promise<void> {
    if (!this.activeSessionId) await this.newSession();
    const sessionId = this.activeSessionId!;
    if (this.inFlightPrompts.has(sessionId) || (this.running && !this.drainingQueue)) {
      this.enqueueLocalPrompt(text, attachments, opts?.deliverAs ?? "followUp");
      return;
    }
    await this.sendPrompt(sessionId, text, attachments);
  }

  private async sendPrompt(
    sessionId: string,
    text: string,
    attachments: readonly ComposerAttachment[] = [],
  ): Promise<void> {
    this.inFlightPrompts.add(sessionId);
    this.plan = null;
    this.transcript.items.push({ id: this.nextId("u"), kind: "user", text, at: Date.now(), attachments: attachments.length ? [...attachments] : undefined });
    this.transcript.assistantIndex = null;
    this.transcript.thoughtIndex = null;
    this.running = true;
    this.emitTranscriptChange();
    this.bump();
    let failed = false;
    try {
      const prompt: ContentBlock[] = [{ type: "text", text }, ...attachments.flatMap((attachment): ContentBlock[] => {
        if (attachment.kind === "image" && attachment.data) return [{ type: "image", data: attachment.data, mimeType: attachment.mimeType }];
        if (attachment.path) return [{ type: "resource_link", uri: attachment.path, name: attachment.name, mimeType: attachment.mimeType }];
        return [];
      })];
      await this.client.request(AcpMethod.SessionPrompt, { sessionId, prompt }, 30 * 60_000);
    } catch (err) {
      failed = true;
      if (!this.maybeNoteAuthFailure(err) && this.activeSessionId === sessionId) {
        this.error = err instanceof Error ? err.message : String(err);
      }
    } finally {
      this.inFlightPrompts.delete(sessionId);
      const cancelled = this.cancelledPrompts.delete(sessionId);
      const stillQueued = this.activeSessionId === sessionId && this.localQueue.length > 0;
      if (!cancelled && !stillQueued) this.emitRunFinished(sessionId, !failed);
      if (this.activeSessionId === sessionId) {
        this.running = this.drainingQueue || this.localQueue.length > 0;
        this.transcript.assistantIndex = null;
        this.transcript.thoughtIndex = null;
        await this.refreshSessionExtras(sessionId);
        this.emitTranscriptChange();
        this.bump();
      } else {
        this.bump();
      }
      if (!this.drainingQueue && this.activeSessionId === sessionId && this.localQueue.length > 0) {
        void this.drainLocalQueue(sessionId);
      }
    }
  }

  private syncQueue(): void {
    const combined = [...this.remoteQueue, ...this.localQueue];
    this.queue = combined.map((entry, position) => ({ ...entry, position }));
  }

  private enqueueLocalPrompt(
    text: string,
    attachments: readonly ComposerAttachment[],
    mode: "steer" | "followUp",
  ): void {
    this.localQueue = [
      ...this.localQueue,
      {
        id: this.nextId("queue"),
        kind: "user",
        text,
        position: this.localQueue.length,
        mode,
        attachments: attachments.length ? [...attachments] : undefined,
        source: "local",
      },
    ];
    this.syncQueue();
    this.bump();
  }

  private async drainLocalQueue(sessionId: string): Promise<void> {
    if (this.drainingQueue || this.activeSessionId !== sessionId) return;
    this.drainingQueue = true;
    try {
      while (this.activeSessionId === sessionId && this.localQueue.length > 0) {
        const next = this.localQueue[0];
        if (!next) break;
        this.localQueue = this.localQueue.slice(1);
        this.syncQueue();
        this.bump();
        await this.sendPrompt(sessionId, next.text, next.attachments ?? []);
      }
    } finally {
      this.drainingQueue = false;
      if (this.activeSessionId === sessionId && !this.inFlightPrompts.has(sessionId)) {
        this.running = false;
        this.bump();
      }
    }
  }

  async editQueuedMessage(
    id: string,
    text: string,
    attachments: readonly ComposerAttachment[] = [],
  ): Promise<void> {
    const index = this.localQueue.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    if (!this.localQueue[index]) return;
    this.localQueue = this.localQueue.map((entry, entryIndex) =>
      entryIndex === index
        ? { ...entry, text, attachments: attachments.length ? [...attachments] : undefined }
        : entry,
    );
    this.syncQueue();
    this.bump();
  }

  async removeQueuedMessage(id: string): Promise<void> {
    const next = this.localQueue.filter((entry) => entry.id !== id);
    if (next.length === this.localQueue.length) return;
    this.localQueue = next;
    this.syncQueue();
    this.bump();
  }

  async steerQueuedMessage(id: string): Promise<void> {
    const index = this.localQueue.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const current = this.localQueue[index];
    if (!current) return;
    this.localQueue = [
      { ...current, mode: "steer" },
      ...this.localQueue.slice(0, index),
      ...this.localQueue.slice(index + 1),
    ];
    this.syncQueue();
    this.bump();
  }

  cancel(): void {
    if (!this.activeSessionId) return;
    this.cancelledPrompts.add(this.activeSessionId);
    this.client.notify(AcpMethod.SessionCancel, { sessionId: this.activeSessionId });
    this.inFlightPrompts.delete(this.activeSessionId);
    this.localQueue = [];
    this.syncQueue();
    this.running = false;
    this.bump();
  }

  async setModel(modelId: string): Promise<void> {
    if (!this.activeSessionId) return;
    await this.client.request(AcpMethod.SessionSetModel, { sessionId: this.activeSessionId, modelId });
    this.currentModelId = modelId;
    this.bump();
  }

  permissionMeta(mode: PermissionMode = this.permissionMode): Record<string, unknown> {
    const yolo = this.yoloArmed || mode === "always-approve";
    return {
      yoloMode: yolo,
      autoMode: !yolo && mode === "auto",
    };
  }

  private armYolo(on: boolean): void {
    this.yoloArmed = on;
    this.gui = { ...this.gui, yoloArmed: on, permissionMode: this.displayPermissionMode() };
    saveGuiState(this.gui);
  }

  private displayPermissionMode(): PermissionMode {
    if (this.currentModeId === "plan" || this.permissionMode === "plan") return "plan";
    if (this.yoloArmed) return "always-approve";
    if (this.currentModeId === "auto" || this.permissionMode === "auto") return "auto";
    return "ask";
  }

  private async applyLiveMode(sessionId: string, mode: PermissionMode, promptFallback = false): Promise<void> {
    if (mode === "always-approve") this.armYolo(true);
    if (mode === "ask") this.armYolo(false);
    if (mode === "auto") this.armYolo(false);
    this.permissionMode = this.yoloArmed && mode !== "plan" && mode !== "auto" ? "always-approve" : mode;
    this.gui = { ...this.gui, permissionMode: this.displayPermissionMode(), yoloArmed: this.yoloArmed };
    saveGuiState(this.gui);
    const modeIds =
      mode === "always-approve" ? ["bypassPermissions", "always-approve", "yolo"]
      : mode === "plan" ? ["plan"]
      : mode === "auto" ? ["auto"]
      : ["default", "ask"];
    let applied = false;
    for (const modeId of modeIds) {
      try {
        await this.client.request(AcpMethod.SessionSetMode, { sessionId, modeId });
        this.currentModeId = modeId;
        applied = true;
        break;
      } catch {}
    }
    if (!applied && promptFallback && (mode === "always-approve" || mode === "ask")) {
      try {
        await this.client.request(AcpMethod.SessionPrompt, {
          sessionId,
          prompt: [{ type: "text", text: mode === "always-approve" ? "/always-approve on" : "/always-approve off" }],
        }, 15_000);
      } catch {}
    }
    this.permissionMode = this.displayPermissionMode();
  }

  async setMode(modeId: PermissionMode | string): Promise<void> {
    const sessionId = this.activeSessionId;
    if (modeId === "low" || modeId === "medium" || modeId === "high" || modeId === "xhigh") {
      await this.setEffort(modeId);
      return;
    }
    const mapped: PermissionMode =
      modeId === "yolo" || modeId === "bypassPermissions" || modeId === "always-approve"
        ? "always-approve"
        : modeId === "auto"
          ? "auto"
          : modeId === "plan"
            ? "plan"
            : "ask";
    if (mapped === "always-approve") this.armYolo(true);
    else if (mapped === "ask" || mapped === "auto") this.armYolo(false);
    this.permissionMode = mapped;
    this.gui = { ...this.gui, permissionMode: mapped, yoloArmed: this.yoloArmed };
    saveGuiState(this.gui);
    if (!sessionId) {
      this.bump();
      return;
    }
    try {
      await this.applyLiveMode(sessionId, mapped, true);
      this.flushAutoApprovals();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
    this.bump();
  }

  async setEffort(effort: string): Promise<void> {
    if (!this.activeSessionId) {
      this.effort = effort;
      this.bump();
      return;
    }
    try {
      await this.client.request(AcpMethod.SessionSetMode, { sessionId: this.activeSessionId, modeId: effort });
      this.effort = effort;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
    this.bump();
  }

  async rename(sessionId: string, title: string): Promise<void> {
    await this.client.request(AcpMethod.XaiSessionRename, { sessionId, title });
    await this.refreshSessions();
    this.bump();
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.request(AcpMethod.XaiSessionDelete, { sessionId });
    if (this.activeSessionId === sessionId) {
      this.sessionEpoch += 1;
      this.activeSessionId = null;
      this.resetTranscript();
      this.emitTranscriptChange();
    }
    this.gui.pinned = this.gui.pinned.filter((id) => id !== sessionId);
    this.gui.archived = this.gui.archived.filter((id) => id !== sessionId);
    saveGuiState(this.gui);
    await this.refreshSessions();
    this.bump();
  }

  async fork(itemId?: string, opts?: { worktree?: boolean }): Promise<void> {
    if (!this.activeSessionId) return;
    const forkItemIndex = itemId ? this.transcript.items.findIndex((item) => item.id === itemId) : -1;
    const promptIndex = forkItemIndex >= 0
      ? this.transcript.items.slice(0, forkItemIndex + 1).filter((item) => item.kind === "user").length - 1
      : undefined;
    const result = unwrap<any>(
      await this.client.request(AcpMethod.XaiSessionFork, {
        sourceSessionId: this.activeSessionId,
        sourceCwd: this.cwd,
        newCwd: this.cwd,
        ...(itemId ? { itemId } : {}),
        ...(promptIndex != null && promptIndex >= 0 ? { promptIndex } : {}),
      }),
    );
    const sessionId = result?.sessionId ?? result?.newSessionId;
    if (sessionId) {
      await this.openSession(sessionId, this.cwd);
      if (promptIndex != null && promptIndex >= 0) {
        try {
          await this.client.request(AcpMethod.XaiRewindExecute, { sessionId, promptIndex });
          await this.openSession(sessionId, this.cwd);
        } catch {}
      }
      if (opts?.worktree) {
        try {
          const created = unwrap<any>(await this.client.request(AcpMethod.XaiGitWorktreeCreate, { sessionId, cwd: this.cwd }));
          const worktreePath = created?.path ?? created?.worktreePath;
          if (worktreePath) {
            this.cwd = worktreePath;
            await this.refreshGit();
          }
        } catch (err) {
          this.error = err instanceof Error ? err.message : String(err);
        }
      }
      await this.applyLiveMode(sessionId, this.permissionMode);
    }
  }

  async compact(note?: string): Promise<void> {
    if (!this.activeSessionId) return;
    const sessionId = this.activeSessionId;
    await this.client.request(AcpMethod.XaiCompact, {
      sessionId,
      context: note,
    });
    await this.refreshSessionExtras(sessionId);
    if (this.activeSessionId !== sessionId) return;
    this.transcript.items = this.readPersistedTranscript(sessionId, this.cwd);
    this.rebuildTranscriptIndexes();
    this.emitTranscriptChange();
    this.bump();
  }

  async rewindTo(index: number): Promise<void> {
    if (!this.activeSessionId) return;
    await this.client.request(AcpMethod.XaiRewindExecute, {
      sessionId: this.activeSessionId,
      promptIndex: index,
    });
    await this.openSession(this.activeSessionId, this.cwd);
  }

  async listRewindPoints(): Promise<RewindPoint[]> {
    if (!this.activeSessionId) return [];
    try {
      const r = unwrap<any>(await this.client.request(AcpMethod.XaiRewindPoints, { sessionId: this.activeSessionId }));
      return asArray<any>(r?.rewind_points ?? r).map((point, index) => ({
        index: Number(point.promptIndex ?? point.index ?? index),
        label: point.label ?? point.title ?? `Turn ${Number(point.promptIndex ?? point.index ?? index) + 1}`,
        preview: point.preview ?? point.text ?? point.summary,
      }));
    } catch {
      return this.transcript.items
        .filter((item): item is Extract<TranscriptItem, { kind: "user" }> => item.kind === "user")
        .map((item, index) => ({
          index,
          label: `Turn ${index + 1}`,
          preview: item.text.split("\n").find((line) => line.trim()) ?? item.text,
        }));
    }
  }

  async gitDiff(filePath: string, staged = false): Promise<GitDiff> {
    return diffFile(this.cwd, filePath, staged);
  }

  async gitStage(filePath: string): Promise<void> {
    await stageFile(this.cwd, filePath);
    await this.refreshGit();
    this.bump();
  }

  async gitUnstage(filePath: string): Promise<void> {
    await unstageFile(this.cwd, filePath);
    await this.refreshGit();
    this.bump();
  }

  async gitDiscard(filePath: string): Promise<void> {
    await discardFile(this.cwd, filePath);
    await this.refreshGit();
    this.bump();
  }

  listFiles(): FileTreeNode[] {
    return listTree(this.cwd);
  }

  readFile(relPath: string): FilePreview {
    return readWorkspaceFile(this.cwd, relPath);
  }

  async runSlash(name: string, args = ""): Promise<void> {
    const text = args ? `/${name} ${args}` : `/${name}`;
    await this.prompt(text);
  }

  async fuzzySearch(query: string): Promise<unknown> {
    if (!this.activeSessionId) return { files: [] };
    return unwrap(
      await this.client.request(AcpMethod.XaiFuzzyOpen, { sessionId: this.activeSessionId, query }),
    );
  }

  async approvePermission(optionId: string): Promise<void> {
    const pending = this.pendingPermission;
    if (!pending) return;
    this.client.respond(pending.requestId, { outcome: { outcome: "selected", optionId } });
    this.pendingPermission = this.nextPermissionForActive();
    this.flushAutoApprovals();
    this.bump();
  }

  private autoApproveOpts() {
    return { yoloArmed: this.yoloArmed, permissionMode: this.permissionMode, currentModeId: this.currentModeId };
  }

  private nextPermissionForActive(): PermissionRequest | null {
    const idx = this.permissionQueue.findIndex((request) => !this.activeSessionId || request.sessionId === this.activeSessionId);
    if (idx < 0) return null;
    const next = this.permissionQueue[idx] ?? null;
    this.permissionQueue.splice(idx, 1);
    return next;
  }

  private flushAutoApprovals(): void {
    while (this.pendingPermission && shouldAutoApprove(this.pendingPermission, this.autoApproveOpts())) {
      const optionId = pickAllowOption(this.pendingPermission.options);
      if (!optionId) break;
      this.client.respond(this.pendingPermission.requestId, { outcome: { outcome: "selected", optionId } });
      this.pendingPermission = this.nextPermissionForActive();
    }
    const kept: PermissionRequest[] = [];
    for (const request of this.permissionQueue) {
      if (shouldAutoApprove(request, this.autoApproveOpts())) {
        const optionId = pickAllowOption(request.options);
        if (optionId) {
          this.client.respond(request.requestId, { outcome: { outcome: "selected", optionId } });
          continue;
        }
      }
      kept.push(request);
    }
    this.permissionQueue = kept;
  }

  async refreshSessionExtras(sessionId: string): Promise<void> {
    const epoch = this.sessionEpoch;
    const isCurrent = () => this.activeSessionId === sessionId && this.sessionEpoch === epoch;
    if (!isCurrent()) return;
    try {
      const info = unwrap<any>(await this.client.request(AcpMethod.XaiSessionInfo, { sessionId }));
      if (isCurrent()) {
        const parsed = parseContextUsage(info?.context ?? info?.usage ?? info);
        if (parsed) this.usage = parsed;
        if (info?.model) this.currentModelId = info.model;
        const account = parseWeeklyUsage(info?.account ?? info?.credits ?? info?.billing, "session-info");
        if (account && (account.usedPct != null || account.resets)) this.accountUsage = account;
      }
    } catch {}
    if (!isCurrent()) return;
    try {
      const mcp = unwrap<any>(await this.client.request(AcpMethod.XaiMcpList, {}));
      if (!isCurrent()) return;
      this.mcp = mergeMcpRecords(
        this.mcp,
        asArray<any>(mcp?.servers).map((s) => ({
          name: s.name,
          displayName: s.displayName,
          enabled: s.session?.enabled,
          status: s.session?.status,
          source: s.source,
        })),
      );
    } catch {}
    if (!isCurrent()) return;
    try {
      const plugins = unwrap<any>(await this.client.request(AcpMethod.XaiPluginsList, { sessionId }));
      if (!isCurrent()) return;
      this.plugins = mergePluginRecords(
        this.plugins,
        asArray<any>(plugins?.plugins).map((p) => ({
          name: p.name ?? p.id,
          enabled: p.enabled,
          version: p.version,
          source: p.source,
          path: p.path,
          description: p.description,
        })),
      );
    } catch {}
    if (!isCurrent()) return;
    try {
      const wts = unwrap<any>(await this.client.request(AcpMethod.XaiGitWorktreeList, {}));
      if (!isCurrent()) return;
      this.worktrees = asArray<any>(wts).map((w) => ({
        path: w.path ?? w.worktreePath ?? "",
        label: w.label ?? w.name,
        sessionId: w.sessionId,
      }));
    } catch {}
    if (!isCurrent()) return;
    this.plan = this.readPlan(sessionId, this.cwd);
    if (!isCurrent()) return;
    await this.refreshAccountUsage();
  }

  async loadToolContent(toolCallId: string): Promise<ToolCallState | null> {
    const cached = this.loadedToolCache.get(toolCallId);
    if (cached) return cached;

    const current = this.transcript.items.find(
      (item): item is Extract<TranscriptItem, { kind: "tool" }> => item.kind === "tool" && item.tool.toolCallId === toolCallId,
    );
    if (current && current.tool.contentLoaded !== false) return this.rememberLoadedTool(current.tool);
    if (!this.activeSessionId) return null;
    const file = path.join(sessionDir(this.activeSessionId, this.cwd), "updates.jsonl");
    if (!existsSync(file)) return null;

    let tool: ToolCallState | null = null;
    const lines = createInterface({ input: createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.trim()) continue;
      let msg: { params?: { update?: Record<string, any> }; update?: Record<string, any> };
      try { msg = JSON.parse(line) as typeof msg; } catch { continue; }
      const update = msg.params?.update ?? msg.update;
      if (!update) continue;
      if (update.sessionUpdate === "tool_call") {
        const candidate = normalizeTool(update, () => toolCallId);
        if (candidate.toolCallId === toolCallId) tool = candidate;
      } else if (update.sessionUpdate === "tool_call_update" && update.toolCallId === toolCallId) {
        const merged = normalizeTool({ ...(tool ?? {}), ...update }, () => toolCallId);
        tool = { ...(tool ?? {}), ...merged };
      }
    }
    return tool ? this.rememberLoadedTool({ ...tool, hasContent: true, contentLoaded: true }) : null;
  }

  private rememberLoadedTool(tool: ToolCallState): ToolCallState {
    const id = tool.toolCallId;
    this.loadedToolCache.delete(id);
    this.loadedToolCache.set(id, tool);
    this.loadedToolCacheOrder = this.loadedToolCacheOrder.filter((key) => key !== id);
    this.loadedToolCacheOrder.push(id);
    while (this.loadedToolCacheOrder.length > MAX_LOADED_TOOL_PAYLOADS) {
      const evict = this.loadedToolCacheOrder.shift();
      if (evict) this.loadedToolCache.delete(evict);
    }
    return tool;
  }

  private applyPlanEntries(entries: PlanEntry[], merge: boolean, content?: string): void {
    const current = this.plan?.entries ?? [];
    const resolved = mergePlanEntries(current, entries, merge);
    if (!resolved.length && !content && !this.plan?.content) {
      this.plan = null;
      return;
    }
    this.plan = {
      content: content ?? this.plan?.content,
      status: resolved.every((entry) => entry.status === "completed" || entry.status === "cancelled") ? "complete" : "active",
      entries: resolved,
    };
  }

  async refreshAccountUsage(): Promise<void> {
    if (this.usageInFlight) return;
    this.usageInFlight = true;
    try {
      const parsed = await fetchWeeklyUsage(async (method, params) =>
        unwrap(await this.client.request(method, params, 3_000)),
      );
      if (!parsed) {
        this.scheduleUsageRetry();
        return;
      }
      this.accountUsage = parsed;
      this.bump();
      if (parsed.usedPct == null) this.scheduleUsageRetry();
    } catch {
      this.scheduleUsageRetry();
    } finally {
      this.usageInFlight = false;
    }
  }

  private startUsagePolling(): void {
    void this.refreshAccountUsage();
    if (this.usageTimer) return;
    this.usageTimer = setInterval(() => {
      void this.refreshAccountUsage();
    }, USAGE_POLL_MS);
  }

  private scheduleUsageRetry(): void {
    if (this.accountUsage?.usedPct != null || this.usageRetry) return;
    this.usageRetry = setTimeout(() => {
      this.usageRetry = null;
      void this.refreshAccountUsage();
    }, 5_000);
  }

  async refreshGit(): Promise<void> {
    try {
      this.git = await inspectGit(this.cwd);
    } catch {
      this.git = { isRepo: existsSync(path.join(this.cwd, ".git")), changes: [] };
    }
    if (!this.git.branch || this.git.changes.length === 0) {
      try {
        const status = unwrap<any>(await this.client.request(AcpMethod.XaiGitStatus, { cwd: this.cwd }));
        if (!this.git.branch) this.git.branch = status?.branch ?? status?.head;
        if (this.git.changes.length === 0) {
          this.git.changes = asArray<any>(status?.files ?? status?.changes ?? []).map((f) => ({
            path: f.path ?? f.file ?? String(f),
            status: f.status ?? f.kind ?? "modified",
            insertions: f.insertions,
            deletions: f.deletions,
          }));
          this.git.isRepo = true;
        }
      } catch {}
    }
  }

  pin(sessionId: string, pinned: boolean): void {
    const current = (this.gui.pinned ?? []).filter((id) => id !== sessionId);
    this.gui.pinned = pinned ? [...current, sessionId] : current;
    saveGuiState(this.gui);
    this.bump();
  }

  archive(sessionId: string, archived: boolean): void {
    const set = new Set(this.gui.archived ?? []);
    if (archived) set.add(sessionId);
    else set.delete(sessionId);
    this.gui.archived = [...set];
    saveGuiState(this.gui);
    this.bump();
  }

  reorderWorkspaces(order: string[]): void {
    const seen = new Set(order);
    const rest = (this.gui.workspaces ?? []).filter((dir) => !seen.has(dir));
    this.gui.workspaces = [...order, ...rest];
    saveGuiState(this.gui);
    this.bump();
  }

  reorderPinned(order: string[]): void {
    const seen = new Set(order);
    const rest = (this.gui.pinned ?? []).filter((id) => !seen.has(id));
    this.gui.pinned = [...order, ...rest];
    saveGuiState(this.gui);
    this.bump();
  }

  private emitRunFinished(sessionId: string, ok: boolean): void {
    const title = this.sessions.find((session) => session.sessionId === sessionId)?.title || "Grok";
    this.emit("run-finished", { sessionId, title, ok });
  }

  respondExtensionUi(response: ExtensionUiResponse): void {
    const pending = this.pendingExtensionDialog;
    if (!pending || pending.requestId !== response.requestId) return;
    this.pendingExtensionDialog = this.extensionDialogQueue.shift() ?? null;
    if ("cancelled" in response && response.cancelled) {
      this.client.respond(response.requestId, { cancelled: true });
    } else if ("confirmed" in response && response.confirmed) {
      this.client.respond(response.requestId, { confirmed: true });
    } else if ("value" in response) {
      this.client.respond(response.requestId, { value: response.value });
    }
    this.bump();
  }

  private enqueueExtensionDialog(dialog: ExtensionDialog): void {
    if (this.pendingExtensionDialog) this.extensionDialogQueue.push(dialog);
    else this.pendingExtensionDialog = dialog;
    this.bump();
  }

  private noteSubagentLink(params: Record<string, any>): void {
    const update = params.update ?? params;
    const kind = String(update.sessionUpdate ?? update.kind ?? "");
    if (kind !== "subagent_spawned" && kind !== "agent_spawned") return;
    const child = update.sessionId ?? update.childSessionId ?? update.agentSessionId ?? update._meta?.sessionId;
    const parent = sessionIdFromParams(params) ?? this.activeSessionId;
    if (typeof child === "string" && child && parent && child !== parent) {
      const already = this.childParents.get(child) === parent;
      this.childParents.set(child, parent);
      if (!already) void this.refreshSessions().then(() => this.bump());
    }
  }

  setGui(partial: Partial<GuiState>): void {
    this.gui = { ...this.gui, ...partial };
    saveGuiState(this.gui);
    this.bump();
  }

  async login(): Promise<void> {
    if (this.loginPromise) return this.loginPromise;
    this.loginPromise = this.runLogin().finally(() => {
      this.loginPromise = null;
    });
    return this.loginPromise;
  }

  cancelLogin(): void {
    this.loginCancelled = true;
    this.loginChild?.kill();
    this.loginChild = null;
  }

  private async runLogin(): Promise<void> {
    const reauth = this.auth.authenticated;
    this.loginCancelled = false;
    this.auth = {
      ...this.auth,
      authenticated: reauth,
      checking: false,
      signingIn: true,
      error: null,
    };
    this.bump();
    try {
      await this.spawnGrokLogin();
      if (!this.client.rpc) {
        await this.reconnectAgent();
      }
      let ok = await this.applyCachedAuth();
      if (!ok) {
        await this.reconnectAgent();
        ok = await this.applyCachedAuth();
      }
      if (!ok) {
        throw new Error("Grok CLI login finished, but the agent could not use the new credentials.");
      }
      await this.hydrateAfterAuth();
      this.auth = { ...this.auth, signingIn: false, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : grokError(err);
      if (reauth && (await this.applyCachedAuth())) {
        this.auth = { ...this.auth, signingIn: false, error: message };
      } else {
        this.auth = signedOutAuth({
          error: message,
          loginUrl: this.auth.loginUrl,
          deviceCode: this.auth.deviceCode,
        });
      }
    }
    this.bump();
  }

  private spawnGrokLogin(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.loginCancelled) {
        reject(new Error("Sign-in cancelled."));
        return;
      }
      const env: NodeJS.ProcessEnv = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      const child = spawn(this.client.grokBin, ["login"], {
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      this.loginChild = child;
      let output = "";
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        this.loginChild = null;
        fn();
      };
      const onData = (buf: Buffer | string) => {
        output += typeof buf === "string" ? buf : buf.toString("utf8");
        const parsed = parseGrokLoginOutput(output);
        let changed = false;
        if (parsed.url && parsed.url !== this.auth.loginUrl) {
          this.auth = { ...this.auth, loginUrl: parsed.url };
          changed = true;
        }
        if (parsed.deviceCode && parsed.deviceCode !== this.auth.deviceCode) {
          this.auth = { ...this.auth, deviceCode: parsed.deviceCode };
          changed = true;
        }
        if (changed) this.bump();
      };
      child.stdout?.on("data", onData);
      child.stderr?.on("data", onData);
      timer = setTimeout(() => {
        child.kill();
        finish(() => reject(new Error("Grok CLI login timed out. Try again.")));
      }, LOGIN_TIMEOUT_MS);
      child.once("error", (err) => {
        finish(() => reject(new Error(grokError(err))));
      });
      child.once("exit", (code) => {
        finish(() => {
          if (this.loginCancelled) {
            reject(new Error("Sign-in cancelled."));
            return;
          }
          if (code === 0) {
            resolve();
            return;
          }
          const detail = output.trim();
          reject(new Error(detail || `grok login exited (${code ?? "unknown"})`));
        });
      });
    });
  }

  private applyInitializeResult(init: unknown): void {
    const meta = (init as { _meta?: Record<string, any> } | null)?._meta ?? {};
    this.models = parseModels(meta.modelState?.availableModels);
    this.currentModelId = meta.modelState?.currentModelId ?? this.models[0]?.modelId ?? "";
    this.effort = this.models.find((m) => m.modelId === this.currentModelId)?.reasoningEffort ?? "high";
    this.commands = asArray(meta.availableCommands);
  }

  private async applyCachedAuth(): Promise<boolean> {
    try {
      const result = unwrap(await this.client.authenticateCached());
      this.auth = authFromAuthenticateResult(result, this.client.lastAuthMethodId ?? "cached_token");
      return true;
    } catch {
      return false;
    }
  }

  private async reconnectAgent(): Promise<void> {
    this.reconnecting = true;
    try {
      this.client.stop();
      await this.client.start();
      this.connected = true;
      this.applyInitializeResult(this.client.initializeResult);
    } finally {
      this.reconnecting = false;
    }
  }

  private async hydrateAfterAuth(): Promise<void> {
    this.accountUsage = loggedWeeklyUsage() ?? this.accountUsage;
    this.startUsagePolling();
    await this.refreshSessions();
    for (const session of this.sessions) {
      if (session.cwd) this.rememberWorkspace(session.cwd, { front: false });
    }
    if (!this.gui.rootCwd && this.cwd) this.gui.rootCwd = this.cwd;
    saveGuiState(this.gui);
    await this.refreshGit();
    await this.refreshCatalogs();
  }

  private maybeNoteAuthFailure(err: unknown): boolean {
    if (!isAuthError(err)) return false;
    if (this.auth.signingIn || this.auth.checking) return true;
    const wasAuthenticated = this.auth.authenticated;
    const message = err instanceof Error ? err.message : String(err);
    this.auth = signedOutAuth({
      error: wasAuthenticated ? message : this.auth.error,
      loginUrl: this.auth.loginUrl,
      deviceCode: this.auth.deviceCode,
    });
    this.bump();
    return true;
  }

  private onServerRequest(msg: JsonRpcMessage): void {
    const method = msg.method ?? "";
    const id = msg.id;
    if (id === undefined) return;
    if (this.handleAgentTerminalRequest(method, id, msg.params as Record<string, any> | undefined)) return;
    if (method === AcpMethod.SessionRequestPermission) {
      const params = msg.params as Record<string, any> | undefined;
      const request: PermissionRequest = {
        requestId: Number(id),
        sessionId: sessionIdFromParams(params) ?? this.activeSessionId ?? "",
        toolCall: normalizeTool(params?.toolCall ?? params, (prefix) => this.nextId(prefix)),
        options: asArray(params?.options).map((o: any) => ({
          optionId: o.optionId ?? o.id,
          name: o.name ?? o.optionId ?? "Allow",
          kind: o.kind,
        })),
      };
      if (shouldAutoApprove(request, this.autoApproveOpts())) {
        const optionId = pickAllowOption(request.options);
        if (optionId) {
          this.client.respond(id, { outcome: { outcome: "selected", optionId } });
          return;
        }
      }
      if (request.sessionId && this.activeSessionId && request.sessionId !== this.activeSessionId) {
        this.permissionQueue.push(request);
        return;
      }
      if (this.pendingPermission) this.permissionQueue.push(request);
      else this.pendingPermission = request;
      this.bump();
      return;
    }
    if (tryHandleFsRequest(method, id, msg.params as Record<string, any> | undefined, this.client)) {
      return;
    }
    const dialog = parseExtensionDialog(method, id, msg.params as Record<string, any> | undefined);
    if (dialog) {
      this.enqueueExtensionDialog(dialog);
      return;
    }
    this.client.respond(id, {});
  }

  private handleAgentTerminalRequest(method: string, id: number | string, params: Record<string, any> | undefined): boolean {
    if (!method.startsWith("terminal/")) return false;
    const request = params ?? {};
    try {
      if (method === AcpMethod.TerminalCreate) {
        const sessionId = typeof request.sessionId === "string" ? request.sessionId : this.activeSessionId;
        const sessionCwd = sessionId ? this.sessions.find((session) => session.sessionId === sessionId)?.cwd : undefined;
        this.client.respond(id, this.agentTerminals.create(request, sessionCwd ?? this.cwd));
        return true;
      }
      const terminalId = typeof request.terminalId === "string" ? request.terminalId : "";
      if (!terminalId) throw new Error(`${method} requires terminalId`);
      if (method === AcpMethod.TerminalOutput) {
        this.client.respond(id, this.agentTerminals.output(terminalId));
        return true;
      }
      if (method === AcpMethod.TerminalWaitForExit) {
        void this.agentTerminals.waitForExit(terminalId).then((status) => this.client.respond(id, status)).catch((error) => {
          this.client.respondError(id, -32000, error instanceof Error ? error.message : String(error));
        });
        return true;
      }
      if (method === AcpMethod.TerminalKill) {
        this.agentTerminals.kill(terminalId);
        this.client.respond(id, {});
        return true;
      }
      if (method === AcpMethod.TerminalRelease) {
        this.agentTerminals.release(terminalId);
        this.client.respond(id, {});
        return true;
      }
      this.client.respondError(id, -32601, `Unsupported terminal method: ${method}`);
    } catch (error) {
      this.client.respondError(id, -32000, error instanceof Error ? error.message : String(error));
    }
    return true;
  }

  private onNotification(msg: JsonRpcMessage): void {
    const method = msg.method ?? "";
    const params = (msg.params ?? {}) as Record<string, any>;
    if (method === AcpMethod.SessionUpdate || method === AcpMethod.XaiSessionUpdate) {
      this.onSessionUpdate(params);
      return;
    }
    if (method === AcpMethod.XaiSessionsChanged) {
      for (const row of asArray<any>(params.upserted)) {
        this.liveById.set(row.sessionId, row);
      }
      void this.refreshSessions().then(() => this.bump());
      return;
    }
    if (method === AcpMethod.XaiQueueChanged) {
      if (params.sessionId === this.activeSessionId) {
        this.remoteQueue = asArray<any>(params.entries).map((e) => ({
          id: e.id,
          kind: e.kind,
          text: e.text,
          position: e.position,
          mode: e.mode === "steer" || e.mode === "followUp" ? e.mode : undefined,
          source: "remote",
        }));
        this.syncQueue();
        this.bump();
      }
      return;
    }
    if (method === AcpMethod.XaiModelsUpdate) {
      this.models = parseModels(params.availableModels);
      this.currentModelId = params.currentModelId ?? this.currentModelId;
      this.bump();
      return;
    }
    if (method === AcpMethod.XaiAnnouncementsUpdate) {
      this.announcements = asArray(params.announcements);
      this.bump();
      return;
    }
    if (method === AcpMethod.XaiSessionNotification) {
      if (!this.isForActiveSession(params)) return;
      const update = params.update ?? {};
      if (update.sessionUpdate === "model_changed") {
        this.currentModelId = update.model_id ?? this.currentModelId;
        this.effort = update.reasoning_effort ?? this.effort;
      }
      if (update.sessionUpdate === "turn_completed" || update.sessionUpdate === "response_completed") {
        if (this.activeSessionId) this.inFlightPrompts.delete(this.activeSessionId);
        this.running = false;
        if (update.usage) {
          this.usage = parseContextUsage({
            used: update.usage.totalTokens ?? update.usage.total_tokens ?? update.usage.used,
            total: update.usage.total ?? this.usage?.total,
            usagePct: update.usage.usagePct,
            freeTokens: update.usage.freeTokens ?? update.usage.remaining,
          }) ?? this.usage;
        }
        if (this.activeSessionId) void this.refreshSessionExtras(this.activeSessionId);
      }
      this.bump();
      return;
    }
    if (method === AcpMethod.XaiMcpUpdated) {
      this.mcp = mergeMcpRecords(
        this.mcp,
        asArray<any>(params.mcpServers).map((s) => ({ name: s.name, status: s.status, enabled: s.enabled })),
      );
      this.bump();
    }
  }

  async refreshCatalogs(): Promise<void> {
    const bin = this.client.grokBin;
    const cwd = this.cwd;
    const [skills, mcp, plugins] = await Promise.all([
      discoverSkills({ cwd, grokBin: bin }).catch(() => this.skills),
      listMcpFromCli(bin, cwd).catch(() => [] as McpServerRecord[]),
      listPluginsFromCli(bin, cwd).catch(() => [] as PluginRecord[]),
    ]);
    this.skills = skills;
    if (mcp.length) this.mcp = mergeMcpRecords(this.mcp, mcp);
    if (plugins.length) this.plugins = mergePluginRecords(this.plugins, plugins);
    this.bump();
  }

  async createSkill(input: CreateSkillInput): Promise<SkillRecord> {
    const skill = createSkill(this.cwd, input);
    await this.refreshCatalogs();
    this.bump();
    return skill;
  }

  async setSkillEnabled(name: string, enabled: boolean): Promise<void> {
    setSkillEnabled(name, enabled);
    await this.refreshCatalogs();
    this.bump();
  }

  async deleteSkill(filePath: string): Promise<void> {
    deleteSkill(filePath);
    await this.refreshCatalogs();
    this.bump();
  }

  async addMcp(input: AddMcpInput): Promise<void> {
    await addMcpServer(this.client.grokBin, this.cwd, input);
    await this.refreshCatalogs();
    if (this.activeSessionId) await this.refreshSessionExtras(this.activeSessionId);
    this.bump();
  }

  async setMcpEnabled(name: string, enabled: boolean): Promise<void> {
    await setMcpEnabled(this.client.grokBin, this.cwd, name, enabled);
    await this.refreshCatalogs();
    if (this.activeSessionId) await this.refreshSessionExtras(this.activeSessionId);
    this.bump();
  }

  async removeMcp(name: string, scope?: "user" | "project"): Promise<void> {
    await removeMcpServer(this.client.grokBin, this.cwd, name, scope);
    this.mcp = this.mcp.filter((server) => server.name !== name);
    await this.refreshCatalogs();
    if (this.activeSessionId) await this.refreshSessionExtras(this.activeSessionId);
    this.bump();
  }

  async installPlugin(source: string, trust: boolean): Promise<void> {
    await installPlugin(this.client.grokBin, this.cwd, source, trust);
    await this.refreshCatalogs();
    if (this.activeSessionId) await this.refreshSessionExtras(this.activeSessionId);
    this.bump();
  }

  async setPluginEnabled(name: string, enabled: boolean): Promise<void> {
    await setPluginEnabled(this.client.grokBin, this.cwd, name, enabled);
    await this.refreshCatalogs();
    if (this.activeSessionId) await this.refreshSessionExtras(this.activeSessionId);
    this.bump();
  }

  async uninstallPlugin(name: string): Promise<void> {
    await uninstallPlugin(this.client.grokBin, this.cwd, name);
    this.plugins = this.plugins.filter((plugin) => plugin.name !== name);
    await this.refreshCatalogs();
    if (this.activeSessionId) await this.refreshSessionExtras(this.activeSessionId);
    this.bump();
  }

  private onSessionUpdate(params: Record<string, any>): void {
    this.noteSubagentLink(params);
    if (!this.isForActiveSession(params)) return;
    if (isActiveSessionLoad(this.loadingSession, this.activeSessionId, this.sessionEpoch)) return;
    const update = params.update ?? params;
    const cadence = applySessionUpdate(this.transcript, update, {
      nextId: (prefix) => this.nextId(prefix),
      mode: "live",
      showThoughts: this.gui.showThoughts,
      streaming: true,
      onPlanEntries: (entries, merge) => this.applyPlanEntries(entries, merge),
      onCommands: (commands) => {
        this.commands = commands;
      },
      onMode: (modeId) => this.applyCurrentModeUpdate(modeId),
      onTurnComplete: () => {
        if (this.activeSessionId) this.inFlightPrompts.delete(this.activeSessionId);
        this.running = false;
      },
    });
    if (cadence === "soon") {
      this.emitTranscriptSoon();
      this.bumpSoon();
    } else if (cadence === "now") {
      this.emitTranscriptChange();
      this.bump();
    }
  }

  private readPersistedTranscript(sessionId: string, cwd: string): TranscriptItem[] {
    const file = path.join(sessionDir(sessionId, cwd), "updates.jsonl");
    if (!existsSync(file)) return [];
    return replayJsonl(readFileSync(file, "utf8"), (prefix) => this.nextId(prefix), {
      showThoughts: this.gui.showThoughts,
      lazyToolContent: true,
    });
  }

  private rebuildTranscriptIndexes(): void {
    this.transcript.toolIndex.clear();
    const continueStream = Boolean(this.activeSessionId && this.inFlightPrompts.has(this.activeSessionId));
    this.transcript.assistantIndex = null;
    this.transcript.thoughtIndex = null;
    this.transcript.items.forEach((item, index) => {
      if (item.kind === "tool") this.transcript.toolIndex.set(item.tool.toolCallId, index);
      else if (continueStream && item.kind === "assistant") this.transcript.assistantIndex = index;
      else if (continueStream && item.kind === "thought") this.transcript.thoughtIndex = index;
    });
  }

  private readPlan(sessionId: string, cwd: string): AppSnapshot["plan"] {
    const dir = sessionDir(sessionId, cwd);
    let content: string | undefined;
    const markdown = path.join(dir, "plan.md");
    if (existsSync(markdown)) {
      try { content = readFileSync(markdown, "utf8"); } catch {}
    }
    // Live todos from this turn win while the prompt is in flight. After that,
    // prefer disk so a finished or empty plan.json can actually clear the strip.
    if (this.plan?.entries.length && this.inFlightPrompts.has(sessionId)) {
      return { ...this.plan, content: content ?? this.plan.content };
    }
    let entries: PlanEntry[] = [];
    const planJson = path.join(dir, "plan.json");
    if (existsSync(planJson)) {
      try { entries = parsePlanEntries(JSON.parse(readFileSync(planJson, "utf8"))); } catch {}
    }
    if (!entries.length) {
      const resources = path.join(dir, "resources_state.json");
      if (existsSync(resources)) {
        try {
          const raw = JSON.parse(readFileSync(resources, "utf8"));
          entries = parsePlanEntries(raw?.state?.["grok_build.Todo"]?.todos ?? raw?.todos);
        } catch {}
      }
    }
    if (!entries.length && !content) return null;
    const complete = entries.every((entry) => entry.status === "completed" || entry.status === "cancelled");
    return {
      content,
      status: complete ? "complete" : "active",
      entries,
    };
  }
}

function mergeMcpRecords(base: McpServerRecord[], overlay: McpServerRecord[]): McpServerRecord[] {
  const map = new Map<string, McpServerRecord>();
  for (const row of [...base, ...overlay]) {
    if (!row.name) continue;
    map.set(row.name, { ...(map.get(row.name) ?? { name: row.name }), ...definedFields(row) });
  }
  return [...map.values()];
}

function mergePluginRecords(base: PluginRecord[], overlay: PluginRecord[]): PluginRecord[] {
  const map = new Map<string, PluginRecord>();
  for (const row of [...base, ...overlay]) {
    if (!row.name) continue;
    map.set(row.name, { ...(map.get(row.name) ?? { name: row.name }), ...definedFields(row) });
  }
  return [...map.values()];
}

function definedFields<T extends object>(row: T): Partial<T> {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)) as Partial<T>;
}
