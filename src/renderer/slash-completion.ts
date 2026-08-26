import type { SlashCommand } from "../shared/protocol";

export type SlashCompletionCandidate = {
  name: string;
  section: "host" | "runtime";
};

export type SlashItem = SlashCompletionCandidate & {
  title: string;
  description: string;
};

export function slashCommandKey(item: SlashCompletionCandidate): string {
  return `${item.section}:${item.name}`;
}

export function slashName(value: string | undefined): string {
  return (value ?? "").replace(/^\//, "").trim();
}

/** ACP-advertised commands that only drive TUI overlays this shell does not implement. */
const INERT_SLASH_COMMANDS = new Set(["context", "session-info", "status", "info"]);

const HOST_OVERLAY_COMMANDS: SlashItem[] = [
  { name: "tree", title: "tree", description: "Browse rewind points", section: "host" },
];

export function grokSlashItems(state: {
  commands: readonly SlashCommand[];
  skills?: readonly {
    name: string;
    description?: string;
    slashCommand?: string;
    enabled?: boolean;
    userInvocable?: boolean;
  }[];
}): SlashItem[] {
  const skillNames = new Set<string>();
  for (const skill of state.skills ?? []) {
    if (skill.enabled === false || skill.userInvocable === false) continue;
    const command = slashName(skill.slashCommand || skill.name).toLowerCase();
    if (command) skillNames.add(command);
  }
  const seen = new Set<string>();
  const items: SlashItem[] = [];
  for (const command of state.commands) {
    const name = slashName(command.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (INERT_SLASH_COMMANDS.has(key) || seen.has(key)) continue;
    seen.add(key);
    items.push({
      name,
      title: name,
      description: command.description ?? "",
      section: skillNames.has(key) ? "runtime" : "host",
    });
  }
  for (const overlay of HOST_OVERLAY_COMMANDS) {
    const key = overlay.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(overlay);
  }
  return items;
}

export function slashMenuItems<T extends SlashCompletionCandidate>(items: readonly T[]): T[] {
  const runtime = items.filter((item) => item.section === "runtime").slice(0, 8);
  const host = items.filter((item) => item.section === "host");
  return [...runtime, ...host];
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
