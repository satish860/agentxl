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
  // EXTRACTION + CITATION WORKFLOW (mandatory)
  // -----------------------------------------------------------------------

  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("⚡ EXTRACTION WORKFLOW — WRITE CODE + CITE EVERY VALUE");
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push("When extracting data from documents to write to Excel, you MUST follow");
  lines.push("this 3-step workflow. This is NOT optional — every value needs a citation.");
  lines.push("");
  lines.push("STEP 1: EXTRACT WITH CITATIONS (bash script)");
  lines.push("─────────────────────────────────────────────");
  lines.push("Write a Node.js script that reads the source files and returns structured");
  lines.push("JSON with BOTH the value AND its citation. Do NOT make 10+ individual");
  lines.push("read/grep calls — extract everything in one script run.");
  lines.push("");
  lines.push("The script MUST output JSON in this exact format:");
  lines.push("```json");
  lines.push("{");
  lines.push('  "fieldName": {');
  lines.push('    "value": "the extracted value",');
  lines.push('    "source": "Original File Name.pdf",');
  lines.push('    "page": 14,');
  lines.push('    "excerpt": "...surrounding ~150 chars with the extracted value in context..."');
  lines.push("  }");
  lines.push("}");
  lines.push("```");
  lines.push("");
  lines.push("How to determine page numbers from converted markdown:");
  lines.push("- PDF markdown files have `---` page separators");
  lines.push("- Count `---` separators before the match to get the page number");
  lines.push("- For XLSX: use sheet name + cell reference as 'page'");
  lines.push("- For DOCX: use section heading as 'page'");
  lines.push("");
  lines.push("How to capture excerpts:");
  lines.push("- Find the match position in the text");
  lines.push("- Take ~75 chars before and ~75 chars after the match");
  lines.push("- Trim to word boundaries");
  lines.push("- Prefix/suffix with '...' if truncated");
  lines.push("");
  lines.push("Example extraction script:");
  lines.push("```");
  lines.push(`bash: node -e "`);
  lines.push("const fs = require('fs');");
  lines.push("const path = require('path');");
  lines.push(`const cacheDir = '${folderPath}/.agentxl-cache';`);
  lines.push("const files = fs.readdirSync(cacheDir, {recursive: true}).filter(f => f.toString().endsWith('.md'));");
  lines.push("const results = {};");
  lines.push("for (const f of files) {");
  lines.push("  const text = fs.readFileSync(path.join(cacheDir, f.toString()), 'utf8');");
  lines.push("  const sourceFile = f.toString().replace('.md','');");
  lines.push("  // Count pages by --- separators");
  lines.push("  function getPage(pos) { return (text.slice(0, pos).match(/^---$/gm) || []).length + 1; }");
  lines.push("  function getExcerpt(pos, len) {");
  lines.push("    const start = Math.max(0, pos - 75);");
  lines.push("    const end = Math.min(text.length, pos + len + 75);");
  lines.push("    return (start > 0 ? '...' : '') + text.slice(start, end).replace(/\\n/g, ' ').trim() + (end < text.length ? '...' : '');");
  lines.push("  }");
  lines.push("  const termMatch = text.match(/(?:lease\\s+term|term\\s+of\\s+(?:the\\s+)?lease)[:\\s]+([^.\\n]+)/i);");
  lines.push("  if (termMatch) {");
  lines.push("    results.leaseTerm = {");
  lines.push("      value: termMatch[1].trim(),");
  lines.push("      source: sourceFile,");
  lines.push("      page: getPage(termMatch.index),");
  lines.push("      excerpt: getExcerpt(termMatch.index, termMatch[0].length)");
  lines.push("    };");
  lines.push("  }");
  lines.push("  // ... add more fields with same pattern");
  lines.push("}");
  lines.push("console.log(JSON.stringify(results, null, 2));");
  lines.push('"');
  lines.push("```");
  lines.push("");
  lines.push("If a value is INFERRED (not directly quoted from a source), mark it:");
  lines.push('  "source": "INFERRED",');
  lines.push('  "page": null,');
  lines.push('  "excerpt": "Reasoning: [explain why you inferred this value]"');
  lines.push("");
  lines.push("STEP 2: WRITE VALUES + COMMENTS TO EXCEL (excel tool)");
  lines.push("─────────────────────────────────────────────────────");
  lines.push("After extracting data with citations, write to Excel in ONE excel tool call.");
  lines.push("For EVERY cell you write, also add an Excel comment (note) with the citation.");
  lines.push("");
  lines.push("```javascript");
  lines.push("// Inside Excel.run(async (context) => { ... }):");
  lines.push("const sheet = context.workbook.worksheets.getItem('SheetName');");
  lines.push("");
  lines.push("// Write value");
  lines.push("const cell = sheet.getRange('B5');");
  lines.push("cell.values = [['12 months']];");
  lines.push("");
  lines.push("// Add citation comment");
  lines.push("cell.note = '📄 Source: Operating Lease.pdf\\n📑 Page: 14\\n💬 \"...the lease term shall be twelve (12) months from the Delivery Date...\"\\n🤖 Extracted by AgentXL';");
  lines.push("");
  lines.push("// For inferred values:");
  lines.push("// cell.note = '⚠️ Inferred — no direct source citation\\n💬 Reasoning: Based on aircraft registration VT-YBH (Indian registry)\\n🤖 Extracted by AgentXL';");
  lines.push("");
  lines.push("await context.sync();");
  lines.push("```");
  lines.push("");
  lines.push("STEP 3: LOG TO _AgentXL_Sources SHEET (excel tool)");
  lines.push("──────────────────────────────────────────────────");
  lines.push("After writing values, append citation records to a Sources sheet.");
  lines.push("Create it if it doesn't exist. This is the audit trail.");
  lines.push("");
  lines.push("```javascript");
  lines.push("// Inside Excel.run(async (context) => { ... }):");
  lines.push("let sourcesSheet;");
  lines.push("try {");
  lines.push("  sourcesSheet = context.workbook.worksheets.getItem('_AgentXL_Sources');");
  lines.push("} catch {");
  lines.push("  // Create the sheet if it doesn't exist");
  lines.push("  sourcesSheet = context.workbook.worksheets.add('_AgentXL_Sources');");
  lines.push("  const header = sourcesSheet.getRange('A1:G1');");
  lines.push("  header.values = [['Target Sheet', 'Target Cell', 'Value', 'Source File', 'Page', 'Excerpt', 'Timestamp']];");
  lines.push("  header.format.font.bold = true;");
  lines.push("  header.format.fill.color = '#4472C4';");
  lines.push("  header.format.font.color = '#FFFFFF';");
  lines.push("  // Set column widths");
  lines.push("  sourcesSheet.getRange('A:A').format.columnWidth = 100;");
  lines.push("  sourcesSheet.getRange('B:B').format.columnWidth = 70;");
  lines.push("  sourcesSheet.getRange('C:C').format.columnWidth = 120;");
  lines.push("  sourcesSheet.getRange('D:D').format.columnWidth = 180;");
  lines.push("  sourcesSheet.getRange('E:E').format.columnWidth = 50;");
  lines.push("  sourcesSheet.getRange('F:F').format.columnWidth = 300;");
  lines.push("  sourcesSheet.getRange('G:G').format.columnWidth = 140;");
  lines.push("}");
  lines.push("");
  lines.push("// Find next empty row");
  lines.push("const usedRange = sourcesSheet.getUsedRange();");
  lines.push("usedRange.load('rowCount');");
  lines.push("await context.sync();");
  lines.push("const nextRow = usedRange.rowCount + 1;");
  lines.push("");
  lines.push("// Append citation rows (one per written cell)");
  lines.push("const timestamp = new Date().toISOString();");
  lines.push("sourcesSheet.getRange(`A${nextRow}:G${nextRow}`).values = [[");
  lines.push("  'Redelivery Details',  // target sheet");
  lines.push("  'B5',                  // target cell");
  lines.push("  '12 months',           // value written");
  lines.push("  'Operating Lease.pdf', // source file");
  lines.push("  14,                    // page number");
  lines.push("  '...the lease term shall be twelve (12) months...', // excerpt");
  lines.push("  timestamp");
  lines.push("]];");
  lines.push("await context.sync();");
  lines.push("```");
  lines.push("");
  lines.push("IMPORTANT RULES:");
  lines.push("- NEVER write a value to Excel without adding a citation comment.");
  lines.push("- NEVER skip the _AgentXL_Sources entry.");
  lines.push("- If you cannot find a source for a value, mark it as INFERRED with reasoning.");
  lines.push("- Combine Steps 2 and 3 into a SINGLE excel tool call when possible.");
  lines.push("- The _AgentXL_Sources sheet is APPEND-ONLY — never delete existing rows.");
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
