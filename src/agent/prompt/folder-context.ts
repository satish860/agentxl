/**
 * Build the folder context block prepended to every agent message.
 *
 * This is the primary mechanism for grounding the agent:
 * - Tells the agent what files are available
 * - Teaches absolute-path discipline
 * - Provides file listing and usage examples
 * - Explains document handling strategies (PDF→MD, XLSX/DOCX via code)
 *
 * Extracted as its own module because this prompt will be tuned
 * frequently as document behavior improves.
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
 * Gives the agent awareness of what files are available and
 * how to access them.
 */
export function buildFolderContext(
  folderPath: string,
  inventory: FolderInventory
): string {
  const lines: string[] = [];

  lines.push("[AgentXL Context]");
  lines.push("");
  lines.push(
    "You are AgentXL, a document-to-Excel agent. The user's source documents are in the linked folder below."
  );
  lines.push(
    "Ground every answer in these files. Cite the source file when you reference a value."
  );
  lines.push(
    "If the folder does not contain enough evidence, say so. Do not fabricate data."
  );
  lines.push("");
  lines.push(
    "IMPORTANT: All file operations MUST use absolute paths under the linked folder."
  );
  lines.push(`The linked folder is: ${folderPath}`);
  lines.push(
    "Do NOT use relative paths. Do NOT read files from the current working directory."
  );
  lines.push(`When the user asks about files, they mean files in: ${folderPath}`);
  lines.push(
    `${inventory.supportedFiles} supported file${inventory.supportedFiles !== 1 ? "s" : ""}, ${inventory.totalFiles} total`
  );

  const supported = inventory.files.filter((f) => f.supported);
  const unsupported = inventory.files.filter((f) => !f.supported);

  if (supported.length > 0) {
    lines.push("");
    lines.push("Supported files (you can read these):");
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

  // -----------------------------------------------------------------------
  // Document handling instructions
  // -----------------------------------------------------------------------

  // PDF conversions
  const conversions = listConvertedFiles(inventory);
  if (conversions.length > 0) {
    lines.push("");
    lines.push("📄 PDF files (pre-converted to Markdown):");
    lines.push("PDFs have been converted to readable Markdown. Read the .md version, NOT the raw PDF.");
    for (const c of conversions) {
      lines.push(`- ${c.source} → READ: "${folderPath}/${c.converted}"`);
    }
  }

  // XLSX handling
  const xlsxFiles = supported.filter((f) => f.extension === ".xlsx" || f.extension === ".xls");
  if (xlsxFiles.length > 0) {
    lines.push("");
    lines.push("📊 Excel files (use code to extract):");
    lines.push("Do NOT try to read .xlsx/.xls with the read tool — they are binary.");
    lines.push("Write a Node.js script via bash that uses the `xlsx` npm package (already installed).");
    lines.push("Example:");
    lines.push("```");
    lines.push(`bash: node -e "const XLSX = require('xlsx'); const wb = XLSX.readFile('${xlsxFiles[0].absolutePath}'); const ws = wb.Sheets[wb.SheetNames[0]]; console.log(JSON.stringify(XLSX.utils.sheet_to_json(ws), null, 2));"`);
    lines.push("```");
  }

  // DOCX handling
  const docxFiles = supported.filter((f) => f.extension === ".docx" || f.extension === ".doc");
  if (docxFiles.length > 0) {
    lines.push("");
    lines.push("📝 Word files (use code to extract):");
    lines.push("Do NOT try to read .docx/.doc with the read tool — they are binary.");
    lines.push("Write a Node.js script via bash that uses the `mammoth` npm package (already installed).");
    lines.push("Example:");
    lines.push("```");
    lines.push(`bash: node -e "const mammoth = require('mammoth'); mammoth.convertToMarkdown({path: '${docxFiles[0].absolutePath}'}).then(r => console.log(r.value));"`);
    lines.push("```");
  }

  // -----------------------------------------------------------------------
  // Code-first extraction strategy
  // -----------------------------------------------------------------------

  lines.push("");
  lines.push("⚡ EXTRACTION STRATEGY — WRITE CODE, DON'T QUERY ONE-BY-ONE:");
  lines.push("");
  lines.push("When extracting multiple fields or details from documents, ALWAYS write a");
  lines.push("Node.js script via bash that reads the files and extracts everything in one shot.");
  lines.push("Do NOT make 10+ individual read/grep calls — that's slow and wastes tokens.");
  lines.push("");
  lines.push("Pattern: write a script → run it → get structured JSON → write to Excel.");
  lines.push("");
  lines.push("Example — extracting lease terms from converted PDFs:");
  lines.push("```");
  lines.push("bash: node -e \"");
  lines.push("const fs = require('fs');");
  lines.push("const path = require('path');");
  lines.push("");
  lines.push("// Read all converted markdown files at once");
  lines.push(`const cacheDir = '${folderPath}/.agentxl-cache';`);
  lines.push("const files = fs.readdirSync(cacheDir, {recursive: true})");
  lines.push("  .filter(f => f.endsWith('.md'));");
  lines.push("");
  lines.push("const results = {};");
  lines.push("for (const file of files) {");
  lines.push("  const text = fs.readFileSync(path.join(cacheDir, file), 'utf8');");
  lines.push("  // Extract fields with regex or string matching");
  lines.push("  const dateMatch = text.match(/(?:effective date|commencement)[:\\s]+(\\d{1,2}[\\s\\/.-]\\w+[\\s\\/.-]\\d{2,4})/i);");
  lines.push("  const termMatch = text.match(/(?:term|duration|period)[:\\s]+(\\d+\\s*(?:months?|years?))/i);");
  lines.push("  results[file] = {");
  lines.push("    effectiveDate: dateMatch?.[1] || null,");
  lines.push("    term: termMatch?.[1] || null,");
  lines.push("    // Add more fields as needed");
  lines.push("  };");
  lines.push("}");
  lines.push("console.log(JSON.stringify(results, null, 2));");
  lines.push("\"");
  lines.push("```");
  lines.push("");
  lines.push("Use this approach for:");
  lines.push("- Extracting multiple fields from lease/contract documents");
  lines.push("- Comparing values across multiple source files");
  lines.push("- Building structured data from unstructured text");
  lines.push("- Processing CSV/TSV files with specific filtering");
  lines.push("");
  lines.push("Use simple read/grep only for:");
  lines.push("- Quick single-value lookups");
  lines.push("- Checking if a file contains a specific term");
  lines.push("- Reading small files in full");

  // -----------------------------------------------------------------------
  // General file access
  // -----------------------------------------------------------------------

  lines.push("");
  lines.push("How to access files:");
  lines.push(`- To list files: ls "${folderPath}"`);
  if (supported.length > 0) {
    const textExample = supported.find(
      (f) => ![".pdf", ".xlsx", ".xls", ".docx", ".doc"].includes(f.extension)
    );
    if (textExample) {
      lines.push(`- To read a text file: read "${textExample.absolutePath}"`);
    }
  }
  lines.push(`- To search text files: grep with path "${folderPath}"`);
  lines.push(
    'Always use the FULL ABSOLUTE PATH shown above. Never use "." or relative paths.'
  );

  return lines.join("\n");
}
