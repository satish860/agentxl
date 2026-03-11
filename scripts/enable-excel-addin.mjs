import { existsSync } from "fs";
import { resolve } from "path";
import * as devCerts from "office-addin-dev-certs";
import * as devSettings from "office-addin-dev-settings";
import * as manifestLib from "office-addin-manifest";

function log(message) {
  console.log(`[enable-excel-addin] ${message}`);
}

function fail(message) {
  console.error(`[enable-excel-addin] ${message}`);
  process.exit(1);
}

const rawManifestPath = process.argv[2];
if (!rawManifestPath) {
  fail("Missing manifest path argument.");
}

const manifestPath = resolve(rawManifestPath);
if (!existsSync(manifestPath)) {
  fail(`Manifest not found: ${manifestPath}`);
}

const openExcel = process.argv.includes("--open-excel");
const machineCert = process.argv.includes("--machine-cert");

try {
  log(`Ensuring Office localhost certificate is trusted (${machineCert ? "machine" : "user"} scope)...`);
  await devCerts.ensureCertificatesAreInstalled(undefined, undefined, machineCert);
} catch (error) {
  log(`Certificate setup warning: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  log("Registering AgentXL with Office developer settings...");
  await devSettings.registerAddIn(manifestPath);
} catch (error) {
  fail(`Could not register add-in: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  log("Ensuring Office loopback access for localhost...");
  await devSettings.ensureLoopbackIsEnabled(manifestPath, false);
} catch (error) {
  log(`Loopback setup warning: ${error instanceof Error ? error.message : String(error)}`);
}

if (openExcel) {
  try {
    log("Opening Excel with AgentXL sideloaded...");
    await devSettings.sideloadAddIn(manifestPath, manifestLib.OfficeApp.Excel, false, devSettings.AppType.Desktop);
  } catch (error) {
    fail(`Could not open Excel with AgentXL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

log("AgentXL is ready for Excel.");
