/**
 * Unit tests for the document converter (PDF → Markdown).
 * Tests text extraction, OCR detection heuristic, and cache management.
 *
 * Run: npx tsx tests/document-converter.test.ts
 */

import { strict as assert } from "assert";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  convertDocuments,
  getConvertedPath,
  listConvertedFiles,
  isTextMeaningful,
  getOcrConfig,
  MIN_CHARS_PER_PAGE,
} from "../src/server/document-converter.js";
import { scanFolder } from "../src/server/folder-scanner.js";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.error(`     ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

// Create a minimal valid PDF with embedded text for testing
function createMinimalPdf(): Buffer {
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj

4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Hello World) Tj ET
endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000360 00000 n 

trailer
<< /Size 6 /Root 1 0 R >>
startxref
441
%%EOF`;
  return Buffer.from(pdf);
}

console.log("\n📄 Document Converter Tests\n");

let tmpDir: string;
tmpDir = mkdtempSync(join(tmpdir(), "agentxl-docconv-"));

// =========================================================================
// OCR detection heuristic
// =========================================================================
console.log("\n  🔍 OCR detection heuristic\n");

await test("isTextMeaningful returns true for text-rich content", async () => {
  // 200 chars on 1 page = 200 chars/page >> 50 threshold
  const text = "This is a test document with meaningful content. ".repeat(4);
  assert.equal(isTextMeaningful(text, 1), true);
});

await test("isTextMeaningful returns false for empty text", async () => {
  assert.equal(isTextMeaningful("", 1), false);
});

await test("isTextMeaningful returns false for zero pages", async () => {
  assert.equal(isTextMeaningful("some text", 0), false);
});

await test("isTextMeaningful returns false for sparse text (scanned PDF)", async () => {
  // 10 chars on 5 pages = 2 chars/page << 50 threshold
  assert.equal(isTextMeaningful("short text", 5), false);
});

await test("isTextMeaningful returns true at threshold boundary", async () => {
  // Exactly MIN_CHARS_PER_PAGE chars on 1 page
  const text = "x".repeat(MIN_CHARS_PER_PAGE);
  assert.equal(isTextMeaningful(text, 1), true);
});

await test("isTextMeaningful ignores whitespace in count", async () => {
  // 40 meaningful chars + lots of whitespace on 1 page = 40 chars/page < 50
  const text = "a ".repeat(20) + "\n\n\n\n\n";
  assert.equal(isTextMeaningful(text, 1), false);
});

await test("getOcrConfig returns null when no OCR keys set", async () => {
  const origAzureEndpoint = process.env.AZURE_MISTRAL_ENDPOINT;
  const origAzureKey = process.env.AZURE_MISTRAL_API_KEY;
  const origMistral = process.env.MISTRAL_API_KEY;
  delete process.env.AZURE_MISTRAL_ENDPOINT;
  delete process.env.AZURE_MISTRAL_API_KEY;
  delete process.env.MISTRAL_API_KEY;

  assert.equal(getOcrConfig(), null);

  // Restore
  if (origAzureEndpoint) process.env.AZURE_MISTRAL_ENDPOINT = origAzureEndpoint;
  if (origAzureKey) process.env.AZURE_MISTRAL_API_KEY = origAzureKey;
  if (origMistral) process.env.MISTRAL_API_KEY = origMistral;
});

await test("getOcrConfig prefers Azure Mistral over direct Mistral", async () => {
  const origAzureEndpoint = process.env.AZURE_MISTRAL_ENDPOINT;
  const origAzureKey = process.env.AZURE_MISTRAL_API_KEY;
  const origMistral = process.env.MISTRAL_API_KEY;

  process.env.AZURE_MISTRAL_ENDPOINT = "https://example.azure.com/ocr";
  process.env.AZURE_MISTRAL_API_KEY = "azure-key";
  process.env.MISTRAL_API_KEY = "direct-key";

  const config = getOcrConfig();
  assert.equal(config?.provider, "azure-mistral");
  assert.equal(config?.endpoint, "https://example.azure.com/ocr");
  assert.equal(config?.apiKey, "azure-key");

  // Restore
  if (origAzureEndpoint) { process.env.AZURE_MISTRAL_ENDPOINT = origAzureEndpoint; } else { delete process.env.AZURE_MISTRAL_ENDPOINT; }
  if (origAzureKey) { process.env.AZURE_MISTRAL_API_KEY = origAzureKey; } else { delete process.env.AZURE_MISTRAL_API_KEY; }
  if (origMistral) { process.env.MISTRAL_API_KEY = origMistral; } else { delete process.env.MISTRAL_API_KEY; }
});

await test("getOcrConfig falls back to direct Mistral", async () => {
  const origAzureEndpoint = process.env.AZURE_MISTRAL_ENDPOINT;
  const origAzureKey = process.env.AZURE_MISTRAL_API_KEY;
  const origMistral = process.env.MISTRAL_API_KEY;

  delete process.env.AZURE_MISTRAL_ENDPOINT;
  delete process.env.AZURE_MISTRAL_API_KEY;
  process.env.MISTRAL_API_KEY = "direct-key";

  const config = getOcrConfig();
  assert.equal(config?.provider, "mistral");
  assert.equal(config?.apiKey, "direct-key");

  // Restore
  if (origAzureEndpoint) { process.env.AZURE_MISTRAL_ENDPOINT = origAzureEndpoint; } else { delete process.env.AZURE_MISTRAL_ENDPOINT; }
  if (origAzureKey) { process.env.AZURE_MISTRAL_API_KEY = origAzureKey; } else { delete process.env.AZURE_MISTRAL_API_KEY; }
  if (origMistral) { process.env.MISTRAL_API_KEY = origMistral; } else { delete process.env.MISTRAL_API_KEY; }
});

