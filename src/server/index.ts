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
import {
  getWorkbookFolderLink,
  setWorkbookFolderLink,
} from "./workbook-folder-store.js";
import { pickLocalFolder } from "./folder-picker.js";
import { scanAndSaveInventory, loadInventory, type FolderInventory, type FileEntry } from "./folder-scanner.js";

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
// Route: GET /api/folder/status
// ---------------------------------------------------------------------------

function handleFolderStatus(
  req: IncomingMessage,
  res: ServerResponse
): void {
  const rawUrl = req.url ?? "/";
  const url = new URL(rawUrl, "https://localhost");
  const workbookId = url.searchParams.get("workbookId")?.trim();

  if (!workbookId) {
    sendError(res, 400, "Missing workbookId query parameter");
    return;
  }

  const link = getWorkbookFolderLink(workbookId);
  if (!link) {
    sendJson(res, 200, {
      workbookId,
      linked: false,
    });
    return;
  }

  const inventory = loadInventory(workbookId);
  sendJson(res, 200, {
    workbookId,
    linked: true,
    folderPath: link.folderPath,
    link,
    ...(inventory
      ? {
          totalFiles: inventory.totalFiles,
          supportedFiles: inventory.supportedFiles,
        }
      : {}),
  });
}

// ---------------------------------------------------------------------------
// Route: POST /api/folder/pick
// ---------------------------------------------------------------------------

