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

export interface WorkbookIdentityInput {
  workbookName: string;
  workbookUrl?: string | null;
  host?: string | null;
  source?: string | null;
}

export interface WorkbookIdentity {
  workbookId: string;
}

export interface FolderStatus {
  workbookId: string;
  linked: boolean;
  folderPath?: string;
  totalFiles?: number;
  supportedFiles?: number;
  link?: {
    workbookId: string;
    folderPath: string;
    workbookName: string | null;
    workbookUrl: string | null;
    host: string | null;
    source: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export interface FolderPickResult {
  picked: boolean;
  folderPath: string | null;
}

function getWorkbookNameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\\/g, "/");
  const lastSegment = normalized.split("/").filter(Boolean).pop();
  return lastSegment && lastSegment.length > 0 ? lastSegment : null;
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

/**
 * Build workbook identity input for server-side workbook resolution.
 * In Excel, this uses Office.js context. In browser-only mode, it falls back
 * to a stable preview identity so the flow still works during development.
 */
export async function getWorkbookIdentityInput(): Promise<WorkbookIdentityInput> {
  const win = window as any;
  const office = win.Office;
  const workbookUrl =
    typeof office?.context?.document?.url === "string"
      ? office.context.document.url
      : null;
  let workbookName = getWorkbookNameFromUrl(workbookUrl);

  try {
    if (typeof win.Excel !== "undefined") {
      const excelName = await win.Excel.run(async (ctx: any) => {
        const workbook = ctx.workbook as any;
        if (typeof workbook.load === "function") {
          workbook.load("name");
          await ctx.sync();
        }
        return typeof workbook.name === "string" ? workbook.name : null;
      });

      if (typeof excelName === "string" && excelName.trim().length > 0) {
        workbookName = excelName.trim();
      }
    }
  } catch {
    // Ignore Office.js workbook-name failures — URL/browser fallback is enough.
  }

  return {
    workbookName: workbookName ?? document.title ?? "AgentXL Workbook",
    workbookUrl,
    host: typeof office?.context?.host === "string" ? office.context.host : "browser",
    source: typeof win.Excel !== "undefined" ? "excel-taskpane" : "browser-preview",
  };
}

export async function resolveWorkbookIdentity(
  input: WorkbookIdentityInput
): Promise<WorkbookIdentity> {
  const res = await fetch(`${BASE}/api/workbook/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Workbook resolve failed" }));
    throw new Error(body.error || `Workbook resolve failed: HTTP ${res.status}`);
  }

  return res.json();
}

export async function getFolderStatus(workbookId: string): Promise<FolderStatus> {
  const res = await fetch(
    `${BASE}/api/folder/status?workbookId=${encodeURIComponent(workbookId)}`
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Folder status failed" }));
    throw new Error(body.error || `Folder status failed: HTTP ${res.status}`);
  }

  return res.json();
}

export async function pickFolder(
  initialPath?: string | null
): Promise<FolderPickResult> {
  const res = await fetch(`${BASE}/api/folder/pick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initialPath: initialPath ?? null }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Folder picker failed" }));
    throw new Error(body.error || `Folder picker failed: HTTP ${res.status}`);
  }

  return res.json();
}

export async function selectFolder(
  workbookId: string,
  folderPath: string,
  identity: WorkbookIdentityInput
): Promise<FolderStatus> {
  const res = await fetch(`${BASE}/api/folder/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workbookId,
      folderPath,
      workbookName: identity.workbookName,
      workbookUrl: identity.workbookUrl ?? null,
      host: identity.host ?? null,
      source: identity.source ?? null,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Folder selection failed" }));
    throw new Error(body.error || `Folder selection failed: HTTP ${res.status}`);
  }

  return res.json();
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
 * @param workbookId - Optional workbook ID for folder context resolution
 * @param onEvent - Callback for each SSE event
 * @param signal - AbortSignal for cancellation
 */
export async function streamAgent(
  message: string,
  context: ExcelContext | undefined,
  workbookId: string | null,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${BASE}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context, workbookId }),
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
