/**
 * Document pre-converter — converts binary documents to readable Markdown.
 *
 * Runs at scan time (or on demand). Cached converted files live alongside
 * the source files in a `.agentxl-cache/` directory inside the linked folder.
 *
 * PDF conversion strategy:
 * 1. Try pdf-parse (fast, local, free) — extracts embedded text
 * 2. Check if extracted text is meaningful (chars-per-page heuristic)
 * 3. If scanned/image PDF → fall back to Mistral OCR API
 *
 * XLSX and DOCX are NOT pre-converted — the agent writes extraction code
 * at runtime via bash, which is more powerful for structured data.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, dirname, basename, relative } from "path";
import type { FolderInventory } from "./folder-scanner.js";

/** Name of the cache directory inside the linked folder. */
const CACHE_DIR = ".agentxl-cache";

/**
 * Minimum average characters per page to consider text extraction successful.
 * Below this threshold, the PDF is likely scanned/image-based and needs OCR.
 */
const MIN_CHARS_PER_PAGE = 50;

// ---------------------------------------------------------------------------
// PDF text extraction (local, fast)
// ---------------------------------------------------------------------------

interface TextExtractionResult {
  text: string;
  pageCount: number;
  title?: string;
  author?: string;
}

/**
 * Extract text from a PDF using pdf-parse (local, no API call).
 * Returns null if the PDF has no meaningful embedded text.
 */
async function extractPdfText(pdfPath: string): Promise<TextExtractionResult | null> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const buffer = readFileSync(pdfPath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();

    let title: string | undefined;
    let author: string | undefined;
    try {
      const infoResult = await parser.getInfo();
      const meta = infoResult?.info as Record<string, unknown> | undefined;
      if (meta?.Title && typeof meta.Title === "string") title = meta.Title;
      if (meta?.Author && typeof meta.Author === "string") author = meta.Author;
    } catch {
      // Metadata is optional
    }

    await parser.destroy();

    const cleanText = result.text.trim();
    return {
      text: cleanText,
      pageCount: result.total,
      title,
      author,
    };
  } catch {
    return null;
  }
}

/**
 * Check if extracted text is meaningful (not just whitespace/control chars).
 * Scanned PDFs often return empty or near-empty text.
 */
function isTextMeaningful(text: string, pageCount: number): boolean {
  if (!text || pageCount === 0) return false;

  // Strip whitespace and control characters
  const meaningful = text.replace(/[\s\x00-\x1f]/g, "");
  const charsPerPage = meaningful.length / pageCount;

  return charsPerPage >= MIN_CHARS_PER_PAGE;
}

// ---------------------------------------------------------------------------
// OCR configuration (Azure Mistral or direct Mistral)
// ---------------------------------------------------------------------------

interface OcrConfig {
  provider: "azure-mistral" | "mistral";
  endpoint?: string;
  apiKey: string;
}

/**
 * Detect which OCR provider is available.
 * Priority: Azure Mistral (enterprise) → direct Mistral → null
 */
function getOcrConfig(): OcrConfig | null {
  // Azure Mistral (enterprise — Azure AI Services)
  const azureEndpoint = process.env.AZURE_MISTRAL_ENDPOINT?.trim();
  const azureKey = process.env.AZURE_MISTRAL_API_KEY?.trim();
  if (azureEndpoint && azureKey) {
    return { provider: "azure-mistral", endpoint: azureEndpoint, apiKey: azureKey };
  }

  // Direct Mistral API
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  if (mistralKey) {
    return { provider: "mistral", apiKey: mistralKey };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Azure Mistral OCR
// ---------------------------------------------------------------------------

/**
 * OCR a PDF using Azure-hosted Mistral OCR.
 * Sends the PDF as a base64 data URL — no file upload step needed.
 */
async function ocrWithAzureMistral(
  pdfPath: string,
  endpoint: string,
  apiKey: string
): Promise<string> {
  const buffer = readFileSync(pdfPath);
  const base64 = buffer.toString("base64");
  const dataUrl = `data:application/pdf;base64,${base64}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document: {
        type: "document_url",
        document_url: dataUrl,
      },
      table_format: "markdown",
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Azure Mistral OCR failed (${response.status}): ${body.slice(0, 200)}`
    );
  }

  const result = (await response.json()) as {
    pages: Array<{ markdown: string }>;
  };

  return result.pages.map((p) => p.markdown).join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Direct Mistral OCR
// ---------------------------------------------------------------------------

/**
 * OCR a PDF using Mistral's direct API.
 * Uploads the file, runs OCR, returns markdown.
 */
async function ocrWithDirectMistral(
  pdfPath: string,
  apiKey: string
): Promise<string> {
  const { Mistral } = await import("@mistralai/mistralai");
  const client = new Mistral({ apiKey });

  // Upload the PDF file
  const buffer = readFileSync(pdfPath);
  const fileName = basename(pdfPath);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const file = new File([blob], fileName, { type: "application/pdf" });

  const uploaded = await client.files.upload({
    file,
    purpose: "ocr" as any,
  });

  // Run OCR
  const ocrResult = await client.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      type: "file",
      fileId: uploaded.id,
    },
    tableFormat: "markdown",
  });

  // Combine all pages into markdown
  const pages = ocrResult.pages.map((page) => page.markdown);

  // Clean up the uploaded file (best effort)
  try {
    await client.files.delete({ fileId: uploaded.id });
  } catch {
    // Non-fatal
  }

  return pages.join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Unified OCR dispatcher
