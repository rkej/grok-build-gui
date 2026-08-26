export function moveSelectionIndex(length: number, current: number, delta: 1 | -1): number {
  if (length <= 0) return -1;
  if (current < 0 || current >= length) return delta > 0 ? 0 : length - 1;
  return (current + delta + length) % length;
}

export function mentionCandidatePath(candidate: unknown): string {
  if (candidate && typeof candidate === "object") {
    const row = candidate as { path?: unknown; name?: unknown };
    if (typeof row.path === "string") return row.path;
    if (typeof row.name === "string") return row.name;
  }
  return String(candidate ?? "");
}

export function composerEscapeAction({
  uiOpen,
  editingQueuedMessage,
  running,
}: {
  uiOpen: boolean;
  editingQueuedMessage: boolean;
  running: boolean;
}): "dismiss-ui" | "cancel-edit" | "cancel-run" | "none" {
  if (uiOpen) return "dismiss-ui";
  if (editingQueuedMessage) return "cancel-edit";
  if (running) return "cancel-run";
  return "none";
}
