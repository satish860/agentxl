import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

export interface WorkbookFolderLink {
  workbookId: string;
  folderPath: string;
  workbookName: string | null;
  workbookUrl: string | null;
  host: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkbookFolderLinkInput {
  workbookId: string;
  folderPath: string;
  workbookName?: string | null;
  workbookUrl?: string | null;
  host?: string | null;
  source?: string | null;
}

interface WorkbookFolderStoreFile {
  version: 1;
  links: Record<string, WorkbookFolderLink>;
}

function normalizeRequired(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${field} is required`);
  }
  return trimmed;
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getAgentXLDataDir(): string {
  const override = process.env.AGENTXL_DATA_DIR;
  if (override && override.trim().length > 0) {
    return override.trim();
  }
  return join(homedir(), ".agentxl");
}

export function getWorkbookLinksPath(): string {
  return join(getAgentXLDataDir(), "workbook-links.json");
}

function ensureParentDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function emptyStore(): WorkbookFolderStoreFile {
  return { version: 1, links: {} };
}

function readStore(): WorkbookFolderStoreFile {
  const path = getWorkbookLinksPath();
  if (!existsSync(path)) return emptyStore();

  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Partial<WorkbookFolderStoreFile>;
    if (parsed.version !== 1 || !parsed.links || typeof parsed.links !== "object") {
      return emptyStore();
    }
    return {
      version: 1,
      links: parsed.links as Record<string, WorkbookFolderLink>,
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: WorkbookFolderStoreFile): void {
  const path = getWorkbookLinksPath();
  ensureParentDir(path);
  const tempPath = `${path}.tmp`;
  writeFileSync(tempPath, JSON.stringify(store, null, 2), "utf-8");
  renameSync(tempPath, path);
}

export function getWorkbookFolderLink(workbookId: string): WorkbookFolderLink | null {
  const normalizedWorkbookId = normalizeRequired(workbookId, "workbookId");
  const store = readStore();
  return store.links[normalizedWorkbookId] ?? null;
}

export function setWorkbookFolderLink(
  input: WorkbookFolderLinkInput
): WorkbookFolderLink {
  const workbookId = normalizeRequired(input.workbookId, "workbookId");
  const folderPath = normalizeRequired(input.folderPath, "folderPath");
  const now = new Date().toISOString();

  const store = readStore();
  const existing = store.links[workbookId];

  const record: WorkbookFolderLink = {
    workbookId,
    folderPath,
    workbookName: normalizeOptional(input.workbookName) ?? existing?.workbookName ?? null,
    workbookUrl: normalizeOptional(input.workbookUrl) ?? existing?.workbookUrl ?? null,
    host: normalizeOptional(input.host) ?? existing?.host ?? null,
    source: normalizeOptional(input.source) ?? existing?.source ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  store.links[workbookId] = record;
  writeStore(store);
  return record;
}

export function clearWorkbookFolderStore(): void {
  const path = getWorkbookLinksPath();
  if (existsSync(path)) {
    unlinkSync(path);
  }
}
