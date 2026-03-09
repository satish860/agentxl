/**
 * Atomic JSON file persistence helpers.
 *
 * Shared pattern: write to temp file, then rename atomically.
 * Used by workbook-folder-store and folder-scanner.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "fs";
import { dirname, join } from "path";
import { homedir } from "os";

/** Base directory for all AgentXL persisted data. */
export const AGENTXL_DATA_DIR = join(homedir(), ".agentxl");

/**
 * Atomically write a JSON file.
 * Writes to a temp file first, then renames to avoid partial writes.
 */
export function writeJsonFileAtomic(
  filePath: string,
  data: unknown
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
  renameSync(tempPath, filePath);
}

/**
 * Read and parse a JSON file.
 * Returns null if the file doesn't exist or can't be parsed.
 */
export function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
