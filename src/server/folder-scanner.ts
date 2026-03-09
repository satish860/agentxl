import { readdirSync, statSync, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs";
import { join, extname, relative, basename, dirname } from "path";
import { getAgentXLDataDir } from "./workbook-folder-store.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileEntry {
  /** File name with extension, e.g. "trial-balance.pdf" */
  name: string;
  /** Path relative to the linked folder root, e.g. "subfolder/trial-balance.pdf" */
  relativePath: string;
  /** Absolute path on disk */
  absolutePath: string;
  /** Lowercase extension including dot, e.g. ".pdf" */
  extension: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Last modified time as ISO string */
  modifiedAt: string;
  /** Whether this file type is supported for content extraction */
  supported: boolean;
}

export interface FolderInventory {
  /** The folder that was scanned */
  folderPath: string;
  /** When the scan was performed */
  scannedAt: string;
  /** Total number of files found */
  totalFiles: number;
  /** Number of supported files */
  supportedFiles: number;
  /** All discovered files */
  files: FileEntry[];
}

interface PersistedInventory {
  version: 1;
  inventory: FolderInventory;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** File extensions that AgentXL can extract content from. */
const SUPPORTED_EXTENSIONS = new Set([
  ".pdf",
  ".csv",
  ".xlsx",
  ".xls",
  ".txt",
  ".md",
  ".json",
  ".tsv",
]);

/** Directory names to always skip. */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "__pycache__",
  ".tox",
  ".venv",
  "venv",
  ".env",
  ".idea",
  ".vscode",
  "$RECYCLE.BIN",
  "System Volume Information",
  ".DS_Store",
  "Thumbs.db",
]);

/** Maximum directory depth to recurse into. */
const MAX_DEPTH = 10;

/** Maximum number of files to include in the inventory. */
const MAX_FILES = 10_000;

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

function isHidden(name: string): boolean {
  return name.startsWith(".") && name !== "." && name !== "..";
}

function shouldSkipDir(name: string): boolean {
  return IGNORED_DIRS.has(name) || isHidden(name);
}

function isSupported(ext: string): boolean {
  return SUPPORTED_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Recursively scan a folder and build a file inventory.
 *
 * @param folderPath - Absolute path to the folder to scan
 * @returns FolderInventory with all discovered files
 * @throws Error if the folder does not exist or is not accessible
 */
export function scanFolder(folderPath: string): FolderInventory {
  const trimmed = folderPath.trim();
  if (!trimmed) {
    throw new Error("Folder path is required");
  }

  if (!existsSync(trimmed)) {
    throw new Error(`Folder does not exist: ${trimmed}`);
  }

  const stat = statSync(trimmed);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${trimmed}`);
  }

  const files: FileEntry[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > MAX_DEPTH) return;
    if (files.length >= MAX_FILES) return;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      // Permission denied or other read error — skip this directory
      return;
    }

    for (const entry of entries) {
      if (files.length >= MAX_FILES) return;

      const fullPath = join(dir, entry);

      let entryStat;
      try {
        entryStat = statSync(fullPath);
      } catch {
        // Broken symlink or permission error — skip
        continue;
      }

      if (entryStat.isDirectory()) {
        if (!shouldSkipDir(entry)) {
          walk(fullPath, depth + 1);
        }
        continue;
      }

      if (!entryStat.isFile()) continue;

      const ext = extname(entry).toLowerCase();
      // Skip files with no extension or hidden files
      if (!ext && isHidden(entry)) continue;

      files.push({
        name: basename(entry),
        relativePath: relative(trimmed, fullPath).replace(/\\/g, "/"),
        absolutePath: fullPath,
        extension: ext,
        sizeBytes: entryStat.size,
        modifiedAt: entryStat.mtime.toISOString(),
        supported: isSupported(ext),
      });
    }
  }

  walk(trimmed, 0);

  // Sort files: supported first, then alphabetically by relative path
  files.sort((a, b) => {
    if (a.supported !== b.supported) return a.supported ? -1 : 1;
    return a.relativePath.localeCompare(b.relativePath);
  });

  const supportedCount = files.filter((f) => f.supported).length;

  return {
    folderPath: trimmed,
    scannedAt: new Date().toISOString(),
    totalFiles: files.length,
    supportedFiles: supportedCount,
    files,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function getInventoryPath(workbookId: string): string {
  return join(getAgentXLDataDir(), "inventories", `${workbookId}.json`);
}

/**
 * Save a folder inventory to disk for a given workbook.
 */
export function saveInventory(workbookId: string, inventory: FolderInventory): void {
  const path = getInventoryPath(workbookId);
  mkdirSync(dirname(path), { recursive: true });
  const data: PersistedInventory = { version: 1, inventory };
  const tempPath = `${path}.tmp`;
  writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
  renameSync(tempPath, path);
}

/**
 * Load a previously saved folder inventory for a given workbook.
 * Returns null if no inventory exists or if it's invalid.
 */
export function loadInventory(workbookId: string): FolderInventory | null {
  const path = getInventoryPath(workbookId);
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PersistedInventory>;
    if (parsed.version !== 1 || !parsed.inventory) return null;
    return parsed.inventory;
  } catch {
    return null;
  }
}

/**
 * Scan a folder, save the inventory, and return it.
 * This is the main entry point for folder scanning.
 */
export function scanAndSaveInventory(workbookId: string, folderPath: string): FolderInventory {
  const inventory = scanFolder(folderPath);
  saveInventory(workbookId, inventory);
  return inventory;
}
