import { useState } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

export function ThinkingBlock({ content, isStreaming }: ThinkingBlockProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!content) return null;

  // Truncate preview to first line, max 60 chars
  const firstLine = content.split("\n")[0];
  const preview =
    firstLine.length > 60 ? firstLine.slice(0, 60) + "…" : firstLine;

  return (
    <div className="my-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Brain size={12} className={isStreaming ? "animate-pulse" : ""} />
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="italic">
          {isStreaming ? "Thinking…" : preview}
        </span>
      </button>
      {isOpen && (
        <div className="mt-1.5 ml-5 text-xs text-gray-400 italic whitespace-pre-wrap leading-relaxed border-l-2 border-gray-200 pl-3">
          {content}
        </div>
      )}
    </div>
  );
}
