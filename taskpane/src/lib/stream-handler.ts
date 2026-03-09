/**
 * SSE event → chat message state updates.
 *
 * Builds a chronological list of blocks (thinking, text, tool_call)
 * so the UI renders them in the order they happened — not grouped by type.
 */

import type {
  Message,
  MessageBlock,
  ThinkingEntry,
  ToolCall,
  AgentSSEEvent,
  ToolExecutionStartEvent,
  ToolExecutionEndEvent,
  CompactionStartEvent,
  CompactionEndEvent,
} from "./types";
import { getToolSummary } from "./tool-meta";

/** Mutable accumulator for an in-progress assistant response. */
export interface StreamAccumulator {
  assistantId: string;
  /** Chronological blocks — the source of truth for rendering. */
  blocks: MessageBlock[];
  /** Index of the currently-streaming thinking block in `blocks`, or -1. */
  activeThinkingIdx: number;
  /** Index of the currently-streaming text block in `blocks`, or -1. */
  activeTextIdx: number;
  /** Full concatenated text (kept for backward compat / search). */
  fullText: string;
  /** All thinking entries (kept for backward compat). */
  thinking: ThinkingEntry[];
  /** All tool calls (kept for backward compat / status tracking). */
  toolCalls: ToolCall[];
}

/** Create a fresh accumulator for a new assistant turn. */
export function createAccumulator(): StreamAccumulator {
  return {
    assistantId: crypto.randomUUID(),
    blocks: [],
    activeThinkingIdx: -1,
    activeTextIdx: -1,
    fullText: "",
    thinking: [],
    toolCalls: [],
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
 * Mutates the accumulator for efficiency, returns a fresh Message snapshot.
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
        case "text_delta": {
          // If no active text block, create one
          if (acc.activeTextIdx < 0) {
            acc.activeTextIdx = acc.blocks.length;
            acc.blocks.push({ type: "text", content: "" });
          }
          const textBlock = acc.blocks[acc.activeTextIdx] as { type: "text"; content: string };
          textBlock.content += ame.delta;
          acc.fullText += ame.delta;
          return { action: "update_assistant", message: snapshotMessage(acc) };
        }

        case "thinking_start": {
          // Close any active text block (new thinking = new section)
          acc.activeTextIdx = -1;

          // Create a new thinking block
          acc.activeThinkingIdx = acc.blocks.length;
          const entry: ThinkingEntry = { content: "", isStreaming: true };
          acc.thinking.push(entry);
          acc.blocks.push({ type: "thinking", content: "", isStreaming: true });
          return { action: "update_assistant", message: snapshotMessage(acc) };
        }

        case "thinking_delta": {
          if (acc.activeThinkingIdx >= 0) {
            const block = acc.blocks[acc.activeThinkingIdx] as {
              type: "thinking"; content: string; isStreaming: boolean;
            };
            block.content += ame.delta;
            // Also update the legacy thinking array
            const legacyIdx = acc.thinking.length - 1;
            if (legacyIdx >= 0) acc.thinking[legacyIdx].content += ame.delta;
            return { action: "update_assistant", message: snapshotMessage(acc) };
          }
          return { action: "none" };
        }

        case "thinking_end": {
          if (acc.activeThinkingIdx >= 0) {
            const block = acc.blocks[acc.activeThinkingIdx] as {
              type: "thinking"; content: string; isStreaming: boolean;
            };
            block.isStreaming = false;
            if (ame.content) block.content = ame.content;
            // Update legacy
            const legacyIdx = acc.thinking.length - 1;
            if (legacyIdx >= 0) {
              acc.thinking[legacyIdx].isStreaming = false;
              if (ame.content) acc.thinking[legacyIdx].content = ame.content;
            }
            acc.activeThinkingIdx = -1;
            return { action: "update_assistant", message: snapshotMessage(acc) };
          }
          return { action: "none" };
        }

        default:
          return { action: "none" };
      }
    }

    case "tool_execution_start": {
      const e = event as ToolExecutionStartEvent;
      // Close any active text block
      acc.activeTextIdx = -1;

      const tool: ToolCall = {
        id: e.toolCallId,
        name: e.toolName,
        status: "running",
        summary: getToolSummary(e.toolName, e.args),
      };
      acc.toolCalls.push(tool);
      acc.blocks.push({ type: "tool_call", tool });
      return { action: "update_assistant", message: snapshotMessage(acc) };
    }

    case "tool_execution_end": {
      const e = event as ToolExecutionEndEvent;
      // Close any active text block (text after tool = new section)
      acc.activeTextIdx = -1;

      // Update status in-place (block references the same ToolCall object)
      const tool = acc.toolCalls.find((t) => t.id === e.toolCallId);
      if (tool) {
        tool.status = e.isError ? "error" : "done";
      }
      return { action: "update_assistant", message: snapshotMessage(acc) };
    }

    case "auto_compaction_start": {
      // Close any active text block
      acc.activeTextIdx = -1;
      acc.blocks.push({
        type: "status",
        label: "Compacting conversation history…",
        state: "running",
      });
      return { action: "update_assistant", message: snapshotMessage(acc) };
    }

    case "auto_compaction_end": {
      const e = event as CompactionEndEvent;
      // Find and update the compaction status block
      for (let i = acc.blocks.length - 1; i >= 0; i--) {
        const b = acc.blocks[i];
        if (b.type === "status" && b.state === "running") {
          b.state = e.aborted || e.errorMessage ? "error" : "done";
          b.label = e.aborted
            ? "Compaction aborted"
            : e.errorMessage
              ? `Compaction failed: ${e.errorMessage}`
              : "Conversation compacted";
          break;
        }
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
    content: acc.fullText,
    thinking: acc.thinking.length > 0 ? [...acc.thinking] : undefined,
    toolCalls: acc.toolCalls.length > 0 ? [...acc.toolCalls] : undefined,
    blocks: acc.blocks.length > 0 ? [...acc.blocks] : undefined,
    timestamp: Date.now(),
  };
}
