import type { FontScale, MonoFontId, UiFontId } from "./fonts";

export type { FontScale, MonoFontId, UiFontId };

export type PermissionMode = "ask" | "auto" | "always-approve" | "plan";
export type Effort = "low" | "medium" | "high" | "xhigh";
export type AppView = "threads" | "new-thread" | "skills" | "mcp" | "settings";
export type SessionActivity = "idle" | "working" | "needs-input" | "blocked" | "completed" | "failed";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "resource_link"; uri: string; name?: string; mimeType?: string }
  | { type: "resource"; resource: { uri: string; mimeType?: string; text?: string } };

export type SlashCommand = {
  name: string;
  description: string;
  input?: { hint?: string } | null;
};

export type ModelInfo = {
  modelId: string;
  name: string;
  description?: string;
  contextTokens: number;
  supportsReasoningEffort: boolean;
  reasoningEffort?: string;
  reasoningEfforts: { id: string; value: string; label: string; description?: string; default?: boolean }[];
};

export type SessionSummary = {
  sessionId: string;
  cwd: string;
  title: string;
  summary: string;
  modelId: string;
  createdAt: string | null;
  updatedAt: string;
  lastActiveAt?: string;
  numMessages: number;
  pinned?: boolean;
  archived?: boolean;
  activity: SessionActivity;
  yolo?: boolean;
  reasoningEffort?: string;
  isWorktree?: boolean;
  kind?: string;
  parentSessionId?: string;
  unseen?: boolean;
};

export type ToolCallState = {
  toolCallId: string;
  title: string;
  kind?: string;
  status: string;
  name?: string;
  rawInput?: unknown;
  rawOutput?: unknown;
  content?: unknown;
  locations?: { path: string }[];
  diff?: { path: string; oldText?: string; newText?: string } | null;
  meta?: unknown;
  /** Persisted transcripts omit large payloads until the tool is expanded. */
  hasContent?: boolean;
  contentLoaded?: boolean;
};

export type ComposerAttachment = {
  id: string;
  name: string;
  kind: "image" | "file";
  mimeType: string;
  data?: string;
  path?: string;
};

export type PlanStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type PlanEntry = {
  id?: string;
  content: string;
  status: PlanStatus;
  priority?: string;
};

export type PlanState = {
  content?: string;
  status: string;
  entries: PlanEntry[];
} | null;

export type TranscriptItem =
  | { id: string; kind: "user"; text: string; at: number; attachments?: ComposerAttachment[] }
  | { id: string; kind: "assistant"; text: string; at: number; streaming?: boolean }
  | { id: string; kind: "thought"; text: string; at: number; streaming?: boolean }
  | { id: string; kind: "tool"; tool: ToolCallState; at: number }
  | { id: string; kind: "plan"; entries: PlanEntry[]; at: number }
  | { id: string; kind: "system"; text: string; at: number };

export type TranscriptSnapshot = {
  sessionId: string | null;
  items: TranscriptItem[];
};

export type PermissionRequest = {
  requestId: number;
  sessionId: string;
  toolCall: ToolCallState;
  options: { optionId: string; name: string; kind?: string }[];
};

export type AskQuestion = {
  requestId: number;
  sessionId: string;
  questions: unknown;
};

export type ExtensionDialog =
  | { kind: "confirm"; requestId: number; title: string; message: string }
  | { kind: "select"; requestId: number; title: string; options: string[] }
  | { kind: "input"; requestId: number; title: string; placeholder?: string; initialValue?: string }
  | { kind: "editor"; requestId: number; title: string; initialValue?: string };

export type ExtensionUiResponse =
  | { requestId: number; cancelled: true }
  | { requestId: number; confirmed: true }
  | { requestId: number; value: string };

export type AuthState = {
  authenticated: boolean;
  checking?: boolean;
  signingIn?: boolean;
  methodId?: string;
  email?: string;
  teamName?: string | null;
  subscriptionTier?: string;
  error?: string | null;
  loginUrl?: string | null;
  deviceCode?: string | null;
};

export type ContextUsage = {
  used: number;
  total: number;
  usagePct: number;
  remainingPct: number;
  freeTokens: number;
  remaining: number;
  categories?: { label: string; tokens: number; detail?: string }[];
};

export type AccountUsage = {
  used?: number;
  total?: number;
  remaining?: number;
  usedPct?: number;
  remainingPct?: number;
  unit?: string;
  resets?: string;
  period?: "weekly" | "monthly";
  label?: string;
  detail?: string;
  source?: string;
  products?: { label: string; usedPct: number }[];
} | null;

export type QueueEntry = {
  id: string;
  kind: string;
  text: string;
  position: number;
  mode?: "steer" | "followUp";
  attachments?: ComposerAttachment[];
  source?: "local" | "remote";
};

