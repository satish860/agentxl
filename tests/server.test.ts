/**
 * Acceptance test for Task 3: HTTPS Server
 *
 * Starts the server, hits every endpoint, validates responses, then shuts down.
 * Run: npx tsx tests/server.test.ts
 */

import { startServer, stopServer } from "../src/server/index.js";
import { get, request as httpsRequest, type RequestOptions } from "https";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { strict as assert } from "assert";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3098;
const BASE = `https://localhost:${PORT}`;
const TASKPANE_DIST = join(__dirname, "..", "taskpane", "dist");
const ASSETS_DIR = join(TASKPANE_DIST, "assets");
const MOCK_FOLDER_PICKER = join(__dirname, "fixtures", "mock-folder-picker.mjs");

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

interface HttpResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

function httpRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<HttpResponse> {
  const payload = body ? JSON.stringify(body) : undefined;
  const opts: RequestOptions = {
    method,
    rejectUnauthorized: false,
    headers: {
      ...(payload
        ? {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          }
        : {}),
    },
  };

  return new Promise((resolve, reject) => {
    const req = httpsRequest(`${BASE}${path}`, opts, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: data,
        })
      );
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const httpGet = (path: string) => httpRequest("GET", path);
const httpPost = (path: string, body: Record<string, unknown>) =>
  httpRequest("POST", path, body);
const httpOptions = (path: string) => httpRequest("OPTIONS", path);

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
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
// Test fixtures
// ---------------------------------------------------------------------------

/** Files the test creates — saved/restored so real builds aren't clobbered. */
const TEST_FILES: Record<string, Buffer | string> = {
  "index.html": "<!DOCTYPE html><html><body>AgentXL Taskpane</body></html>",
  "app.js": 'console.log("hello");',
  "style.css": "body { margin: 0; }",
  "data.json": '{"key":"value"}',
  "assets/icon.png": Buffer.from([0x89, 0x50]),
  "assets/logo.svg": "<svg></svg>",
  "assets/favicon.ico": Buffer.from([0x00]),
};

const backups = new Map<string, Buffer | null>();

function setupTaskpaneDist() {
  mkdirSync(ASSETS_DIR, { recursive: true });

  // Back up existing files, then write test fixtures
  for (const [rel, content] of Object.entries(TEST_FILES)) {
    const fullPath = join(TASKPANE_DIST, rel);
    if (existsSync(fullPath)) {
      backups.set(rel, readFileSync(fullPath));
    } else {
      backups.set(rel, null); // mark for deletion on restore
    }
    writeFileSync(fullPath, content);
  }
}

function teardownTaskpaneDist() {
  // Restore original files (or delete test-only files)
  for (const [rel, original] of backups) {
    const fullPath = join(TASKPANE_DIST, rel);
    if (original !== null) {
      writeFileSync(fullPath, original);
    } else if (existsSync(fullPath)) {
      rmSync(fullPath);
    }
  }
  backups.clear();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function run() {
  console.log("\n🌐 Server Acceptance Tests\n");

  const originalDataDir = process.env.AGENTXL_DATA_DIR;
  const originalPickFolderPath = process.env.AGENTXL_PICK_FOLDER_TEST_PATH;
  const originalPickFolderDelay = process.env.AGENTXL_PICK_FOLDER_TEST_DELAY_MS;
  const originalPickFolderTimeout = process.env.AGENTXL_PICK_FOLDER_TIMEOUT_MS;
  const originalPickFolderError = process.env.AGENTXL_PICK_FOLDER_TEST_ERROR;
  const originalFolderPickerHelper = process.env.AGENTXL_FOLDER_PICKER_HELPER;
  const originalMockFolderPickerMode = process.env.MOCK_FOLDER_PICKER_MODE;
  const originalMockFolderPickerPath = process.env.MOCK_FOLDER_PICKER_PATH;
  const tempDataDir = mkdtempSync(join(tmpdir(), "agentxl-server-test-"));
  process.env.AGENTXL_DATA_DIR = tempDataDir;
  process.env.AGENTXL_PICK_FOLDER_TEST_PATH = "C:\\Evidence\\Picked Folder";
  delete process.env.AGENTXL_PICK_FOLDER_TEST_DELAY_MS;
  delete process.env.AGENTXL_PICK_FOLDER_TIMEOUT_MS;
  delete process.env.AGENTXL_PICK_FOLDER_TEST_ERROR;
  delete process.env.AGENTXL_FOLDER_PICKER_HELPER;
  delete process.env.MOCK_FOLDER_PICKER_MODE;
  delete process.env.MOCK_FOLDER_PICKER_PATH;

  // Setup
  setupTaskpaneDist();
  await startServer(PORT);

  try {
    // =======================================================================
    // GET /api/version
    // =======================================================================
    console.log("\n  📡 GET /api/version\n");

    await test("returns 200 with version string", async () => {
      const res = await httpGet("/api/version");
      assert.equal(res.status, 200);
      const json = JSON.parse(res.body);
      assert.equal(typeof json.version, "string");
      assert.ok(json.version.length > 0);
    });

    await test("response has CORS header", async () => {
      const res = await httpGet("/api/version");
      assert.equal(res.headers["access-control-allow-origin"], "*");
    });

    await test("response has Content-Type application/json", async () => {
      const res = await httpGet("/api/version");
      assert.ok(
        res.headers["content-type"]?.toString().includes("application/json")
      );
    });

    await test("works with query string (?t=123)", async () => {
      const res = await httpGet("/api/version?t=123");
      assert.equal(res.status, 200);
      const json = JSON.parse(res.body);
      assert.ok(json.version);
    });

    // =======================================================================
    // GET /api/config/status
    // =======================================================================
    console.log("\n  📡 GET /api/config/status\n");

    await test("returns 200 with auth status", async () => {
      const res = await httpGet("/api/config/status");
      assert.equal(res.status, 200);
      const json = JSON.parse(res.body);
      assert.equal(typeof json.authenticated, "boolean");
      assert.equal(typeof json.version, "string");
      assert.ok("provider" in json, "should include provider field");
    });

    await test("POST returns 405", async () => {
      const res = await httpPost("/api/config/status", {});
      assert.equal(res.status, 405);
      const json = JSON.parse(res.body);
      assert.ok(json.error.includes("GET"));
    });

    // =======================================================================
    // POST /api/workbook/resolve
    // =======================================================================
    console.log("\n  📡 POST /api/workbook/resolve\n");

    await test("returns 200 with workbookId", async () => {
      const res = await httpPost("/api/workbook/resolve", {
        workbookName: "Lead_Sheet_2025.xlsx",
        host: "Excel",
        source: "excel-taskpane",
      });
      assert.equal(res.status, 200);
      const json = JSON.parse(res.body);
      assert.ok(/^wb_[a-f0-9]{16}$/.test(json.workbookId), `invalid workbookId: ${json.workbookId}`);
    });

    await test("same workbook context returns the same workbookId", async () => {
      const body = {
        workbookName: "Lead_Sheet_2025.xlsx",
        workbookUrl: "file:///C:/Clients/ABC/Lead_Sheet_2025.xlsx",
        host: "Excel",
        source: "excel-taskpane",
      };
      const res1 = await httpPost("/api/workbook/resolve", body);
      const res2 = await httpPost("/api/workbook/resolve", body);
      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);
      const json1 = JSON.parse(res1.body);
      const json2 = JSON.parse(res2.body);
      assert.equal(json1.workbookId, json2.workbookId);
    });

    await test("URL variants with query strings resolve to the same workbookId", async () => {
      const res1 = await httpPost("/api/workbook/resolve", {
        workbookName: "Cash.xlsx",
        workbookUrl: "https://contoso.sharepoint.com/sites/Audit/Cash.xlsx?web=1",
      });
      const res2 = await httpPost("/api/workbook/resolve", {
        workbookName: "Cash.xlsx",
        workbookUrl: "https://contoso.sharepoint.com/sites/Audit/Cash.xlsx",
      });
      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);
      const json1 = JSON.parse(res1.body);
      const json2 = JSON.parse(res2.body);
      assert.equal(json1.workbookId, json2.workbookId);
    });

    await test("URL variants with fragments resolve to the same workbookId", async () => {
      const res1 = await httpPost("/api/workbook/resolve", {
        workbookName: "Cash.xlsx",
        workbookUrl: "https://contoso.sharepoint.com/sites/Audit/Cash.xlsx#sheet=1",
      });
      const res2 = await httpPost("/api/workbook/resolve", {
        workbookName: "Cash.xlsx",
        workbookUrl: "https://contoso.sharepoint.com/sites/Audit/Cash.xlsx",
      });
      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);
      const json1 = JSON.parse(res1.body);
      const json2 = JSON.parse(res2.body);
      assert.equal(json1.workbookId, json2.workbookId);
    });

    await test("different workbook context returns a different workbookId", async () => {
      const res1 = await httpPost("/api/workbook/resolve", {
        workbookName: "Lead_Sheet_2025.xlsx",
        workbookUrl: "file:///C:/Clients/ABC/Lead_Sheet_2025.xlsx",
      });
      const res2 = await httpPost("/api/workbook/resolve", {
        workbookName: "Cash_Workpaper.xlsx",
        workbookUrl: "file:///C:/Clients/ABC/Cash_Workpaper.xlsx",
      });
      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);
      const json1 = JSON.parse(res1.body);
      const json2 = JSON.parse(res2.body);
      assert.notEqual(json1.workbookId, json2.workbookId);
    });

    await test("returns 400 without workbookName or workbookUrl", async () => {
      const res = await httpPost("/api/workbook/resolve", {});
      assert.equal(res.status, 400);
      const json = JSON.parse(res.body);
      assert.ok(json.error.includes("workbookName") || json.error.includes("workbookUrl"));
    });

    await test("GET returns 405", async () => {
      const res = await httpGet("/api/workbook/resolve");
      assert.equal(res.status, 405);
      const json = JSON.parse(res.body);
      assert.ok(json.error.includes("POST"));
    });

    // =======================================================================
    // Folder status API
    // =======================================================================
    console.log("\n  📡 Folder status API\n");

    await test("GET /api/folder/status returns linked false when no mapping exists", async () => {
      const res = await httpGet("/api/folder/status?workbookId=wb_status_test");
      assert.equal(res.status, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.workbookId, "wb_status_test");
      assert.equal(json.linked, false);
    });

    await test("POST /api/folder/select stores a folder for a valid workbookId", async () => {
      const res = await httpPost("/api/folder/select", {
        workbookId: "wb_status_test",
        folderPath: "C:\\Clients\\ABC\\Support",
        workbookName: "Lead Sheet.xlsx",
        host: "Excel",
        source: "excel-taskpane",
      });
      assert.equal(res.status, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.workbookId, "wb_status_test");
      assert.equal(json.linked, true);
      assert.equal(json.folderPath, "C:\\Clients\\ABC\\Support");
      assert.equal(json.link.folderPath, "C:\\Clients\\ABC\\Support");
    });

    await test("GET /api/folder/status returns linked folder for a valid workbookId", async () => {
      const res = await httpGet("/api/folder/status?workbookId=wb_status_test");
      assert.equal(res.status, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.workbookId, "wb_status_test");
      assert.equal(json.linked, true);
      assert.equal(json.folderPath, "C:\\Clients\\ABC\\Support");
      assert.equal(json.link.folderPath, "C:\\Clients\\ABC\\Support");
    });

    await test("POST /api/folder/select overwrites the previous mapping", async () => {
      const res = await httpPost("/api/folder/select", {
        workbookId: "wb_status_test",
        folderPath: "C:\\Clients\\ABC\\Updated Support",
      });
      assert.equal(res.status, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.folderPath, "C:\\Clients\\ABC\\Updated Support");

      const statusRes = await httpGet("/api/folder/status?workbookId=wb_status_test");
      const statusJson = JSON.parse(statusRes.body);
      assert.equal(statusJson.folderPath, "C:\\Clients\\ABC\\Updated Support");
    });

    await test("GET /api/folder/status returns 400 without workbookId", async () => {
      const res = await httpGet("/api/folder/status");
      assert.equal(res.status, 400);
      const json = JSON.parse(res.body);
      assert.ok(json.error.includes("workbookId"));
    });

    await test("POST /api/folder/select returns 400 without workbookId", async () => {
      const res = await httpPost("/api/folder/select", {
        folderPath: "C:\\Clients\\ABC\\Support",
      });
      assert.equal(res.status, 400);
      const json = JSON.parse(res.body);
      assert.ok(json.error.includes("workbookId"));
    });

    await test("POST /api/folder/select returns 400 without folderPath", async () => {
      const res = await httpPost("/api/folder/select", {
        workbookId: "wb_status_test",
      });
      assert.equal(res.status, 400);
      const json = JSON.parse(res.body);
      assert.ok(json.error.includes("folderPath"));
    });

    await test("POST /api/folder/pick returns a picked local folder path", async () => {
      const res = await httpPost("/api/folder/pick", {});
      assert.equal(res.status, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.picked, true);
      assert.equal(json.folderPath, "C:\\Evidence\\Picked Folder");
    });

    await test("POST /api/folder/pick uses the native helper contract when configured", async () => {
      process.env.AGENTXL_PICK_FOLDER_TEST_PATH = "";
      process.env.AGENTXL_FOLDER_PICKER_HELPER = MOCK_FOLDER_PICKER;
      process.env.MOCK_FOLDER_PICKER_MODE = "success";
      process.env.MOCK_FOLDER_PICKER_PATH = "C:\\Helper Picked\\Support";

      try {
        const res = await httpPost("/api/folder/pick", {
          initialPath: "C:\\Existing\\Support",
        });
        assert.equal(res.status, 200);
        const json = JSON.parse(res.body);
        assert.equal(json.picked, true);
        assert.equal(json.folderPath, "C:\\Helper Picked\\Support");
      } finally {
        process.env.AGENTXL_PICK_FOLDER_TEST_PATH = "C:\\Evidence\\Picked Folder";
        delete process.env.AGENTXL_FOLDER_PICKER_HELPER;
        delete process.env.MOCK_FOLDER_PICKER_MODE;
        delete process.env.MOCK_FOLDER_PICKER_PATH;
      }
    });

    await test("POST /api/folder/pick returns timeout guidance when picker hangs", async () => {
      process.env.AGENTXL_PICK_FOLDER_TEST_ERROR =
        "Native folder picker timed out. Paste the folder path manually instead.";

      try {
        const res = await httpPost("/api/folder/pick", {});
        assert.equal(res.status, 504);
        const json = JSON.parse(res.body);
        assert.ok(json.error.includes("timed out"));
        assert.ok(json.error.includes("Paste the folder path manually"));
      } finally {
        delete process.env.AGENTXL_PICK_FOLDER_TEST_ERROR;
      }
    });

    await test("wrong methods return 405 for folder endpoints", async () => {
      const statusRes = await httpPost("/api/folder/status", {});
      assert.equal(statusRes.status, 405);
      const statusJson = JSON.parse(statusRes.body);
      assert.ok(statusJson.error.includes("GET"));

      const pickRes = await httpGet("/api/folder/pick");
      assert.equal(pickRes.status, 405);
      const pickJson = JSON.parse(pickRes.body);
      assert.ok(pickJson.error.includes("POST"));

      const selectRes = await httpGet("/api/folder/select");
      assert.equal(selectRes.status, 405);
      const selectJson = JSON.parse(selectRes.body);
      assert.ok(selectJson.error.includes("POST"));
    });

    // =======================================================================
    // Folder scanning API
    // =======================================================================
    console.log("\n  📡 Folder scanning API\n");

    // Create a real test folder for scanning
    const scanTestFolder = mkdtempSync(join(tmpdir(), "agentxl-scan-api-"));
    writeFileSync(join(scanTestFolder, "report.pdf"), "pdf content");
    writeFileSync(join(scanTestFolder, "data.csv"), "a,b\n1,2");
    writeFileSync(join(scanTestFolder, "notes.txt"), "some notes");
    writeFileSync(join(scanTestFolder, "photo.jpg"), "fake jpg");
    mkdirSync(join(scanTestFolder, "sub"));
    writeFileSync(join(scanTestFolder, "sub", "deep.xlsx"), "fake xlsx");

    await test("POST /api/folder/select auto-scans and returns file counts", async () => {
      const res = await httpPost("/api/folder/select", {
        workbookId: "wb_scan_test",
        folderPath: scanTestFolder,
        workbookName: "ScanTest.xlsx",
      });
      assert.equal(res.status, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.linked, true);
      assert.equal(json.totalFiles, 5);
      assert.equal(json.supportedFiles, 4); // pdf, csv, txt, xlsx
    });

    await test("GET /api/folder/files returns inventory for linked workbook", async () => {
      const res = await httpGet("/api/folder/files?workbookId=wb_scan_test");
      assert.equal(res.status, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.workbookId, "wb_scan_test");
      assert.equal(json.totalFiles, 5);
      assert.equal(json.supportedFiles, 4);
      assert.ok(Array.isArray(json.files));
      assert.equal(json.files.length, 5);

      // Check file entry structure
      const pdfFile = json.files.find((f: any) => f.name === "report.pdf");
      assert.ok(pdfFile, "should find report.pdf");
      assert.equal(pdfFile.extension, ".pdf");
      assert.equal(pdfFile.supported, true);
      assert.equal(typeof pdfFile.sizeBytes, "number");
      assert.equal(typeof pdfFile.modifiedAt, "string");
      assert.equal(typeof pdfFile.relativePath, "string");
    });

    await test("GET /api/folder/files includes subdirectory files", async () => {
      const res = await httpGet("/api/folder/files?workbookId=wb_scan_test");
      const json = JSON.parse(res.body);
      const deepFile = json.files.find((f: any) => f.name === "deep.xlsx");
      assert.ok(deepFile, "should find deep.xlsx in subdirectory");
      assert.equal(deepFile.relativePath, "sub/deep.xlsx");
      assert.equal(deepFile.supported, true);
    });

    await test("GET /api/folder/files returns 400 without workbookId", async () => {
      const res = await httpGet("/api/folder/files");
      assert.equal(res.status, 400);
      const json = JSON.parse(res.body);
      assert.ok(json.error.includes("workbookId"));
    });

    await test("GET /api/folder/files returns 404 for unlinked workbook", async () => {
      const res = await httpGet("/api/folder/files?workbookId=wb_no_link");
      assert.equal(res.status, 404);
    });

    await test("POST /api/folder/refresh rescans and updates inventory", async () => {
      // Add a new file
      writeFileSync(join(scanTestFolder, "new-report.pdf"), "new pdf");

      const res = await httpPost("/api/folder/refresh", {
        workbookId: "wb_scan_test",
      });
      assert.equal(res.status, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.totalFiles, 6);
      assert.equal(json.supportedFiles, 5);

      // Verify the inventory was persisted
      const filesRes = await httpGet("/api/folder/files?workbookId=wb_scan_test");
      const filesJson = JSON.parse(filesRes.body);
      assert.equal(filesJson.totalFiles, 6);
    });

    await test("POST /api/folder/refresh returns 400 without workbookId", async () => {
      const res = await httpPost("/api/folder/refresh", {});
      assert.equal(res.status, 400);
      const json = JSON.parse(res.body);
      assert.ok(json.error.includes("workbookId"));
    });

    await test("POST /api/folder/refresh returns 404 for unlinked workbook", async () => {
      const res = await httpPost("/api/folder/refresh", {
        workbookId: "wb_no_link",
      });
      assert.equal(res.status, 404);
    });

    // Clean up scan test folder
    rmSync(scanTestFolder, { recursive: true, force: true });

    // =======================================================================
    // POST /api/agent (stub)
    // =======================================================================
    console.log("\n  📡 POST /api/agent\n");

    await test("returns 401 or 200 depending on auth", async () => {
      const res = await httpPost("/api/agent", { message: "Hello" });
      // 401 if no auth configured, 200 (SSE stream) if auth exists
      assert.ok(
        res.status === 401 || res.status === 200,
        `expected 401 or 200, got ${res.status}`
      );
      if (res.status === 401) {
        const json = JSON.parse(res.body);
        assert.ok(json.error.includes("Not authenticated"));
      }
    });

    await test("returns 400 without message field", async () => {
      const res = await httpPost("/api/agent", {});
      assert.equal(res.status, 400);
      const json = JSON.parse(res.body);
      assert.ok(json.error.includes("message"));
    });

    await test("returns 400 with empty body", async () => {
      const res = await httpPost("/api/agent", {} as any);
      assert.equal(res.status, 400);
    });

    await test("returns 400 with non-string message", async () => {
      const res = await httpPost("/api/agent", { message: 123 });
      assert.equal(res.status, 400);
    });

    await test("returns 400 with empty string message", async () => {
      const res = await httpPost("/api/agent", { message: "   " });
      assert.equal(res.status, 400);
    });

    await test("GET returns 405", async () => {
      const res = await httpGet("/api/agent");
      assert.equal(res.status, 405);
      const json = JSON.parse(res.body);
      assert.ok(json.error.includes("POST"));
    });

    // =======================================================================
    // POST /api/excel/result — Excel bridge
    // =======================================================================
    console.log("\n  📡 Excel bridge API\n");

    await test("POST /api/excel/result returns 400 without toolCallId", async () => {
      const res = await httpPost("/api/excel/result", { result: "ok" });
      assert.equal(res.status, 400);
      const json = JSON.parse(res.body);
      assert.ok(json.error.includes("toolCallId"));
    });

    await test("POST /api/excel/result returns 404 for unknown toolCallId", async () => {
      const res = await httpPost("/api/excel/result", {
        toolCallId: "nonexistent-id",
        result: "ok",
      });
      assert.equal(res.status, 404);
      const json = JSON.parse(res.body);
      assert.ok(json.error.includes("No pending execution"));
    });

    await test("GET /api/excel/result returns 405", async () => {
      const res = await httpGet("/api/excel/result");
      assert.equal(res.status, 405);
    });

    // =======================================================================
    // GET /taskpane/* — Static file serving
    // =======================================================================
    console.log("\n  📁 Static file serving (/taskpane/*)\n");

    await test("/taskpane/ serves index.html", async () => {
      const res = await httpGet("/taskpane/");
      assert.equal(res.status, 200);
      assert.ok(res.body.includes("AgentXL Taskpane"));
      assert.ok(
        res.headers["content-type"]?.toString().includes("text/html")
      );
    });

    await test("/taskpane serves index.html (no trailing slash)", async () => {
      const res = await httpGet("/taskpane");
      assert.equal(res.status, 200);
      assert.ok(res.body.includes("AgentXL Taskpane"));
    });

    await test("/taskpane/app.js serves JS with correct MIME", async () => {
      const res = await httpGet("/taskpane/app.js");
      assert.equal(res.status, 200);
      assert.ok(res.body.includes("hello"));
      assert.ok(
        res.headers["content-type"]
          ?.toString()
          .includes("application/javascript")
      );
    });

    await test("/taskpane/style.css serves CSS with correct MIME", async () => {
      const res = await httpGet("/taskpane/style.css");
      assert.equal(res.status, 200);
      assert.ok(res.body.includes("margin"));
      assert.ok(
        res.headers["content-type"]?.toString().includes("text/css")
      );
    });

    await test("/taskpane/data.json serves JSON with correct MIME", async () => {
      const res = await httpGet("/taskpane/data.json");
      assert.equal(res.status, 200);
      assert.ok(
        res.headers["content-type"]
          ?.toString()
          .includes("application/json")
      );
    });

    await test("/taskpane/assets/icon.png serves PNG with correct MIME", async () => {
      const res = await httpGet("/taskpane/assets/icon.png");
      assert.equal(res.status, 200);
      assert.ok(
        res.headers["content-type"]?.toString().includes("image/png")
      );
    });

    await test("/taskpane/assets/logo.svg serves SVG with correct MIME", async () => {
      const res = await httpGet("/taskpane/assets/logo.svg");
      assert.equal(res.status, 200);
      assert.ok(
        res.headers["content-type"]?.toString().includes("image/svg+xml")
      );
    });

    await test("/taskpane/assets/favicon.ico serves ICO with correct MIME", async () => {
      const res = await httpGet("/taskpane/assets/favicon.ico");
      assert.equal(res.status, 200);
      assert.ok(
        res.headers["content-type"]?.toString().includes("image/x-icon")
      );
    });

    await test("missing file returns 404", async () => {
      const res = await httpGet("/taskpane/does-not-exist.xyz");
      assert.equal(res.status, 404);
    });

    await test("SPA fallback: non-file path serves index.html", async () => {
      const res = await httpGet("/taskpane/some/deep/route");
      assert.equal(res.status, 200);
      assert.ok(res.body.includes("AgentXL Taskpane"));
    });

    await test("Content-Length header present on static files", async () => {
      const res = await httpGet("/taskpane/app.js");
      assert.ok(res.headers["content-length"]);
      assert.equal(
        parseInt(res.headers["content-length"] as string, 10),
        Buffer.byteLength('console.log("hello");')
      );
    });

    await test("HTML has no-cache, assets have max-age", async () => {
      const htmlRes = await httpGet("/taskpane/");
      assert.ok(
        htmlRes.headers["cache-control"]?.toString().includes("no-cache")
      );

      const jsRes = await httpGet("/taskpane/app.js");
      assert.ok(
        jsRes.headers["cache-control"]?.toString().includes("max-age=31536000")
      );
    });

    await test("path traversal blocked (/../../../etc/passwd)", async () => {
      const res = await httpGet(
        "/taskpane/../../../../../../etc/passwd"
      );
      // Should return 404 or 403, never the file contents
      assert.ok(
        res.status === 404 || res.status === 403,
        `expected 403 or 404, got ${res.status}`
      );
      assert.ok(!res.body.includes("root:"));
    });

    await test("CORS header present on static files", async () => {
      const res = await httpGet("/taskpane/app.js");
      assert.equal(res.headers["access-control-allow-origin"], "*");
    });

    // =======================================================================
    // Root redirect
    // =======================================================================
    console.log("\n  🔀 Root redirect\n");

    await test("GET / returns 302 → /taskpane/", async () => {
      // Use raw request to avoid following redirect
      const res = await new Promise<HttpResponse>((resolve, reject) => {
        const req = get(
          `${BASE}/`,
          { rejectUnauthorized: false },
          (r) => {
            let data = "";
            r.on("data", (chunk: string) => (data += chunk));
            r.on("end", () =>
              resolve({
                status: r.statusCode ?? 0,
                headers: r.headers,
                body: data,
              })
            );
          }
        );
        req.on("error", reject);
      });
      assert.equal(res.status, 302);
      assert.equal(res.headers["location"], "/taskpane/");
    });

    // =======================================================================
    // CORS preflight
    // =======================================================================
    console.log("\n  🔒 CORS\n");

    await test("OPTIONS /api/agent returns 204 with CORS headers", async () => {
      const res = await httpOptions("/api/agent");
      assert.equal(res.status, 204);
      assert.equal(res.headers["access-control-allow-origin"], "*");
      assert.ok(
        res.headers["access-control-allow-methods"]
          ?.toString()
          .includes("POST")
      );
      assert.ok(
        res.headers["access-control-allow-headers"]
          ?.toString()
          .includes("Content-Type")
      );
      assert.ok(res.headers["access-control-max-age"]);
    });

    await test("OPTIONS works on any path", async () => {
      const res = await httpOptions("/api/config/status");
      assert.equal(res.status, 204);
      assert.equal(res.headers["access-control-allow-origin"], "*");
    });

    // =======================================================================
    // 404 catch-all
    // =======================================================================
    console.log("\n  🚫 404 catch-all\n");

    await test("GET /unknown returns 404", async () => {
      const res = await httpGet("/unknown");
      assert.equal(res.status, 404);
      const json = JSON.parse(res.body);
      assert.ok(json.error);
    });

    await test("GET /api/nonexistent returns 404", async () => {
      const res = await httpGet("/api/nonexistent");
      assert.equal(res.status, 404);
    });

    // =======================================================================
    // Server lifecycle
    // =======================================================================
    console.log("\n  🔄 Server lifecycle\n");

    await test("stopServer + restart on same port succeeds", async () => {
      await stopServer();
      // Small delay to ensure the port is fully released
      await new Promise((r) => setTimeout(r, 200));
      await startServer(PORT);
      // Small delay to ensure the server is accepting connections
      await new Promise((r) => setTimeout(r, 100));
      const res = await httpGet("/api/version");
      assert.equal(res.status, 200);
    });
  } finally {
    await stopServer();
    teardownTaskpaneDist();
    process.env.AGENTXL_DATA_DIR = originalDataDir;
    process.env.AGENTXL_PICK_FOLDER_TEST_PATH = originalPickFolderPath;
    process.env.AGENTXL_PICK_FOLDER_TEST_DELAY_MS = originalPickFolderDelay;
    process.env.AGENTXL_PICK_FOLDER_TIMEOUT_MS = originalPickFolderTimeout;
    process.env.AGENTXL_PICK_FOLDER_TEST_ERROR = originalPickFolderError;
    process.env.AGENTXL_FOLDER_PICKER_HELPER = originalFolderPickerHelper;
    process.env.MOCK_FOLDER_PICKER_MODE = originalMockFolderPickerMode;
    process.env.MOCK_FOLDER_PICKER_PATH = originalMockFolderPickerPath;
    rmSync(tempDataDir, { recursive: true, force: true });
  }

  // Summary
  console.log(`\n  ─────────────────────────────────────`);
  console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);
  console.log(`  ─────────────────────────────────────\n`);
}

run();
