/**
 * Static file serving for the taskpane UI.
 *
 * Serves pre-built React bundle from taskpane/dist/.
 * Includes SPA fallback and security checks.
 */

import { IncomingMessage, ServerResponse } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import { sendError } from "./http.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** MIME types for static file serving. */
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

/** Resolve the taskpane dist directory. */
export function resolveTaskpaneRoot(): string {
  const candidates = [
    join(__dirname, "..", "..", "taskpane", "dist"),
    join(__dirname, "..", "..", "..", "taskpane", "dist"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return join(__dirname, "..", "..", "taskpane", "dist");
}

/** Serve static files from the taskpane dist directory. */
export function handleTaskpane(
  req: IncomingMessage,
  res: ServerResponse,
  taskpaneRoot: string
): void {
  const url = req.url ?? "/";

  // Strip /taskpane prefix to get relative path
  let relativePath = url.replace(/^\/taskpane\/?/, "");
  relativePath = relativePath.split("?")[0];

  // Default to index.html
  if (relativePath === "" || relativePath === "/") {
    relativePath = "index.html";
  }

  const filePath = join(taskpaneRoot, relativePath);

  // Security: ensure resolved path is within taskpaneRoot
  if (!filePath.startsWith(taskpaneRoot)) {
    sendError(res, 403, "Forbidden");
    return;
  }

  if (!existsSync(filePath)) {
    // SPA fallback: serve index.html for non-file paths
    const indexPath = join(taskpaneRoot, "index.html");
    if (existsSync(indexPath) && !extname(relativePath)) {
      const content = readFileSync(indexPath);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": content.length,
        "Access-Control-Allow-Origin": "*",
      });
      res.end(content);
      return;
    }
    sendError(res, 404, "Not found");
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  const content = readFileSync(filePath);

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": content.length,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control":
      ext === ".html" ? "no-cache" : "public, max-age=31536000",
  });
  res.end(content);
}
