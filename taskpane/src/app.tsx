import { useEffect, useRef, useState, useCallback } from "react";
import { useAgentStatus } from "./hooks/useAgentStatus";
import { useChatStream } from "./hooks/useChatStream";
import { ConnectionError } from "./components/ConnectionError";
import { AuthRequired } from "./components/AuthRequired";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { MessageBubble } from "./components/MessageBubble";
import { ChatInput } from "./components/ChatInput";

export function App() {
  const { status, connectionError, serverDown, markServerDown } =
    useAgentStatus();
  const { messages, isStreaming, sendMessage, stopStreaming } =
    useChatStream(markServerDown);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      sendMessage(trimmed);
      setInput("");
    },
    [sendMessage]
  );

  const handleQuickAction = useCallback(
    (prompt: string) => {
      setInput(prompt);
    },
    []
  );

  // ── Connection error (never connected) ──────────────────────────────────
  if (connectionError && !status) {
    return <ConnectionError />;
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (!status) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-gray-400">Connecting…</div>
      </div>
    );
  }

  // ── Not authenticated ───────────────────────────────────────────────────
  if (!status.authenticated) {
    return <AuthRequired />;
  }

  // ── Chat UI ─────────────────────────────────────────────────────────────
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Server-down banner */}
      {serverDown && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs text-amber-700">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          Server disconnected — reconnecting…
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <WelcomeScreen status={status} onQuickAction={handleQuickAction} />
        ) : (
          <div className="p-4 space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming indicator (before first assistant content) */}
            {isStreaming &&
              !messages.some(
                (m) =>
                  m.role === "assistant" &&
                  (m.content || m.thinking?.length)
              ) && (
                <div className="flex items-center gap-2 text-xs text-gray-400 pl-1">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={stopStreaming}
        isStreaming={isStreaming}
        disabled={serverDown}
      />
    </div>
  );
}
