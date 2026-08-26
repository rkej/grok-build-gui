/** Minimal TOML helpers for Grok's `[skills].disabled` list. Not a full parser. */

export function readTomlStringArray(text: string, section: string, key: string): string[] {
  const body = sectionBody(text, section);
  if (body == null) return [];
  const value = tableValue(body, key);
  if (value == null) return [];
  return parseStringArray(value);
}

export function writeTomlStringArray(text: string, section: string, key: string, values: string[]): string {
  const rendered = `${key} = [${values.map(quoteTomlString).join(", ")}]`;
  const found = findSection(text, section);
  if (!found) {
    const prefix = text.endsWith("\n") || text.length === 0 ? text : `${text}\n`;
    return `${prefix}\n[${section}]\n${rendered}\n`;
  }
  const { start, end } = found;
  const headerEnd = text.indexOf("\n", start);
  const bodyStart = headerEnd < 0 ? end : headerEnd + 1;
  const body = text.slice(bodyStart, end);
  const replaced = replaceKey(body, key, rendered);
  if (replaced != null) {
    return text.slice(0, bodyStart) + replaced + text.slice(end);
  }
  const insertAt = bodyStart;
  const spacer = body.startsWith("\n") || body.length === 0 ? "" : "";
  return `${text.slice(0, insertAt)}${rendered}\n${spacer}${text.slice(insertAt)}`;
}

function findSection(text: string, section: string): { start: number; end: number } | null {
  const header = `[${section}]`;
  const lines = splitLines(text);
  let start = -1;
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = stripComment(line).trim();
    if (start < 0) {
      if (trimmed === header) start = offset;
    } else if (trimmed.startsWith("[") && trimmed.endsWith("]") && trimmed !== header) {
      return { start, end: offset };
    }
    offset += line.length;
  }
  if (start < 0) return null;
  return { start, end: text.length };
}

function sectionBody(text: string, section: string): string | null {
  const found = findSection(text, section);
  if (!found) return null;
  const headerEnd = text.indexOf("\n", found.start);
  if (headerEnd < 0 || headerEnd >= found.end) return "";
  return text.slice(headerEnd + 1, found.end);
}

function tableValue(body: string, key: string): string | null {
  const keyRe = new RegExp(`^${escapeRegExp(key)}\\s*=`, "m");
  const match = keyRe.exec(body);
  if (!match || match.index == null) return null;
  const after = body.slice(match.index + match[0].length);
  const trimmed = after.replace(/^[ \t]+/, "");
  if (trimmed.startsWith("[")) {
    const end = matchingBracket(trimmed);
    if (end < 0) return trimmed.trim();
    return trimmed.slice(0, end + 1);
  }
  const line = trimmed.split(/\r?\n/, 1)[0] ?? "";
  return stripComment(line).trim();
}

function replaceKey(body: string, key: string, rendered: string): string | null {
  const keyRe = new RegExp(`^${escapeRegExp(key)}\\s*=`, "m");
  const match = keyRe.exec(body);
  if (!match || match.index == null) return null;
  const from = match.index;
  const afterEq = body.slice(from + match[0].length).replace(/^[ \t]+/, "");
  let valueLength = 0;
  if (afterEq.startsWith("[")) {
    const end = matchingBracket(afterEq);
    valueLength = (end < 0 ? afterEq.length : end + 1) + (body.slice(from + match[0].length).length - afterEq.length);
  } else {
    const line = afterEq.split(/\r?\n/, 1)[0] ?? "";
    valueLength = (body.slice(from + match[0].length).length - afterEq.length) + line.length;
  }
  const to = from + match[0].length + valueLength;
  let next = `${body.slice(0, from)}${rendered}${body.slice(to)}`;
  if (!next.endsWith("\n") && body.endsWith("\n")) next += "\n";
  return next;
}

function parseStringArray(value: string): string[] {
  const inner = value.trim().replace(/^\[/, "").replace(/\]$/, "").trim();
  if (!inner) return [];
  const items: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i] ?? "";
    if (quote) {
      if (ch === "\\" && quote === '"') {
        current += inner[i + 1] ?? "";
        i += 1;
        continue;
      }
      if (ch === quote) {
        items.push(current);
        current = "";
        quote = null;
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current = "";
      continue;
    }
    if (ch === ",") {
      const token = current.trim();
      if (token) items.push(unquote(token));
      current = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") continue;
    current += ch;
  }
  const token = current.trim();
  if (token) items.push(unquote(token));
  return items;
}

function unquote(token: string): string {
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    return token.slice(1, -1);
  }
  return token;
}

function quoteTomlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function matchingBracket(text: string): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? "";
    if (quote) {
      if (ch === "\\" && quote === '"') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitLines(text: string): string[] {
  const lines: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      lines.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) lines.push(text.slice(start));
  return lines;
}

function stripComment(line: string): string {
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? "";
    if (quote) {
      if (ch === "\\" && quote === '"') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "#") return line.slice(0, i);
  }
  return line;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
