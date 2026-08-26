import { memo } from "react";
import { InlineDiff } from "./diff-inline";
import { MessageMarkdown } from "./markdown";
import { PlanCard } from "./plan-card";
import { formatWorkedDuration, type DisplayTimelineItem } from "./timeline-turns";
import {
  countDiffStats,
  extractDiffFromTool,
  extractFilename,
  formatToolBody,
  isWriteTool,
  shortenPath,
  toolDetail,
  toolLabel,
  toolName,
} from "./tool-format";
import { ChevronRightIcon, CopyIcon, DiffIcon, FileIcon, ForkIcon, SparkIcon, TerminalIcon } from "./icons";
import { extensionToLanguage } from "./syntax-highlight";

export const TimelineItem = memo(function TimelineItem({
  item,
  expanded,
  loading,
  showThoughts,
  onToggle,
  onViewFileInDiff,
  onFork,
}: {
  readonly item: DisplayTimelineItem;
  readonly expanded: boolean;
  readonly loading?: boolean;
  readonly showThoughts?: boolean;
  readonly onToggle: (item: DisplayTimelineItem) => void;
  readonly onViewFileInDiff?: (path: string) => void;
  readonly onFork?: (itemId: string) => void;
}) {
  if (item.kind === "user") {
    return (
      <article className="timeline-item timeline-item--user" data-message-id={item.id}>
        <div className="timeline-item__bubble">
          {item.attachments?.length ? (
            <div className="timeline-item__attachments">
              {item.attachments.map((attachment, index) => attachment.kind === "image" && attachment.data ? (
                <img
                  key={`${item.id}:${index}`}
                  className="timeline-item__attachment timeline-item__attachment--image"
                  src={`data:${attachment.mimeType};base64,${attachment.data}`}
                  alt={attachment.name}
                />
              ) : (
                <div key={`${item.id}:${index}`} className="timeline-item__attachment timeline-item__attachment--file" title={attachment.path}>
                  <span className="timeline-item__attachment-icon"><FileIcon /></span>
                  <span className="timeline-item__attachment-name">{attachment.name}</span>
                </div>
              ))}
            </div>
          ) : null}
          <MessageMarkdown text={item.text} />
        </div>
      </article>
    );
  }

  if (item.kind === "assistant") {
    if (!item.text.trim() && !item.streaming) return null;
    const canFork = Boolean(onFork && item.text.trim());
    return (
      <article className="timeline-item timeline-item--assistant" data-message-id={item.id}>
        <MessageMarkdown text={item.text} />
        {canFork ? (
          <div className="timeline-item__actions">
            <button type="button" className="timeline-item__action" title="Fork conversation from this point" aria-label="Fork conversation from this point" data-testid="fork-from-message" onClick={() => onFork?.(item.id)}>
              <ForkIcon />
              <span className="timeline-item__action-label">Fork</span>
            </button>
          </div>
        ) : null}
      </article>
    );
  }

  if (item.kind === "turn-marker") {
    return (
      <div className="timeline-turn-marker" data-testid="timeline-turn-marker">
        <span className="timeline-turn-marker__label">{`Worked for ${formatWorkedDuration(item.durationMs)}`}</span>
      </div>
    );
  }

  if (item.kind === "thought") {
    if (showThoughts === false) return null;
    return (
      <div className="timeline-activity">
        <span className="timeline-activity__label">Thinking</span>
      </div>
    );
  }

  if (item.kind === "plan") {
    return <PlanCard entries={item.entries} />;
  }

  if (item.kind === "system") {
    return (
      <div className="timeline-activity timeline-activity--summary">
        <span className="timeline-activity__label">{item.text}</span>
      </div>
    );
  }

  if (item.kind === "tool-group" || item.kind === "tool-bucket") {
    const count = item.tools.length;
    const countLabel = item.kind === "tool-group" ? `${count} actions` : String(count);
    return (
      <div
        className={`timeline-tool-group ${indentClass(item.indent)} ${item.kind === "tool-bucket" ? "timeline-tool-group--nested" : ""} ${item.failed ? "timeline-tool-group--failed" : ""}`}
        data-testid={item.kind === "tool-group" ? "timeline-tool-group" : "timeline-tool-bucket"}
      >
        <div className="timeline-tool__header-row">
          <span className="timeline-tool__glyph" aria-hidden="true">
            <SparkIcon />
          </span>
          <button
            className="timeline-tool-group__summary"
            type="button"
            aria-expanded={expanded}
            onClick={() => onToggle(item)}
          >
            <span className={`timeline-tool__chevron ${expanded ? "timeline-tool__chevron--expanded" : ""}`}>
              <ChevronRightIcon />
            </span>
            <span className="timeline-tool-group__label">{item.summary}</span>
            <span className="timeline-tool__meta-inline">
              <span className="timeline-tool__status-pip" aria-hidden="true" />
              {countLabel}
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (item.kind !== "tool") return null;

  const tool = item.tool;
  const status = toolStatus(tool.status);
  const name = toolName(tool);
  const filePath = extractFilename(tool.rawInput) || tool.diff?.path || "";
  const diffLanguage = filePath ? extensionToLanguage(filePath) : undefined;
  const diffText = expanded && !loading ? extractDiffFromTool(tool) : undefined;
  const diffStats = diffText ? countDiffStats(diffText) : undefined;
  const body = expanded && !loading ? formatToolBody(tool) : "";
  const hasContent = tool.hasContent ?? Boolean(
    tool.rawInput !== undefined || tool.rawOutput !== undefined || tool.content !== undefined || tool.diff,
  );
  const label = isWriteTool(name) && filePath ? `Edited ${shortenPath(filePath)}` : toolLabel(tool);
  const errorDetail = !loading && status === "error" ? toolDetail(tool) : undefined;
  const copyText = diffText || body;

  return (
    <article className={`timeline-tool timeline-tool--${status} ${indentClass(item.indent)}`}>
      <div className="timeline-tool__header-row">
        <span className="timeline-tool__glyph" aria-hidden="true">
          {toolGlyph(name)}
        </span>
        <button className="timeline-tool__header" type="button" aria-expanded={expanded} onClick={() => onToggle(item)} disabled={!hasContent}>
          {hasContent ? (
            <span className={`timeline-tool__chevron ${expanded ? "timeline-tool__chevron--expanded" : ""}`}>
              <ChevronRightIcon />
            </span>
          ) : null}
          <span className="timeline-tool__label">{label}</span>
          {errorDetail ? <span className="timeline-tool__detail">{errorDetail}</span> : null}
          {diffStats ? (
            <span className="timeline-tool__diff-stats">
              <span className="timeline-tool__stat-add">+{diffStats.added}</span>
              {" "}
              <span className="timeline-tool__stat-del">-{diffStats.removed}</span>
            </span>
          ) : null}
          <span className="timeline-tool__meta-inline">
            <span className="timeline-tool__status-pip" aria-hidden="true" />
            {`${name} · ${statusLabel(status)}`}
          </span>
        </button>
        {filePath && onViewFileInDiff ? (
          <button
            aria-label={`View ${filePath} in changes`}
            className="icon-button timeline-tool__view-in-diff"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onViewFileInDiff(filePath);
            }}
          >
            <DiffIcon />
          </button>
        ) : null}
      </div>
      {expanded && hasContent ? (
        <div className="timeline-tool__body">
          {loading ? <div className="timeline-tool__loading">Loading tool output…</div> : null}
          {!loading && diffText ? (
            <>
              <div className="timeline-tool__diff-header">
                <span className="timeline-tool__diff-filename">
                  {shortenPath(filePath) || tool.title}
                  {diffStats ? (
                    <span className="timeline-tool__diff-stats">
                      {" "}<span className="timeline-tool__stat-add">+{diffStats.added}</span>
                      {" "}<span className="timeline-tool__stat-del">-{diffStats.removed}</span>
                    </span>
                  ) : null}
                </span>
                <button
                  className="icon-button timeline-tool__copy"
                  type="button"
                  aria-label="Copy"
                  onClick={() => void navigator.clipboard.writeText(copyText)}
                >
                  <CopyIcon />
                </button>
              </div>
              <InlineDiff diff={diffText} language={diffLanguage} />
            </>
          ) : !loading ? (
            <>
              <div className="timeline-tool__body-actions">
                <button
                  className="icon-button timeline-tool__copy"
                  type="button"
                  aria-label="Copy"
                  onClick={() => void navigator.clipboard.writeText(copyText)}
                >
                  <CopyIcon />
                </button>
              </div>
              <pre className="timeline-tool__pre">{body}</pre>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
});

function toolStatus(status: string): "running" | "success" | "error" {
  if (status === "failed" || status === "error") return "error";
  if (status === "completed" || status === "success") return "success";
  return "running";
}

function statusLabel(status: "running" | "success" | "error"): string {
  if (status === "running") return "running";
  if (status === "success") return "done";
  return "failed";
}

function indentClass(indent: number | undefined): string {
  if (indent === 2) return "timeline-indent--2";
  if (indent === 1) return "timeline-indent--1";
  return "";
}

function toolGlyph(name: string) {
  if (isWriteTool(name)) return <DiffIcon />;
  if (/bash|shell|exec|terminal|command|run/i.test(name)) return <TerminalIcon />;
  if (/read|view|cat|open|file|glob|grep|search|ls/i.test(name)) return <FileIcon />;
  return <SparkIcon />;
}
