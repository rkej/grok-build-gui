import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_GUI_STATE, type GuiState } from "../shared/protocol.js";
import { grokHome, guiStatePath } from "./paths.js";

export function loadGuiState(): GuiState {
  try {
    const raw = JSON.parse(readFileSync(guiStatePath(), "utf8")) as Partial<GuiState>;
    return { ...DEFAULT_GUI_STATE, ...raw };
  } catch {
    return { ...DEFAULT_GUI_STATE };
  }
}

export function saveGuiState(state: GuiState): void {
  mkdirSync(grokHome(), { recursive: true });
  writeFileSync(guiStatePath(), JSON.stringify(state, null, 2));
}
