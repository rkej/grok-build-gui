export type SlashCompletionCandidate = {
  name: string;
  section: "host" | "runtime";
};

export function slashCommandKey(item: SlashCompletionCandidate): string {
  return `${item.section}:${item.name}`;
}

export function slashMenuItems<T extends SlashCompletionCandidate>(items: readonly T[]): T[] {
  return [
    ...items.filter((item) => item.section === "runtime").slice(0, 8),
    ...items.filter((item) => item.section === "host"),
  ];
}

export function moveSlashSelection<T extends SlashCompletionCandidate>(
  items: readonly T[],
  selectedKey: string,
  delta: 1 | -1,
): T | undefined {
  const visible = slashMenuItems(items);
  if (visible.length === 0) return undefined;
  const index = visible.findIndex((item) => slashCommandKey(item) === selectedKey);
  if (index < 0) return delta > 0 ? visible[0] : visible[visible.length - 1];
  return visible[(index + delta + visible.length) % visible.length];
}

export function slashTabCompletion<T extends SlashCompletionCandidate>(
  draft: string,
  slashOpen: boolean,
  items: readonly T[],
  selectedKey = "",
): T | undefined {
  if (!slashOpen || !/^\/[^\s]*$/.test(draft)) return undefined;
  const visible = slashMenuItems(items);
  return visible.find((item) => slashCommandKey(item) === selectedKey) ?? visible[0];
}
