/**
 * Build the per-message folder context block.
 *
 * This block is prepended to every user message and tells the agent:
 *   - Which folder is linked
 *   - What files are available (with sizes)
 *   - Which PDFs have been pre-converted to markdown
 *   - How to access XLSX / DOCX files (binary → code)
 *   - How to access text / CSV / MD files (read tool)
 *
 * Behavioral rules (citation format, review-before-write, extraction
 * workflow) live in the system prompt — see ./system-prompt.ts.
 * This module is file-inventory only.
 */

import type { FolderInventory } from "../../server/folder-scanner.js";
import { listConvertedFiles } from "../../server/document-converter.js";

/** Max supported files to list individually in context. */
export const MAX_FILES_IN_CONTEXT = 50;

/** Format file size for human-readable display. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Build a folder context block to prepend to the agent message.
 * Contains only the file inventory and access instructions — no
 * behavioral rules (those are in the system prompt).
 */
export function buildFolderContext(
  folderPath: string,
  inventory: FolderInventory
): string {
  const lines: string[] = [];

  lines.push("[AgentXL — Linked Folder]");
  lines.push("");
  lines.push(`Folder: ${folderPath}`);
  lines.push(
    `${inventory.supportedFiles} supported file${inventory.supportedFiles !== 1 ? "s" : ""}, ${inventory.totalFiles} total`
  );
  lines.push("");
  lines.push(
    "IMPORTANT: All file paths MUST be absolute paths under this folder."
  );

  // ── Supported files ────────────────────────────────────────────────────

  const supported = inventory.files.filter((f) => f.supported);
  const unsupported = inventory.files.filter((f) => !f.supported);

  if (supported.length > 0) {
    lines.push("");
    lines.push("Supported files:");
    const shown = supported.slice(0, MAX_FILES_IN_CONTEXT);
    for (const f of shown) {
      lines.push(`- ${f.relativePath} (${formatFileSize(f.sizeBytes)})`);
    }
    if (supported.length > MAX_FILES_IN_CONTEXT) {
      lines.push(
        `  ... and ${supported.length - MAX_FILES_IN_CONTEXT} more supported files`
      );
    }
  }

  if (unsupported.length > 0) {
    lines.push("");
    const unsupportedNames = unsupported
      .slice(0, 10)
      .map((f) => f.name)
      .join(", ");
    const suffix =
      unsupported.length > 10
        ? ` and ${unsupported.length - 10} more`
        : "";
    lines.push(
      `Unsupported files (cannot read): ${unsupportedNames}${suffix}`
    );
  }

  // ── PDF conversions ────────────────────────────────────────────────────

  const conversions = listConvertedFiles(inventory);
  if (conversions.length > 0) {
    lines.push("");
    lines.push("📄 PDF files (pre-converted to Markdown):");
    lines.push("Read the .md version, NOT the raw PDF.");
    for (const c of conversions) {
      lines.push(`- ${c.source} → READ: "${folderPath}/${c.converted}"`);
    }
  }

  // ── XLSX handling ──────────────────────────────────────────────────────

  const xlsxFiles = supported.filter(
    (f) => f.extension === ".xlsx" || f.extension === ".xls"
  );
  if (xlsxFiles.length > 0) {
    lines.push("");
    lines.push("📊 Excel files — do NOT read with the read tool (binary).");
    lines.push("Use bash + xlsx npm package:");
    lines.push("```");
    lines.push(
      `node -e "const XLSX = require('xlsx'); const wb = XLSX.readFile('${xlsxFiles[0].absolutePath}'); const ws = wb.Sheets[wb.SheetNames[0]]; console.log(JSON.stringify(XLSX.utils.sheet_to_json(ws), null, 2));"`
    );
    lines.push("```");
  }

  // ── DOCX handling ──────────────────────────────────────────────────────

  const docxFiles = supported.filter(
    (f) => f.extension === ".docx" || f.extension === ".doc"
  );
  if (docxFiles.length > 0) {
    lines.push("");
    lines.push("📝 Word files — do NOT read with the read tool (binary).");
    lines.push("Use bash + mammoth npm package:");
    lines.push("```");
    lines.push(
      `node -e "const mammoth = require('mammoth'); mammoth.convertToMarkdown({path: '${docxFiles[0].absolutePath}'}).then(r => console.log(r.value));"`
    );
    lines.push("```");
  }

  // ── Quick access examples ──────────────────────────────────────────────

  lines.push("");
  lines.push("File access:");
  lines.push(`- List: ls "${folderPath}"`);

  const textExample = supported.find(
    (f) => ![".pdf", ".xlsx", ".xls", ".docx", ".doc"].includes(f.extension)
  );
  if (textExample) {
    lines.push(`- Read text file: read "${textExample.absolutePath}"`);
  }

  lines.push(`- Search: grep with path "${folderPath}"`);

  return lines.join("\n");
}