export type GitChange = {
  path: string;
  status: string;
  insertions?: number;
  deletions?: number;
  staged?: boolean;
  unstaged?: boolean;
};

export type GitState = {
  isRepo: boolean;
  branch?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  changes: GitChange[];
};

export type GitDiff = {
  path: string;
  diff: string;
  staged?: boolean;
  insertions?: number;
  deletions?: number;
};

export type FileTreeNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileTreeNode[];
};

export type SkillRecord = {
  name: string;
  description?: string;
  enabled: boolean;
  source: string;
  filePath?: string;
  slashCommand: string;
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  manageable: boolean;
};

export type McpServerRecord = {
  name: string;
  displayName?: string;
  enabled?: boolean;
  status?: string;
  source?: string;
  transport?: string;
  command?: string;
  url?: string;
  scope?: string;
};

export type PluginRecord = {
  name: string;
  enabled?: boolean;
  version?: string;
  source?: string;
  path?: string;
  description?: string;
};

export type CreateSkillInput = {
  name: string;
  description: string;
  body?: string;
  scope: "user" | "project";
};

export type AddMcpInput = {
  name: string;
  scope?: "user" | "project";
  transport?: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
};

export type FilePreview = {
  path: string;
  language?: string;
  text?: string;
  truncated?: boolean;
  binary?: boolean;
  error?: string;
};

export type RewindPoint = {
  index: number;
  label: string;
  preview?: string;
};

export type SlashOption = {
  value: string;
  label: string;
  description?: string;
};

export type AppSnapshot = {
  instanceId: string;
  connected: boolean;
  grokBin: string | null;
  grokVersion: string | null;
  platform: string;
  cliMissing: boolean;
  cliInstallError: string | null;
  auth: AuthState;
  cwd: string;
  models: ModelInfo[];
  currentModelId: string;
  effort: string;
  permissionMode: PermissionMode;
  currentModeId: string | null;
  commands: SlashCommand[];
  sessions: SessionSummary[];
  activeSessionId: string | null;
  items: TranscriptItem[];
  pendingPermission: PermissionRequest | null;
  pendingExtensionDialog: ExtensionDialog | null;
  usage: ContextUsage | null;
  accountUsage: AccountUsage;
  queue: QueueEntry[];
  running: boolean;
  git: GitState;
  worktrees: { path: string; label?: string; sessionId?: string }[];
  mcp: McpServerRecord[];
  plugins: PluginRecord[];
  skills: SkillRecord[];
  plan: PlanState;
  announcements: { id: string; title?: string; message: string }[];
  error: string | null;
  gui: GuiState;
  rev: number;
};

export type ThemeMode = "system" | "light" | "dark";
export type ThemePresetId = "default" | "catppuccin" | "tokyo-night" | "nord" | "ayu";

export type GuiState = {
  sidebarWidth: number;
  reviewWidth: number;
  lastCwd: string;
  rootCwd: string;
  workspaces: string[];
  permissionMode: PermissionMode;
  yoloArmed: boolean;
  pinned: string[];
  archived: string[];
  showThoughts: boolean;
  showReview: boolean;
  showFiles: boolean;
  showPromptRail: boolean;
  showTerminal: boolean;
  sidebarCollapsed: boolean;
  notifyOnComplete: boolean;
  notifyOnFailure: boolean;
  themeMode: ThemeMode;
  themePresetId: ThemePresetId;
  enableTransparency: boolean;
  uiFontId: UiFontId;
  monoFontId: MonoFontId;
  fontScale: FontScale;
  workspaceNames: Record<string, string>;
  lastSeen: Record<string, string>;
  composerDrafts: Record<string, string>;
  permanentWorktrees: Record<string, string>;
  terminalHeight: number;
  terminalTakeover: boolean;
};

export const DEFAULT_GUI_STATE: GuiState = {
  sidebarWidth: 280,
  reviewWidth: 360,
  lastCwd: "",
  rootCwd: "",
  workspaces: [],
  permissionMode: "ask",
  yoloArmed: false,
  pinned: [],
  archived: [],
  showThoughts: true,
  showReview: false,
  showFiles: false,
  showPromptRail: true,
  showTerminal: false,
  sidebarCollapsed: false,
  notifyOnComplete: true,
  notifyOnFailure: true,
  themeMode: "system",
  themePresetId: "default",
  enableTransparency: false,
  uiFontId: "system",
  monoFontId: "system",
  fontScale: 100,
  workspaceNames: {},
  lastSeen: {},
  composerDrafts: {},
  permanentWorktrees: {},
  terminalHeight: 340,
  terminalTakeover: false,
};
