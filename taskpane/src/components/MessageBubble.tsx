import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Search,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { ThinkingBlock } from "./ThinkingBlock";
import { TOOL_META } from "../lib/tool-meta";
import type { Message, ToolCall } from "../lib/types";

/** Map icon keys to Lucide components. */
const ICON_MAP: Record<string, typeof FileText> = {
  "file-text": FileText,
  search: Search,
  "folder-open": FolderOpen,
};

function ToolCallBadge({ tool }: { tool: ToolCall }) {
  const meta = TOOL_META[tool.name];
  const Icon = meta ? ICON_MAP[meta.iconKey] ?? FileText : FileText;
  const label = meta?.label ?? tool.name;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-600">
      {tool.status === "running" ? (
        <Loader2
          size={12}
          className="text-emerald-500 animate-spin shrink-0"
        />
      ) : tool.status === "error" ? (
        <AlertCircle size={12} className="text-red-400 shrink-0" />
      ) : (
        <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
      )}
      <Icon size={12} className="text-gray-400 shrink-0" />
      <span>{label}</span>
      {tool.summary && (
        <span className="text-gray-400 truncate max-w-[120px]">
          {tool.summary}
        </span>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center animate-message-in">
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600 max-w-[90%]">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-message-in">
        <div className="bg-emerald-600 text-white rounded-2xl rounded-br-md px-3.5 py-2.5 text-[14px] leading-relaxed max-w-[85%]">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message — clean card
  return (
    <div className="flex justify-start animate-message-in">
      <div className="max-w-[95%] border border-gray-100 rounded-xl px-4 py-3 bg-gray-50/60">
        {/* Thinking blocks */}
        {message.thinking?.map((block, i) => (
          <ThinkingBlock
            key={i}
            content={block.content}
            isStreaming={block.isStreaming}
          />
        ))}

        {/* Tool calls — keyed by stable ID */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {message.toolCalls.map((tool) => (
              <ToolCallBadge key={tool.id} tool={tool} />
            ))}
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <div className="agentxl-prose prose prose-sm max-w-none text-gray-800 prose-p:my-1.5 prose-p:leading-relaxed prose-headings:my-2 prose-headings:text-gray-900 prose-h1:text-base prose-h1:font-semibold prose-h2:text-[13px] prose-h2:font-semibold prose-h3:text-[12px] prose-h3:font-semibold prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-li:text-[13px] prose-pre:my-2 prose-code:text-emerald-700 prose-code:bg-emerald-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:text-xs prose-pre:overflow-x-auto prose-a:text-emerald-600 prose-table:text-xs prose-strong:text-gray-900 prose-strong:font-semibold prose-blockquote:text-[12px] prose-blockquote:text-gray-500 prose-blockquote:border-gray-200 prose-blockquote:my-2 prose-hr:my-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
