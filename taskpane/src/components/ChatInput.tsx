import { useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  disabled,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [value]);

  // Focus after streaming ends
  useEffect(() => {
    if (!isStreaming) textareaRef.current?.focus();
  }, [isStreaming]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend(value);
      }
    },
    [value, onSend]
  );

  return (
    <div className="border-t border-gray-100 p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your source files…"
          disabled={isStreaming || disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50 disabled:bg-gray-50 placeholder:text-gray-400"
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="btn-press shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
            title="Stop"
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            onClick={() => onSend(value)}
            disabled={!value.trim() || disabled}
            className="btn-press shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-30 disabled:hover:bg-emerald-600"
            title="Send"
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
