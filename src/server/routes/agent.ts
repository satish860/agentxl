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
// Session event logging
// ---------------------------------------------------------------------------

function lastAssistantSummary(messages: unknown): string | null {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const last = messages[messages.length - 1] as Record<string, unknown> | undefined;
  if (!last || last.role !== "assistant") return null;
  const stop = last.stopReason as string | undefined;
  const err = last.errorMessage as string | undefined;
  if (err) return `stop=${stop ?? "?"} err="${err.slice(0, 200)}"`;
  if (stop && stop !== "stop") return `stop=${stop}`;
  return null;
}

function logSessionEvent(event: unknown): void {
  if (!event || typeof event !== "object") return;
  const e = event as Record<string, unknown>;
  const type = e.type as string;

  switch (type) {
    case "agent_start":
      console.log(`[agent] agent_start`);
      return;

    case "tool_execution_start":
    case "tool_execution_end": {
      const toolName = e.toolName as string;
      const toolCallId = e.toolCallId as string;
      const isError = e.isError as boolean | undefined;
      console.log(
        `[agent] ${type} tool=${toolName ?? "?"} id=${toolCallId ?? "?"}` +
          (type === "tool_execution_end" && isError ? " ERROR" : "")
      );
      return;
    }

    case "agent_end": {
      const messages = e.messages as unknown[] | undefined;
      const summary = lastAssistantSummary(messages);
      console.log(
        `[agent] agent_end messages=${messages?.length ?? 0}` +
          (summary ? ` ${summary}` : "")
      );
      return;
    }

    case "auto_compaction_start":
      console.log(`[agent] auto_compaction_start reason=${e.reason}`);
      return;

    case "auto_compaction_end":
      console.log(
        `[agent] auto_compaction_end aborted=${e.aborted}` +
          (e.errorMessage ? ` error=${e.errorMessage}` : "")
      );
      return;

    case "auto_retry_start":
      console.log(
        `[agent] auto_retry_start attempt=${e.attempt}/${e.maxAttempts} err=${e.errorMessage}`
      );
      return;

    case "error":
      console.log(`[agent] error ${JSON.stringify(e).slice(0, 500)}`);
      return;

    default:
      return;
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
    let sawAssistantContent = false;
    unsubscribe = session.subscribe((event) => {
      logSessionEvent(event);

      // Track whether the assistant produced anything we can show
      const e = event as Record<string, unknown>;
      if (e.type === "message_update") {
        const ame = e.assistantMessageEvent as Record<string, unknown> | undefined;
        const t = ame?.type as string | undefined;
        if (
          t === "text_delta" ||
          t === "text_start" ||
          t === "thinking_delta" ||
          t === "thinking_start" ||
          t === "toolcall_start"
        ) {
          sawAssistantContent = true;
        }
      } else if (e.type === "tool_execution_start") {
        sawAssistantContent = true;
      }

      sendSSE(event as unknown as Record<string, unknown>);

      if (event.type === "agent_end") {
        if (!sawAssistantContent) {
          console.log(
            "[agent] EMPTY response — model returned no text/thinking/tool calls. " +
              "Likely causes: deprecated model id or provider quota / billing issue."
          );
          sendSSE({
            type: "error",
            error:
              "The model returned an empty response. Check the server console — the configured model id may be deprecated or the provider returned no content.",
          });
        }
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
  const ctxBytes = ctx.contextParts.reduce((n, p) => n + p.length, 0);
  console.log(
    `[agent] prompt msg=${ctx.message.length}b context=${ctxBytes}b parts=${ctx.contextParts.length} total=${fullMessage.length}b`
  );

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
