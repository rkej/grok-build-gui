export const MIN_SIDEBAR_WIDTH = 220;
export const MAX_SIDEBAR_WIDTH = 520;
export const DEFAULT_SIDEBAR_WIDTH = 280;

export function clampSidebarWidth(width: number, viewportWidth = 1440): number {
  const max = Math.min(
    MAX_SIDEBAR_WIDTH,
    Math.max(MIN_SIDEBAR_WIDTH, Math.round(viewportWidth * 0.45)),
  );
  if (!Number.isFinite(width)) return Math.min(max, DEFAULT_SIDEBAR_WIDTH);
  return Math.min(max, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)));
}