async function handleFolderPick(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await parseJsonBody(req);
    const initialPath =
      body && typeof body === "object" && typeof body.initialPath === "string"
        ? body.initialPath
        : null;

    const folderPath = await pickLocalFolder(initialPath);
    sendJson(res, 200, {
      picked: Boolean(folderPath),
      folderPath,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to open native folder picker";
    const status = message.toLowerCase().includes("timed out") ? 504 : 500;

    sendError(res, status, message);
  }
}

// ---------------------------------------------------------------------------
// Route: POST /api/folder/select
// ---------------------------------------------------------------------------

async function handleFolderSelect(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await parseJsonBody(req);

  if (!body || typeof body !== "object") {
    sendError(res, 400, "Missing folder selection payload");
    return;
  }

  const workbookId =
    typeof body.workbookId === "string" ? body.workbookId.trim() : "";
  const folderPath =
    typeof body.folderPath === "string" ? body.folderPath.trim() : "";

  if (!workbookId) {
    sendError(res, 400, "Missing workbookId in request body");
    return;
  }

  if (!folderPath) {
    sendError(res, 400, "Missing folderPath in request body");
    return;
  }

  try {
    const link = setWorkbookFolderLink({
      workbookId,
      folderPath,
      workbookName:
        typeof body.workbookName === "string" ? body.workbookName : null,
      workbookUrl:
        typeof body.workbookUrl === "string" ? body.workbookUrl : null,
      host: typeof body.host === "string" ? body.host : null,
      source: typeof body.source === "string" ? body.source : null,
    });

    // Auto-scan the folder on link/update
    let inventory = null;
    try {
      inventory = scanAndSaveInventory(workbookId, link.folderPath);
    } catch {
      // Scan failure is non-fatal — folder is still linked
    }

    sendJson(res, 200, {
      workbookId,
      linked: true,
      folderPath: link.folderPath,
      link,
      ...(inventory
        ? {
            totalFiles: inventory.totalFiles,
            supportedFiles: inventory.supportedFiles,
          }
        : {}),
    });
  } catch (error) {
    sendError(
      res,
      400,
      error instanceof Error ? error.message : "Failed to save folder mapping"
    );
  }
}

// ---------------------------------------------------------------------------
// Route: GET /api/folder/files
// ---------------------------------------------------------------------------

function handleFolderFiles(
  req: IncomingMessage,
  res: ServerResponse
): void {
  const rawUrl = req.url ?? "/";
  const url = new URL(rawUrl, "https://localhost");
  const workbookId = url.searchParams.get("workbookId")?.trim();

  if (!workbookId) {
    sendError(res, 400, "Missing workbookId query parameter");
    return;
  }

  const link = getWorkbookFolderLink(workbookId);
  if (!link) {
    sendError(res, 404, "No folder linked for this workbook. Link a folder first.");
    return;
  }

  const inventory = loadInventory(workbookId);
  if (!inventory) {
    sendError(res, 404, "No inventory available. Refresh the folder to scan files.");
    return;
  }

  sendJson(res, 200, {
    workbookId,
    folderPath: inventory.folderPath,
    scannedAt: inventory.scannedAt,
    totalFiles: inventory.totalFiles,
    supportedFiles: inventory.supportedFiles,
    files: inventory.files,
  });
}

// ---------------------------------------------------------------------------
// Route: POST /api/folder/refresh
// ---------------------------------------------------------------------------

async function handleFolderRefresh(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await parseJsonBody(req);

  if (!body || typeof body !== "object") {
    sendError(res, 400, "Missing request body");
    return;
  }

  const workbookId =
    typeof body.workbookId === "string" ? body.workbookId.trim() : "";

  if (!workbookId) {
    sendError(res, 400, "Missing workbookId in request body");
    return;
  }

  const link = getWorkbookFolderLink(workbookId);
  if (!link) {
    sendError(res, 404, "No folder linked for this workbook. Link a folder first.");
    return;
  }

  try {
    const inventory = scanAndSaveInventory(workbookId, link.folderPath);
    sendJson(res, 200, {
      workbookId,
      folderPath: inventory.folderPath,
      scannedAt: inventory.scannedAt,
      totalFiles: inventory.totalFiles,
      supportedFiles: inventory.supportedFiles,
    });
  } catch (error) {
    sendError(
      res,
      500,
      error instanceof Error ? error.message : "Failed to scan folder"
    );
  }
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
// Folder context builder
// ---------------------------------------------------------------------------

/** Max supported files to list individually in context. */
const MAX_FILES_IN_CONTEXT = 50;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Build a folder context block to prepend to the agent message.
 * Gives the agent awareness of what files are available.
 */
function buildFolderContext(
  folderPath: string,
  inventory: FolderInventory
): string {
  const lines: string[] = [];

  lines.push("[AgentXL Context]");
  lines.push("");
  lines.push(
    "You are AgentXL, a document-to-Excel agent. The user's source documents are in the linked folder below."
  );
  lines.push(
    "Ground every answer in these files. Cite the source file when you reference a value."
  );
  lines.push(
    "If the folder does not contain enough evidence, say so. Do not fabricate data."
  );
  lines.push("");
  lines.push("IMPORTANT: All file operations MUST use absolute paths under the linked folder.");
  lines.push(`The linked folder is: ${folderPath}`);
  lines.push("Do NOT use relative paths. Do NOT read files from the current working directory.");
  lines.push(`When the user asks about files, they mean files in: ${folderPath}`);
  lines.push(
    `${inventory.supportedFiles} supported file${inventory.supportedFiles !== 1 ? "s" : ""}, ${inventory.totalFiles} total`
  );

  const supported = inventory.files.filter((f) => f.supported);
  const unsupported = inventory.files.filter((f) => !f.supported);

  if (supported.length > 0) {
    lines.push("");
    lines.push("Supported files (you can read these):");
    const shown = supported.slice(0, MAX_FILES_IN_CONTEXT);
    for (const f of shown) {
      lines.push(`- ${f.relativePath} (${formatFileSize(f.sizeBytes)})`);
    }
    if (supported.length > MAX_FILES_IN_CONTEXT) {
      lines.push(
        `  ... and ${supported.length - MAX_FILES_IN_CONTEXT} more supported files`
      );
    }
  }

  if (unsupported.length > 0) {
    lines.push("");
    const unsupportedNames = unsupported
      .slice(0, 10)
      .map((f) => f.name)
      .join(", ");
    const suffix =
      unsupported.length > 10
        ? ` and ${unsupported.length - 10} more`
        : "";
    lines.push(
      `Unsupported files (cannot read): ${unsupportedNames}${suffix}`
    );
  }

  lines.push("");
  lines.push("How to access files:");
  lines.push(
    `- To list files: ls "${folderPath}"`
  );
  if (supported.length > 0) {
    const example = supported[0];
    lines.push(
      `- To read a file: read "${example.absolutePath}"`
    );
  }
  lines.push(
    `- To search: grep with path "${folderPath}"`
  );
  lines.push("Always use the FULL ABSOLUTE PATH shown above. Never use \".\" or relative paths.");

  return lines.join("\n");
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

  // Build message with folder + Excel context
  const context = body.context as
    | { activeSheet?: string; selectedRange?: string }
    | undefined;
  const workbookId =
    typeof body.workbookId === "string" ? body.workbookId.trim() : "";
  const message: string = body.message.trim();

  // Resolve folder context from workbookId
  const contextParts: string[] = [];
  let linkedFolderPath: string | null = null;

  if (workbookId) {
    const link = getWorkbookFolderLink(workbookId);
    if (link) {
      linkedFolderPath = link.folderPath;
      const inventory = loadInventory(workbookId);
      if (inventory) {
        contextParts.push(buildFolderContext(link.folderPath, inventory));
      } else {
        contextParts.push(
          `[Linked folder: ${link.folderPath}]\n[No file inventory available — folder has not been scanned yet]`
        );
      }
    }
  }

  // Add Excel context
  if (context && (context.activeSheet || context.selectedRange)) {
    const excelParts: string[] = [];
    if (context.activeSheet) excelParts.push(`Active sheet: ${context.activeSheet}`);
    if (context.selectedRange)
      excelParts.push(`Selected range: ${context.selectedRange}`);
    contextParts.push(`[Excel: ${excelParts.join(", ")}]`);
  }

  const fullMessage =
    contextParts.length > 0
      ? `${contextParts.join("\n\n")}\n\n${message}`
      : message;

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
    console.log(`[agent] workbookId=${workbookId || "(none)"} linkedFolder=${linkedFolderPath || "(none)"} cwd=${process.cwd()}`);

    const session = await getSession(linkedFolderPath ?? undefined);

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

    // Abort any in-flight prompt before sending the new one.
    // Pi SDK rejects concurrent prompts — this ensures a clean slate.
    await abortSession();

    // Change working directory to the linked folder so Pi SDK tools
    // (ls, read, grep, find) operate on the user's documents, not
    // the AgentXL project root. Safe because Node.js is single-threaded.
    const originalCwd = process.cwd();
    if (linkedFolderPath) {
      try {
        process.chdir(linkedFolderPath);
        console.log(`[agent] chdir → ${process.cwd()}`);
      } catch (e) {
        console.error(`[agent] chdir failed: ${e}`);
      }
    } else {
      console.log(`[agent] no linked folder — staying in ${process.cwd()}`);
    }

    try {
      // Send the prompt
      await session.prompt(fullMessage);
    } finally {
      // Restore original cwd
      try {
        process.chdir(originalCwd);
      } catch {
        // Best effort restore
      }
    }
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
  "/api/folder/status": "GET",
  "/api/folder/pick": "POST",
  "/api/folder/select": "POST",
  "/api/folder/files": "GET",
  "/api/folder/refresh": "POST",
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

  if (url === "/api/folder/status" && method === "GET") {
    handleFolderStatus(req, res);
    return;
  }

  if (url === "/api/folder/pick" && method === "POST") {
    await handleFolderPick(req, res);
    return;
  }

  if (url === "/api/folder/select" && method === "POST") {
    await handleFolderSelect(req, res);
    return;
  }

  if (url === "/api/folder/files" && method === "GET") {
    handleFolderFiles(req, res);
    return;
  }

  if (url === "/api/folder/refresh" && method === "POST") {
    await handleFolderRefresh(req, res);
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


