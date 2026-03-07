import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import selfsigned from "selfsigned";

const AGENTXL_DIR = join(homedir(), ".agentxl");
const CERTS_DIR = join(AGENTXL_DIR, "certs");
const KEY_PATH = join(CERTS_DIR, "localhost.key");
const CERT_PATH = join(CERTS_DIR, "localhost.crt");

export interface CertPair {
  key: string;
  cert: string;
}

/**
 * Ensure HTTPS certificates exist for localhost.
 * Generates self-signed certs on first run, reuses them on subsequent runs.
 */
export async function ensureCerts(): Promise<CertPair> {
  // Return existing certs if they exist
  if (existsSync(KEY_PATH) && existsSync(CERT_PATH)) {
    return {
      key: readFileSync(KEY_PATH, "utf-8"),
      cert: readFileSync(CERT_PATH, "utf-8"),
    };
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
}
