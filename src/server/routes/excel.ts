/**
 * Excel bridge route — receives execution results from the taskpane.
 *
 * POST /api/excel/result
 * Body: { toolCallId: string, result?: string, error?: string }
 */

import { IncomingMessage, ServerResponse } from "http";
import { sendJson, sendError, parseJsonBody } from "../http.js";
import { resolveExecution, rejectExecution } from "../excel-bridge.js";

/** POST /api/excel/result — taskpane sends Office.js execution result. */
export async function handleExcelResult(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await parseJsonBody(req);

  if (!body || typeof body !== "object") {
    sendError(res, 400, "Missing request body");
    return;
  }

  const b = body as Record<string, unknown>;
  const toolCallId =
    typeof b.toolCallId === "string" ? b.toolCallId.trim() : "";

  if (!toolCallId) {
    sendError(res, 400, "Missing toolCallId");
    return;
  }

  // Handle error result
  if (typeof b.error === "string") {
    const found = rejectExecution(toolCallId, b.error);
    if (!found) {
      sendError(res, 404, "No pending execution found for this toolCallId");
      return;
    }
    sendJson(res, 200, { ok: true, toolCallId, resolved: false });
    return;
  }

  // Handle success result
  const result = typeof b.result === "string" ? b.result : JSON.stringify(b.result ?? null);
  const found = resolveExecution(toolCallId, result);
  if (!found) {
    sendError(res, 404, "No pending execution found for this toolCallId");
    return;
  }

  sendJson(res, 200, { ok: true, toolCallId, resolved: true });
}
