/**
 * API client for communicating with the AgentXL server.
 */

const BASE = window.location.origin;

export interface ConfigStatus {
  authenticated: boolean;
  provider: string | null;
  version: string;
}

export async function getConfigStatus(): Promise<ConfigStatus> {
  const res = await fetch(`${BASE}/api/config/status`);
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json();
}

export interface ExcelContext {
  activeSheet?: string;
  selectedRange?: string;
}

/** Friendly display names for provider IDs. */
const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Claude",
  "openai-codex": "ChatGPT",
  openrouter: "OpenRouter",
  openai: "OpenAI",
  "github-copilot": "GitHub Copilot",
  "google-gemini-cli": "Gemini",
  "google-antigravity": "Antigravity",
};

/** Get a user-friendly provider name from the raw provider ID. */
export function getProviderLabel(provider: string | null): string {
  if (!provider) return "AI";
  return PROVIDER_LABELS[provider] ?? provider;
}

/**
 * Get current Excel context via Office.js (if available).
 */
export async function getExcelContext(): Promise<ExcelContext | undefined> {
  try {
    const win = window as any;
    if (typeof win.Excel === "undefined") return undefined;

    return await win.Excel.run(async (ctx: any) => {
      const sheet = ctx.workbook.worksheets.getActiveWorksheet();
      const range = ctx.workbook.getSelectedRange();
      sheet.load("name");
      range.load("address");
      await ctx.sync();
      return {
        activeSheet: sheet.name,
        selectedRange: range.address,
      };
    });
  } catch {
    return undefined;
  }
}

export interface SSEEvent {
  type: string;
  [key: string]: any;
}

/**
 * Send a message to the agent and stream SSE events back.
 *
 * @param message - User message text
 * @param context - Optional Excel context
 * @param onEvent - Callback for each SSE event
 * @param signal - AbortSignal for cancellation
 */
export async function streamAgent(
  message: string,
  context: ExcelContext | undefined,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${BASE}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE lines: "data: {...}\n\n"
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // Keep incomplete last line

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        try {
          const event = JSON.parse(trimmed.slice(6));
          onEvent(event);
        } catch {
          // Skip malformed events
        }
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim().startsWith("data: ")) {
    try {
      const event = JSON.parse(buffer.trim().slice(6));
      onEvent(event);
    } catch {
      // Skip
    }
  }
}