// ---------------------------------------------------------------------------

/**
 * OCR a PDF using the best available provider.
 */
async function ocrPdf(pdfPath: string): Promise<string> {
  const config = getOcrConfig();
  if (!config) {
    throw new Error(
      "No OCR provider configured. Scanned PDFs need Mistral OCR.\n" +
      "Set AZURE_MISTRAL_ENDPOINT + AZURE_MISTRAL_API_KEY (Azure)\n" +
      "or MISTRAL_API_KEY (direct) in .env to enable OCR."
    );
  }

  if (config.provider === "azure-mistral") {
    return ocrWithAzureMistral(pdfPath, config.endpoint!, config.apiKey);
  }

  return ocrWithDirectMistral(pdfPath, config.apiKey);
}

// ---------------------------------------------------------------------------
// PDF → Markdown (smart: text-first, OCR fallback)
// ---------------------------------------------------------------------------

/**
 * Convert a single PDF to Markdown.
 *
 * Strategy:
 * 1. Try local text extraction (pdf-parse) — fast, free
 * 2. If text is empty/sparse → PDF is scanned → use Mistral OCR
 * 3. If no Mistral key → return what we have with a warning
 */
async function pdfToMarkdown(pdfPath: string): Promise<string> {
  const fileName = basename(pdfPath);

  // Step 1: Try local text extraction
  const extraction = await extractPdfText(pdfPath);

  if (extraction && isTextMeaningful(extraction.text, extraction.pageCount)) {
    // Good text extraction — use it directly
    return formatPdfMarkdown(fileName, extraction.text, extraction.pageCount, {
      title: extraction.title,
      author: extraction.author,
      method: "text-extraction",
    });
  }

  // Step 2: Text is empty/sparse — try OCR (Azure Mistral or direct Mistral)
  const pageCount = extraction?.pageCount ?? 0;
  const sparseText = extraction?.text ?? "";

  try {
    const ocrText = await ocrPdf(pdfPath);
    const config = getOcrConfig();
    return formatPdfMarkdown(fileName, ocrText, pageCount, {
      title: extraction?.title,
      author: extraction?.author,
      method: config?.provider === "azure-mistral" ? "azure-mistral-ocr" : "mistral-ocr",
    });
  } catch (err) {
    const ocrError = err instanceof Error ? err.message : String(err);

    // No OCR available — return whatever we got (possibly empty)
    if (sparseText) {
      return formatPdfMarkdown(fileName, sparseText, pageCount, {
        title: extraction?.title,
        author: extraction?.author,
        method: "text-extraction (partial)",
        warning: `This PDF appears to be scanned/image-based. Text extraction may be incomplete. OCR failed: ${ocrError}`,
      });
    }

    return `# ${fileName}\n\n> ⚠️ This PDF is scanned/image-based and could not be read.\n> Text extraction returned no content.\n> OCR failed: ${ocrError}\n\nSet AZURE_MISTRAL_ENDPOINT + AZURE_MISTRAL_API_KEY or MISTRAL_API_KEY to enable OCR.`;
  }
}

/**
 * Format extracted PDF content as clean Markdown.
 */
function formatPdfMarkdown(
  fileName: string,
  text: string,
  pageCount: number,
  opts: {
    title?: string;
    author?: string;
    method: string;
    warning?: string;
  }
): string {
  const lines: string[] = [
    `# ${fileName}`,
    "",
    `> Extracted from PDF · ${pageCount} page${pageCount !== 1 ? "s" : ""} · ${opts.method}`,
    "",
  ];

  if (opts.title) lines.push(`**Title:** ${opts.title}  `);
  if (opts.author) lines.push(`**Author:** ${opts.author}  `);
  if (opts.title || opts.author) lines.push("");

  if (opts.warning) {
    lines.push(`> ⚠️ ${opts.warning}`, "");
  }

  lines.push("---", "", text.trim());
  return lines.join("\n");
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
  /** Number of PDFs converted via text extraction */
  converted: number;
  /** Number of PDFs converted via Mistral OCR */
  ocrConverted: number;
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
    ocrConverted: 0,
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

      // Detect which method was used
      const usedOcr = markdown.includes("mistral-ocr");

      // Ensure cache directory exists
      const cacheDir = dirname(cachePath);
      mkdirSync(cacheDir, { recursive: true });

      writeFileSync(cachePath, markdown, "utf-8");

      if (usedOcr) {
        result.ocrConverted++;
      } else {
        result.converted++;
      }
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

// Exports for testing
export { isTextMeaningful, getOcrConfig, MIN_CHARS_PER_PAGE };
export type { OcrConfig };
