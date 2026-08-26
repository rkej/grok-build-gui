import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { AppSnapshot, AppView, ComposerAttachment, RewindPoint, SlashOption, ThemeMode, ThemePresetId, ToolCallState, TranscriptItem, TranscriptSnapshot } from "../shared/protocol";
import { composerDraftKey } from "../shared/composer-drafts";
import { clampSidebarWidth, DEFAULT_SIDEBAR_WIDTH } from "../shared/layout";
import { ComposerPanel, type ComposerMenu } from "./composer-panel";
import { ConversationTimeline } from "./conversation-timeline";
import { DiffPanel } from "./diff-panel";
import { ExtensionsView, type ExtensionsSection } from "./extensions-view";
import { ForkModal, type ForkEnvironment } from "./fork-modal";
import { NewThreadView } from "./new-thread-view";
import { AuthLoader } from "./auth-loader";
import { SignInView } from "./sign-in-view";
import { credentialsPending } from "../shared/auth";
import { SecondarySurface } from "./secondary-surface";
import { SETTINGS_NAV, SettingsView, type SettingsSection } from "./settings-view";
import { cwdName, Sidebar, workspaceDisplayName } from "./sidebar";
import { groupSessionsByWorkspace, pinnedThreads } from "./workspace-groups";
import { SidebarToggleButton } from "./sidebar-toggle-button";
import { SkillsView } from "./skills-view";
import { TerminalPanel } from "./terminal-panel";
import { TreeModal } from "./tree-modal";
import { applyThemePresetToRoot } from "./theme-presets";
import { PlanStrip } from "./plan-card";
import { sessionDisplayTitle, Topbar } from "./topbar";
import { isEventInsideTerminal } from "./app-shell-utils";
import { formatRelativeTime } from "./string-utils";
import { useRunningLabel } from "./use-running-label";
import { useThreadSearch } from "./use-thread-search";
import { useTimelineScroll } from "./use-timeline-scroll";
import { putLoadedToolRecord } from "../shared/loaded-tool-cache";
import { shouldApplySnapshot } from "../shared/snapshot-order";
import { composerEscapeAction, moveSelectionIndex, mentionCandidatePath } from "./composer-navigation";
import { grokSlashItems, moveSlashSelection, slashCommandKey, slashMenuItems, slashTabCompletion } from "./slash-completion";
import { canNavigateThreadHistory, EMPTY_THREAD_HISTORY, threadHistoryTarget, visitThread, type ThreadHistory } from "./thread-history";

const EMPTY_TRANSCRIPT: readonly TranscriptItem[] = [];

