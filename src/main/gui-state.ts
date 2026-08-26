import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { clampSidebarWidth } from "../shared/layout.js";
import { DEFAULT_GUI_STATE, type GuiState } from "../shared/protocol.js";
import { grokHome, guiStatePath } from "./paths.js";

function record(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") next[key] = entry;
  }
  return next;
}

export function loadGuiState(): GuiState {
  try {
    const raw = JSON.parse(readFileSync(guiStatePath(), "utf8")) as Partial<GuiState>;
    return {
      ...DEFAULT_GUI_STATE,
      ...raw,
      workspaceNames: record(raw.workspaceNames),
      lastSeen: record(raw.lastSeen),
      composerDrafts: record(raw.composerDrafts),
      permanentWorktrees: record(raw.permanentWorktrees),
      sidebarWidth: clampSidebarWidth(
        typeof raw.sidebarWidth === "number" ? raw.sidebarWidth : DEFAULT_GUI_STATE.sidebarWidth,
      ),
      terminalHeight: typeof raw.terminalHeight === "number" ? raw.terminalHeight : DEFAULT_GUI_STATE.terminalHeight,
      terminalTakeover: Boolean(raw.terminalTakeover),
    };
  } catch {
    return { ...DEFAULT_GUI_STATE };
  }
}

export function saveGuiState(state: GuiState): void {
  mkdirSync(grokHome(), { recursive: true });
  writeFileSync(guiStatePath(), JSON.stringify(state, null, 2));
}
