/**
 * SSE event → chat message state updates.
 *
 * Extracted from the React component so it can be tested independently
 * and doesn't bury protocol handling inside UI rendering.
 */

import type {
  Message,
  ThinkingEntry,
  ToolCall,
  AgentSSEEvent,
  ToolExecutionStartEvent,
  ToolExecutionEndEvent,
} from "./types";
import { getToolLabel, getToolSummary } from "./tool-meta";

/** Mutable accumulator for an in-progress assistant response. */
export interface StreamAccumulator {
  assistantId: string;
  content: string;
  thinking: ThinkingEntry[];
  toolCalls: ToolCall[];
  currentThinkingIdx: number;
}

/** Create a fresh accumulator for a new assistant turn. */
export function createAccumulator(): StreamAccumulator {
  return {
    assistantId: crypto.randomUUID(),
    content: "",
    thinking: [],
    toolCalls: [],
    currentThinkingIdx: -1,
  };
}

/** Result of processing an SSE event. */
export type StreamResult =
  | { action: "update_assistant"; message: Message }
  | { action: "add_system_error"; message: Message }
  | { action: "agent_end" }
  | { action: "none" };

/**
 * Process a single SSE event and return what the UI should do.
 *
 * Mutates the accumulator (content, thinking blocks) for efficiency,
 * but returns a fresh Message snapshot for React state.
 */
export function processSSEEvent(
  event: AgentSSEEvent,
  acc: StreamAccumulator
): StreamResult {
  switch (event.type) {
    case "message_update": {
      const ame = event.assistantMessageEvent;
      if (!ame) return { action: "none" };

      switch (ame.type) {
        case "text_delta":
          acc.content += ame.delta;
          return { action: "update_assistant", message: snapshotMessage(acc) };

        case "thinking_start":
          acc.currentThinkingIdx = acc.thinking.length;
          acc.thinking.push({ content: "", isStreaming: true });
          return { action: "update_assistant", message: snapshotMessage(acc) };

        case "thinking_delta":
          if (acc.currentThinkingIdx >= 0) {
            acc.thinking[acc.currentThinkingIdx].content += ame.delta;
            return {
              action: "update_assistant",
              message: snapshotMessage(acc),
            };
          }
          return { action: "none" };

        case "thinking_end":
          if (acc.currentThinkingIdx >= 0) {
            acc.thinking[acc.currentThinkingIdx].isStreaming = false;
            if (ame.content) {
              acc.thinking[acc.currentThinkingIdx].content = ame.content;
            }
            acc.currentThinkingIdx = -1;
            return {
              action: "update_assistant",
              message: snapshotMessage(acc),
            };
          }
          return { action: "none" };

        default:
          return { action: "none" };
      }
    }

    case "tool_execution_start": {
      const e = event as ToolExecutionStartEvent;
      acc.toolCalls.push({
        id: e.toolCallId,
        name: e.toolName,
        status: "running",
        summary: getToolSummary(e.toolName, e.args),
      });
      return { action: "update_assistant", message: snapshotMessage(acc) };
    }

    case "tool_execution_end": {
      const e = event as ToolExecutionEndEvent;

      // Match by stable toolCallId — not best-effort name matching
      const idx = acc.toolCalls.findIndex((t) => t.id === e.toolCallId);
      if (idx >= 0) {
        acc.toolCalls[idx].status = e.isError ? "error" : "done";
      }
      return { action: "update_assistant", message: snapshotMessage(acc) };
    }

    case "error":
      return {
        action: "add_system_error",
        message: {
          id: crypto.randomUUID(),
          role: "system",
          content:
            (event as { error?: string }).error || "An error occurred",
          timestamp: Date.now(),
        },
      };

    case "agent_end":
      return { action: "agent_end" };

    default:
      return { action: "none" };
  }
}

/** Create an immutable Message snapshot from the current accumulator state. */
function snapshotMessage(acc: StreamAccumulator): Message {
  return {
    id: acc.assistantId,
    role: "assistant",
    content: acc.content,
    thinking: acc.thinking.length > 0 ? [...acc.thinking] : undefined,
    toolCalls: acc.toolCalls.length > 0 ? [...acc.toolCalls] : undefined,
    timestamp: Date.now(),
  };
}
