/**
 * ACP methods this shell speaks, plus Grok's `_x.ai/*` extensions.
 *
 * Keep this list as the catalog of protocol surface. Prefer these constants
 * over string literals when adding a new call.
 */
export const AcpMethod = {
  Initialize: "initialize",
  Authenticate: "authenticate",
  SessionNew: "session/new",
  SessionLoad: "session/load",
  SessionPrompt: "session/prompt",
  SessionCancel: "session/cancel",
  SessionSetModel: "session/set_model",
  SessionSetMode: "session/set_mode",
  SessionUpdate: "session/update",
  SessionRequestPermission: "session/request_permission",
  TerminalCreate: "terminal/create",
  TerminalOutput: "terminal/output",
  TerminalRelease: "terminal/release",
  TerminalWaitForExit: "terminal/wait_for_exit",
  TerminalKill: "terminal/kill",
  FsReadTextFile: "fs/read_text_file",
  FsWriteTextFile: "fs/write_text_file",
  XaiSessionUpdate: "_x.ai/session/update",
  XaiSessionList: "_x.ai/session/list",
  XaiSessionInfo: "_x.ai/session/info",
  XaiSessionRename: "_x.ai/session/rename",
  XaiSessionDelete: "_x.ai/session/delete",
  XaiSessionFork: "_x.ai/session/fork",
  XaiSessionsChanged: "_x.ai/sessions/changed",
  XaiSessionNotification: "_x.ai/session_notification",
  XaiCompact: "_x.ai/compact_conversation",
  XaiRewindExecute: "_x.ai/rewind/execute",
  XaiRewindPoints: "_x.ai/rewind/points",
  XaiFuzzyOpen: "_x.ai/search/fuzzy/open",
  XaiMcpList: "_x.ai/mcp/list",
  XaiMcpUpdated: "_x.ai/mcp/servers_updated",
  XaiPluginsList: "_x.ai/plugins/list",
  XaiGitStatus: "_x.ai/git/status",
  XaiGitWorktreeCreate: "_x.ai/git/worktree/create",
  XaiGitWorktreeList: "_x.ai/git/worktree/list",
  XaiQueueChanged: "_x.ai/queue/changed",
  XaiModelsUpdate: "_x.ai/models/update",
  XaiAnnouncementsUpdate: "_x.ai/announcements/update",
  XaiBilling: "x.ai/billing",
  XaiBillingAlt: "_x.ai/billing",
} as const;

export type AcpMethodName = (typeof AcpMethod)[keyof typeof AcpMethod];
