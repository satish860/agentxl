import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const root = dirname(dirname(__filename));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));

const releaseDir = join(root, "release", "windows");
const payloadDir = join(releaseDir, "payload");
const appDir = join(payloadDir, "app");
const runtimeDir = join(payloadDir, "runtime");
const cacheDir = join(releaseDir, "cache");
const nodeVersion = process.env.AGENTXL_NODE_VERSION || process.version.replace(/^v/, "");
const nodeArch = process.env.AGENTXL_NODE_ARCH || "x64";
const nodeZipName = `node-v${nodeVersion}-win-${nodeArch}.zip`;
const nodeZipUrl =
  process.env.AGENTXL_NODE_ZIP_URL ||
  `https://nodejs.org/dist/v${nodeVersion}/${nodeZipName}`;
const nodeZipPath = join(cacheDir, nodeZipName);

function log(message) {
  console.log(`[prepare-installer-win] ${message}`);
}

function ensureExists(path) {
  if (!existsSync(path)) {
    throw new Error(`Required path not found: ${path}`);
  }
}

function run(command, options = {}) {
  log(`Running: ${command}`);
  return execSync(command, {
    cwd: options.cwd || root,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
}

async function downloadFile(url, targetPath) {
  log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed: ${url} (${res.status} ${res.statusText})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(targetPath, buffer);
}

function copyInto(source, target) {
  ensureExists(source);
  cpSync(source, target, { recursive: true, force: true });
}

function flattenSingleSubdirectory(path) {
  const entries = readdirSync(path, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length !== 1) return path;
  return join(path, dirs[0].name);
}

async function prepareNodeRuntime() {
  mkdirSync(cacheDir, { recursive: true });

  if (!existsSync(nodeZipPath)) {
    await downloadFile(nodeZipUrl, nodeZipPath);
  } else {
    log(`Using cached Node runtime: ${nodeZipPath}`);
  }

  const extractDir = join(cacheDir, "node-extract");
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });

  run(
    `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${nodeZipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force"`
  );

  const expandedRoot = flattenSingleSubdirectory(extractDir);
  copyInto(expandedRoot, runtimeDir);
}

function prepareAppPayload() {
  const requiredPaths = [
    "bin/agentxl.js",
    "dist",
    "taskpane/dist",
    "manifest",
    "package.json",
    "package-lock.json",
    "README.md",
    "LICENSE",
  ];

  for (const rel of requiredPaths) {
    ensureExists(join(root, rel));
  }

  copyInto(join(root, "bin"), join(appDir, "bin"));
  copyInto(join(root, "dist"), join(appDir, "dist"));
  copyInto(join(root, "taskpane", "dist"), join(appDir, "taskpane", "dist"));
  copyInto(join(root, "manifest"), join(appDir, "manifest"));
  copyInto(join(root, "package.json"), join(appDir, "package.json"));
  copyInto(join(root, "package-lock.json"), join(appDir, "package-lock.json"));
  copyInto(join(root, "README.md"), join(appDir, "README.md"));
  copyInto(join(root, "LICENSE"), join(appDir, "LICENSE"));

  if (!existsSync(join(root, "bin", "agentxl-folder-picker.exe"))) {
    log(
      "Warning: bin/agentxl-folder-picker.exe not found. " +
        "Run `npm run build:folder-picker:win` if you want the native Windows folder picker in the installer."
    );
  }

  run("npm ci --omit=dev", { cwd: appDir });
}

function writeInstallerMetadata() {
  const metadata = {
    appName: "AgentXL",
    version: pkg.version,
    npmPackage: pkg.name,
    nodeRuntime: {
      version: nodeVersion,
      arch: nodeArch,
      source: nodeZipUrl,
    },
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(join(releaseDir, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n", "utf-8");
  writeFileSync(join(releaseDir, "version.iss"), `#define AppVersion \"${pkg.version}\"\n`, "utf-8");
}

function copyInstallerFiles() {
  const filesToCopy = [
    [join(root, "installer", "windows", "install-agentxl.ps1"), join(payloadDir, "install-agentxl.ps1")],
    [join(root, "installer", "windows", "uninstall-agentxl.ps1"), join(payloadDir, "uninstall-agentxl.ps1")],
    [join(root, "installer", "windows", "POST_INSTALL.txt"), join(payloadDir, "POST_INSTALL.txt")],
  ];

  for (const [source, target] of filesToCopy) {
    copyInto(source, target);
  }
}

function writePortableWindowsLaunchers() {
  const startCmd = [
    "@echo off",
    "set ROOT=%~dp0",
    "pushd \"%ROOT%app\"",
    "\"%ROOT%runtime\\node.exe\" \"%ROOT%app\\bin\\agentxl.js\" start %*",
    "popd",
    "",
  ].join("\r\n");

  const loginCmd = [
    "@echo off",
    "set ROOT=%~dp0",
    "pushd \"%ROOT%app\"",
    "\"%ROOT%runtime\\node.exe\" \"%ROOT%app\\bin\\agentxl.js\" login %*",
    "popd",
    "",
  ].join("\r\n");

  const openTaskpaneCmd = [
    "@echo off",
    "start \"\" \"https://localhost:3001/taskpane/\"",
    "",
  ].join("\r\n");

  const manifestRoot = join(payloadDir, "manifest");
  mkdirSync(manifestRoot, { recursive: true });
  copyInto(join(appDir, "manifest", "manifest.xml"), join(manifestRoot, "manifest.xml"));

  writeFileSync(join(payloadDir, "Start AgentXL.cmd"), startCmd, "utf-8");
  writeFileSync(join(payloadDir, "AgentXL Login.cmd"), loginCmd, "utf-8");
  writeFileSync(join(payloadDir, "Open AgentXL Taskpane.cmd"), openTaskpaneCmd, "utf-8");

  const info = [
    "AgentXL portable Windows build",
    "",
    "Quick start:",
    "1. Double-click 'Start AgentXL.cmd'",
    "2. Wait for the terminal to say the server is running",
    "3. In Excel, open Trusted Add-in Catalogs",
    `4. Add this folder: ${manifestRoot}`,
    "5. Restart Excel",
    "6. Insert -> My Add-ins -> SHARED FOLDER -> AgentXL",
    "",
    "If you need to sign in first, run 'AgentXL Login.cmd'.",
    "",
  ].join("\r\n");
  writeFileSync(join(payloadDir, "INSTALLATION_INFO.txt"), info, "utf-8");
}

async function main() {
  rmSync(releaseDir, { recursive: true, force: true });
  mkdirSync(appDir, { recursive: true });
  mkdirSync(runtimeDir, { recursive: true });

  prepareAppPayload();
  await prepareNodeRuntime();
  copyInstallerFiles();
  writePortableWindowsLaunchers();
  writeInstallerMetadata();

  log(`Prepared self-contained Windows installer payload in ${payloadDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
