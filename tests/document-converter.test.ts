/**
 * Unit tests for the document converter (PDF → Markdown).
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

// Create a minimal valid PDF for testing
// This is the smallest valid PDF that pdf-parse can handle
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

// Setup
tmpDir = mkdtempSync(join(tmpdir(), "agentxl-docconv-"));

await test("converts a PDF to Markdown", async () => {
  const dir = join(tmpDir, "test1");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "test.pdf"), createMinimalPdf());
  writeFileSync(join(dir, "data.csv"), "a,b\n1,2\n");

  const inventory = scanFolder(dir);
  const result = await convertDocuments(inventory);

  assert.equal(result.converted, 1);
  assert.equal(result.failed, 0);

  // Check that the MD file was created in .agentxl-cache
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
  assert.equal(r1.converted, 1);
  assert.equal(r1.cached, 0);

  // Second conversion — should be cached
  const r2 = await convertDocuments(inventory);
  assert.equal(r2.converted, 0);
  assert.equal(r2.cached, 1);
});

await test("re-converts when source PDF is modified", async () => {
  const dir = join(tmpDir, "test3");
  mkdirSync(dir, { recursive: true });
  const pdfPath = join(dir, "test.pdf");
  writeFileSync(pdfPath, createMinimalPdf());

  const inv1 = scanFolder(dir);
  await convertDocuments(inv1);

  // Touch the source file to make it newer
  await new Promise((r) => setTimeout(r, 100));
  writeFileSync(pdfPath, createMinimalPdf());

  const inv2 = scanFolder(dir);
  const r2 = await convertDocuments(inv2);
  assert.equal(r2.converted, 1, "Should re-convert modified PDF");
  assert.equal(r2.cached, 0);
});

await test("handles folders with no PDFs", async () => {
  const dir = join(tmpDir, "test4");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "data.csv"), "a,b\n1,2\n");

  const inventory = scanFolder(dir);
  const result = await convertDocuments(inventory);

  assert.equal(result.converted, 0);
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
  assert.equal(result.converted, 1);

  const cachePath = join(dir, ".agentxl-cache", "sub", "nested.pdf.md");
  assert.ok(existsSync(cachePath), "Nested cache file should exist");
});

// Cleanup
rmSync(tmpDir, { recursive: true, force: true });

console.log(
  `\n  ─────────────────────────────────────\n  ${passed + failed} tests: ${passed} passed, ${failed} failed\n  ─────────────────────────────────────\n`
);

if (failed > 0) process.exit(1);
