/**
 * Hook: chat message state + streaming.
 *
 * Handles:
 * - Message list state
 * - Sending messages via SSE
 * - Event processing (delegates to stream-handler)
 * - Abort / stop
 * - Network error detection
 */

import { useState, useCallback, useRef } from "react";
import { getExcelContext, streamAgent } from "../lib/api";
import { createAccumulator, processSSEEvent } from "../lib/stream-handler";
import type { Message, AgentSSEEvent } from "../lib/types";

export interface ChatStreamState {
  messages: Message[];
  isStreaming: boolean;
  sendMessage: (text: string) => Promise<void>;
  stopStreaming: () => void;
}

export function useChatStream(
  workbookId: string | null,
  onServerDown: () => void
): ChatStreamState {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      // Add user message
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      // Prepare streaming state
      const acc = createAccumulator();

      /** Apply a stream result to React state. */
      const applyResult = (
        result: ReturnType<typeof processSSEEvent>
      ): void => {
        switch (result.action) {
          case "update_assistant":
            setMessages((prev) => {
              const exists = prev.find((m) => m.id === result.message.id);
              if (exists) {
                return prev.map((m) =>
                  m.id === result.message.id ? result.message : m
                );
              }
              return [...prev, result.message];
            });
            break;

          case "add_system_error":
            setMessages((prev) => [...prev, result.message]);
            break;

          case "agent_end":
          case "none":
            break;
        }
      };

      // Get Excel context if available
      const context = await getExcelContext();

      // Stream response
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamAgent(
          trimmed,
          context,
          workbookId,
          (event) => {
            const result = processSSEEvent(event as AgentSSEEvent, acc);
            applyResult(result);
          },
          controller.signal
        );
      } catch (err: any) {
        if (err.name === "AbortError") {
          // User cancelled — no error
        } else if (
          err.message?.includes("fetch") ||
          err.message?.includes("network") ||
          err.name === "TypeError"
        ) {
          onServerDown();
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "system",
              content: err.message || "Failed to get response",
              timestamp: Date.now(),
            },
          ]);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, onServerDown]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isStreaming, sendMessage, stopStreaming };
}
