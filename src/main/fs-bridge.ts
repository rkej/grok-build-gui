import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AcpMethod } from "../acp/methods.js";
import type { GrokAcpClient } from "../acp/client.js";
import type { JsonRpcId } from "../acp/rpc.js";

/**
 * ACP `fs/*` requests come from the Grok child, which already has local
 * filesystem access via its own tools. Honor them so the protocol stays
 * complete; do not expose this path to the renderer.
 */
export function tryHandleFsRequest(
  method: string,
  id: JsonRpcId,
  params: Record<string, any> | undefined,
  client: GrokAcpClient,
): boolean {
  if (method === AcpMethod.FsReadTextFile) {
    const filePath = params?.path;
    try {
      const text = typeof filePath === "string" ? readFileSync(filePath, "utf8") : "";
      client.respond(id, { content: text });
    } catch {
      client.respond(id, { content: "" });
    }
    return true;
  }
  if (method === AcpMethod.FsWriteTextFile) {
    try {
      if (typeof params?.path === "string") {
        mkdirSync(path.dirname(params.path), { recursive: true });
        writeFileSync(params.path, params.content ?? "");
      }
      client.respond(id, {});
    } catch {
      client.respond(id, {});
    }
    return true;
  }
  return false;
}
