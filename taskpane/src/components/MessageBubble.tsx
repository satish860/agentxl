import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThinkingBlock } from "./ThinkingBlock";
import type { Message } from "../lib/types";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
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
