/**
 * Workbook identity resolution routes.
 */

import { IncomingMessage, ServerResponse } from "http";
import { sendJson, sendError, parseJsonBody } from "../http.js";
import { resolveWorkbookId } from "../workbook-identity.js";

/** POST /api/workbook/resolve */
export async function handleWorkbookResolve(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await parseJsonBody(req);

  if (!body || typeof body !== "object") {
    sendError(res, 400, "Missing workbook context in request body");
    return;
  }

  const b = body as Record<string, unknown>;
  const workbookName =
    typeof b.workbookName === "string" ? b.workbookName : null;
  const workbookUrl =
    typeof b.workbookUrl === "string" ? b.workbookUrl : null;
  const host = typeof b.host === "string" ? b.host : null;
  const source = typeof b.source === "string" ? b.source : null;

  if (
    (!workbookName || workbookName.trim().length === 0) &&
    (!workbookUrl || workbookUrl.trim().length === 0)
  ) {
    sendError(res, 400, "Missing workbookName or workbookUrl in request body");
    return;
  }

  const workbookId = resolveWorkbookId({
    workbookName,
    workbookUrl,
    host,
    source,
  });

  sendJson(res, 200, { workbookId });
}
