import { strict as assert } from "assert";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  clearWorkbookFolderStore,
  getWorkbookFolderLink,
  getWorkbookLinksPath,
  setWorkbookFolderLink,
} from "../src/server/workbook-folder-store.js";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.error(`     ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

async function run() {
  console.log("\n🗂️  Workbook Folder Store Tests\n");

  const originalDataDir = process.env.AGENTXL_DATA_DIR;
  const tempDataDir = mkdtempSync(join(tmpdir(), "agentxl-store-test-"));
  process.env.AGENTXL_DATA_DIR = tempDataDir;
  clearWorkbookFolderStore();

  try {
    await test("saves and loads a folder mapping for a workbookId", () => {
      const saved = setWorkbookFolderLink({
        workbookId: "wb_123",
        folderPath: "C:\\Clients\\ABC\\Support",
        workbookName: "Lead Sheet.xlsx",
        host: "Excel",
        source: "excel-taskpane",
      });

      assert.equal(saved.workbookId, "wb_123");
      assert.equal(saved.folderPath, "C:\\Clients\\ABC\\Support");
      assert.equal(saved.workbookName, "Lead Sheet.xlsx");

      const loaded = getWorkbookFolderLink("wb_123");
      assert.ok(loaded, "expected saved mapping to load");
      assert.equal(loaded!.folderPath, "C:\\Clients\\ABC\\Support");
      assert.equal(loaded!.workbookName, "Lead Sheet.xlsx");
    });

    await test("updating the same workbookId overwrites the previous folder path", () => {
      const first = getWorkbookFolderLink("wb_123");
      assert.ok(first, "expected existing mapping before update");

      const updated = setWorkbookFolderLink({
        workbookId: "wb_123",
        folderPath: "C:\\Clients\\ABC\\Updated Support",
      });

      assert.equal(updated.folderPath, "C:\\Clients\\ABC\\Updated Support");
      assert.equal(updated.createdAt, first!.createdAt, "createdAt should remain stable");
      assert.notEqual(updated.updatedAt, first!.updatedAt, "updatedAt should change on update");

      const loaded = getWorkbookFolderLink("wb_123");
      assert.ok(loaded, "expected updated mapping to load");
      assert.equal(loaded!.folderPath, "C:\\Clients\\ABC\\Updated Support");
      assert.equal(loaded!.workbookName, "Lead Sheet.xlsx", "existing metadata should be preserved when omitted");
    });

    await test("mapping is persisted to disk", () => {
      const storePath = getWorkbookLinksPath();
      assert.ok(existsSync(storePath), `expected store file at ${storePath}`);

      const raw = readFileSync(storePath, "utf-8");
      const parsed = JSON.parse(raw);
      assert.equal(parsed.version, 1);
      assert.ok(parsed.links.wb_123, "expected wb_123 in persisted store");
      assert.equal(
        parsed.links.wb_123.folderPath,
        "C:\\Clients\\ABC\\Updated Support"
      );
    });

    await test("mapping survives fresh module import (restart simulation)", async () => {
      const moduleUrl = new URL(
        `../src/server/workbook-folder-store.ts?fresh=${Date.now()}`,
        import.meta.url
      ).href;
      const freshModule = await import(moduleUrl);
      const loaded = freshModule.getWorkbookFolderLink("wb_123");

      assert.ok(loaded, "expected mapping from fresh import");
      assert.equal(loaded.folderPath, "C:\\Clients\\ABC\\Updated Support");
    });

    await test("returns null for unknown workbookId", () => {
      const loaded = getWorkbookFolderLink("wb_missing");
      assert.equal(loaded, null);
    });
  } finally {
    clearWorkbookFolderStore();
    process.env.AGENTXL_DATA_DIR = originalDataDir;
    rmSync(tempDataDir, { recursive: true, force: true });
  }

  console.log("\n  ─────────────────────────────────────");
  console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);
  console.log("  ─────────────────────────────────────\n");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
