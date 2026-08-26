import type { FileTreeNode } from "./protocol.js";

export function rankFileMentions(nodes: readonly FileTreeNode[], query: string, limit = 24): FileTreeNode[] {
  const files: FileTreeNode[] = [];
  const visit = (rows: readonly FileTreeNode[]) => {
    for (const row of rows) {
      if (row.type === "file") files.push(row);
      if (row.children) visit(row.children);
    }
  };
  visit(nodes);

  const normalized = query.trim().toLowerCase();
  if (!normalized) return files.slice(0, limit);
  return files
    .map((file) => ({ file, score: fileMentionScore(file, normalized) }))
    .filter((row) => Number.isFinite(row.score))
    .sort((a, b) => a.score - b.score || a.file.path.localeCompare(b.file.path))
    .slice(0, limit)
    .map((row) => row.file);
}

function fileMentionScore(file: FileTreeNode, query: string): number {
  const name = file.name.toLowerCase();
  const filePath = file.path.toLowerCase();
  if (name === query) return 0;
  if (name.startsWith(query)) return 10 + name.length - query.length;
  const nameIndex = name.indexOf(query);
  if (nameIndex >= 0) return 50 + nameIndex;
  if (filePath.startsWith(query)) return 100 + filePath.length - query.length;
  const pathIndex = filePath.indexOf(query);
  if (pathIndex >= 0) return 150 + pathIndex;

  let cursor = -1;
  let gaps = 0;
  for (const char of query) {
    const next = filePath.indexOf(char, cursor + 1);
    if (next < 0) return Number.POSITIVE_INFINITY;
    gaps += next - cursor - 1;
    cursor = next;
  }
  return 300 + gaps;
}