export default function App() {
  const [state, setState] = useState<AppSnapshot | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSnapshot>({ sessionId: null, items: [] });
  const [view, setView] = useState<AppView>("new-thread");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");
  const [extensionsSection, setExtensionsSection] = useState<ExtensionsSection>("mcp");
  const [draft, setDraft] = useState("");
  const [slashOpen, setSlashOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionHits, setMentionHits] = useState<any[]>([]);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [loadedToolContent, setLoadedToolContent] = useState<Record<string, ToolCallState>>({});
  const [loadingToolContent, setLoadingToolContent] = useState<Record<string, boolean>>({});
  const [openMenu, setOpenMenu] = useState<ComposerMenu>("none");
  const [archivedOpen, setArchivedOpen] = useState<Record<string, boolean>>({});
  const [collapsedWorkspaces, setCollapsedWorkspaces] = useState<Record<string, boolean>>({});
  const [workspaceMenu, setWorkspaceMenu] = useState<string | null>(null);
  const [threadMenu, setThreadMenu] = useState<string | null>(null);
  const [environmentMenuOpen, setEnvironmentMenuOpen] = useState(false);
  const [environment, setEnvironment] = useState<"local" | "worktree">("local");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingWorkspace, setRenamingWorkspace] = useState<string | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeSubmitting, setTreeSubmitting] = useState(false);
  const [treeError, setTreeError] = useState<string | undefined>();
  const [treePoints, setTreePoints] = useState<RewindPoint[]>([]);
  const [liveTerminalHeight, setLiveTerminalHeight] = useState<number | null>(null);
  const [liveSidebarWidth, setLiveSidebarWidth] = useState<number | null>(null);
  const [slashOptions, setSlashOptions] = useState<SlashOption[]>([]);
  const [slashOptionTitle, setSlashOptionTitle] = useState("");
  const [selectedSlashOption, setSelectedSlashOption] = useState("");
  const [selectedSlashCommand, setSelectedSlashCommand] = useState("");
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [diffFocusPath, setDiffFocusPath] = useState<string | null>(null);
  const [forkRequest, setForkRequest] = useState<{ itemId: string; preview?: string } | null>(null);
  const [forkSubmitting, setForkSubmitting] = useState(false);
  const [forkError, setForkError] = useState<string | undefined>();
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [editingQueuedMessageId, setEditingQueuedMessageId] = useState<string | null>(null);
  const queuedEditRestore = useRef<{ draft: string; attachments: ComposerAttachment[] } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const draftKeyRef = useRef("");
  const draftsRef = useRef<Record<string, string>>({});
  const draftValueRef = useRef("");
  const draftTimer = useRef<number | null>(null);
  const draftsSeeded = useRef(false);
  const heightTimer = useRef<number | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const selectorRef = useRef<HTMLSpanElement | null>(null);
  const mentionTimer = useRef<number | null>(null);
  const stateRevRef = useRef(-1);
  const stateInstanceRef = useRef<string | null>(null);
  const [threadHistory, setThreadHistory] = useState<ThreadHistory>(EMPTY_THREAD_HISTORY);
  const threadHistoryRef = useRef<ThreadHistory>(EMPTY_THREAD_HISTORY);
  const api = window.grokApp;

  const commitThreadHistory = useCallback((next: ThreadHistory) => {
    threadHistoryRef.current = next;
    setThreadHistory(next);
  }, []);

  const applyStateSnapshot = useCallback((snapshot: AppSnapshot) => {
    if (!shouldApplySnapshot(
      { instanceId: stateInstanceRef.current, rev: stateRevRef.current },
      { instanceId: snapshot.instanceId, rev: snapshot.rev },
    )) return;
    stateInstanceRef.current = snapshot.instanceId;
    stateRevRef.current = snapshot.rev;
    setState(snapshot);
  }, []);

  const resyncState = useCallback(() => {
    void api.getState().then(applyStateSnapshot);
  }, [api, applyStateSnapshot]);

  const persistDraft = useCallback((key: string, text: string) => {
    if (!key) return;
    draftsRef.current = { ...draftsRef.current, [key]: text };
    void api.setComposerDraft(key, text);
  }, [api]);

  useEffect(() => {
    const sessionId = state?.activeSessionId;
    if (!sessionId) return;
    const next = visitThread(threadHistoryRef.current, sessionId);
    if (next !== threadHistoryRef.current) commitThreadHistory(next);
  }, [commitThreadHistory, state?.activeSessionId]);

  useEffect(() => {
    const unsubState = api.onState(applyStateSnapshot);
    const unsubTranscript = api.onTranscript((next) => {
      // The main process emits transcript snapshots from the same active
      // session that it exposes in AppSnapshot. Filtering against a renderer
      // ref here races those two IPC channels during a thread switch and can
      // drop the freshly loaded transcript.
      setTranscript(next);
    });
    let retry: number | null = null;
    let disposed = false;
    const load = () => {
      if (disposed) return;
      void Promise.all([api.getState(), api.getTranscript()]).then(([snapshot, selectedTranscript]) => {
        if (disposed) return;
        applyStateSnapshot(snapshot);
        if (selectedTranscript.sessionId === snapshot.activeSessionId) setTranscript(selectedTranscript);
        if (snapshot.activeSessionId) setView("threads");
      }).catch(() => {
        if (disposed) return;
        retry = window.setTimeout(load, 120);
      });
    };
    load();
    return () => {
      disposed = true;
      unsubState();
      unsubTranscript();
      if (retry != null) window.clearTimeout(retry);
    };
  }, [api, applyStateSnapshot]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const mode = state?.gui.themeMode ?? "system";
    const apply = () => {
      const dark = mode === "dark" || (mode === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
      applyThemePresetToRoot(document.documentElement, state?.gui.themePresetId ?? "default", dark ? "dark" : "light");
      document.documentElement.classList.toggle("enable-transparency", Boolean(state?.gui.enableTransparency));
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [state?.gui.themeMode, state?.gui.themePresetId, state?.gui.enableTransparency]);

  useEffect(() => {
    setExpandedTools({});
    setLoadedToolContent({});
    setLoadingToolContent({});
  }, [transcript.sessionId]);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 24), 220)}px`;
  }, [draft, view]);

  useEffect(() => {
    draftValueRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!state || draftsSeeded.current) return;
    draftsRef.current = { ...(state.gui.composerDrafts ?? {}) };
    draftsSeeded.current = true;
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const key = composerDraftKey(state.activeSessionId, state.cwd, view === "new-thread");
    if (draftKeyRef.current === key) return;
    if (draftKeyRef.current) persistDraft(draftKeyRef.current, draftValueRef.current);
    draftKeyRef.current = key;
    const next = draftsRef.current[key] ?? state.gui.composerDrafts?.[key] ?? "";
    setDraft(next);
    draftValueRef.current = next;
  }, [persistDraft, state, view]);

  useEffect(() => {
    const flush = () => {
      if (draftKeyRef.current) persistDraft(draftKeyRef.current, draftValueRef.current);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onHide);
      if (draftTimer.current != null) window.clearTimeout(draftTimer.current);
    };
  }, [persistDraft]);

  useEffect(() => {
    if (openMenu === "none" && !environmentMenuOpen && !workspaceMenu && !threadMenu) return;
    const onDown = (event: Event) => {
      const target = event.target as Node;
      if (selectorRef.current && !selectorRef.current.contains(target)) setOpenMenu("none");
      if (!(target instanceof Element) || !target.closest(".environment-picker")) setEnvironmentMenuOpen(false);
      if (!(target instanceof Element) || !target.closest(".workspace-row__menu-wrap")) setWorkspaceMenu(null);
      if (!(target instanceof Element) || !target.closest(".session-row")) setThreadMenu(null);
      if (!(target instanceof Element) || !target.closest(".workspace-rename")) setRenamingWorkspace(null);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu("none");
        setEnvironmentMenuOpen(false);
        setWorkspaceMenu(null);
        setThreadMenu(null);
        setRenamingWorkspace(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu, environmentMenuOpen, workspaceMenu, threadMenu]);

  const availableSessionIds = useMemo(
    () => new Set((state?.sessions ?? []).map((session) => session.sessionId)),
    [state?.sessions],
  );

  const navigateThreadHistory = useCallback((direction: -1 | 1) => {
    const target = threadHistoryTarget(threadHistoryRef.current, direction, availableSessionIds);
    if (!target) return;
    const session = state?.sessions.find((candidate) => candidate.sessionId === target.sessionId);
    if (!session) return;
    commitThreadHistory(target.history);
    setView("threads");
    setThreadMenu(null);
    void api.openSession(session.sessionId, session.cwd);
  }, [api, availableSessionIds, commitThreadHistory, state?.sessions]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      if (event.key === "[" && !event.shiftKey) {
        event.preventDefault();
        navigateThreadHistory(-1);
        return;
      }
      if (event.key === "]" && !event.shiftKey) {
        event.preventDefault();
        navigateThreadHistory(1);
        return;
      }
      const inTerminal = isEventInsideTerminal(event);
      if (inTerminal && event.key.toLowerCase() !== "j") return;
      if (event.key === "," && !event.shiftKey) {
        event.preventDefault();
        setView("settings");
        setSettingsSection("general");
        return;
      }
      if (event.key.toLowerCase() === "b" && !event.shiftKey) {
        event.preventDefault();
        if (state) void api.setGui({ sidebarCollapsed: !state.gui.sidebarCollapsed });
        return;
      }
      if (event.key.toLowerCase() === "n" && !event.shiftKey) {
        event.preventDefault();
        if ((state?.gui.workspaces ?? []).length === 0) {
          void api.pickFolder();
          return;
        }
        setView("new-thread");
        window.setTimeout(() => composerRef.current?.focus(), 0);
        return;
      }
      if (event.key.toLowerCase() === "d" && !event.shiftKey) {
        event.preventDefault();
        if (state) void api.setGui({ showReview: !state.gui.showReview, showFiles: false });
        return;
      }
      if (event.key.toLowerCase() === "j" && !event.shiftKey) {
        event.preventDefault();
        if (state) void api.setGui({ showTerminal: !state.gui.showTerminal });
        return;
      }
      if (event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        if (state?.activeSessionId) setRenamingId(state.activeSessionId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api, navigateThreadHistory, state]);

  const grouped = useMemo(
    () => groupSessionsByWorkspace(state?.sessions ?? [], state?.cwd, state?.gui.rootCwd, state?.gui.workspaces, state?.gui.pinned),
    [state?.sessions, state?.cwd, state?.gui.workspaces, state?.gui.rootCwd, state?.gui.pinned],
  );
  const pinnedAll = useMemo(
    () => pinnedThreads(state?.sessions ?? [], state?.gui.pinned),
    [state?.sessions, state?.gui.pinned],
  );
  const active = state?.sessions.find((s) => s.sessionId === state.activeSessionId);
  const slashItems = useMemo(() => {
    if (!state || !slashOpen) return [];
    const token = draft.split(/\s/)[0]?.slice(1).toLowerCase() ?? "";
    return grokSlashItems(state).filter((c) => c.name.toLowerCase().includes(token) || c.title.toLowerCase().includes(token));
  }, [state, draft, slashOpen]);
  const visibleSlashItems = useMemo(() => slashMenuItems(slashItems), [slashItems]);

  useEffect(() => {
    if (!slashOpen) {
      setSelectedSlashCommand("");
      return;
    }
    setSelectedSlashCommand((current) => {
      if (visibleSlashItems.some((item) => slashCommandKey(item) === current)) return current;
      return visibleSlashItems[0] ? slashCommandKey(visibleSlashItems[0]) : "";
    });
  }, [slashOpen, visibleSlashItems]);

  const closeSlashMenus = () => {
    setSlashOpen(false);
    setSlashOptions([]);
    setSlashOptionTitle("");
    setSelectedSlashOption("");
    setSelectedSlashCommand("");
  };

  const loadSlashOptions = useCallback(async (name: string, filter = "") => {
    if (!state) return;
    const q = filter.trim().toLowerCase();
    if (name === "model") {
      const options = state.models.map((model) => ({
        value: model.modelId,
        label: model.name,
        description: model.description ?? model.modelId,
      }));
      setSlashOptionTitle("Model");
      setSlashOptions(options.filter((option) => option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q)));
      setSelectedSlashOption(state.currentModelId);
      setSlashOpen(false);
      return;
    }
    if (name === "effort") {
      const options = (state.models.find((m) => m.modelId === state.currentModelId)?.reasoningEfforts ?? [
        { id: "low", value: "low", label: "low" },
        { id: "medium", value: "medium", label: "medium" },
        { id: "high", value: "high", label: "high" },
        { id: "xhigh", value: "xhigh", label: "xhigh" },
      ]).map((effort) => ({ value: effort.value, label: effort.label, description: effort.value }));
      setSlashOptionTitle("Thinking level");
      setSlashOptions(options.filter((option) => option.label.toLowerCase().includes(q)));
      setSelectedSlashOption(state.effort);
      setSlashOpen(false);
      return;
    }
    if (name === "rewind") {
      const points = await api.rewindPoints();
      setSlashOptionTitle("Rewind to");
      setSlashOptions(
        points
          .map((point) => ({
            value: String(point.index),
            label: point.label,
            description: point.preview,
          }))
          .filter((option) => option.label.toLowerCase().includes(q) || (option.description ?? "").toLowerCase().includes(q)),
      );
      setSelectedSlashOption(points[0] ? String(points[0].index) : "");
      setSlashOpen(false);
    }
  }, [api, state]);

  const openTreeModal = useCallback(async () => {
    if (!state?.activeSessionId) {
      setView("threads");
      return;
    }
    setSlashOpen(false);
    setSlashOptions([]);
    setTreeOpen(true);
    setTreeLoading(true);
    setTreeError(undefined);
    try {
      setTreePoints(await api.rewindPoints());
    } catch (error) {
      setTreeError(error instanceof Error ? error.message : String(error));
      setTreePoints([]);
    } finally {
      setTreeLoading(false);
    }
  }, [api, state?.activeSessionId]);

  const scheduleDraftPersist = useCallback((key: string, text: string) => {
    if (!key) return;
    draftsRef.current = { ...draftsRef.current, [key]: text };
    if (draftTimer.current != null) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      draftTimer.current = null;
      void api.setComposerDraft(key, text);
    }, 400);
  }, [api]);

  const startNew = useCallback(async (prompt?: string, promptAttachments: readonly ComposerAttachment[] = []) => {
    setView("threads");
    setDraft("");
    if (draftKeyRef.current) persistDraft(draftKeyRef.current, "");
    await api.newSession(undefined, { worktree: environment === "worktree" });
    if (prompt?.trim()) await api.prompt(prompt, promptAttachments);
  }, [api, environment, persistDraft]);

  const onPickAttachments = useCallback((files: File[]) => {
    for (const file of files) {
      const path = (file as File & { path?: string }).path;
      const id = `${file.name}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2)}`;
      if (!file.type.startsWith("image/")) {
        setAttachments((current) => [...current, { id, name: file.name, kind: "file", mimeType: file.type || "application/octet-stream", path }]);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const encoded = typeof reader.result === "string" ? reader.result.split(",", 2)[1] : undefined;
        if (!encoded) return;
        setAttachments((current) => [...current, { id, name: file.name, kind: "image", mimeType: file.type, data: encoded, path }]);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const onRemoveAttachment = useCallback((id: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }, []);

  const onEditQueuedMessage = useCallback((id: string) => {
    const entry = state?.queue.find((candidate) => candidate.id === id);
    if (!entry || entry.source === "remote") return;
    queuedEditRestore.current = { draft, attachments: [...attachments] };
    setEditingQueuedMessageId(id);
    setDraft(entry.text);
    setAttachments(entry.attachments ? [...entry.attachments] : []);
    composerRef.current?.focus();
  }, [attachments, draft, state]);

  const onCancelQueuedEdit = useCallback(() => {
    const restore = queuedEditRestore.current;
    queuedEditRestore.current = null;
    setEditingQueuedMessageId(null);
    setDraft(restore?.draft ?? "");
    setAttachments(restore?.attachments ?? []);
    composerRef.current?.focus();
  }, []);

  const onRemoveQueuedMessage = useCallback((id: string) => {
    if (editingQueuedMessageId === id) onCancelQueuedEdit();
    setState((current) => current
      ? { ...current, queue: current.queue.filter((entry) => entry.id !== id) }
      : current);
    void api.removeQueuedMessage(id).then(applyStateSnapshot).catch(resyncState);
  }, [api, applyStateSnapshot, editingQueuedMessageId, onCancelQueuedEdit, resyncState]);

  const onSteerQueuedMessage = useCallback((id: string) => {
    void api.steerQueuedMessage(id).then(applyStateSnapshot).catch(resyncState);
  }, [api, applyStateSnapshot, resyncState]);

  const onCancel = useCallback(() => {
    void api.cancel().then(applyStateSnapshot).catch(resyncState);
  }, [api, applyStateSnapshot, resyncState]);

  const submit = useCallback(async (deliveryMode?: "steer" | "followUp") => {
    const text = draft.trim();
    if ((!text && attachments.length === 0) || !state) return;
    const promptAttachments = attachments;
    setAttachments([]);
    if (editingQueuedMessageId) {
      const id = editingQueuedMessageId;
      queuedEditRestore.current = null;
      setEditingQueuedMessageId(null);
      setDraft("");
      applyStateSnapshot(await api.editQueuedMessage(id, text, promptAttachments));
      return;
    }
    if (!state.activeSessionId || view === "new-thread") {
      await startNew(text, promptAttachments);
      return;
    }
    if (text.startsWith("/") && promptAttachments.length === 0) {
      const [name, ...rest] = text.slice(1).split(/\s+/);
      setDraft("");
      closeSlashMenus();
      if (name === "new") { setView("new-thread"); return; }
      if (name === "tree") { void openTreeModal(); return; }
      if (name === "fork") { await api.fork(); return; }
      if (name === "compact") { await api.compact(rest.join(" ")); return; }
      if (name === "plan") { await api.setMode("plan"); return; }
      if (name === "always-approve") { await api.setMode("always-approve"); return; }
      if (name === "auto") { await api.setMode("auto"); return; }
      if (name === "mcp") { setView("mcp"); return; }
      if (name === "skills") { setView("skills"); return; }
      if (name === "rename" && state.activeSessionId) { await api.rename(state.activeSessionId, rest.join(" ")); return; }
      if (name === "model" && rest[0]) { await api.setModel(rest.join(" ")); return; }
      if (name === "effort" && rest[0]) { await api.setEffort(rest[0]); return; }
      await api.slash(name ?? "", rest.join(" "));
      return;
    }
    setDraft("");
    if (draftKeyRef.current) persistDraft(draftKeyRef.current, "");
    applyStateSnapshot(await api.prompt(text, promptAttachments, state.running ? { deliverAs: deliveryMode ?? "followUp" } : undefined));
  }, [api, applyStateSnapshot, attachments, draft, editingQueuedMessageId, openTreeModal, persistDraft, state, view, startNew]);

  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOptions.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const current = slashOptions.findIndex((option) => option.value === selectedSlashOption);
      const next = slashOptions[moveSelectionIndex(slashOptions.length, current, e.key === "ArrowDown" ? 1 : -1)];
      if (next) setSelectedSlashOption(next.value);
      return;
    }
    if (slashOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const next = moveSlashSelection(slashItems, selectedSlashCommand, e.key === "ArrowDown" ? 1 : -1);
      if (next) setSelectedSlashCommand(slashCommandKey(next));
      return;
    }
    if (mentionOpen && mentionHits.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setSelectedMentionIndex((current) => moveSelectionIndex(Math.min(mentionHits.length, 12), current, e.key === "ArrowDown" ? 1 : -1));
      return;
    }
    if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
      const completion = slashTabCompletion(draft, slashOpen, slashItems, selectedSlashCommand);
      if (completion) {
        e.preventDefault();
        if (e.key === "Tab") completeSlashCommand(completion.name);
        else onPickSlash(completion.name);
        return;
      }
      if (mentionOpen && mentionHits.length > 0) {
        const candidate = mentionHits[Math.max(0, selectedMentionIndex)];
        if (candidate) {
          e.preventDefault();
          pickMention(mentionCandidatePath(candidate));
          return;
        }
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (slashOptions.length > 0) {
        const option = slashOptions.find((item) => item.value === selectedSlashOption) ?? slashOptions[0];
        if (option) onPickSlashOption(option);
        return;
      }
      void submit(e.metaKey || e.ctrlKey ? "steer" : "followUp");
    }
    if (e.key === "Escape") {
      const action = composerEscapeAction({
        uiOpen: slashOpen || slashOptions.length > 0 || mentionOpen || openMenu !== "none",
        editingQueuedMessage: Boolean(editingQueuedMessageId),
        running: Boolean(state?.running),
      });
      closeSlashMenus();
      setMentionOpen(false);
      setOpenMenu("none");
      if (action === "dismiss-ui") {
        e.preventDefault();
        return;
      }
      if (action === "cancel-edit") {
        onCancelQueuedEdit();
        return;
      }
      if (action === "cancel-run") onCancel();
    }
  };

  const completeSlashCommand = (name: string) => {
    setDraft(`/${name} `);
    setMentionOpen(false);
    if (name === "model" || name === "effort" || name === "rewind") {
      void loadSlashOptions(name);
    } else {
      closeSlashMenus();
    }
    composerRef.current?.focus();
  };

  const onPickSlash = (name: string) => {
    if (name === "model" || name === "effort" || name === "rewind") {
      setDraft(`/${name} `);
      void loadSlashOptions(name);
      composerRef.current?.focus();
      return;
    }
    if (name === "rename") {
      closeSlashMenus();
      setDraft("");
      if (state?.activeSessionId) setRenamingId(state.activeSessionId);
      return;
    }
    closeSlashMenus();
    if (name === "new") { setView("new-thread"); setDraft(""); return; }
    if (name === "tree") { void openTreeModal(); return; }
    if (name === "fork") { void api.fork(); return; }
    if (name === "plan") { void api.setMode("plan"); return; }
    if (name === "always-approve") { void api.setMode("always-approve"); return; }
    if (name === "auto") { void api.setMode("auto"); return; }
    if (name === "mcp") { setView("mcp"); return; }
    if (name === "skills") { setView("skills"); return; }
    setDraft(`/${name} `);
    closeSlashMenus();
    composerRef.current?.focus();
  };

  const onPickSlashOption = (option: SlashOption) => {
    const command = draft.split(/\s/)[0]?.slice(1);
    closeSlashMenus();
    setDraft("");
    if (command === "model") void api.setModel(option.value);
    else if (command === "effort") void api.setEffort(option.value);
    else if (command === "rewind") void api.rewind(Number(option.value));
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    draftValueRef.current = value;
    if (draftKeyRef.current) scheduleDraftPersist(draftKeyRef.current, value);
    const start = value.slice(0, composerRef.current?.selectionStart ?? value.length);
    const optionMatch = start.match(/^\/(model|effort|rewind)(?:\s+(.*))?$/);
    if (optionMatch) {
      void loadSlashOptions(optionMatch[1] ?? "model", optionMatch[2] ?? "");
      setMentionOpen(false);
      return;
    }
    setSlashOptions([]);
    setSlashOpen(start.startsWith("/") && !start.includes("\n") && !start.includes(" "));
    const at = start.match(/(?:^|\s)@([^\s]*)$/);
    if (mentionTimer.current != null) window.clearTimeout(mentionTimer.current);
    if (at) {
      setMentionOpen(true);
      setSelectedMentionIndex(0);
      mentionTimer.current = window.setTimeout(() => {
        void api.fuzzy(at[1] ?? "").then((res) => {
          setMentionHits(res?.files ?? res?.nodes ?? res?.result?.nodes ?? []);
          setSelectedMentionIndex(0);
        });
      }, 120);
    } else setMentionOpen(false);
  };

  const pickMention = (path: string) => {
    setDraft((current) => current.replace(/@([^\s]*)$/, `@${path} `));
    setMentionOpen(false);
    setSelectedMentionIndex(0);
    composerRef.current?.focus();
  };

  const onToggleTool = useCallback((id: string) => {
    const sessionId = transcript.sessionId;
    const expanding = !expandedTools[id];
    setExpandedTools((m) => ({ ...m, [id]: expanding }));
    if (!expanding) {
      setLoadedToolContent((m) => {
        if (!m[id]) return m;
        const next = { ...m };
        delete next[id];
        return next;
      });
      return;
    }
    if (loadedToolContent[id]) return;
    setLoadingToolContent((m) => ({ ...m, [id]: true }));
    void api.loadToolContent(id).then((tool) => {
      if (!tool || transcript.sessionId !== sessionId) return;
      setLoadedToolContent((m) => {
        const { next, evicted } = putLoadedToolRecord(m, id, tool);
        if (evicted.length) {
          setExpandedTools((expanded) => {
            const copy = { ...expanded };
            for (const evictedId of evicted) copy[evictedId] = false;
            return copy;
          });
        }
        return next;
      });
    }).finally(() => {
      if (transcript.sessionId !== sessionId) return;
      setLoadingToolContent((m) => {
        if (!m[id]) return m;
        const next = { ...m };
        delete next[id];
        return next;
      });
    });
  }, [api, expandedTools, loadedToolContent, transcript.sessionId]);
  const activeTranscript: readonly TranscriptItem[] = state && transcript.sessionId === state.activeSessionId
    ? transcript.items
    : EMPTY_TRANSCRIPT;
  const onViewFileInDiff = useCallback((path: string) => {
    setDiffFocusPath(path);
    void api.setGui({ showReview: true, showFiles: false });
  }, [api]);
  const onFork = useCallback((itemId?: string) => {
    if (!itemId) return;
    const source = activeTranscript.find((item) => item.id === itemId);
    const preview = source && (source.kind === "assistant" || source.kind === "user") ? source.text : undefined;
    setForkError(undefined);
    setForkRequest({ itemId, preview: preview?.trim().slice(0, 280) });
  }, [activeTranscript]);

  const closeFork = useCallback(() => {
    if (forkSubmitting) return;
    setForkRequest(null);
    setForkError(undefined);
  }, [forkSubmitting]);

  const submitFork = useCallback(async (environment: ForkEnvironment) => {
    if (!forkRequest) return;
    setForkSubmitting(true);
    setForkError(undefined);
    try {
      await api.fork(forkRequest.itemId, { worktree: environment === "worktree" });
      setForkRequest(null);
    } catch (error) {
      setForkError(error instanceof Error ? error.message : String(error));
    } finally {
      setForkSubmitting(false);
    }
  }, [api, forkRequest]);

  const focusComposer = () => {
    window.setTimeout(() => composerRef.current?.focus(), 0);
  };

  const openNewThread = () => {
    if ((state?.gui.workspaces ?? []).length === 0) {
      void api.pickFolder();
      return;
    }
    setView("new-thread");
    focusComposer();
  };

  const threadSearch = useThreadSearch(paneRef);
  const timelineScroll = useTimelineScroll({
    sessionKey: state?.activeSessionId ?? "",
    itemCount: activeTranscript.length,
    running: Boolean(state?.running),
    enabled: view === "threads",
    paneRef,
  });

  useEffect(() => {
    const openFind = () => {
      if (view !== "threads") return;
      threadSearch.open();
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        openFind();
      }
    };
    window.addEventListener("keydown", onKey);
    const unsub = api.onFindInThread(openFind);
    const unsubSettings = api.onOpenSettings(() => {
      setView("settings");
      setSettingsSection("general");
    });
    const unsubNewThread = api.onOpenNewThread(() => {
      if ((state?.gui.workspaces ?? []).length === 0) {
        void api.pickFolder();
        return;
      }
      setView("new-thread");
      window.setTimeout(() => composerRef.current?.focus(), 0);
    });
    const unsubRename = api.onRenameCurrentThread(() => {
      if (state?.activeSessionId) setRenamingId(state.activeSessionId);
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      unsub();
      unsubSettings();
      unsubNewThread();
      unsubRename();
    };
  }, [api, state?.activeSessionId, state?.gui.workspaces, threadSearch, view]);

  useEffect(() => {
    if (threadSearch.isOpen) threadSearch.close();
  }, [state?.activeSessionId]);

  const runningLabel = useRunningLabel(Boolean(state?.running));

  if (!state) {
    return <AuthLoader label="Connecting…" />;
  }

  if (credentialsPending(state.auth)) {
    const signingIn = Boolean(state.auth.signingIn);
    return (
      <AuthLoader
        label={
          signingIn
            ? state.auth.deviceCode
              ? "Enter this code in your browser"
              : "Signing in…"
            : "Loading credentials…"
        }
        deviceCode={state.auth.deviceCode}
        loginUrl={state.auth.loginUrl}
        onCancel={signingIn ? () => void api.cancelLogin() : undefined}
        onOpenUrl={(url) => void api.openExternal(url)}
      />
    );
  }

  if (!state.auth.authenticated) {
    return (
      <SignInView
        auth={state.auth}
        connected={state.connected}
        grokBin={state.grokBin}
        grokVersion={state.grokVersion}
        bootError={state.error}
        onSignIn={() => void api.login()}
        onOpenUrl={(url) => void api.openExternal(url)}
      />
    );
  }

  const collapsed = Boolean(state.gui.sidebarCollapsed);
  const showReview = Boolean(state.gui.showReview);
  const showFiles = Boolean(state.gui.showFiles);
  const showPromptRail = state.gui.showPromptRail !== false;
  const showTerminal = Boolean(state.gui.showTerminal);
  const sidePanelMode = showFiles && !showReview ? "files" : showReview ? "changes" : null;
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
  const shortcut = isMac ? "⌘B" : "Ctrl+B";
  const efforts = state.models.find((m) => m.modelId === state.currentModelId)?.reasoningEfforts ?? [
    { id: "low", value: "low", label: "low" },
    { id: "medium", value: "medium", label: "medium" },
    { id: "high", value: "high", label: "high" },
    { id: "xhigh", value: "xhigh", label: "xhigh" },
  ];
  const workspaces = grouped.map((g) => g.cwd);
  if (state.cwd && !workspaces.includes(state.cwd)) workspaces.unshift(state.cwd);
  const rootCwd = state.gui.rootCwd || state.cwd;
  const environments = [
    { id: "local", label: "Local" },
    ...state.worktrees.filter((wt) => wt.path).map((wt) => ({ id: wt.path, label: wt.label || cwdName(wt.path) })),
  ];
  const onWorktree = state.worktrees.some((wt) => wt.path === state.cwd);
  const environmentLabel = onWorktree
    ? (state.worktrees.find((wt) => wt.path === state.cwd)?.label || cwdName(state.cwd))
    : "Local";

  const persistGui = (partial: Partial<typeof state.gui>) => {
    void api.setGui(partial);
  };

  const composer = (
    <ComposerPanel
      state={state}
      draft={draft}
      leading={<PlanStrip plan={state.plan} />}
      composerRef={composerRef}
      selectorRef={selectorRef}
      slashOpen={slashOpen}
      slashItems={visibleSlashItems}
      slashOptions={slashOptions}
      slashOptionTitle={slashOptionTitle}
      selectedSlashOption={selectedSlashOption}
      selectedSlashCommand={selectedSlashCommand}
      mentionOpen={mentionOpen}
      mentionHits={mentionHits}
      selectedMentionIndex={selectedMentionIndex}
      openMenu={openMenu}
      setOpenMenu={setOpenMenu}
      efforts={efforts}
      placeholder="Ask Grok to inspect the repo, run a fix, or continue the current thread..."
      onDraftChange={onDraftChange}
      onKeyDown={onComposerKey}
      onSubmit={(mode) => void submit(mode)}
      onCancel={onCancel}
      onPickSlash={onPickSlash}
      onPickSlashOption={onPickSlashOption}
      onPickMention={pickMention}
      attachments={attachments}
      onPickAttachments={onPickAttachments}
      onRemoveAttachment={onRemoveAttachment}
      editingQueuedMessageId={editingQueuedMessageId}
      onEditQueuedMessage={onEditQueuedMessage}
      onCancelQueuedEdit={onCancelQueuedEdit}
      onRemoveQueuedMessage={onRemoveQueuedMessage}
      onSteerQueuedMessage={onSteerQueuedMessage}
    />
  );

  if (view === "settings" || view === "skills" || view === "mcp") {
    const nav = view === "settings"
      ? SETTINGS_NAV.map((item) => ({ id: item.id, label: item.label }))
      : view === "skills"
        ? [{ id: "skills", label: "Skills" }]
        : [
            { id: "mcp", label: "MCP servers" },
            { id: "plugins", label: "Plugins" },
          ];
    return (
      <SecondarySurface
        title={view === "settings" ? "Settings" : view === "skills" ? "Skills" : "Extensions"}
        items={[...nav]}
        activeId={view === "settings" ? settingsSection : view === "skills" ? "skills" : extensionsSection}
        onBack={() => setView(state.activeSessionId ? "threads" : "new-thread")}
        onSelect={(id) => {
          if (view === "settings") setSettingsSection(id as SettingsSection);
          if (view === "mcp") setExtensionsSection(id as ExtensionsSection);
        }}
      >
        {view === "settings" ? (
          <SettingsView
            state={state}
            section={settingsSection}
            onSetThemeMode={(mode: ThemeMode) => persistGui({ themeMode: mode })}
            onSetThemePreset={(id: ThemePresetId) => persistGui({ themePresetId: id })}
            onSetTransparency={(enabled) => persistGui({ enableTransparency: enabled })}
          />
        ) : null}
        {view === "skills" ? (
          <SkillsView
            state={state}
            onTrySkill={(skill) => {
              const command = skill.slashCommand?.replace(/^\//, "") || skill.name;
              setView(state.activeSessionId ? "threads" : "new-thread");
              setDraft(`/${command} `);
              focusComposer();
            }}
            onAskGrokCreate={() => {
              setView(state.activeSessionId ? "threads" : "new-thread");
              setDraft("/create-skill ");
              focusComposer();
            }}
          />
        ) : null}
        {view === "mcp" ? <ExtensionsView key={extensionsSection} state={state} section={extensionsSection} /> : null}
      </SecondarySurface>
    );
  }

  const sidebarWidth = clampSidebarWidth(
    liveSidebarWidth ?? state.gui.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const shellClass = ["shell", collapsed ? "shell--sidebar-collapsed" : ""].join(" ");
  const terminalHeight = liveTerminalHeight ?? state.gui.terminalHeight ?? 340;
  const terminalTakeover = Boolean(state.gui.terminalTakeover);
  const mainClass = [
    "main",
    sidePanelMode && view === "threads" ? "main--with-side-panel" : "",
    showTerminal && view === "threads" ? "main--with-terminal" : "",
    showTerminal && view === "threads" && terminalTakeover ? "main--terminal-takeover" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={shellClass} style={{ ["--sidebar-width" as string]: `${sidebarWidth}px` }}>
      <SidebarToggleButton
        collapsed={collapsed}
        shortcutLabel={shortcut}
        previousShortcutLabel={isMac ? "⌘[" : "Ctrl+["}
        nextShortcutLabel={isMac ? "⌘]" : "Ctrl+]"}
        canGoBack={view === "threads" && canNavigateThreadHistory(threadHistory, -1, availableSessionIds)}
        canGoForward={view === "threads" && canNavigateThreadHistory(threadHistory, 1, availableSessionIds)}
        onToggle={() => persistGui({ sidebarCollapsed: !collapsed })}
        onGoBack={() => navigateThreadHistory(-1)}
        onGoForward={() => navigateThreadHistory(1)}
      />

      {!collapsed && (
        <Sidebar
          view={view}
          cwd={state.cwd}
          groups={grouped}
          accountUsage={state.accountUsage}
          auth={state.auth}
          pinnedAll={pinnedAll}
          activeSessionId={state.activeSessionId}
          archivedOpen={archivedOpen}
          collapsedWorkspaces={collapsedWorkspaces}
          workspaceMenu={workspaceMenu}
          threadMenu={threadMenu}
          renamingId={renamingId}
          renamingWorkspace={renamingWorkspace}
          workspaceNames={state.gui.workspaceNames ?? {}}
          permanentWorktrees={state.gui.permanentWorktrees ?? {}}
          onNewThread={openNewThread}
          onSetView={setView}
          onPickFolder={() => {
            void api.pickFolder().then((dir) => {
              if (!dir) return;
              setView("new-thread");
              window.setTimeout(() => composerRef.current?.focus(), 0);
            });
          }}
          onSelectWorkspace={(cwd) => void api.setCwd(cwd)}
          onToggleWorkspace={(cwd) => setCollapsedWorkspaces((m) => ({ ...m, [cwd]: !m[cwd] }))}
          onToggleWorkspaceMenu={(cwd) => setWorkspaceMenu(workspaceMenu === cwd ? null : cwd)}
          onOpenFolder={(cwd) => { void api.openPath(cwd); setWorkspaceMenu(null); }}
          onCreateWorktree={(cwd) => { void api.createWorktree(cwd); setWorkspaceMenu(null); }}
          onRemoveWorktree={(cwd) => { void api.removeWorktree(cwd); setWorkspaceMenu(null); }}
          onRemoveWorkspace={(cwd) => { void api.removeWorkspace(cwd); setWorkspaceMenu(null); }}
          onStartWorkspaceRename={(cwd) => { setWorkspaceMenu(null); setRenamingWorkspace(cwd); }}
          onCommitWorkspaceRename={(cwd, name) => { setRenamingWorkspace(null); void api.renameWorkspace(cwd, name); }}
          onCancelWorkspaceRename={() => setRenamingWorkspace(null)}
          onSelectSession={(session) => {
            setView("threads");
            setThreadMenu(null);
            const next = visitThread(threadHistoryRef.current, session.sessionId);
            if (next !== threadHistoryRef.current) commitThreadHistory(next);
            void api.openSession(session.sessionId, session.cwd);
          }}
          onToggleThreadMenu={(sessionId) => setThreadMenu(threadMenu === sessionId ? null : sessionId)}
          onToggleArchived={(cwd) => setArchivedOpen((m) => ({ ...m, [cwd]: !m[cwd] }))}
          onStartRename={(sessionId) => { setThreadMenu(null); setRenamingId(sessionId); }}
          onCommitRename={(sessionId, title) => { setRenamingId(null); void api.rename(sessionId, title); }}
          onCancelRename={() => setRenamingId(null)}
          onMarkRead={(sessionId) => { setThreadMenu(null); void api.markRead(sessionId); }}
          onCopySessionId={(sessionId) => { setThreadMenu(null); void api.copyText(sessionId); }}
          onReorderWorkspaces={(order) => void api.reorderWorkspaces(order)}
          onReorderPinned={(order) => void api.reorderPinned(order)}
          width={sidebarWidth}
          onWidthChange={setLiveSidebarWidth}
          onWidthCommit={(width) => {
            setLiveSidebarWidth(width);
            persistGui({ sidebarWidth: width });
          }}
        />
      )}

      <section className={mainClass}>
        <Topbar
          view={view}
          workspaceName={workspaceDisplayName(rootCwd, state.gui.workspaceNames)}
          sessionTitle={sessionDisplayTitle(active)}
          environmentLabel={environmentLabel}
          environmentOpen={environmentMenuOpen}
          environments={environments}
          onToggleEnvironment={() => setEnvironmentMenuOpen((open) => !open)}
          onSelectEnvironment={(id) => {
            setEnvironmentMenuOpen(false);
            setEnvironment(id === "local" ? "local" : "worktree");
            void api.selectEnvironment(id);
          }}
          terminalVisible={showTerminal}
          onToggleTerminal={() => persistGui({ showTerminal: !showTerminal })}
          changesVisible={showReview}
          onToggleChanges={() => {
            persistGui({ showReview: !showReview, showFiles: false });
            if (!showReview) void api.refresh();
          }}
          filesVisible={showFiles}
          onToggleFiles={() => persistGui({ showFiles: !showFiles, showReview: false })}
          promptRailVisible={showPromptRail}
          onTogglePromptRail={() => persistGui({ showPromptRail: !showPromptRail })}
          panelsAvailable={view === "threads" && Boolean(state.activeSessionId)}
        />

        {view === "new-thread" && (
          <NewThreadView
            state={state}
            draft={draft}
            composerRef={composerRef}
            selectorRef={selectorRef}
            slashOpen={slashOpen}
            slashItems={visibleSlashItems}
            slashOptions={slashOptions}
            slashOptionTitle={slashOptionTitle}
            selectedSlashOption={selectedSlashOption}
            selectedSlashCommand={selectedSlashCommand}
            mentionOpen={mentionOpen}
            mentionHits={mentionHits}
            selectedMentionIndex={selectedMentionIndex}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            efforts={efforts}
            environment={environment}
            workspaces={workspaces}
            onSelectWorkspace={(cwd) => void api.setCwd(cwd)}
            onSelectEnvironment={setEnvironment}
            onDraftChange={onDraftChange}
            onKeyDown={onComposerKey}
            onSubmit={(mode) => void submit(mode)}
            onCancel={onCancel}
            onPickSlash={onPickSlash}
            onPickSlashOption={onPickSlashOption}
            onPickMention={pickMention}
            attachments={attachments}
            onPickAttachments={onPickAttachments}
            onRemoveAttachment={onRemoveAttachment}
            editingQueuedMessageId={null}
            onEditQueuedMessage={() => undefined}
            onCancelQueuedEdit={() => undefined}
            onRemoveQueuedMessage={() => undefined}
            onSteerQueuedMessage={() => undefined}
          />
        )}

        {view === "threads" && !state.cwd ? (
          <section className="canvas canvas--empty">
            <div className="empty-panel">
              <div className="session-header__eyebrow">Workspace</div>
              <h1>Open a folder to start</h1>
              <p>Add a project folder, then create a thread. Sessions stay grouped under that folder in the sidebar.</p>
              <div className="empty-panel__actions">
                <button className="button button--primary" type="button" onClick={() => void api.pickFolder()}>
                  Open folder
                </button>
              </div>
            </div>
          </section>
        ) : view === "threads" && !active ? (
          <section className="canvas canvas--empty">
            <div className="empty-panel">
              <div className="session-header__eyebrow">Workspace</div>
              <h1>{cwdName(state.cwd)}</h1>
              <p>Create a thread for this folder, then jump between sessions from the sidebar.</p>
              <div className="empty-panel__actions">
                <button className="button button--primary" type="button" onClick={openNewThread}>
                  New thread
                </button>
              </div>
            </div>
          </section>
        ) : view === "threads" && active ? (
          <>
            <div className="canvas canvas--thread">
              <div className="conversation conversation--thread">
                <div className="chat-header">
                  <div className="chat-header__eyebrow">
                    {onWorktree
                      ? `${cwdName(rootCwd)} · ${environmentLabel}`
                      : `${cwdName(state.cwd)} · Local`}
                  </div>
                  <div className="chat-header__row">
                    <h1 className="chat-header__title">{sessionDisplayTitle(active)}</h1>
                    <div className="chat-header__status">
                      {state.running ? runningLabel : formatRelativeTime(active.lastActiveAt ?? active.updatedAt)}
                    </div>
                  </div>
                </div>
                <ConversationTimeline
                  key={state.activeSessionId ?? "none"}
                  items={activeTranscript}
                  running={state.running}
                  runningLabel={runningLabel}
                  error={state.error}
                  paneRef={paneRef}
                  expandedTools={expandedTools}
                  promptRailVisible={showPromptRail}
                  showThoughts={state.gui.showThoughts}
                  loadingTools={loadingToolContent}
                  loadedToolContent={loadedToolContent}
                  transcriptLoading={Boolean(state.activeSessionId && transcript.sessionId !== state.activeSessionId)}
                  threadSearch={threadSearch}
                  onToggleTool={onToggleTool}
                  onViewFileInDiff={onViewFileInDiff}
                  onFork={state.running ? undefined : onFork}
                  onTimelineScroll={timelineScroll.handleTimelineScroll}
                  onTimelineScrollIntent={timelineScroll.handleTimelineScrollIntent}
                  onContentHeightChange={timelineScroll.handleContentHeightChange}
                  showJumpToLatest={timelineScroll.showJumpToLatest}
                  onJumpToLatest={timelineScroll.jumpToLatest}
                />
              </div>
            </div>
            <footer className="composer">
              {composer}
            </footer>
          </>
        ) : null}

        {sidePanelMode && view === "threads" ? <DiffPanel state={state} mode={sidePanelMode} focusPath={diffFocusPath} /> : null}
        {showTerminal && view === "threads" ? (
          <TerminalPanel
            cwd={state.cwd}
            height={terminalHeight}
            isTakeover={terminalTakeover}
            onHeightChange={(height) => {
              setLiveTerminalHeight(height);
              if (heightTimer.current != null) window.clearTimeout(heightTimer.current);
              heightTimer.current = window.setTimeout(() => {
                heightTimer.current = null;
                persistGui({ terminalHeight: height });
              }, 150);
            }}
            onToggleTakeover={() => persistGui({ terminalTakeover: !terminalTakeover })}
            onClose={() => persistGui({ showTerminal: false, terminalTakeover: false })}
          />
        ) : null}
        {treeOpen ? (
          <TreeModal
            points={treePoints}
            loading={treeLoading}
            submitting={treeSubmitting}
            error={treeError}
            onClose={() => {
              if (treeSubmitting) return;
              setTreeOpen(false);
            }}
            onRewind={(index) => {
              setTreeSubmitting(true);
              setTreeError(undefined);
              void api.rewind(index).then(
                () => setTreeOpen(false),
                (error) => setTreeError(error instanceof Error ? error.message : String(error)),
              ).finally(() => setTreeSubmitting(false));
            }}
          />
        ) : null}
        {forkRequest ? (
          <ForkModal
            preview={forkRequest.preview}
            canUseWorktree={Boolean(state.git.isRepo)}
            submitting={forkSubmitting}
            error={forkError}
            onClose={closeFork}
            onSubmit={(environment) => void submitFork(environment)}
          />
        ) : null}
      </section>
    </div>
  );
}
