/**
 * HTTP helpers — JSON responses, error responses, body parsing.
 *
 * Shared across all route handlers. No domain logic here.
 */

import { IncomingMessage, ServerResponse } from "http";

/** Send a JSON response with CORS headers. */
export function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** Send a JSON error response. */
export function sendError(
  res: ServerResponse,
  status: number,
  message: string
): void {
  sendJson(res, status, { error: message });
}

/** Read the full request body as a string. */
export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/** Parse JSON body, returning null on failure. */
export async function parseJsonBody(
  req: IncomingMessage
): Promise<unknown | null> {
  try {
    const raw = await readBody(req);
    return raw.length > 0 ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Send CORS preflight response. */
export function sendCorsPreflightResponse(res: ServerResponse): void {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });
  res.end();
}

/** Send 405 Method Not Allowed for a known route. */
export function sendMethodNotAllowed(
  res: ServerResponse,
  method: string,
  allowedMethod: string
): void {
  res.writeHead(405, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    Allow: allowedMethod,
  });
  res.end(
    JSON.stringify({
      error: `Method ${method} not allowed. Use ${allowedMethod}.`,
    })
  );
}
