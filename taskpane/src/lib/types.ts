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

export interface ToolCall {
  /** Stable ID from the Pi SDK event, used for reconciliation. */
  id: string;
  name: string;
  status: "running" | "done" | "error";
  /** Brief summary of what the tool is doing, e.g. file path for read */
  summary?: string;
}

/**
 * A chronological block within an assistant message.
 * Rendered in order so thinking → text → tool → thinking → text
 * flows naturally.
 */
export type MessageBlock =
  | { type: "thinking"; content: string; isStreaming: boolean }
  | { type: "text"; content: string }
  | { type: "tool_call"; tool: ToolCall }
  | { type: "status"; label: string; state: "running" | "done" | "error" };

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: ThinkingEntry[];
  toolCalls?: ToolCall[];
  /** Chronological blocks for rendering (assistant messages only). */
  blocks?: MessageBlock[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// SSE events from /api/agent
//
// These match the Pi SDK agent event shapes. The server forwards them as-is.
// ---------------------------------------------------------------------------

/** Delta sub-events inside a message_update (from Pi SDK AssistantMessageEvent). */
export type AssistantMessageEvent =
  | { type: "text_start"; contentIndex: number }
  | { type: "text_delta"; contentIndex: number; delta: string }
  | { type: "text_end"; contentIndex: number; content: string }
  | { type: "thinking_start"; contentIndex: number }
  | { type: "thinking_delta"; contentIndex: number; delta: string }
  | { type: "thinking_end"; contentIndex: number; content: string }
  | { type: string; [key: string]: unknown };

/** Tool execution start event. */
export interface ToolExecutionStartEvent {
  type: "tool_execution_start";
  toolCallId: string;
  toolName: string;
  args?: Record<string, unknown>;
}

/** Tool execution end event. */
export interface ToolExecutionEndEvent {
  type: "tool_execution_end";
  toolCallId: string;
  toolName: string;
  isError?: boolean;
  result?: unknown;
}

/** Compaction start event. */
export interface CompactionStartEvent {
  type: "auto_compaction_start";
  reason: "threshold" | "overflow";
}

/** Compaction end event. */
export interface CompactionEndEvent {
  type: "auto_compaction_end";
  aborted: boolean;
  willRetry: boolean;
  errorMessage?: string;
}

/** Top-level SSE events streamed from POST /api/agent. */
export type AgentSSEEvent =
  | { type: "agent_start" }
  | { type: "agent_end" }
  | {
      type: "message_update";
      assistantMessageEvent: AssistantMessageEvent;
      message: unknown;
    }
  | ToolExecutionStartEvent
  | ToolExecutionEndEvent
  | CompactionStartEvent
  | CompactionEndEvent
  | { type: "error"; error: string }
  | { type: string; [key: string]: unknown };
