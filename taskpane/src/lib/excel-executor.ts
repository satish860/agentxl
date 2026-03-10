/**
 * Excel executor — runs Office.js code from the agent in the active workbook.
 *
 * When the agent calls the `excel` tool, this module:
 * 1. Receives the code from the tool_execution_start SSE event
 * 2. Wraps and executes it inside Excel.run()
 * 3. POSTs the result (or error) back to /api/excel/result
 *
 * The server-side tool is waiting for this result before returning to the agent.
 */

const BASE = window.location.origin;

/**
 * Execute Office.js code in the active workbook and send the result
 * back to the server.
 *
 * @param toolCallId - The stable tool call ID for result matching
 * @param code - Office.js code to execute inside Excel.run()
 */
export async function executeExcelCode(
  toolCallId: string,
  code: string
): Promise<void> {
  try {
    const win = window as unknown as Record<string, unknown>;

    if (typeof win.Excel === "undefined") {
      await postResult(toolCallId, {
        error: "Excel is not available. The taskpane must be running inside Excel.",
      });
      return;
    }

    const Excel = win.Excel as any;

    // Guard against unsupported pseudo-APIs that fail silently.
    if (/\.\s*note\s*=/.test(code)) {
      await postResult(toolCallId, {
        error:
          "Unsupported Office.js pattern: `range.note` / `cell.note` does not create a visible Excel comment in this runtime. " +
          "Use `worksheet.comments.add(cellAddress, content)` instead, and delete any existing comment first if needed.",
      });
      return;
    }

    // Execute the code inside Excel.run()
    const result = await Excel.run(async (context: any) => {
      // Create an async function from the code string.
      // The code has access to `context` (Excel.RequestContext).
      const fn = new Function(
        "context",
        `return (async () => { ${code} })()`
      );
      return await fn(context);
    });

    // Serialize the result
    let resultStr: string;
    if (result === undefined || result === null) {
      resultStr = "Done (no return value)";
    } else if (typeof result === "string") {
      resultStr = result;
    } else {
      resultStr = JSON.stringify(result, null, 2);
    }

    await postResult(toolCallId, { result: resultStr });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    await postResult(toolCallId, { error: message });
  }
}

/** POST result back to the server's excel bridge. */
async function postResult(
  toolCallId: string,
  payload: { result?: string; error?: string }
): Promise<void> {
  try {
    await fetch(`${BASE}/api/excel/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolCallId, ...payload }),
    });
  } catch (err) {
    console.error("[excel-executor] Failed to POST result:", err);
  }
}
