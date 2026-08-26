import type { PermissionMode, PermissionRequest } from "../shared/protocol.js";

export function pickAllowOption(options: PermissionRequest["options"]): string | null {
  const always = options.find((option) =>
    option.kind === "allow_always" || /always|yolo|bypass/i.test(`${option.optionId} ${option.name}`),
  );
  if (always) return always.optionId;
  const once = options.find((option) =>
    option.kind === "allow_once" || option.kind === "allow" || /allow|approve|yes/i.test(`${option.optionId} ${option.name}`),
  );
  if (once) return once.optionId;
  return options[0]?.optionId ?? null;
}

/**
 * `always-approve` / yolo: allow everything.
 * `auto`: allow read-ish tools only (search, grep, glob, web fetch, …).
 * `ask` / `plan`: never auto-approve.
 */
export function shouldAutoApprove(
  request: PermissionRequest,
  opts: { yoloArmed: boolean; permissionMode: PermissionMode; currentModeId: string | null },
): boolean {
  if (opts.yoloArmed || opts.permissionMode === "always-approve") return true;
  if (opts.permissionMode !== "auto" && opts.currentModeId !== "auto") return false;
  const title = `${request.toolCall.title} ${request.toolCall.name ?? ""} ${request.toolCall.kind ?? ""}`.toLowerCase();
  return /read|search|grep|glob|list|ls|stat|info|web_search|web_fetch/.test(title);
}
