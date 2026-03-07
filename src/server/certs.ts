import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";
import { X509Certificate } from "crypto";
import selfsigned from "selfsigned";

const AGENTXL_DIR = join(homedir(), ".agentxl");
const CERTS_DIR = join(AGENTXL_DIR, "certs");
const KEY_PATH = join(CERTS_DIR, "localhost.key");
const CERT_PATH = join(CERTS_DIR, "localhost.crt");

/** Days before expiry to trigger regeneration */
const EXPIRY_BUFFER_DAYS = 30;

export interface CertPair {
  key: string;
  cert: string;
}

/**
 * Check if an existing certificate is still valid.
 * Returns false if expired or within EXPIRY_BUFFER_DAYS of expiry.
 */
function isCertValid(certPem: string): boolean {
  try {
    const cert = new X509Certificate(certPem);
    const expiryDate = new Date(cert.validTo);
    const bufferMs = EXPIRY_BUFFER_DAYS * 24 * 60 * 60 * 1000;
    return expiryDate.getTime() - Date.now() > bufferMs;
  } catch {
    return false;
  }
}

/**
 * Ensure HTTPS certificates exist for localhost.
 * Generates self-signed certs on first run, reuses them on subsequent runs.
 * Regenerates if certs are expired or within 30 days of expiry.
 */
export async function ensureCerts(): Promise<CertPair> {
  try {
    // Check for existing valid certs
    if (existsSync(KEY_PATH) && existsSync(CERT_PATH)) {
      const key = readFileSync(KEY_PATH, "utf-8");
      const cert = readFileSync(CERT_PATH, "utf-8");

      if (isCertValid(cert)) {
        return { key, cert };
      }

      console.log(
        "🔐 Existing certificate expired or expiring soon, regenerating..."
      );
    }

    // Create directory structure
    if (!existsSync(CERTS_DIR)) {
      mkdirSync(CERTS_DIR, { recursive: true });
    }

    // Generate self-signed certificate for localhost, valid for 1 year
    const notBeforeDate = new Date();
    const notAfterDate = new Date();
    notAfterDate.setFullYear(notAfterDate.getFullYear() + 1);

    const pems = await selfsigned.generate(
      [{ name: "commonName", value: "localhost" }],
      {
        notBeforeDate,
        notAfterDate,
        keySize: 2048,
        algorithm: "sha256",
        extensions: [
          {
            name: "subjectAltName",
            altNames: [
              { type: 2, value: "localhost" },
              { type: 7, ip: "127.0.0.1" },
            ],
          },
        ],
      }
    );

    // Write cert files with restricted permissions
    writeFileSync(KEY_PATH, pems.private, { mode: 0o600 });
    writeFileSync(CERT_PATH, pems.cert, { mode: 0o600 });

    console.log("🔐 Generated HTTPS certificate for localhost");
    console.log(
      "   If Excel shows a certificate warning, you may need to trust the certificate"
    );

    return {
      key: pems.private,
      cert: pems.cert,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to generate HTTPS certificates: ${message}\n` +
        `   Check that ${CERTS_DIR} is writable.`
    );
  }
}
