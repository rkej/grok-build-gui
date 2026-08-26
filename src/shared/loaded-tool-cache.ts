/**
 * Caps hydrated tool payloads in the renderer (and any other LRU of the same
 * shape). Collapsed summaries stay compact; only the tools the user opened
 * keep diffs/output in RAM.
 */
export const MAX_LOADED_TOOL_PAYLOADS = 8;

export function putLoadedToolRecord<T>(
  current: Readonly<Record<string, T>>,
  id: string,
  value: T,
  limit = MAX_LOADED_TOOL_PAYLOADS,
): { next: Record<string, T>; evicted: string[] } {
  const next: Record<string, T> = { ...current };
  if (id in next) delete next[id];
  next[id] = value;
  const evicted: string[] = [];
  const keys = Object.keys(next);
  while (keys.length > limit) {
    const oldest = keys.shift();
    if (!oldest || oldest === id) break;
    delete next[oldest];
    evicted.push(oldest);
  }
  return { next, evicted };
}
