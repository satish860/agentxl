import { createServer } from "https";
import { IncomingMessage, ServerResponse } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import { ensureCerts, type CertPair } from "./certs.js";
import {
  isAuthenticated,
  getAuthProvider,
  getSession,
  abortSession,
} from "../agent/session.js";
import { resolveWorkbookId } from "./workbook-identity.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// MIME types for static file serving
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the full request body as a string. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/** Parse JSON body, returning null on failure. */
async function parseJsonBody(req: IncomingMessage): Promise<any | null> {
  try {
    const raw = await readBody(req);
    return raw.length > 0 ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Send a JSON response. */
function sendJson(
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

/** Send a plain-text error. */
function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

/** Get package version from package.json. */
function getVersion(): string {
  try {
    // Walk up from dist/server/ or src/server/ to find package.json
    const candidates = [
      join(__dirname, "..", "..", "package.json"), // dist/server -> root
      join(__dirname, "..", "..", "..", "package.json"),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        const pkg = JSON.parse(readFileSync(p, "utf-8"));
        return pkg.version ?? "0.0.0";
      }
    }
    return "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// ---------------------------------------------------------------------------
// Route: GET /taskpane/* — static file serving
// ---------------------------------------------------------------------------

function resolveTaskpaneRoot(): string {
  // From dist/server/ → ../../taskpane/dist
  const candidates = [
    join(__dirname, "..", "..", "taskpane", "dist"),
    join(__dirname, "..", "..", "..", "taskpane", "dist"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Fallback — may not exist yet
  return join(__dirname, "..", "..", "taskpane", "dist");
}

function handleTaskpane(
  req: IncomingMessage,
  res: ServerResponse,
  taskpaneRoot: string
): void {
  const url = req.url ?? "/";

  // Strip /taskpane prefix to get relative path
  let relativePath = url.replace(/^\/taskpane\/?/, "");

  // Remove query string
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
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
  });
  res.end(content);
}

// ---------------------------------------------------------------------------
// Route: GET /api/version
// ---------------------------------------------------------------------------

function handleVersion(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, { version: getVersion() });
}

// ---------------------------------------------------------------------------
// Route: POST /api/workbook/resolve
// ---------------------------------------------------------------------------

async function handleWorkbookResolve(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await parseJsonBody(req);

  if (!body || typeof body !== "object") {
    sendError(res, 400, "Missing workbook context in request body");
    return;
  }

  const workbookName =
    typeof body.workbookName === "string" ? body.workbookName : null;
  const workbookUrl =
    typeof body.workbookUrl === "string" ? body.workbookUrl : null;
  const host = typeof body.host === "string" ? body.host : null;
  const source = typeof body.source === "string" ? body.source : null;

  if ((!workbookName || workbookName.trim().length === 0) && (!workbookUrl || workbookUrl.trim().length === 0)) {
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

// ---------------------------------------------------------------------------
// Route: POST /api/agent — SSE streaming via Pi SDK session
// ---------------------------------------------------------------------------

async function handleAgent(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await parseJsonBody(req);

  // Strict validation: message must be a non-empty string
  if (
    !body ||
    typeof body.message !== "string" ||
    body.message.trim().length === 0
  ) {
    sendError(res, 400, "Missing 'message' in request body");
    return;
  }

  // Auth check
  if (!isAuthenticated()) {
    sendError(
      res,
      401,
      "Not authenticated. Run 'agentxl login' to set up credentials."
    );
    return;
  }

  // Build message with optional Excel context
  const context = body.context as
    | { activeSheet?: string; selectedRange?: string }
    | undefined;
  const message: string = body.message.trim();
  let fullMessage: string = message;
  if (context && (context.activeSheet || context.selectedRange)) {
    const parts: string[] = [];
    if (context.activeSheet) parts.push(`Active sheet: ${context.activeSheet}`);
    if (context.selectedRange)
      parts.push(`Selected range: ${context.selectedRange}`);
    fullMessage = `[Context: ${parts.join(", ")}]\n\n${message}`;
  }

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  /** Write an SSE event to the response stream. */
  const sendSSE = (data: Record<string, unknown>): void => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  let unsubscribe: (() => void) | null = null;
  let completed = false;

  /** Clean up subscription. */
  const cleanup = (): void => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  try {
    const session = await getSession();

    // Subscribe to session events and stream them as SSE
    unsubscribe = session.subscribe((event) => {
      // Forward all events to the client
      sendSSE(event as unknown as Record<string, unknown>);

      // Close the stream when the agent finishes
      if (event.type === "agent_end") {
        completed = true;
        cleanup();
        if (!res.writableEnded) {
          res.end();
        }
      }
    });

    // Handle client disconnect mid-stream.
    // `close` fires on any request lifecycle end — only abort if the
    // prompt hasn't completed normally yet.
    req.on("close", () => {
      if (!completed) {
        cleanup();
        // Abort the in-flight LLM call to stop wasting tokens
        abortSession();
      }
    });

    // Send the prompt
    await session.prompt(fullMessage);
  } catch (err) {
    completed = true;
    cleanup();
    const errMessage = err instanceof Error ? err.message : String(err);
    sendSSE({ type: "error", error: errMessage });
    if (!res.writableEnded) {
      res.end();
    }
  }
}

// ---------------------------------------------------------------------------
// Route: GET /api/config/status
// ---------------------------------------------------------------------------

function handleConfigStatus(
  _req: IncomingMessage,
  res: ServerResponse
): void {
  sendJson(res, 200, {
    authenticated: isAuthenticated(),
    provider: getAuthProvider(),
    version: getVersion(),
  });
}

// ---------------------------------------------------------------------------
// Known API routes (for 405 detection)
// ---------------------------------------------------------------------------

const API_ROUTES: Record<string, string> = {
  "/api/version": "GET",
  "/api/workbook/resolve": "POST",
  "/api/agent": "POST",
  "/api/config/status": "GET",
};

// ---------------------------------------------------------------------------
// Request router
// ---------------------------------------------------------------------------

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  taskpaneRoot: string
): Promise<void> {
  const method = req.method ?? "GET";
  const rawUrl = req.url ?? "/";

  // Strip query string for route matching
  const url = rawUrl.split("?")[0];

  // Handle CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  // Route matching
  if (url.startsWith("/taskpane")) {
    handleTaskpane(req, res, taskpaneRoot);
    return;
  }

  if (url === "/api/version" && method === "GET") {
    handleVersion(req, res);
    return;
  }

  if (url === "/api/workbook/resolve" && method === "POST") {
    await handleWorkbookResolve(req, res);
    return;
  }

  if (url === "/api/agent" && method === "POST") {
    await handleAgent(req, res);
    return;
  }

  if (url === "/api/config/status" && method === "GET") {
    handleConfigStatus(req, res);
    return;
  }

  // 405 Method Not Allowed for known routes with wrong method
  if (url in API_ROUTES) {
    res.writeHead(405, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      Allow: API_ROUTES[url],
    });
    res.end(JSON.stringify({ error: `Method ${method} not allowed. Use ${API_ROUTES[url]}.` }));
    return;
  }

  // Root redirect to taskpane
  if (url === "/" || url === "") {
    res.writeHead(302, { Location: "/taskpane/" });
    res.end();
    return;
  }

  sendError(res, 404, "Not found");
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let serverInstance: ReturnType<typeof createServer> | null = null;
let verbose = false;

/** Enable or disable request logging. */
export function setVerbose(enabled: boolean): void {
  verbose = enabled;
}

/**
 * Start the HTTPS server.
 *
 * @param port - Port to listen on (default: 3001)
 * @param certs - Optional pre-loaded certificates. If not provided, will call ensureCerts().
 */
export async function startServer(
  port: number = 3001,
  certs?: CertPair
): Promise<void> {
  const { key, cert } = certs ?? (await ensureCerts());
  const taskpaneRoot = resolveTaskpaneRoot();

  const server = createServer({ key, cert }, (req, res) => {
    const start = Date.now();
    handleRequest(req, res, taskpaneRoot)
      .then(() => {
        if (verbose) {
          const ms = Date.now() - start;
          console.log(`${req.method} ${req.url} → ${res.statusCode} (${ms}ms)`);
        }
      })
      .catch((err) => {
        console.error("Unhandled request error:", err);
        if (!res.headersSent) {
          sendError(res, 500, "Internal server error");
        }
      });
  });

  serverInstance = server;

  return new Promise<void>((resolve, reject) => {
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use. ` +
              `Is another instance of AgentXL running?\n` +
              `   Try: agentxl start --port ${port + 1}`
          )
        );
      } else {
        reject(err);
      }
    });

    server.listen(port, "127.0.0.1", () => {
      resolve();
    });
  });
}

/**
 * Stop the HTTPS server gracefully.
 */
export async function stopServer(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!serverInstance) {
      resolve();
      return;
    }
    serverInstance.close(() => {
      serverInstance = null;
      resolve();
    });
  });
}


