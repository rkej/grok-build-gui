export type SnapshotRevision = {
  instanceId: string | null;
  rev: number;
};

export function shouldApplySnapshot(current: SnapshotRevision, next: SnapshotRevision): boolean {
  return current.instanceId !== next.instanceId || next.rev >= current.rev;
}
