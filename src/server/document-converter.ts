/**
 * Document pre-converter — converts binary documents to readable Markdown.
 *
 * Runs at scan time (or on demand). Cached converted files live alongside
 * the source files in a `.agentxl-cache/` directory inside the linked folder.
 *
 * Currently handles:
 * - PDF → Markdown (via pdf-parse)
 *
 * XLSX and DOCX are NOT pre-converted — the agent writes extraction code
 * at runtime via bash, which is more powerful for structured data.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, dirname, basename, relative } from "path";
import type { FolderInventory, FileEntry } from "./folder-scanner.js";

/** Name of the cache directory inside the linked folder. */
const CACHE_DIR = ".agentxl-cache";

// ---------------------------------------------------------------------------
// PDF → Markdown
// ---------------------------------------------------------------------------

/**
 * Convert a single PDF file to Markdown.
 * Returns the text content, or an error message if parsing fails.
 */
async function pdfToMarkdown(pdfPath: string): Promise<string> {
  try {
    // pdf-parse v2 API: new PDFParse({ data }).getText()
    const { PDFParse } = await import("pdf-parse");
    const buffer = readFileSync(pdfPath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();

    const fileName = basename(pdfPath);
    const lines: string[] = [
      `# ${fileName}`,
      "",
      `> Extracted from PDF · ${result.total} page${result.total !== 1 ? "s" : ""}`,
      "",
    ];

    // Add metadata if available
    try {
      const infoResult = await parser.getInfo();
      const meta = infoResult?.info as Record<string, unknown> | undefined;
      if (meta?.Title) lines.push(`**Title:** ${meta.Title}  `);
      if (meta?.Author) lines.push(`**Author:** ${meta.Author}  `);
      if (lines[lines.length - 1] !== "") lines.push("");
    } catch {
      // Metadata extraction is optional
    }

    // Add the text content
    lines.push("---", "", result.text.trim());

    // Clean up
    await parser.destroy();

    return lines.join("\n");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `# ${basename(pdfPath)}\n\n> ⚠️ Failed to extract text: ${msg}`;
  }
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

/**
 * Get the cache path for a converted file.
 * E.g., `subfolder/invoice.pdf` → `<folderRoot>/.agentxl-cache/subfolder/invoice.pdf.md`
 */
function getCachePath(folderRoot: string, relativePath: string): string {
  return join(folderRoot, CACHE_DIR, `${relativePath}.md`);
}

/**
 * Check if a cached conversion exists and is newer than the source file.
 */
function isCacheValid(sourcePath: string, cachePath: string): boolean {
  if (!existsSync(cachePath)) return false;
  try {
    const sourceTime = statSync(sourcePath).mtimeMs;
    const cacheTime = statSync(cachePath).mtimeMs;
    return cacheTime >= sourceTime;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ConversionResult {
  /** Number of PDFs converted */
  converted: number;
  /** Number already cached (skipped) */
  cached: number;
  /** Number that failed */
  failed: number;
  /** Error messages for failures */
  errors: string[];
}

/**
 * Pre-convert all PDFs in an inventory to Markdown.
 * Skips files where the cache is still valid (source not modified).
 *
 * @param inventory - Folder inventory from scanner
 * @returns Summary of conversion results
 */
export async function convertDocuments(
  inventory: FolderInventory
): Promise<ConversionResult> {
  const result: ConversionResult = {
    converted: 0,
    cached: 0,
    failed: 0,
    errors: [],
  };

  const pdfs = inventory.files.filter(
    (f) => f.extension === ".pdf" && f.supported
  );

  if (pdfs.length === 0) return result;

  for (const file of pdfs) {
    const cachePath = getCachePath(inventory.folderPath, file.relativePath);

    // Skip if cache is still valid
    if (isCacheValid(file.absolutePath, cachePath)) {
      result.cached++;
      continue;
    }

    try {
      const markdown = await pdfToMarkdown(file.absolutePath);

      // Ensure cache directory exists
      const cacheDir = dirname(cachePath);
      mkdirSync(cacheDir, { recursive: true });

      writeFileSync(cachePath, markdown, "utf-8");
      result.converted++;
    } catch (err) {
      result.failed++;
      result.errors.push(
        `${file.relativePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return result;
}

/**
 * Get the markdown path for a source file, if it has been converted.
 * Returns null if no cached conversion exists.
 */
export function getConvertedPath(
  folderRoot: string,
  relativePath: string
): string | null {
  const cachePath = getCachePath(folderRoot, relativePath);
  return existsSync(cachePath) ? cachePath : null;
}

/**
 * Build a list of converted markdown files for agent context.
 * Returns entries like: `invoice.pdf → .agentxl-cache/invoice.pdf.md`
 */
export function listConvertedFiles(
  inventory: FolderInventory
): Array<{ source: string; converted: string }> {
  const entries: Array<{ source: string; converted: string }> = [];

  for (const file of inventory.files) {
    if (file.extension === ".pdf") {
      const cachePath = getCachePath(inventory.folderPath, file.relativePath);
      if (existsSync(cachePath)) {
        const convertedRelative = relative(inventory.folderPath, cachePath).replace(/\\/g, "/");
        entries.push({
          source: file.relativePath,
          converted: convertedRelative,
        });
      }
    }
  }

  return entries;
}
