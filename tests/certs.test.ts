/**
 * Acceptance tests for HTTPS certificate generation.
 *
 * Uses office-addin-dev-certs — Microsoft's official package for
 * generating OS-trusted localhost certificates.
 *
 * Run: npx tsx tests/certs.test.ts
 */

import { strict as assert } from "assert";
import { createServer } from "https";
import { ensureCerts, type CertPair } from "../src/server/certs.js";

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
    console.error(`     ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

async function run() {
  console.log("\n🔐 Certificate Tests\n");

  let certs: CertPair;

  await test("ensureCerts returns key and cert", async () => {
    certs = await ensureCerts();
    assert.ok(certs.key, "should have a key");
    assert.ok(certs.cert, "should have a cert");
    assert.ok(certs.key.includes("-----BEGIN"), "key should be PEM format");
    assert.ok(certs.cert.includes("-----BEGIN CERTIFICATE"), "cert should be PEM format");
  });

  await test("ensureCerts returns same certs on second call", async () => {
    const certs2 = await ensureCerts();
    assert.equal(certs2.key, certs.key, "key should be identical");
    assert.equal(certs2.cert, certs.cert, "cert should be identical");
  });

  await test("HTTPS server accepts the certs", async () => {
    const server = createServer(
      { key: certs.key, cert: certs.cert },
      (_req, res) => {
        res.writeHead(200);
        res.end("ok");
      }
    );

    await new Promise<void>((resolve, reject) => {
      server.on("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const addr = server.address() as { port: number };
    assert.ok(addr.port > 0, "server should be listening");

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  console.log(`\n  ─────────────────────────────────────`);
  console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);
  console.log(`  ─────────────────────────────────────\n`);
}

run();
