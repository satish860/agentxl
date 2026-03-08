import { createHash } from "crypto";

export interface WorkbookIdentityInput {
  workbookName?: string | null;
  workbookUrl?: string | null;
  host?: string | null;
  source?: string | null;
}

function normalize(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePathname(pathname: string): string {
  const decoded = safeDecode(pathname);
  const collapsed = decoded.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (collapsed === "/") return "/";
  return collapsed.replace(/\/+$/, "").toLowerCase();
}

function normalizeUrl(value: string | null | undefined): string | null {
  const normalized = normalize(value);
  if (!normalized) return null;

  const slashNormalized = normalized.replace(/\\/g, "/");

  try {
    const url = new URL(slashNormalized);
    const protocol = url.protocol.toLowerCase();
    const host = url.host.toLowerCase();
    const pathname = normalizePathname(url.pathname);
    return `${protocol}//${host}${pathname}`;
  } catch {
    return normalizePathname(slashNormalized.split(/[?#]/, 1)[0]);
  }
}

function normalizeName(value: string | null | undefined): string | null {
  const normalized = normalize(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function resolveWorkbookId(input: WorkbookIdentityInput): string {
  const workbookUrl = normalizeUrl(input.workbookUrl);
  const workbookName = normalizeName(input.workbookName);
  const host = normalizeName(input.host) ?? "unknown";
  const source = normalizeName(input.source) ?? "unknown";

  if (!workbookUrl && !workbookName) {
    throw new Error("workbookName or workbookUrl is required");
  }

  const key = workbookUrl
    ? `url:${workbookUrl}`
    : `name:${workbookName}|host:${host}|source:${source}`;

  const hash = createHash("sha256").update(key).digest("hex");
  return `wb_${hash.slice(0, 16)}`;
}
