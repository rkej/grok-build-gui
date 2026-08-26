import type { SessionSummary } from "../shared/protocol";

export type WorkspaceGroup = {
  cwd: string;
  pinned: SessionSummary[];
  active: SessionSummary[];
  archived: SessionSummary[];
};

export function groupSessionsByWorkspace(
  sessions: SessionSummary[],
  cwd: string | undefined,
  rootCwd: string | undefined,
  workspaces: string[] | undefined,
  pinnedOrder?: string[],
): WorkspaceGroup[] {
  const byCwd = new Map<string, SessionSummary[]>();
  for (const session of sessions) {
    if (!session.cwd) continue;
    const list = byCwd.get(session.cwd) ?? [];
    list.push(session);
    byCwd.set(session.cwd, list);
  }
  const cwdOrder: string[] = [];
  const add = (dir?: string) => {
    if (dir && !cwdOrder.includes(dir)) cwdOrder.push(dir);
  };
  for (const dir of workspaces ?? []) add(dir);
  add(rootCwd);
  add(cwd);
  for (const dir of byCwd.keys()) add(dir);
  return cwdOrder.map((dir) => {
    const group = byCwd.get(dir) ?? [];
    return {
      cwd: dir,
      pinned: sortByPinnedOrder(group.filter((session) => session.pinned && !session.archived), pinnedOrder),
      active: group.filter((session) => !session.archived && !session.pinned),
      archived: group.filter((session) => session.archived),
    };
  });
}

export function pinnedThreads(sessions: SessionSummary[], pinnedOrder?: string[]): SessionSummary[] {
  return sortByPinnedOrder(
    sessions.filter((session) => session.pinned && !session.archived),
    pinnedOrder,
  );
}

export function workspaceOrder(grouped: WorkspaceGroup[], cwd: string | undefined): string[] {
  const workspaces = grouped.map((group) => group.cwd);
  if (cwd && !workspaces.includes(cwd)) workspaces.push(cwd);
  return workspaces;
}

function sortByPinnedOrder(sessions: SessionSummary[], pinnedOrder: string[] | undefined): SessionSummary[] {
  const order = new Map((pinnedOrder ?? []).map((id, index) => [id, index] as const));
  return [...sessions].sort((left, right) => {
    const leftIndex = order.get(left.sessionId);
    const rightIndex = order.get(right.sessionId);
    if (leftIndex != null || rightIndex != null) {
      if (leftIndex == null) return 1;
      if (rightIndex == null) return -1;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    }
    return (right.updatedAt || "").localeCompare(left.updatedAt || "");
  });
}
