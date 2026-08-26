import type { DisplayTimelineItem } from "./timeline-turns";

export function estimateTimelineItemHeight(item: DisplayTimelineItem): number {
  if (item.kind === "turn-marker") return 32;
  if (item.kind === "user" || item.kind === "assistant") {
    const attachmentHeight = item.kind === "user" && item.attachments?.some((attachment) => attachment.kind === "image")
      ? 120
      : item.kind === "user" && item.attachments?.length
        ? 56
        : 0;
    const textLength = Math.max(item.text.length, 1);
    return 68 + attachmentHeight + Math.min(240, Math.ceil(textLength / 90) * 20);
  }
  if (item.kind === "tool") return 28;
  if (item.kind === "tool-group" || item.kind === "tool-bucket") return 28;
  if (item.kind === "plan") return 140;
  return 38;
}

export function initialTimelineViewport(
  items: readonly DisplayTimelineItem[],
  viewportHeight: number,
  rowGap: number,
): { scrollTop: number; height: number } {
  const totalHeight = items.reduce(
    (total, item, index) => total + estimateTimelineItemHeight(item) + (index > 0 ? rowGap : 0),
    0,
  );
  return { scrollTop: Math.max(0, totalHeight - viewportHeight), height: viewportHeight };
}
