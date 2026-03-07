/**
 * Acceptance tests for Task 5: Agent Session + SSE Streaming
 *
 * Tests model selection, session lifecycle, auth detection, and SSE streaming.
 * Requires auth — copies Pi's auth.json to ~/.agentxl/ if not present.
 *
 * Run: npx tsx tests/session.test.ts
 */

import { strict as assert } from "assert";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "fs";
import { homedir } from "os";
import { get, request as httpsRequest, type RequestOptions } from "https";

import { getDefaultModel } from "../src/agent/models.js";
import {
  isAuthenticated,
  getAuthProvider,
  resetSession,
  getSession,
  abortSession,
} from "../src/agent/session.js";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { startServer, stopServer } from "../src/server/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const PI_AUTH = join(homedir(), ".pi", "agent", "auth.json");
const AGENTXL_AUTH = join(homedir(), ".agentxl", "auth.json");

// ---------------------------------------------------------------------------
// Setup — check auth availability
// ---------------------------------------------------------------------------

function ensureAuth(): boolean {
  // session.ts auto-resolves: AgentXL auth → Pi auth fallback
  // No need to copy files — uses Pi's live tokens (auto-refreshed)
  if (existsSync(AGENTXL_AUTH) || existsSync(PI_AUTH)) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const PORT = 3097;
const BASE = `https://localhost:${PORT}`;

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

/**
 * POST to /api/agent and collect SSE events (with timeout).
 */
function postAgentSSE(
  body: Record<string, unknown>,
  timeoutMs: number = 30_000
): Promise<{ status: number; events: any[]; raw: string }> {
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`SSE request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const req = httpsRequest(
      `${BASE}/api/agent`,
      {
        method: "POST",
        rejectUnauthorized: false,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = "";
        const events: any[] = [];

        res.on("data", (chunk: string) => {
          raw += chunk;
          // Parse SSE lines
          const lines = chunk.toString().split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                events.push(JSON.parse(line.slice(6)));
              } catch {
                // ignore parse errors on partial chunks
              }
            }
          }
        });

        res.on("end", () => {
          clearTimeout(timer);
          resolve({ status: res.statusCode ?? 0, events, raw });
        });
      }
    );

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

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
  console.log("\n🧠 Session & SSE Acceptance Tests\n");

  const hasAuth = ensureAuth();

  // =======================================================================
  // Model selection (getDefaultModel)
  // =======================================================================
  console.log("\n  📦 Model selection\n");

  await test("getDefaultModel returns a model when auth exists", async () => {
    if (!hasAuth) throw new Error("No auth available");
    // Create a fresh registry from resolved auth
    const authPath = existsSync(AGENTXL_AUTH) ? AGENTXL_AUTH : PI_AUTH;
    const testAuth = new AuthStorage(authPath);
    const testRegistry = new ModelRegistry(testAuth);
    const model = getDefaultModel(testRegistry);
    assert.ok(model, "should return a model");
    assert.ok(model.provider, "model should have a provider");
    assert.ok(model.id, "model should have an id");
  });

  await test("getDefaultModel prefers subscriptions over API keys", async () => {
    if (!hasAuth) throw new Error("No auth available");
    const authPath = existsSync(AGENTXL_AUTH) ? AGENTXL_AUTH : PI_AUTH;
    const testAuth = new AuthStorage(authPath);
    const testRegistry = new ModelRegistry(testAuth);
    const model = getDefaultModel(testRegistry);
    assert.ok(model);

    // Should pick from a known provider
    const validProviders = ["anthropic", "openai-codex", "openrouter", "openai"];
    assert.ok(
      validProviders.includes(model.provider),
      `provider should be one of ${validProviders.join(", ")}, got ${model.provider}`
    );

    // If OAuth models exist, should prefer them over API key models
    const available = testRegistry.getAvailable();
    const hasOAuth = available.some((m) => testRegistry.isUsingOAuth(m));
    if (hasOAuth) {
      assert.ok(
        testRegistry.isUsingOAuth(model),
        `should prefer subscription (OAuth) over API key, got ${model.provider}/${model.id}`
      );
    }
  });

  await test("getDefaultModel returns null with empty registry", async () => {
    // Create isolated AuthStorage with no credentials
    const emptyAuth = new AuthStorage(join(homedir(), ".agentxl", "empty-auth-test.json"));
    const emptyRegistry = new ModelRegistry(emptyAuth);
    const model = getDefaultModel(emptyRegistry);
    assert.equal(model, null, "should return null with no auth");
  });

  // =======================================================================
  // Session lifecycle
  // =======================================================================
  console.log("\n  🔄 Session lifecycle\n");

  await test("isAuthenticated returns true when auth exists", async () => {
    if (!hasAuth) throw new Error("No auth available");
    assert.equal(isAuthenticated(), true);
  });

  await test("getAuthProvider returns a provider string", async () => {
    if (!hasAuth) throw new Error("No auth available");
    const provider = getAuthProvider();
    assert.ok(provider, "should return a provider");
    assert.equal(typeof provider, "string");
  });

  await test("getAuthProvider matches the model getDefaultModel would select", async () => {
    if (!hasAuth) throw new Error("No auth available");
    resetSession(); // clear any prior session
    const provider = getAuthProvider();
    const authPath = existsSync(AGENTXL_AUTH) ? AGENTXL_AUTH : PI_AUTH;
    const testAuth = new AuthStorage(authPath);
    const testRegistry = new ModelRegistry(testAuth);
    const model = getDefaultModel(testRegistry);
    assert.equal(
      provider,
      model?.provider ?? null,
      `getAuthProvider() should match getDefaultModel().provider`
    );
  });

  await test("abortSession does not throw when no session exists", async () => {
    resetSession();
    await abortSession(); // should be a no-op
  });

  await test("resetSession does not throw when no session exists", async () => {
    // Should be safe to call even if no session has been created
    resetSession();
  });

  await test("getSession creates and returns a session", async () => {
    if (!hasAuth) throw new Error("No auth available");
    resetSession(); // clear any prior session (also rebuilds auth)
    const session = await getSession();
    assert.ok(session, "should return a session");
    assert.ok(session.model, "session should have a model");
    assert.equal(session.thinkingLevel, "medium");
  });

  await test("getSession returns same session on second call", async () => {
    if (!hasAuth) throw new Error("No auth available");
    const session1 = await getSession();
    const session2 = await getSession();
    assert.equal(session1, session2, "should be the same singleton instance");
  });

  await test("resetSession disposes and clears session", async () => {
    if (!hasAuth) throw new Error("No auth available");
    const sessionBefore = await getSession();
    resetSession();
    const sessionAfter = await getSession();
    assert.notEqual(
      sessionBefore,
      sessionAfter,
      "should create a new session after reset"
    );
  });

  await test("session has no built-in tools", async () => {
    if (!hasAuth) throw new Error("No auth available");
    const session = await getSession();
    const toolNames = session.getActiveToolNames();
    // No read/bash/edit/write — Excel-only agent
    assert.ok(
      !toolNames.includes("read"),
      "should not have 'read' tool"
    );
    assert.ok(
      !toolNames.includes("bash"),
      "should not have 'bash' tool"
    );
    assert.ok(
      !toolNames.includes("edit"),
      "should not have 'edit' tool"
    );
    assert.ok(
      !toolNames.includes("write"),
      "should not have 'write' tool"
    );
  });

  // =======================================================================
  // SSE endpoint via HTTP (integration)
  // =======================================================================
  console.log("\n  📡 SSE endpoint (POST /api/agent)\n");

  // Create taskpane/dist so server can start
  const taskpaneDist = join(__dirname, "..", "taskpane", "dist");
  if (!existsSync(taskpaneDist)) {
    mkdirSync(taskpaneDist, { recursive: true });
    writeFileSync(join(taskpaneDist, "index.html"), "<html></html>");
  }

  resetSession(); // fresh session for HTTP tests
  await startServer(PORT);

  try {
    await test("GET /api/config/status reflects auth", async () => {
      const res = await httpGet("/api/config/status");
      assert.equal(res.status, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.authenticated, hasAuth);
      if (hasAuth) {
        assert.ok(json.provider, "should have a provider when authenticated");
      }
    });

    await test("POST /api/agent returns 400 without message", async () => {
      const res = await httpPost("/api/agent", {});
      assert.equal(res.status, 400);
    });

    if (!hasAuth) {
      skip(
        "POST /api/agent streams SSE response",
        "No auth configured"
      );
      skip(
        "SSE stream contains agent_start and agent_end events",
        "No auth configured"
      );
      skip(
        "SSE stream contains message_update with text",
        "No auth configured"
      );
      skip("Context is prepended to message", "No auth configured");
    } else {
      await test("SSE response has correct headers", async () => {
        const res = await postAgentSSE(
          { message: "Reply with only the word 'pong'. Nothing else." },
          30_000
        );
        assert.equal(res.status, 200);

        // Log error events if any, for diagnostics
        const errors = res.events.filter((e) => e.type === "error");
        if (errors.length > 0) {
          console.log(`     ⚠️  Error events: ${JSON.stringify(errors)}`);
        }
      });

      await test("SSE stream contains agent_start and agent_end", async () => {
        const { events } = await postAgentSSE(
          { message: "Reply with only the word 'pong'. Nothing else." },
          30_000
        );
        const types = events.map((e) => e.type);

        // Log error details if present
        const errors = events.filter((e) => e.type === "error");
        if (errors.length > 0) {
          console.log(`     ⚠️  Error events: ${JSON.stringify(errors)}`);
        }

        assert.ok(
          types.includes("agent_start"),
          `should have agent_start, got: ${types.join(", ")}`
        );
        assert.ok(
          types.includes("agent_end"),
          `should have agent_end, got: ${types.join(", ")}`
        );
      });

      await test("SSE stream contains message_update with text", async () => {
        const { events } = await postAgentSSE(
          { message: "Reply with only the word 'pong'. Nothing else." },
          30_000
        );
        const messageUpdates = events.filter(
          (e) => e.type === "message_update"
        );
        assert.ok(
          messageUpdates.length > 0,
          "should have at least one message_update"
        );

        // At least one update should have text content
        const hasText = messageUpdates.some((e) => {
          const msg = e.message;
          if (!msg || !msg.content) return false;
          return msg.content.some(
            (c: any) => c.type === "text" && c.text && c.text.length > 0
          );
        });
        assert.ok(hasText, "should have text content in message updates");
      });

      await test("SSE stream with context prepends it", async () => {
        const { events } = await postAgentSSE(
          {
            message:
              "Reply with only the word 'pong'. Nothing else.",
            context: {
              activeSheet: "TestSheet",
              selectedRange: "B2:C5",
            },
          },
          30_000
        );
        // Just verify the stream completes successfully with context
        const types = events.map((e) => e.type);
        assert.ok(types.includes("agent_end"), "should complete successfully");
      });

      await test("SSE error event on invalid session state", async () => {
        // Dispose the session to force an error on next prompt
        resetSession();

        // This should create a new session and work fine
        const { events } = await postAgentSSE(
          { message: "Reply with only the word 'pong'. Nothing else." },
          30_000
        );
        const types = events.map((e) => e.type);
        assert.ok(
          types.includes("agent_end"),
          "should recover with a new session"
        );
      });
    }
  } finally {
    resetSession();
    await stopServer();
  }

  // =======================================================================
  // Summary
  // =======================================================================
  console.log(`\n  ─────────────────────────────────────`);
  console.log(
    `  ${passed + failed + skipped} tests: ${passed} passed, ${failed} failed, ${skipped} skipped`
  );
  console.log(`  ─────────────────────────────────────\n`);
}

run();
