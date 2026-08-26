export type SlashCompletionCandidate = {
  name: string;
  section: "host" | "runtime";
};

export function slashTabCompletion<T extends SlashCompletionCandidate>(
  draft: string,
  slashOpen: boolean,
  items: readonly T[],
): T | undefined {
  if (!slashOpen || !/^\/[^\s]*$/.test(draft)) return undefined;
  return items.find((item) => item.section === "runtime")
    ?? items.find((item) => item.section === "host");
}
