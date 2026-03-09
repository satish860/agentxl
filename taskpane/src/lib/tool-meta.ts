/**
 * Tool display metadata — single source of truth.
 *
 * Used by both the stream handler (labels/summaries) and
 * the UI components (icons/labels).
 */

/** Tool display metadata entry. */
export interface ToolMeta {
  label: string;
  /** Lucide icon key — resolved at render time in the component. */
  iconKey: "file-text" | "search" | "folder-open";
}

/** Display metadata for each built-in tool. */
export const TOOL_META: Record<string, ToolMeta> = {
  read: { label: "Reading file", iconKey: "file-text" },
  grep: { label: "Searching files", iconKey: "search" },
  find: { label: "Finding files", iconKey: "folder-open" },
  ls: { label: "Listing directory", iconKey: "folder-open" },
  excel: { label: "Excel", iconKey: "file-text" },
};

/** Get the display label for a tool, with fallback. */
export function getToolLabel(toolName: string): string {
  return TOOL_META[toolName]?.label ?? toolName;
}

/** Extract a brief summary from tool args (e.g. file path for read). */
export function getToolSummary(
  toolName: string,
  args: Record<string, unknown> | undefined
): string | undefined {
  if (!args) return undefined;

  if (toolName === "read" && typeof args.path === "string") {
    const parts = args.path.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || args.path;
  }
  if (toolName === "grep" && typeof args.pattern === "string") {
    return `"${args.pattern}"`;
  }
  if (toolName === "find" && typeof args.path === "string") {
    return args.path;
  }
  if (toolName === "ls" && typeof args.path === "string") {
    return args.path;
  }
  if (toolName === "excel" && typeof args.description === "string") {
    return args.description;
  }
  return undefined;
}
