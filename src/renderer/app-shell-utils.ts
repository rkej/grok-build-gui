export function isEventInsideTerminal(event: Event): boolean {
  return event.composedPath().some(
    (target) => target instanceof Element && Boolean(target.closest(".terminal-panel, .xterm")),
  );
}
