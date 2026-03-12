/**
 * API client for communicating with the AgentXL server.
 *
 * Organized by domain:
 * - Config (auth status)
 * - Workbook identity
 * - Folder linking/scanning
 * - Agent streaming
 *
 * Office.js access is delegated to office-adapter.ts.
 */

import {
  readExcelContext,
  readWorkbookIdentityInput,
  getWorkbookNameFromUrl,
} from "./office-adapter";

/**
 * API base URL.
 *
 * When served from localhost (dev or self-hosted mode), use the same origin.
 * When served from a public host (GitHub Pages / AppSource), connect to
 * the local AgentXL server on localhost:3001.
 */
const BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? window.location.origin
    : "https://localhost:3001";

// ---------------------------------------------------------------------------
// Types (shared between client and API responses)
// ---------------------------------------------------------------------------

export interface ConfigStatus {
  authenticated: boolean;
  provider: string | null;
  version: string;
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

export interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Provider labels
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Re-exports from office-adapter (backwards compatibility)
// ---------------------------------------------------------------------------

export { getWorkbookNameFromUrl };

/** Get current Excel context. Delegates to office-adapter. */
export async function getExcelContext(): Promise<ExcelContext | undefined> {
  return readExcelContext();
}

/** Build workbook identity input. Delegates to office-adapter. */
export async function getWorkbookIdentityInput(): Promise<WorkbookIdentityInput> {
  return readWorkbookIdentityInput();
}

// ---------------------------------------------------------------------------
// Config API
// ---------------------------------------------------------------------------

export async function getConfigStatus(): Promise<ConfigStatus> {
  const res = await fetch(`${BASE}/api/config/status`);
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Workbook API
// ---------------------------------------------------------------------------

export async function resolveWorkbookIdentity(
  input: WorkbookIdentityInput
): Promise<WorkbookIdentity> {
  const res = await fetch(`${BASE}/api/workbook/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ error: "Workbook resolve failed" }));
    throw new Error(
      body.error || `Workbook resolve failed: HTTP ${res.status}`
    );
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Folder API
// ---------------------------------------------------------------------------

export async function getFolderStatus(
  workbookId: string
): Promise<FolderStatus> {
  const res = await fetch(
    `${BASE}/api/folder/status?workbookId=${encodeURIComponent(workbookId)}`
  );

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ error: "Folder status failed" }));
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
    const body = await res
      .json()
      .catch(() => ({ error: "Folder picker failed" }));
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
    const body = await res
      .json()
      .catch(() => ({ error: "Folder selection failed" }));
    throw new Error(
      body.error || `Folder selection failed: HTTP ${res.status}`
    );
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Agent API (SSE streaming)
// ---------------------------------------------------------------------------

/**
 * Send a message to the agent and stream SSE events back.
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
    const body = await res
      .json()
      .catch(() => ({ error: "Request failed" }));
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
    buffer = lines.pop() ?? "";

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
