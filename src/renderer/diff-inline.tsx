import { useMemo, type ReactNode } from "react";
import { highlightLine, MAX_HIGHLIGHTED_LINES, type HighlightLine } from "./syntax-highlight";

export function InlineDiff({ diff, language }: { readonly diff: string; readonly language?: string }) {
  if (!diff.trim()) {
    return <div className="diff-panel__empty">No textual diff for this file.</div>;
  }
  const lines = diff.split("\n");
  const highlight = language !== undefined && lines.length <= MAX_HIGHLIGHTED_LINES;
  return (
    <pre className="diff-inline">
      {lines.map((line, index) => {
        if (line.startsWith("---") || line.startsWith("+++")) return null;
        const kind = line.startsWith("@@")
          ? "header"
          : line.startsWith("+")
            ? "added"
            : line.startsWith("-")
              ? "removed"
              : "context";
        return (
          <div className={`diff-line diff-line--${kind}`} key={`${index}:${line.slice(0, 24)}`}>
            <span className="diff-line__number">{index + 1}</span>
            <span className="diff-line__content">{highlight && kind !== "header" ? <HighlightedContent content={line || " "} language={language} /> : line || " "}</span>
          </div>
        );
      })}
    </pre>
  );
}

function HighlightedContent({ content, language }: { readonly content: string; readonly language: string }) {
  const tokens = useMemo(() => highlightLine(content, language), [content, language]);
  return <>{renderTokens(tokens)}</>;
}

function renderTokens(tokens: HighlightLine): ReactNode {
  return tokens.map((token, index) => typeof token === "string" ? token : <span className={token.className} key={index}>{renderTokens(token.children)}</span>);
}
