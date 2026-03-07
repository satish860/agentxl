import { ensureCerts } from "../src/server/certs.js";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createServer, get } from "https";
import { X509Certificate } from "crypto";
import { strict as assert } from "assert";

const CERTS_DIR = join(homedir(), ".agentxl", "certs");
const KEY_PATH = join(CERTS_DIR, "localhost.key");
const CERT_PATH = join(CERTS_DIR, "localhost.crt");

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
  } catch (error) {
    console.log(`  ❌ ${name}`);
    console.error(`     ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

async function run() {
  console.log("\n🔐 Certificate Tests\n");

  // Clean slate
  if (existsSync(KEY_PATH)) unlinkSync(KEY_PATH);
  if (existsSync(CERT_PATH)) unlinkSync(CERT_PATH);

  await test("generates certs on first run", async () => {
    const certs = await ensureCerts();

    assert.ok(certs.key.startsWith("-----BEGIN PRIVATE KEY-----"));
    assert.ok(certs.cert.startsWith("-----BEGIN CERTIFICATE-----"));
    assert.ok(existsSync(KEY_PATH), "key file should exist on disk");
    assert.ok(existsSync(CERT_PATH), "cert file should exist on disk");
  });

  await test("reuses existing valid certs", async () => {
    const keyOnDisk = readFileSync(KEY_PATH, "utf-8");
    const certs = await ensureCerts();

    assert.equal(certs.key, keyOnDisk, "should return same key from disk");
  });

  await test("cert has correct subject and SANs", async () => {
    const certs = await ensureCerts();
    const x509 = new X509Certificate(certs.cert);

    assert.ok(x509.subject.includes("CN=localhost"), "CN should be localhost");
    assert.ok(
      x509.subjectAltName?.includes("DNS:localhost"),
      "SAN should include DNS:localhost"
    );
    assert.ok(
      x509.subjectAltName?.includes("IP Address:127.0.0.1"),
      "SAN should include IP:127.0.0.1"
    );
  });

  await test("cert is valid for at least 11 months", async () => {
    const certs = await ensureCerts();
    const x509 = new X509Certificate(certs.cert);
    const expiryDate = new Date(x509.validTo);
    const elevenMonthsFromNow = new Date();
    elevenMonthsFromNow.setMonth(elevenMonthsFromNow.getMonth() + 11);

    assert.ok(
      expiryDate > elevenMonthsFromNow,
      `cert should be valid for at least 11 months, expires: ${expiryDate.toISOString()}`
    );
  });

  await test("regenerates when cert is invalid", async () => {
    const originalKey = readFileSync(KEY_PATH, "utf-8");

    // Corrupt the cert file
    writeFileSync(CERT_PATH, "NOT A VALID CERT");

    const certs = await ensureCerts();

    assert.ok(certs.cert.startsWith("-----BEGIN CERTIFICATE-----"));
    assert.notEqual(certs.key, originalKey, "should generate a new key pair");
  });

  await test("HTTPS server accepts the certs", async () => {
    const certs = await ensureCerts();

    const server = createServer(
      { key: certs.key, cert: certs.cert },
      (_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
      }
    );

    const port = 3099;

    await new Promise<void>((resolve) =>
      server.listen(port, "127.0.0.1", resolve)
    );

    const body = await new Promise<string>((resolve, reject) => {
      get(
        `https://localhost:${port}`,
        { rejectUnauthorized: false },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        }
      ).on("error", reject);
    });

    server.close();

    const parsed = JSON.parse(body);
    assert.equal(parsed.status, "ok");
  });

  console.log("");
}

run();
