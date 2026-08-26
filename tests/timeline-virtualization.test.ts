import assert from "node:assert/strict";
import { test } from "node:test";
import type { DisplayTimelineItem } from "../src/renderer/timeline-turns.js";
import { initialTimelineViewport } from "../src/renderer/timeline-virtualization.js";

test("a virtualized transcript initializes at its estimated bottom", () => {
  const items: DisplayTimelineItem[] = Array.from({ length: 100 }, (_, index) => ({
    id: `message-${index}`,
    kind: "assistant",
    text: `answer ${index}`,
    at: index,
  }));
  const viewport = initialTimelineViewport(items, 800, 14);
  assert.equal(viewport.height, 800);
  assert.ok(viewport.scrollTop > 0);
});

test("a short transcript still initializes at the top", () => {
  const items: DisplayTimelineItem[] = [{ id: "message", kind: "assistant", text: "answer", at: 1 }];
  assert.equal(initialTimelineViewport(items, 800, 14).scrollTop, 0);
});
