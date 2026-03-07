/**
 * Shared types for the AgentXL taskpane.
 */

// ---------------------------------------------------------------------------
// Chat messages
// ---------------------------------------------------------------------------

export interface ThinkingEntry {
  content: string;
  isStreaming: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: ThinkingEntry[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// SSE events from /api/agent
//
// These match the Pi SDK agent event shapes. The server forwards them as-is.
// Only the types the client cares about are defined here.
// ---------------------------------------------------------------------------

/** Delta sub-events inside a message_update (from pi-ai AssistantMessageEvent). */
export type AssistantMessageEvent =
  | { type: "text_start"; contentIndex: number }
  | { type: "text_delta"; contentIndex: number; delta: string }
  | { type: "text_end"; contentIndex: number; content: string }
  | { type: "thinking_start"; contentIndex: number }
  | { type: "thinking_delta"; contentIndex: number; delta: string }
  | { type: "thinking_end"; contentIndex: number; content: string }
  | { type: string; [key: string]: unknown }; // catch-all for events we don't handle

/** Top-level SSE events streamed from POST /api/agent. */
export type AgentSSEEvent =
  | { type: "agent_start" }
  | { type: "agent_end" }
  | { type: "message_update"; assistantMessageEvent: AssistantMessageEvent; message: unknown }
  | { type: "error"; error: string }
  | { type: string; [key: string]: unknown }; // other Pi SDK events we forward but don't use
