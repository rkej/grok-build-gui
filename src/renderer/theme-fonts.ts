import {
  MONO_FONT_STACKS,
  UI_FONT_STACKS,
  parseFontScale,
  parseMonoFontId,
  parseUiFontId,
  type FontScale,
  type MonoFontId,
  type UiFontId,
} from "../shared/fonts";

export function applyFontsToRoot(
  root: HTMLElement,
  uiFontId: UiFontId | string | undefined,
  monoFontId: MonoFontId | string | undefined,
  fontScale: FontScale | number | undefined,
): void {
  const ui = parseUiFontId(uiFontId);
  const mono = parseMonoFontId(monoFontId);
  const scale = parseFontScale(fontScale);
  root.style.setProperty("--font-ui", UI_FONT_STACKS[ui]);
  root.style.setProperty("--font-sans", UI_FONT_STACKS[ui]);
  root.style.setProperty("--font-mono", MONO_FONT_STACKS[mono]);
  root.style.setProperty("--font-scale", String(scale / 100));
  root.dataset.uiFont = ui;
  root.dataset.monoFont = mono;
}

export function resolvedMonoFontStack(monoFontId: MonoFontId | string | undefined): string {
  return MONO_FONT_STACKS[parseMonoFontId(monoFontId)];
}

export function resolvedFontScale(fontScale: FontScale | number | undefined): number {
  return parseFontScale(fontScale) / 100;
}
