/**
 * Acceptance tests for Task 5: Folder scanning and file inventory.
 *
 * Run: npx tsx tests/folder-scanner.test.ts
 */

import { strict as assert } from "assert";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  scanFolder,
  saveInventory,
  loadInventory,
  scanAndSaveInventory,
  type FolderInventory,
} from "../src/server/folder-scanner.js";

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.error(
      `     ${error instanceof Error ? error.message : error}`
    );
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createTestFolder(): string {
  const root = mkdtempSync(join(tmpdir(), "agentxl-scanner-"));

  // Supported files
  writeFileSync(join(root, "trial-balance.pdf"), "fake pdf content");
  writeFileSync(join(root, "accounts.csv"), "a,b,c\n1,2,3");
  writeFileSync(join(root, "ledger.xlsx"), "fake xlsx");
  writeFileSync(join(root, "notes.txt"), "some notes");
  writeFileSync(join(root, "readme.md"), "# Readme");
  writeFileSync(join(root, "data.json"), '{"key": "value"}');
  writeFileSync(join(root, "export.tsv"), "a\tb\tc");

  // Unsupported files
  writeFileSync(join(root, "photo.jpg"), "fake jpg");
  writeFileSync(join(root, "archive.zip"), "fake zip");
  writeFileSync(join(root, "presentation.pptx"), "fake pptx");

  // Subdirectory with more files
  const sub = join(root, "statements");
  mkdirSync(sub);
  writeFileSync(join(sub, "bank-jan.pdf"), "jan statement");
  writeFileSync(join(sub, "bank-feb.pdf"), "feb statement");
  writeFileSync(join(sub, "screenshot.png"), "fake png");

  // Deeply nested
  const deep = join(root, "level1", "level2");
  mkdirSync(deep, { recursive: true });
  writeFileSync(join(deep, "deep-file.csv"), "deep,data");

  // Ignored directories
  const gitDir = join(root, ".git");
  mkdirSync(gitDir);
  writeFileSync(join(gitDir, "config"), "git config");

  const nodeModules = join(root, "node_modules");
  mkdirSync(nodeModules);
  writeFileSync(join(nodeModules, "package.json"), "{}");

  return root;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function run() {
  console.log("\n📂 Folder Scanner Tests\n");

  const testFolder = createTestFolder();
  const originalDataDir = process.env.AGENTXL_DATA_DIR;
  const tempDataDir = mkdtempSync(join(tmpdir(), "agentxl-scanner-data-"));
  process.env.AGENTXL_DATA_DIR = tempDataDir;

  try {
    // =====================================================================
    // scanFolder
    // =====================================================================
    console.log("\n  🔍 scanFolder\n");

    let inventory: FolderInventory;

    await test("scans a folder and returns an inventory", () => {
      inventory = scanFolder(testFolder);
      assert.equal(typeof inventory.folderPath, "string");
      assert.equal(typeof inventory.scannedAt, "string");
      assert.equal(typeof inventory.totalFiles, "number");
      assert.equal(typeof inventory.supportedFiles, "number");
      assert.ok(Array.isArray(inventory.files));
    });

    await test("finds the correct total file count", () => {
      // 7 root supported + 3 root unsupported + 2 sub supported + 1 sub unsupported + 1 deep = 14
      assert.equal(inventory.totalFiles, 14);
    });

    await test("detects supported files correctly", () => {
      // pdf(1) + csv(1) + xlsx(1) + txt(1) + md(1) + json(1) + tsv(1) + sub pdf(2) + deep csv(1) = 10
      assert.equal(inventory.supportedFiles, 10);
    });

    await test("each file entry has required fields", () => {
      for (const file of inventory.files) {
        assert.equal(typeof file.name, "string");
        assert.equal(typeof file.relativePath, "string");
        assert.equal(typeof file.absolutePath, "string");
        assert.equal(typeof file.extension, "string");
        assert.equal(typeof file.sizeBytes, "number");
        assert.equal(typeof file.modifiedAt, "string");
        assert.equal(typeof file.supported, "boolean");
      }
    });

    await test("relative paths use forward slashes", () => {
      const subFiles = inventory.files.filter((f) =>
        f.relativePath.includes("statements")
      );
      assert.ok(subFiles.length > 0, "should find files in statements/");
      for (const f of subFiles) {
        assert.ok(
          !f.relativePath.includes("\\"),
          `relative path should not contain backslash: ${f.relativePath}`
        );
        assert.ok(
          f.relativePath.startsWith("statements/"),
          `should start with statements/: ${f.relativePath}`
        );
      }
    });

    await test("supported files are sorted before unsupported", () => {
      const firstUnsupportedIdx = inventory.files.findIndex((f) => !f.supported);
      if (firstUnsupportedIdx === -1) return; // all supported, fine
      const lastSupportedIdx = inventory.files.findLastIndex((f) => f.supported);
      assert.ok(
        lastSupportedIdx < firstUnsupportedIdx,
        "all supported files should come before unsupported files"
      );
    });

    await test("skips .git directory", () => {
      const gitFiles = inventory.files.filter((f) =>
        f.relativePath.includes(".git")
      );
      assert.equal(gitFiles.length, 0, "should not include .git files");
    });

    await test("skips node_modules directory", () => {
      const nmFiles = inventory.files.filter((f) =>
        f.relativePath.includes("node_modules")
      );
      assert.equal(nmFiles.length, 0, "should not include node_modules files");
    });

    await test("recurses into subdirectories", () => {
      const deepFiles = inventory.files.filter((f) =>
        f.relativePath.includes("level1/level2")
      );
      assert.equal(deepFiles.length, 1, "should find the deep file");
      assert.equal(deepFiles[0].name, "deep-file.csv");
    });

    await test("throws for non-existent folder", () => {
      assert.throws(
        () => scanFolder("/non/existent/path/xyz"),
        /does not exist/
      );
    });

    await test("throws for empty folder path", () => {
      assert.throws(
        () => scanFolder(""),
        /required/
      );
    });

    // =====================================================================
    // Persistence
    // =====================================================================
    console.log("\n  💾 Inventory persistence\n");

    await test("saves and loads an inventory", () => {
      const inv = scanFolder(testFolder);
      saveInventory("wb_test_123", inv);

      const loaded = loadInventory("wb_test_123");
      assert.ok(loaded, "should load saved inventory");
      assert.equal(loaded!.folderPath, inv.folderPath);
      assert.equal(loaded!.totalFiles, inv.totalFiles);
      assert.equal(loaded!.supportedFiles, inv.supportedFiles);
      assert.equal(loaded!.files.length, inv.files.length);
    });

    await test("returns null for unknown workbook", () => {
      const loaded = loadInventory("wb_unknown");
      assert.equal(loaded, null);
    });

    await test("scanAndSaveInventory scans and persists in one call", () => {
      const inv = scanAndSaveInventory("wb_combined", testFolder);
      assert.equal(inv.totalFiles, 14);
      assert.equal(inv.supportedFiles, 10);

      const loaded = loadInventory("wb_combined");
      assert.ok(loaded);
      assert.equal(loaded!.totalFiles, 14);
    });

    await test("rescanning updates the inventory", () => {
      // Add a new file
      writeFileSync(join(testFolder, "new-report.pdf"), "new report");

      const updated = scanAndSaveInventory("wb_combined", testFolder);
      assert.equal(updated.totalFiles, 15);
      assert.equal(updated.supportedFiles, 11);

      const loaded = loadInventory("wb_combined");
      assert.ok(loaded);
      assert.equal(loaded!.totalFiles, 15);
    });
  } finally {
    rmSync(testFolder, { recursive: true, force: true });
    rmSync(tempDataDir, { recursive: true, force: true });
    process.env.AGENTXL_DATA_DIR = originalDataDir;
  }

  // Summary
  console.log(`\n  ─────────────────────────────────────`);
  console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);
  console.log(`  ─────────────────────────────────────\n`);
}

run();
