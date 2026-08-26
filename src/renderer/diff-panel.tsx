import { useEffect, useState, type CSSProperties } from "react";
import type { AppSnapshot, FilePreview, FileTreeNode, GitChange, GitDiff } from "../shared/protocol";
import { InlineDiff } from "./diff-inline";
import { ChevronDownIcon, ChevronRightIcon, FileIcon, FolderIcon } from "./icons";

export function DiffPanel({
  state,
  mode,
  focusPath,
}: {
  readonly state: AppSnapshot;
  readonly mode: "changes" | "files";
  readonly focusPath?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState<GitDiff | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const changes = state.git.changes;
  const selectedChange = changes.find((change) => change.path === selected);

  useEffect(() => {
    if (focusPath) setSelected(focusPath);
  }, [focusPath]);

  useEffect(() => {
    if (mode !== "files") return;
    void window.grokApp.listFiles().then(setTree);
  }, [mode, state.cwd]);

  useEffect(() => {
    if (!selected) {
      setDiff(null);
      setPreview(null);
      return;
    }
    if (mode === "changes") {
      void window.grokApp.gitDiff(selected, Boolean(selectedChange?.staged && !selectedChange.unstaged)).then(setDiff);
      return;
    }
    void window.grokApp.readFile(selected).then(setPreview);
  }, [mode, selected, selectedChange?.staged, selectedChange?.unstaged, state.git.changes]);

  const staged = changes.filter((change) => change.staged);
  const unstaged = changes.filter((change) => change.unstaged || !change.staged);

  return (
    <aside className={`diff-panel file-workbench ${mode === "files" ? "file-workbench--files" : "file-workbench--changes"}`}>
      <div className="diff-panel__header file-workbench__header">
        <div className="file-workbench__heading">
          <h2 className="diff-panel__title">{mode === "files" ? "Files" : "Review"}</h2>
          <GitMeta git={state.git} />
        </div>
        <span className="diff-panel__counter">{mode === "files" ? countFiles(tree) : changes.length}</span>
      </div>

      {mode === "changes" ? (
        <>
          <div className="file-workbench__body">
            {changes.length === 0 ? (
              <div className="diff-panel__empty">{state.git.isRepo ? "No local changes." : "Not a git repo."}</div>
            ) : (
              <div className="diff-panel__file-list">
                {unstaged.length > 0 ? (
                  <ChangeGroup
                    title="Unstaged"
                    changes={unstaged}
                    selected={selected}
                    busy={busy}
                    onSelect={setSelected}
                    onStage={(path) => runGit(path, () => window.grokApp.gitStage(path), setBusy)}
                    onDiscard={(path) => runGit(path, () => window.grokApp.gitDiscard(path), setBusy)}
                  />
                ) : null}
                {staged.length > 0 ? (
                  <ChangeGroup
                    title="Staged"
                    changes={staged}
                    selected={selected}
                    busy={busy}
                    staged
                    onSelect={setSelected}
                    onStage={(path) => runGit(path, () => window.grokApp.gitUnstage(path), setBusy)}
                  />
                ) : null}
              </div>
            )}
          </div>
          <div className="diff-panel__viewer file-workbench__viewer">
            {diff ? (
              <>
                <div className="diff-panel__viewer-header">
                  <span className="diff-panel__file-path">{diff.path}</span>
                  {diff.insertions != null || diff.deletions != null ? (
                    <span className="timeline-tool__diff-stats">
                      <span className="timeline-tool__stat-add">+{diff.insertions ?? 0}</span>{" "}
                      <span className="timeline-tool__stat-del">-{diff.deletions ?? 0}</span>
                    </span>
                  ) : null}
                </div>
                <InlineDiff diff={diff.diff} />
              </>
            ) : (
              <div className="diff-panel__empty">Select a changed file to review the diff.</div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="file-workbench__body">
            <div className="file-workbench__tree">
              {tree.length === 0 ? (
                <div className="diff-panel__empty">Open a folder to browse files.</div>
              ) : (
                tree.map((node) => (
                  <TreeNode key={node.path} node={node} depth={0} selected={selected} onSelect={setSelected} />
                ))
              )}
            </div>
          </div>
          <div className="file-workbench__viewer">
            {preview ? (
              <>
                <div className="file-workbench__viewer-header">
                  <span className="file-workbench__viewer-path">{preview.path}</span>
                </div>
                {preview.error ? <div className="diff-panel__empty diff-panel__unavailable">{preview.error}</div> : null}
                {preview.binary ? <div className="diff-panel__empty">Binary file.</div> : null}
                {preview.text != null ? <pre className="file-workbench__preview">{preview.text}</pre> : null}
              </>
            ) : (
              <div className="diff-panel__empty">Select a file to preview it.</div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function GitMeta({ git }: { readonly git: AppSnapshot["git"] }) {
  if (!git.isRepo) return <span className="file-workbench__subtitle">Not a git repo</span>;
  const parts = [git.branch || "detached"];
  if (git.ahead) parts.push(`↑${git.ahead}`);
  if (git.behind) parts.push(`↓${git.behind}`);
  return <span className="file-workbench__subtitle">{parts.join(" ")}</span>;
}

function ChangeGroup({
  title,
  changes,
  selected,
  busy,
  staged,
  onSelect,
  onStage,
  onDiscard,
}: {
  title: string;
  changes: GitChange[];
  selected: string | null;
  busy: string | null;
  staged?: boolean;
  onSelect: (path: string) => void;
  onStage: (path: string) => void;
  onDiscard?: (path: string) => void;
}) {
  return (
    <div className="file-workbench__change-group">
      <div className="file-workbench__change-heading">
        <span>{title}</span>
        <span className="file-workbench__status-label">{changes.length}</span>
      </div>
      {changes.map((change) => (
        <div
          className={`diff-panel__file ${selected === change.path ? "diff-panel__file--selected" : ""}`}
          key={`${title}:${change.path}`}
        >
          <button className="diff-panel__file-name" type="button" onClick={() => onSelect(change.path)}>
            <span className={`diff-panel__status-dot diff-panel__status-dot--${change.status}`} />
            <span>{change.path}</span>
            {change.insertions != null || change.deletions != null ? (
              <span className="file-workbench__status-label">
                +{change.insertions ?? 0} −{change.deletions ?? 0}
              </span>
            ) : null}
          </button>
          <button
            className="diff-panel__stage-btn"
            type="button"
            disabled={busy === change.path}
            onClick={() => onStage(change.path)}
          >
            {staged ? "Unstage" : "Stage"}
          </button>
          {!staged && onDiscard ? (
            <button
              className="diff-panel__stage-btn"
              type="button"
              disabled={busy === change.path}
              onClick={() => onDiscard(change.path)}
            >
              Discard
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  if (node.type === "dir") {
    return (
      <div>
        <button
          className="file-workbench__tree-row file-workbench__tree-row--dir"
          style={{ "--depth": depth } as CSSProperties}
          type="button"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="file-workbench__tree-icon">{open ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
          <FolderIcon />
          <span>{node.name}</span>
        </button>
        {open
          ? (node.children ?? []).map((child) => (
              <TreeNode key={child.path} node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
            ))
          : null}
      </div>
    );
  }
  return (
    <button
      className={`file-workbench__tree-row file-workbench__tree-row--file ${selected === node.path ? "file-workbench__tree-row--selected" : ""}`}
      style={{ "--depth": depth } as CSSProperties}
      type="button"
      onClick={() => onSelect(node.path)}
    >
      <span className="file-workbench__tree-icon"><FileIcon /></span>
      <span>{node.name}</span>
    </button>
  );
}

function countFiles(nodes: FileTreeNode[]): number {
  return nodes.reduce((sum, node) => sum + (node.type === "file" ? 1 : countFiles(node.children ?? [])), 0);
}

function runGit(path: string, action: () => Promise<void>, setBusy: (path: string | null) => void) {
  setBusy(path);
  void action().finally(() => setBusy(null));
}
