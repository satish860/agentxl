/**
 * AgentXL HTTPS server — thin wiring layer.
 *
 * Responsibilities:
 * - Server lifecycle (start, stop)
 * - Route dispatch
 * - Version resolution
 *
 * All handler logic lives in:
 * - src/server/routes/agent.ts
 * - src/server/routes/folder.ts
 * - src/server/routes/workbook.ts
 * - src/server/static.ts
 */

import { createServer } from "https";
import { IncomingMessage, ServerResponse } from "http";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ensureCerts, type CertPair } from "./certs.js";
import {
  sendError,
  sendJson,
  sendCorsPreflightResponse,
  sendMethodNotAllowed,
} from "./http.js";
import { resolveTaskpaneRoot, handleTaskpane } from "./static.js";
import { handleWorkbookResolve } from "./routes/workbook.js";
import {
  handleFolderStatus,
  handleFolderPick,
  handleFolderSelect,
  handleFolderFiles,
  handleFolderRefresh,
} from "./routes/folder.js";
import { handleAgent, handleConfigStatus } from "./routes/agent.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

/** Get package version from package.json. */
function getVersion(): string {
  try {
    const candidates = [
      join(__dirname, "..", "..", "package.json"),
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
  const url = rawUrl.split("?")[0];

  // CORS preflight
  if (method === "OPTIONS") {
    sendCorsPreflightResponse(res);
    return;
  }

  // Static files
  if (url.startsWith("/taskpane")) {
    handleTaskpane(req, res, taskpaneRoot);
    return;
  }

  // API routes
  if (url === "/api/version" && method === "GET") {
    sendJson(res, 200, { version: getVersion() });
    return;
  }

  if (url === "/api/config/status" && method === "GET") {
    handleConfigStatus(req, res, getVersion);
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

  // 405 for known routes with wrong method
  if (url in API_ROUTES) {
    sendMethodNotAllowed(res, method, API_ROUTES[url]);
    return;
  }

  // Root redirect
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
 * @param certs - Optional pre-loaded certificates.
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
          console.log(
            `${req.method} ${req.url} → ${res.statusCode} (${ms}ms)`
          );
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

/** Stop the HTTPS server gracefully. */
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
