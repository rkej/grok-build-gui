import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);

export const MAX_HIGHLIGHTED_LINES = 500;
export type HighlightLine = readonly (string | { readonly className?: string; readonly children: HighlightLine })[];

const EXTENSIONS: Readonly<Record<string, string>> = {
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  json: "json", py: "python", sh: "bash", bash: "bash", zsh: "bash",
};
const cache = new Map<string, HighlightLine>();

export function extensionToLanguage(filePath: string): string | undefined {
  const dot = filePath.lastIndexOf(".");
  return dot < 0 ? undefined : EXTENSIONS[filePath.slice(dot + 1).toLowerCase()];
}

export function highlightLine(line: string, language: string): HighlightLine {
  const key = `${language}\0${line}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const tokens = parseHtml(hljs.highlight(line, { language, ignoreIllegals: true }).value);
  if (cache.size >= 5000) cache.delete(cache.keys().next().value ?? key);
  cache.set(key, tokens);
  return tokens;
}

function parseHtml(source: string): HighlightLine {
  const out: (string | { className?: string; children: HighlightLine })[] = [];
  let pos = 0;
  const parseChildren = (closing: string | null): void => {
    let textStart = pos;
    const flush = (end: number) => { if (end > textStart) out.push(decode(source.slice(textStart, end))); };
    while (pos < source.length) {
      if (source[pos] !== "<") { pos += 1; continue; }
      if (closing && source.startsWith(`</${closing}>`, pos)) {
        flush(pos); pos += closing.length + 3; return;
      }
      if (source.startsWith("<span", pos)) {
        flush(pos);
        const end = source.indexOf(">", pos);
        if (end < 0) { pos += 1; continue; }
        const className = /\sclass="([^"]*)"/.exec(source.slice(pos + 5, end))?.[1];
        pos = end + 1;
        const original = out.splice(0, out.length);
        const nestedParser = parseNested(source, pos, "span");
        pos = nestedParser.pos;
        out.push(...original, { className, children: nestedParser.tokens });
        textStart = pos;
        continue;
      }
      pos += 1;
    }
    flush(pos);
  };
  parseChildren(null);
  return out;
}

function parseNested(source: string, start: number, closing: string): { pos: number; tokens: HighlightLine } {
  const tokens: (string | { className?: string; children: HighlightLine })[] = [];
  let pos = start;
  let textStart = start;
  while (pos < source.length) {
    if (source.startsWith(`</${closing}>`, pos)) {
      if (pos > textStart) tokens.push(decode(source.slice(textStart, pos)));
      return { pos: pos + closing.length + 3, tokens };
    }
    if (source[pos] === "<" && source.startsWith("<span", pos)) {
      if (pos > textStart) tokens.push(decode(source.slice(textStart, pos)));
      const end = source.indexOf(">", pos);
      if (end < 0) break;
      const className = /\sclass="([^"]*)"/.exec(source.slice(pos + 5, end))?.[1];
      const nested = parseNested(source, end + 1, "span");
      tokens.push({ className, children: nested.tokens });
      pos = nested.pos;
      textStart = pos;
      continue;
    }
    pos += 1;
  }
  if (pos > textStart) tokens.push(decode(source.slice(textStart, pos)));
  return { pos, tokens };
}

function decode(value: string): string {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/gi, "'").replace(/&amp;/g, "&");
}