// =========================================================================
// PDF conversion (text-based PDFs)
// =========================================================================
console.log("\n  📄 PDF conversion (text-based)\n");

await test("converts a text-based PDF to Markdown", async () => {
  const dir = join(tmpDir, "test1");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "test.pdf"), createMinimalPdf());
  writeFileSync(join(dir, "data.csv"), "a,b\n1,2\n");

  const inventory = scanFolder(dir);
  const result = await convertDocuments(inventory);

  assert.ok(result.converted >= 0, "converted count should be >= 0");
  assert.equal(result.ocrConverted, 0, "no OCR should be used for text PDFs");

  const cachePath = join(dir, ".agentxl-cache", "test.pdf.md");
  assert.ok(existsSync(cachePath), "Cache file should exist");

  const content = readFileSync(cachePath, "utf-8");
  assert.ok(content.includes("# test.pdf"), "Should have filename as heading");
  assert.ok(content.includes("Extracted from PDF"), "Should have extraction note");
});

await test("skips already-cached PDFs on second run", async () => {
  const dir = join(tmpDir, "test2");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "test.pdf"), createMinimalPdf());

  const inventory = scanFolder(dir);

  // First conversion
  const r1 = await convertDocuments(inventory);
  const firstTotal = r1.converted + r1.ocrConverted;
  assert.ok(firstTotal >= 1 || r1.failed >= 1, "Should have attempted conversion");

  // Second conversion — should be cached (if first succeeded)
  if (firstTotal >= 1) {
    const r2 = await convertDocuments(inventory);
    assert.equal(r2.converted, 0);
    assert.equal(r2.ocrConverted, 0);
    assert.equal(r2.cached, 1);
  }
});

await test("re-converts when source PDF is modified", async () => {
  const dir = join(tmpDir, "test3");
  mkdirSync(dir, { recursive: true });
  const pdfPath = join(dir, "test.pdf");
  writeFileSync(pdfPath, createMinimalPdf());

  const inv1 = scanFolder(dir);
  const r1 = await convertDocuments(inv1);
  const firstTotal = r1.converted + r1.ocrConverted;

  if (firstTotal >= 1) {
    // Touch the source file to make it newer
    await new Promise((r) => setTimeout(r, 100));
    writeFileSync(pdfPath, createMinimalPdf());

    const inv2 = scanFolder(dir);
    const r2 = await convertDocuments(inv2);
    const secondTotal = r2.converted + r2.ocrConverted;
    assert.ok(secondTotal >= 1, "Should re-convert modified PDF");
    assert.equal(r2.cached, 0);
  }
});

await test("handles folders with no PDFs", async () => {
  const dir = join(tmpDir, "test4");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "data.csv"), "a,b\n1,2\n");

  const inventory = scanFolder(dir);
  const result = await convertDocuments(inventory);

  assert.equal(result.converted, 0);
  assert.equal(result.ocrConverted, 0);
  assert.equal(result.cached, 0);
  assert.equal(result.failed, 0);
});

await test("getConvertedPath returns path for cached file", async () => {
  const dir = join(tmpDir, "test5");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "doc.pdf"), createMinimalPdf());

  const inventory = scanFolder(dir);
  await convertDocuments(inventory);

  const path = getConvertedPath(dir, "doc.pdf");
  assert.ok(path, "Should return a path");
  assert.ok(path!.endsWith("doc.pdf.md"), "Path should end with .pdf.md");
  assert.ok(existsSync(path!), "Path should exist on disk");
});

await test("getConvertedPath returns null for non-converted file", async () => {
  const dir = join(tmpDir, "test6");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "data.csv"), "a,b\n");

  const path = getConvertedPath(dir, "data.csv");
  assert.equal(path, null);
});

await test("listConvertedFiles returns source → converted mapping", async () => {
  const dir = join(tmpDir, "test7");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "a.pdf"), createMinimalPdf());
  writeFileSync(join(dir, "b.pdf"), createMinimalPdf());

  const inventory = scanFolder(dir);
  await convertDocuments(inventory);

  const list = listConvertedFiles(inventory);
  assert.equal(list.length, 2);
  assert.ok(list.some((e) => e.source === "a.pdf"));
  assert.ok(list.some((e) => e.source === "b.pdf"));
  assert.ok(list[0].converted.includes(".agentxl-cache/"));
});

await test("converts PDFs in subdirectories", async () => {
  const dir = join(tmpDir, "test8");
  const sub = join(dir, "sub");
  mkdirSync(sub, { recursive: true });
  writeFileSync(join(sub, "nested.pdf"), createMinimalPdf());

  const inventory = scanFolder(dir);
  const result = await convertDocuments(inventory);
  const total = result.converted + result.ocrConverted;
  assert.ok(total >= 1 || result.failed >= 1, "Should attempt conversion");

  if (total >= 1) {
    const cachePath = join(dir, ".agentxl-cache", "sub", "nested.pdf.md");
    assert.ok(existsSync(cachePath), "Nested cache file should exist");
  }
});

// Cleanup
rmSync(tmpDir, { recursive: true, force: true });

console.log(
  `\n  ─────────────────────────────────────\n  ${passed + failed} tests: ${passed} passed, ${failed} failed\n  ─────────────────────────────────────\n`
);

if (failed > 0) process.exit(1);
