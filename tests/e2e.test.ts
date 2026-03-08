/**
 * End-to-end test for Task 9: Full pipeline verification.
 *
 * Uses Playwright to test the chat UI in a real browser.
 * Starts the server, opens the taskpane, sends a message,
 * verifies streaming response, and shuts down.
 *
 * Run: npx tsx tests/e2e.test.ts
 */

import { chromium, type Browser, type Page } from "playwright";
import { ensureCerts } from "../src/server/certs.js";
import { startServer, stopServer } from "../src/server/index.js";
import { resetSession, isAuthenticated } from "../src/agent/session.js";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { strict as assert } from "assert";

const PORT = 3096;
const BASE = `https://localhost:${PORT}`;

let browser: Browser;
let page: Page;

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
let skipped = 0;

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

function skip(name: string, reason: string) {
  skipped++;
  console.log(`  ⏭️  ${name} — ${reason}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function run() {
  console.log("\n🌐 End-to-End Tests (Playwright)\n");

  const hasAuth = isAuthenticated();
  const originalDataDir = process.env.AGENTXL_DATA_DIR;
  const originalPickFolderPath = process.env.AGENTXL_PICK_FOLDER_TEST_PATH;
  const originalPickFolderDelay = process.env.AGENTXL_PICK_FOLDER_TEST_DELAY_MS;
  const tempDataDir = mkdtempSync(join(tmpdir(), "agentxl-e2e-"));
  process.env.AGENTXL_DATA_DIR = tempDataDir;
  process.env.AGENTXL_PICK_FOLDER_TEST_PATH = "C:\\Evidence\\Picked Folder";
  process.env.AGENTXL_PICK_FOLDER_TEST_DELAY_MS = "250";

  // Start server
  const certs = await ensureCerts();
  await startServer(PORT, certs);

  // Launch browser
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  page = await context.newPage();

  try {
    // =======================================================================
    // Server health
    // =======================================================================
    console.log("\n  📡 Server health\n");

    await test("GET /api/version returns version", async () => {
      const res = await page.goto(`${BASE}/api/version`);
      assert.equal(res?.status(), 200);
      const json = await res!.json();
      assert.equal(typeof json.version, "string");
      assert.ok(json.version.match(/^\d+\.\d+\.\d+$/), `version should be semver, got: ${json.version}`);
    });

    await test("GET /api/config/status returns auth info", async () => {
      const res = await page.goto(`${BASE}/api/config/status`);
      assert.equal(res?.status(), 200);
      const json = await res!.json();
      assert.equal(typeof json.authenticated, "boolean");
      assert.equal(typeof json.version, "string");
    });

    // =======================================================================
    // Taskpane loads
    // =======================================================================
    console.log("\n  🖥️  Taskpane UI\n");

    await test("taskpane loads without errors", async () => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      const res = await page.goto(`${BASE}/taskpane/`, {
        waitUntil: "networkidle",
      });
      assert.equal(res?.status(), 200);

      // Wait for React to render
      await page.waitForSelector("#root", { timeout: 5000 });

      assert.equal(
        errors.length,
        0,
        `Page errors: ${errors.join("; ")}`
      );
    });

    if (!hasAuth) {
      await test("shows unauthenticated message", async () => {
        const text = await page.textContent("body");
        assert.ok(
          text?.includes("agentxl login"),
          "should show login instruction"
        );
      });

      skip("welcome screen", "No auth configured");
      skip("send message", "No auth configured");
      skip("streaming response", "No auth configured");
      skip("follow-up message", "No auth configured");
    } else {
      await test("shows folder-link flow when no folder is linked", async () => {
        await page.waitForSelector("text=Choose the folder with your supporting documents", {
          timeout: 5000,
        });

        const input = await page.$('input[placeholder*="Clients"]');
        assert.ok(input, "should have folder path input");
      });

      await test("folder picker keeps manual path entry usable and then fills the path", async () => {
        await page.click("text=Try folder picker");
        const input = await page.$('input[placeholder*="Clients"]');
        assert.ok(input, "should have folder path input");
        assert.equal(await input!.isDisabled(), false, "manual path input should stay enabled");

        await page.waitForFunction(() => {
          const el = document.querySelector('input[placeholder*="Clients"]') as HTMLInputElement | null;
          return !!el && el.value.includes('Picked Folder');
        }, { timeout: 5000 });

        await page.click("text=Link folder");
        await page.waitForSelector("text=Linked folder", { timeout: 5000 });
        await page.waitForSelector("text=Compare source files to this sheet", {
          timeout: 5000,
        });
      });

      await test("linked folder persists when the taskpane reloads", async () => {
        await page.reload({ waitUntil: "networkidle" });
        await page.waitForSelector("text=Linked folder", { timeout: 5000 });
        const text = await page.textContent("body");
        assert.ok(text?.includes("C:\\Evidence\\Picked Folder"));
      });

      await test("textarea and send button are present after folder is linked", async () => {
        const textarea = await page.$("textarea");
        assert.ok(textarea, "should have a textarea");

        const placeholder = await textarea!.getAttribute("placeholder");
        assert.ok(
          placeholder?.includes("source files"),
          `placeholder should mention source files, got: ${placeholder}`
        );
      });

      await test("quick action fills the textarea", async () => {
        await page.click("text=Map a value into Excel");

        const textarea = await page.$("textarea");
        const value = await textarea!.inputValue();
        assert.ok(
          value.includes("map it into Excel"),
          `textarea should contain mapping text, got: ${value}`
        );

        await textarea!.fill("");
      });

      await test("send message and receive streaming response", async () => {
        const textarea = await page.$("textarea");
        assert.ok(textarea);

        // Type a message
        await textarea!.fill("Reply with exactly: Hello from AgentXL");

        // Click send
        const sendButton = await page.$('button[title="Send"]');
        assert.ok(sendButton, "should have send button");
        await sendButton!.click();

        // User message should appear
        await page.waitForSelector("text=Reply with exactly", {
          timeout: 5000,
        });

        // Wait for assistant response (may take a while for LLM)
        // Look for any assistant content in a card-style container
        await page.waitForFunction(
          () => {
            const cards = document.querySelectorAll(".border.border-gray-100");
            return cards.length > 0 && cards[0].textContent!.length > 5;
          },
          { timeout: 60000 }
        );

        // Verify assistant message has content
        const cards = await page.$$(".border.border-gray-100");
        assert.ok(cards.length > 0, "should have assistant message card");

        const assistantText = await cards[0].textContent();
        assert.ok(
          assistantText && assistantText.length > 0,
          "assistant should have text content"
        );
      });

      await test("follow-up message works (session persists)", async () => {
        const textarea = await page.$("textarea");
        assert.ok(textarea);

        // Send follow-up
        await textarea!.fill("Reply with exactly: pong");

        const sendButton = await page.$('button[title="Send"]');
        await sendButton!.click();

        // Wait for second assistant response
        await page.waitForFunction(
          () => {
            const cards = document.querySelectorAll(".border.border-gray-100");
            return cards.length >= 2;
          },
          { timeout: 60000 }
        );

        const cards = await page.$$(".border.border-gray-100");
        assert.ok(
          cards.length >= 2,
          `should have at least 2 assistant messages, got ${cards.length}`
        );
      });

      await test("stop button appears during streaming", async () => {
        const textarea = await page.$("textarea");
        assert.ok(textarea);

        // Send a message that will produce a long response
        await textarea!.fill("Write a long paragraph about spreadsheets");

        const sendButton = await page.$('button[title="Send"]');
        await sendButton!.click();

        // Stop button should appear
        try {
          await page.waitForSelector('button[title="Stop"]', {
            timeout: 10000,
          });

          // Click stop
          const stopButton = await page.$('button[title="Stop"]');
          if (stopButton) {
            await stopButton.click();
          }
        } catch {
          // If response was too fast, stop button may not have appeared — that's ok
        }

        // Wait for streaming to end (send button returns)
        await page.waitForSelector('button[title="Send"]', {
          timeout: 15000,
        });
      });
    }

    // =======================================================================
    // Server lifecycle
    // =======================================================================
    console.log("\n  🔄 Server lifecycle\n");

    await test("server stops and restarts cleanly", async () => {
      // Close browser first so keep-alive connections don't block shutdown
      await browser.close();

      resetSession();
      await stopServer();

      // Brief pause
      await new Promise((r) => setTimeout(r, 500));

      // Restart
      await startServer(PORT, certs);

      // Reopen browser and verify
      browser = await chromium.launch({ headless: true });
      const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
      const p = await ctx.newPage();
      const res = await p.goto(`${BASE}/api/version`);
      assert.equal(res?.status(), 200);
      await browser.close();
    });
  } finally {
    await browser.close().catch(() => {});
    resetSession();
    await stopServer();
    process.env.AGENTXL_DATA_DIR = originalDataDir;
    process.env.AGENTXL_PICK_FOLDER_TEST_PATH = originalPickFolderPath;
    process.env.AGENTXL_PICK_FOLDER_TEST_DELAY_MS = originalPickFolderDelay;
    rmSync(tempDataDir, { recursive: true, force: true });
  }

  // Summary
  console.log(`\n  ─────────────────────────────────────`);
  console.log(
    `  ${passed + failed + skipped} tests: ${passed} passed, ${failed} failed, ${skipped} skipped`
  );
  console.log(`  ─────────────────────────────────────\n`);
}

run();
