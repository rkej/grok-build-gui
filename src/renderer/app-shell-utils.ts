export function isEventInsideTerminal(event: Event): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(".terminal-panel, .xterm, .xterm-helper-textarea"));
}
