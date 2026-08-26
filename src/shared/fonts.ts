export const UI_FONT_IDS = ["system", "inter", "ibm-plex", "source-sans", "serif", "rounded"] as const;
export type UiFontId = (typeof UI_FONT_IDS)[number];

export const MONO_FONT_IDS = ["system", "jetbrains", "fira", "cascadia", "ibm-plex-mono", "iosevka"] as const;
export type MonoFontId = (typeof MONO_FONT_IDS)[number];

export const FONT_SCALES = [90, 100, 110, 125] as const;
export type FontScale = (typeof FONT_SCALES)[number];

export const UI_FONT_STACKS: Record<UiFontId, string> = {
  system: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
  inter: 'Inter, "Inter Variable", ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif',
  "ibm-plex": '"IBM Plex Sans", ui-sans-serif, -apple-system, "Segoe UI", sans-serif',
  "source-sans": '"Source Sans 3", "Source Sans Pro", ui-sans-serif, -apple-system, sans-serif',
  serif: 'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", ui-sans-serif, sans-serif',
};

export const MONO_FONT_STACKS: Record<MonoFontId, string> = {
  system: 'ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace',
  jetbrains: '"JetBrains Mono", ui-monospace, "SF Mono", monospace',
  fira: '"Fira Code", ui-monospace, "SF Mono", monospace',
  cascadia: '"Cascadia Code", "Cascadia Mono", ui-monospace, Consolas, monospace',
  "ibm-plex-mono": '"IBM Plex Mono", ui-monospace, "SF Mono", monospace',
  iosevka: 'Iosevka, ui-monospace, "SF Mono", monospace',
};

export const UI_FONT_OPTIONS: { id: UiFontId; label: string; description: string }[] = [
  { id: "system", label: "System", description: "San Francisco on macOS, Segoe UI on Windows." },
  { id: "inter", label: "Inter", description: "Uses Inter if it is installed on this machine." },
  { id: "ibm-plex", label: "IBM Plex", description: "Uses IBM Plex Sans if installed." },
  { id: "source-sans", label: "Source Sans", description: "Uses Source Sans 3 if installed." },
  { id: "serif", label: "Serif", description: "System UI serif, then Palatino / Georgia." },
  { id: "rounded", label: "Rounded", description: "SF Pro Rounded when the OS provides it." },
];

export const MONO_FONT_OPTIONS: { id: MonoFontId; label: string; description: string }[] = [
  { id: "system", label: "System", description: "SF Mono, Cascadia Code, or Consolas." },
  { id: "jetbrains", label: "JetBrains Mono", description: "Uses JetBrains Mono if installed." },
  { id: "fira", label: "Fira Code", description: "Uses Fira Code if installed." },
  { id: "cascadia", label: "Cascadia", description: "Uses Cascadia Code if installed." },
  { id: "ibm-plex-mono", label: "IBM Plex Mono", description: "Uses IBM Plex Mono if installed." },
  { id: "iosevka", label: "Iosevka", description: "Uses Iosevka if installed." },
];

export const FONT_SCALE_OPTIONS: { id: FontScale; label: string }[] = [
  { id: 90, label: "Small" },
  { id: 100, label: "Default" },
  { id: 110, label: "Large" },
  { id: 125, label: "Larger" },
];

export function parseUiFontId(value: unknown): UiFontId {
  return UI_FONT_IDS.includes(value as UiFontId) ? (value as UiFontId) : "system";
}

export function parseMonoFontId(value: unknown): MonoFontId {
  return MONO_FONT_IDS.includes(value as MonoFontId) ? (value as MonoFontId) : "system";
}

export function parseFontScale(value: unknown): FontScale {
  return FONT_SCALES.includes(value as FontScale) ? (value as FontScale) : 100;
}
