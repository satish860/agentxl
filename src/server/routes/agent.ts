/**
 * Agent route — SSE streaming via Pi SDK session.
 *
 * Responsibilities:
 * - Validate agent request
 * - Resolve workbook/folder context
 * - Build prompt with context
 * - Stream SSE events to client
 * - Manage cwd for Pi SDK tools
 */

import { IncomingMessage, ServerResponse } from "http";
import { sendJson, sendError, parseJsonBody } from "../http.js";
import {
  isAuthenticated,
  getAuthProvider,
  getSession,
  abortSession,
} from "../../agent/session.js";
import { getWorkbookFolderLink } from "../workbook-folder-store.js";
import { loadInventory } from "../folder-scanner.js";
import { buildFolderContext } from "../../agent/prompt/folder-context.js";

// ---------------------------------------------------------------------------
// Agent request context resolution
// ---------------------------------------------------------------------------

interface AgentRequestContext {
  message: string;
  linkedFolderPath: string | null;
  contextParts: string[];
}

/**
 * Parse and validate the agent request body, resolve folder/Excel context.
 * Returns null if validation failed (error already sent to response).
 */
async function resolveAgentRequestContext(
  req: IncomingMessage,
  res: ServerResponse
): Promise<AgentRequestContext | null> {
  const body = await parseJsonBody(req);

  // Strict validation: message must be a non-empty string
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as Record<string, unknown>).message !== "string" ||
    ((body as Record<string, unknown>).message as string).trim().length === 0
  ) {
    sendError(res, 400, "Missing 'message' in request body");
    return null;
  }

  // Auth check
  if (!isAuthenticated()) {
    sendError(
      res,
      401,
      "Not authenticated. Run 'agentxl login' to set up credentials."
    );
    return null;
  }

  const b = body as Record<string, unknown>;
  const context = b.context as
    | { activeSheet?: string; selectedRange?: string }
    | undefined;
  const workbookId =
    typeof b.workbookId === "string" ? (b.workbookId as string).trim() : "";
  const message = (b.message as string).trim();

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
    if (context.activeSheet)
      excelParts.push(`Active sheet: ${context.activeSheet}`);
    if (context.selectedRange)
      excelParts.push(`Selected range: ${context.selectedRange}`);
    contextParts.push(`[Excel: ${excelParts.join(", ")}]`);
  }

  console.log(
    `[agent] workbookId=${workbookId || "(none)"} linkedFolder=${linkedFolderPath || "(none)"} cwd=${process.cwd()}`
  );

  return { message, linkedFolderPath, contextParts };
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

/** Combine context parts and user message into a full prompt. */
function buildAgentPrompt(contextParts: string[], message: string): string {
  return contextParts.length > 0
    ? `${contextParts.join("\n\n")}\n\n${message}`
    : message;
}

// ---------------------------------------------------------------------------
// Folder-scoped execution
// ---------------------------------------------------------------------------

/**
 * Run a function with process.cwd() temporarily set to the linked folder.
 *
 * Pi SDK's built-in tools (ls, read, grep, find) resolve paths against
 * process.cwd(). This ensures they operate on the user's documents,
 * not the AgentXL project root.
 *
 * Safe because Node.js is single-threaded — no concurrent cwd races.
 */
async function withLinkedFolderCwd<T>(
  folderPath: string | null,
  fn: () => Promise<T>
): Promise<T> {
  const originalCwd = process.cwd();

  if (folderPath) {
    try {
      process.chdir(folderPath);
      console.log(`[agent] chdir → ${process.cwd()}`);
    } catch (e) {
      console.error(`[agent] chdir failed: ${e}`);
    }
  } else {
    console.log(`[agent] no linked folder — staying in ${process.cwd()}`);
  }

  try {
    return await fn();
  } finally {
    try {
      process.chdir(originalCwd);
    } catch {
      // Best effort restore
    }
  }
}

// ---------------------------------------------------------------------------
// SSE stream runner
// ---------------------------------------------------------------------------

/**
 * Subscribe to session events and forward them as SSE to the HTTP response.
 * Handles client disconnect and prompt abort.
 */
async function runAgentStream(
  res: ServerResponse,
  req: IncomingMessage,
  fullMessage: string,
  linkedFolderPath: string | null
): Promise<void> {
  let unsubscribe: (() => void) | null = null;
  let completed = false;

  const cleanup = (): void => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  const sendSSE = (data: Record<string, unknown>): void => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  try {
    const session = await getSession(linkedFolderPath ?? undefined);

    // Subscribe to session events and stream them as SSE
    unsubscribe = session.subscribe((event) => {
      sendSSE(event as unknown as Record<string, unknown>);

      if (event.type === "agent_end") {
        completed = true;
        cleanup();
        if (!res.writableEnded) {
          res.end();
        }
      }
    });

    // Handle client disconnect mid-stream
    req.on("close", () => {
      if (!completed) {
        cleanup();
        abortSession();
      }
    });

    // Abort any in-flight prompt before sending the new one
    await abortSession();

    // Execute the prompt with cwd set to the linked folder
    await withLinkedFolderCwd(linkedFolderPath, () =>
      session.prompt(fullMessage)
    );
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
// Route handlers
// ---------------------------------------------------------------------------

/** POST /api/agent — SSE streaming agent endpoint. */
export async function handleAgent(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const ctx = await resolveAgentRequestContext(req, res);
  if (!ctx) return; // Validation error already sent

  const fullMessage = buildAgentPrompt(ctx.contextParts, ctx.message);

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  await runAgentStream(res, req, fullMessage, ctx.linkedFolderPath);
}

/** GET /api/config/status */
export function handleConfigStatus(
  _req: IncomingMessage,
  res: ServerResponse,
  getVersion: () => string
): void {
  sendJson(res, 200, {
    authenticated: isAuthenticated(),
    provider: getAuthProvider(),
    version: getVersion(),
  });
}
