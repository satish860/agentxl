import { readFileSync } from "fs";

export interface CertPair {
  key: string;
  cert: string;
}

/**
 * Ensure trusted HTTPS certificates exist for localhost.
 *
 * Uses Microsoft's `office-addin-dev-certs` package which:
 * 1. Generates a localhost CA + server certificate
 * 2. Installs the CA into the OS trust store (Windows + Mac)
 * 3. Chrome, Edge, Excel all trust it — no manual steps
 *
 * On first run, the user may see an OS prompt to trust the certificate.
 * Subsequent runs reuse the existing trusted certs.
 */
export async function ensureCerts(): Promise<CertPair> {
  try {
    // Dynamic require — office-addin-dev-certs is CJS
    const devCerts = await import("office-addin-dev-certs");

    // This generates certs if needed AND installs the CA into the OS trust store.
    // Returns { key: string, cert: string } paths or buffer.
    const httpsOptions = await devCerts.getHttpsServerOptions();

    const key =
      typeof httpsOptions.key === "string"
        ? httpsOptions.key
        : Buffer.isBuffer(httpsOptions.key)
          ? httpsOptions.key.toString("utf-8")
          : readFileSync(httpsOptions.key as any, "utf-8");

    const cert =
      typeof httpsOptions.cert === "string"
        ? httpsOptions.cert
        : Buffer.isBuffer(httpsOptions.cert)
          ? httpsOptions.cert.toString("utf-8")
          : readFileSync(httpsOptions.cert as any, "utf-8");

    return { key, cert };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to generate HTTPS certificates: ${message}\n` +
        `   Try running: npx office-addin-dev-certs install`
    );
  }
}
