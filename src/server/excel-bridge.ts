/**
 * Excel execution bridge — bidirectional communication between
 * server-side tool execution and browser-side Office.js.
 *
 * Flow:
 * 1. Agent calls `excel` custom tool with Office.js code
 * 2. Tool execute() registers a pending execution and waits
 * 3. Pi SDK emits tool_execution_start SSE → taskpane receives it
 * 4. Taskpane runs the code inside Excel.run() via Office.js
 * 5. Taskpane POSTs result to /api/excel/result
 * 6. Bridge resolves the pending promise → tool returns result to agent
 */

/** Default timeout for Excel execution (ms). */
const DEFAULT_TIMEOUT_MS = 30_000;

interface PendingExecution {
  resolve: (result: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/** Map of toolCallId → pending execution promise. */
const pending = new Map<string, PendingExecution>();

/**
 * Register a pending Excel execution and return a promise that resolves
 * when the taskpane sends the result back.
 *
 * Called by the `excel` custom tool's execute function.
 */
export function registerPendingExecution(
  toolCallId: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(toolCallId);
      reject(
        new Error(
          `Excel execution timed out after ${timeoutMs / 1000}s. ` +
            `The taskpane may not be connected or Excel may be unresponsive.`
        )
      );
    }, timeoutMs);

    pending.set(toolCallId, { resolve, reject, timeout });
  });
}

/**
 * Resolve a pending execution with a successful result.
 * Called when the taskpane POSTs to /api/excel/result.
 *
 * @returns true if the execution was found and resolved.
 */
export function resolveExecution(
  toolCallId: string,
  result: string
): boolean {
  const entry = pending.get(toolCallId);
  if (!entry) return false;

  clearTimeout(entry.timeout);
  pending.delete(toolCallId);
  entry.resolve(result);
  return true;
}

/**
 * Reject a pending execution with an error.
 * Called when the taskpane reports an Office.js error.
 *
 * @returns true if the execution was found and rejected.
 */
export function rejectExecution(
  toolCallId: string,
  errorMessage: string
): boolean {
  const entry = pending.get(toolCallId);
  if (!entry) return false;

  clearTimeout(entry.timeout);
  pending.delete(toolCallId);
  entry.reject(new Error(`Excel error: ${errorMessage}`));
  return true;
}

/** Get count of pending executions (for diagnostics). */
export function getPendingCount(): number {
  return pending.size;
}

/** Clear all pending executions (for cleanup/testing). */
export function clearAllPending(): void {
  for (const [id, entry] of pending) {
    clearTimeout(entry.timeout);
    entry.reject(new Error("Cleared"));
  }
  pending.clear();
}
