import { useEffect, useRef, useState, useCallback } from "react";
import { useAgentStatus } from "./hooks/useAgentStatus";
import { useWorkbookIdentity } from "./hooks/useWorkbookIdentity";
import { useChatStream } from "./hooks/useChatStream";
import { ConnectionError } from "./components/ConnectionError";
import { AuthRequired } from "./components/AuthRequired";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { MessageBubble } from "./components/MessageBubble";
import { ChatInput } from "./components/ChatInput";

export function App() {
  const { status, connectionError, serverDown, markServerDown } =
    useAgentStatus();
  const {
    workbookId,
    workbookResolveError,
    isResolvingWorkbook,
  } = useWorkbookIdentity(Boolean(status?.authenticated));
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

  // ── Workbook identity state ─────────────────────────────────────────────
  if (isResolvingWorkbook && !workbookId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-gray-400">Resolving workbook…</div>
      </div>
    );
  }

  // ── Chat UI ─────────────────────────────────────────────────────────────
  const hasMessages = messages.length > 0;
  const inputDisabled = serverDown || !workbookId || Boolean(workbookResolveError);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Server-down banner */}
      {serverDown && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2 text-xs text-amber-700">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          Server disconnected — reconnecting…
        </div>
      )}

      {/* Workbook state banner */}
      {workbookResolveError && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-2 text-xs text-red-700">
          Could not resolve workbook identity. Reopen the taskpane or workbook and try again.
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <WelcomeScreen
            status={status}
            workbookId={workbookId}
            onQuickAction={handleQuickAction}
          />
        ) : (
          <div className="p-4 space-y-4">
            {workbookId && (
              <div className="text-[11px] text-gray-400 px-1">
                Workbook ID: {workbookId}
              </div>
            )}
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
                <div className="flex items-center gap-2 text-xs text-gray-400 pl-1 animate-message-in">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span>Thinking…</span>
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
        disabled={inputDisabled}
      />
    </div>
  );
}
