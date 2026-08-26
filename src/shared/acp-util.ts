/**
 * Tiny helpers for Grok ACP payloads. The harness wraps some results
 * in `{ result }` and sometimes returns a bare value.
 */

export function unwrap<T = unknown>(result: unknown): T {
  if (result && typeof result === "object" && "result" in result && (result as { result?: unknown }).result !== undefined) {
    return (result as { result: T }).result;
  }
  return result as T;
}

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
