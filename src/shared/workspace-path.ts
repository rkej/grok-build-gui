import path from "node:path";

/**
 * Resolve `relPath` against `root` and return the absolute path only if it
 * stays inside `root`. Used by renderer-facing IPC (file preview, git).
 *
 * ACP `fs/*` requests from the Grok child are a different boundary: that
 * process already has local filesystem access.
 */
export function resolveInside(root: string, relPath: string): string | null {
  if (!root) return null;
  const base = path.resolve(root);
  const resolved = path.resolve(base, relPath);
  const relative = path.relative(base, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

export function isInside(root: string, candidate: string): boolean {
  return resolveInside(root, candidate) !== null;
}
