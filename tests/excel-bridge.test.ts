/**
 * Unit tests for the Excel execution bridge.
 *
 * Run: npx tsx tests/excel-bridge.test.ts
 */

import { strict as assert } from "assert";
import {
  registerPendingExecution,
  resolveExecution,
  rejectExecution,
  getPendingCount,
  clearAllPending,
} from "../src/server/excel-bridge.js";

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

console.log("\n🔗 Excel Bridge Tests\n");

// Clean up between tests
function cleanup() {
  clearAllPending();
}

await test("registerPendingExecution creates a pending entry", async () => {
  cleanup();
  const promise = registerPendingExecution("test-1", 5000);
  assert.equal(getPendingCount(), 1);
  // Resolve it so it doesn't hang
  resolveExecution("test-1", "done");
  const result = await promise;
  assert.equal(result, "done");
  assert.equal(getPendingCount(), 0);
});

await test("resolveExecution resolves the pending promise", async () => {
  cleanup();
  const promise = registerPendingExecution("test-2", 5000);
  const found = resolveExecution("test-2", "hello world");
  assert.equal(found, true);
  const result = await promise;
  assert.equal(result, "hello world");
});

await test("resolveExecution returns false for unknown toolCallId", async () => {
  cleanup();
  const found = resolveExecution("nonexistent", "data");
  assert.equal(found, false);
});

await test("rejectExecution rejects the pending promise", async () => {
  cleanup();
  const promise = registerPendingExecution("test-3", 5000);
  const found = rejectExecution("test-3", "Something went wrong");
  assert.equal(found, true);
  try {
    await promise;
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("Something went wrong"));
  }
});

await test("rejectExecution returns false for unknown toolCallId", async () => {
  cleanup();
  const found = rejectExecution("nonexistent", "error");
  assert.equal(found, false);
});

await test("execution times out after specified duration", async () => {
  cleanup();
  const promise = registerPendingExecution("test-timeout", 100); // 100ms timeout
  try {
    await promise;
    assert.fail("Should have timed out");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("timed out"));
  }
  assert.equal(getPendingCount(), 0);
});

await test("clearAllPending clears all entries", async () => {
  cleanup();
  // Register multiple but don't await (they'll be rejected by clear)
  const p1 = registerPendingExecution("a", 5000).catch(() => {});
  const p2 = registerPendingExecution("b", 5000).catch(() => {});
  assert.equal(getPendingCount(), 2);
  clearAllPending();
  assert.equal(getPendingCount(), 0);
  await p1;
  await p2;
});

await test("resolving same toolCallId twice returns false on second call", async () => {
  cleanup();
  const promise = registerPendingExecution("test-double", 5000);
  assert.equal(resolveExecution("test-double", "first"), true);
  assert.equal(resolveExecution("test-double", "second"), false);
  const result = await promise;
  assert.equal(result, "first");
});

cleanup();

console.log(
  `\n  ─────────────────────────────────────\n  ${passed + failed} tests: ${passed} passed, ${failed} failed\n  ─────────────────────────────────────\n`
);

if (failed > 0) process.exit(1);
