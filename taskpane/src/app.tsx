import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from "react";
import { Send, Square, BarChart3, FileSpreadsheet, Calculator, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThinkingBlock } from "./components/ThinkingBlock";
import {
  getConfigStatus,
  getExcelContext,
  getProviderLabel,
  streamAgent,
  type ConfigStatus,
  type SSEEvent,
} from "./lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThinkingEntry {
  content: string;
  isStreaming: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: ThinkingEntry[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

const QUICK_ACTIONS = [
  { icon: FileSpreadsheet, label: "Summarize data", prompt: "Summarize the data in this spreadsheet" },
  { icon: BarChart3, label: "Create chart", prompt: "Create a chart from the selected data" },
  { icon: Calculator, label: "Write formula", prompt: "Help me write a formula" },
];

/** Retry interval for status polling and reconnect (ms). */
const RETRY_INTERVAL = 2000;

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [serverDown, setServerDown] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // -------------------------------------------------------------------------
  // Check server status (with retry)
  // -------------------------------------------------------------------------

  const checkStatus = useCallback(async () => {
    try {
      const s = await getConfigStatus();
      setStatus(s);
      setConnectionError(null);
      setServerDown(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    async function poll() {
      const ok = await checkStatus();
      if (!cancelled && !ok) {
        setConnectionError("Cannot connect to AgentXL server");
        retryTimer = setTimeout(poll, RETRY_INTERVAL);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [checkStatus]);

  // Poll for auth changes when unauthenticated (user may run `agentxl login`)
  useEffect(() => {
    if (!status || status.authenticated) return;

    const interval = setInterval(async () => {
      const s = await getConfigStatus().catch(() => null);
      if (s?.authenticated) setStatus(s);
    }, RETRY_INTERVAL);

    return () => clearInterval(interval);
  }, [status]);

  // -------------------------------------------------------------------------
  // Auto-scroll to bottom
  // -------------------------------------------------------------------------

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // -------------------------------------------------------------------------
  // Auto-resize textarea
  // -------------------------------------------------------------------------

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px"; // max ~5 lines
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  // -------------------------------------------------------------------------
  // Send message
  // -------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      // Clear any previous server-down state
      setServerDown(false);

      // Add user message
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsStreaming(true);

      // Prepare streaming assistant message
      const assistantId = crypto.randomUUID();
      let assistantContent = "";
      let thinkingBlocks: ThinkingEntry[] = [];
      let currentThinkingIdx = -1;

      const updateAssistant = () => {
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === assistantId);
          const msg: Message = {
            id: assistantId,
            role: "assistant",
            content: assistantContent,
            thinking: thinkingBlocks.length > 0 ? [...thinkingBlocks] : undefined,
            timestamp: existing?.timestamp ?? Date.now(),
          };
          if (existing) {
            return prev.map((m) => (m.id === assistantId ? msg : m));
          }
          return [...prev, msg];
        });
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
          (event: SSEEvent) => {
            switch (event.type) {
              case "message_update": {
                const ame = event.assistantMessageEvent;
                if (!ame) break;

                if (ame.type === "text_delta") {
                  assistantContent += ame.delta;
                  updateAssistant();
                } else if (ame.type === "thinking_start") {
                  currentThinkingIdx = thinkingBlocks.length;
                  thinkingBlocks.push({ content: "", isStreaming: true });
                  updateAssistant();
                } else if (ame.type === "thinking_delta") {
                  if (currentThinkingIdx >= 0) {
                    thinkingBlocks[currentThinkingIdx].content += ame.delta;
                    updateAssistant();
                  }
                } else if (ame.type === "thinking_end") {
                  if (currentThinkingIdx >= 0) {
                    thinkingBlocks[currentThinkingIdx].isStreaming = false;
                    if (ame.content) {
                      thinkingBlocks[currentThinkingIdx].content = ame.content;
                    }
                    currentThinkingIdx = -1;
                    updateAssistant();
                  }
                }
                break;
              }

              case "error": {
                const errMsg: Message = {
                  id: crypto.randomUUID(),
                  role: "system",
                  content: event.error || "An error occurred",
                  timestamp: Date.now(),
                };
                setMessages((prev) => [...prev, errMsg]);
                break;
              }

              case "agent_end":
                break;
            }
          },
          controller.signal
        );
      } catch (err: any) {
        if (err.name === "AbortError") {
          // User cancelled — no error
        } else if (err.message?.includes("fetch") || err.message?.includes("network") || err.name === "TypeError") {
          // Network failure — server is down, show reconnect banner
          setServerDown(true);
          startReconnect();
        } else {
          const errMsg: Message = {
            id: crypto.randomUUID(),
            role: "system",
            content: err.message || "Failed to get response",
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, errMsg]);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        textareaRef.current?.focus();
      }
    },
    [isStreaming]
  );

  // -------------------------------------------------------------------------
  // Reconnect after server goes down mid-chat
  // -------------------------------------------------------------------------

  const reconnectRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startReconnect = useCallback(() => {
    if (reconnectRef.current) return; // already reconnecting
    reconnectRef.current = setInterval(async () => {
      const ok = await checkStatus();
      if (ok) {
        clearInterval(reconnectRef.current!);
        reconnectRef.current = null;
        setServerDown(false);
      }
    }, RETRY_INTERVAL);
  }, [checkStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectRef.current) clearInterval(reconnectRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Stop streaming
  // -------------------------------------------------------------------------

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // -------------------------------------------------------------------------
  // Keyboard handling
  // -------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage]
  );

  // -------------------------------------------------------------------------
  // Render: Connection error (initial — never connected)
  // -------------------------------------------------------------------------

  if (connectionError && !status) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
          <span className="text-red-500 text-lg">!</span>
        </div>
        <p className="text-sm text-gray-700 font-medium mb-2">
          Can't connect to server
        </p>
        <p className="text-xs text-gray-500">
          Make sure{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded">
            agentxl start
          </code>{" "}
          is running in your terminal.
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
          <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" />
          Reconnecting…
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Loading
  // -------------------------------------------------------------------------

  if (!status) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-gray-400">Connecting…</div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Not authenticated (polls for changes)
  // -------------------------------------------------------------------------

  if (!status.authenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
          <span className="text-amber-600 text-xl">🔑</span>
        </div>
        <p className="text-sm text-gray-700 font-medium mb-2">
          Authentication required
        </p>
        <p className="text-xs text-gray-500 leading-relaxed mb-4">
          Run{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
            agentxl login
          </code>{" "}
          in your terminal to set up credentials.
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <RefreshCw size={12} className="animate-spin" />
          Waiting for credentials…
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Chat UI
  // -------------------------------------------------------------------------

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Server-down banner (reconnecting after runtime failure) */}
      {serverDown && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs text-amber-700">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          Server disconnected — reconnecting…
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          /* Welcome screen */
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-white text-xl font-bold">AX</span>
            </div>
            <h1 className="text-base font-semibold text-gray-900 mb-1">
              AgentXL
            </h1>
            <p className="text-xs text-gray-500 mb-6">
              Your AI assistant for Excel
            </p>

            {/* Quick actions */}
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    setInput(action.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-gray-200 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  <action.icon size={16} className="text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700">{action.label}</span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-gray-400 mt-6">
              {getProviderLabel(status.provider)} • v{status.version}
            </p>
          </div>
        ) : (
          /* Message list */
          <div className="p-4 space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming indicator (shown before first assistant content arrives) */}
            {isStreaming &&
              !messages.some(
                (m) => m.role === "assistant" && (m.content || m.thinking?.length)
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

      {/* Input area */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your spreadsheet…"
            disabled={isStreaming || serverDown}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:bg-gray-50 placeholder:text-gray-400"
          />
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              title="Stop"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || serverDown}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-30 disabled:hover:bg-emerald-600"
              title="Send"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message bubble component
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600 max-w-[90%]">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-emerald-600 text-white rounded-2xl rounded-br-md px-3.5 py-2 text-sm max-w-[85%]">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message — card-style with border
  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] border border-gray-200 rounded-xl px-4 py-3 bg-gray-50/50">
        {/* Thinking blocks */}
        {message.thinking?.map((block, i) => (
          <ThinkingBlock
            key={i}
            content={block.content}
            isStreaming={block.isStreaming}
          />
        ))}

        {/* Text content */}
        {message.content && (
          <div className="prose prose-sm max-w-none text-gray-800 prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-pre:my-2 prose-code:text-emerald-700 prose-code:bg-emerald-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-a:text-emerald-600 prose-table:text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
