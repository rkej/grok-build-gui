import type { ExtensionDialog } from "../shared/protocol.js";

export function parseExtensionDialog(
  method: string,
  id: string | number | undefined,
  params: Record<string, any> | undefined | null,
): ExtensionDialog | null {
  if (id === undefined || id === null) return null;
  const requestId = Number(id);
  if (!Number.isFinite(requestId)) return null;
  const payload = params ?? {};
  let kind = String(payload.kind ?? payload.type ?? payload.dialogKind ?? "").toLowerCase();
  const looksLikeUi = /elicit|host.?ui|extension.?ui|request_ui|user_input|ask_user|session\/ui/i.test(method);
  if (!kind && looksLikeUi) {
    if (Array.isArray(payload.options) && payload.options.length) kind = "select";
    else if (payload.multiline === true || payload.language) kind = "editor";
    else if (payload.message && payload.placeholder == null && payload.input == null) kind = "confirm";
    else kind = "input";
  }
  if (kind !== "confirm" && kind !== "select" && kind !== "input" && kind !== "editor") return null;
  const title = String(payload.title ?? payload.heading ?? "Extension");
  if (kind === "confirm") {
    return { kind, requestId, title, message: String(payload.message ?? payload.body ?? payload.text ?? "") };
  }
  if (kind === "select") {
    const options = asStringOptions(payload.options);
    if (!options.length) return null;
    return { kind, requestId, title, options };
  }
  if (kind === "input") {
    return {
      kind,
      requestId,
      title,
      placeholder: typeof payload.placeholder === "string" ? payload.placeholder : undefined,
      initialValue: stringOrUndefined(payload.initialValue ?? payload.value),
    };
  }
  return {
    kind,
    requestId,
    title,
    initialValue: stringOrUndefined(payload.initialValue ?? payload.value ?? payload.text),
  };
}

function asStringOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((option) => {
      if (typeof option === "string") return option;
      if (option && typeof option === "object") {
        const row = option as Record<string, unknown>;
        const label = row.name ?? row.label ?? row.value ?? row.optionId ?? row.id;
        return typeof label === "string" ? label : "";
      }
      return "";
    })
    .filter((option) => option.length > 0);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
