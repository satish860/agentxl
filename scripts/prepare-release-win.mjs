/**
 * Prepare a self-contained Windows release ZIP.
 *
 * Output: release/windows/dist/AgentXL-<version>-windows-x64.zip
 *
 * Contents:
 *   AgentXL.vbs              ← double-click launcher (starts server + opens Excel)
 *   AgentXL Login.vbs        ← sign-in launcher
 *   runtime/                 ← portable Node.js (no system install needed)
 *   app/                     ← AgentXL server, agent, taskpane
 *   manifest/manifest.xml    ← for local sideloading (non-AppSource users)
 *   _internal/               ← hidden cmd launchers
 *
 * No MSI. No WiX. No Inno Setup. Just a ZIP.
 */

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
const distDir = join(releaseDir, "dist");
const cacheDir = join(releaseDir, "cache");

const nodeVersion =
  process.env.AGENTXL_NODE_VERSION || process.version.replace(/^v/, "");
const nodeArch = process.env.AGENTXL_NODE_ARCH || "x64";
const nodeZipName = `node-v${nodeVersion}-win-${nodeArch}.zip`;
const nodeZipUrl =
  process.env.AGENTXL_NODE_ZIP_URL ||
  `https://nodejs.org/dist/v${nodeVersion}/${nodeZipName}`;
const nodeZipPath = join(cacheDir, nodeZipName);

function log(msg) {
  console.log(`[release] ${msg}`);
}

function run(command, opts = {}) {
  return execSync(command, {
    cwd: opts.cwd || root,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
}

function ensureExists(path) {
  if (!existsSync(path))
    throw new Error(`Required path not found: ${path}`);
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

// ---------------------------------------------------------------------------
// Download portable Node.js
// ---------------------------------------------------------------------------

async function prepareNodeRuntime() {
  mkdirSync(cacheDir, { recursive: true });

  if (!existsSync(nodeZipPath)) {
    log(`Downloading Node.js ${nodeVersion} (${nodeArch})...`);
    const res = await fetch(nodeZipUrl);
    if (!res.ok)
      throw new Error(`Download failed: ${nodeZipUrl} (${res.status})`);
    writeFileSync(nodeZipPath, Buffer.from(await res.arrayBuffer()));
  } else {
    log(`Using cached Node.js: ${nodeZipPath}`);
  }

  const extractDir = join(cacheDir, "node-extract");
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });

  run(
    `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${nodeZipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force"`
  );

  copyInto(flattenSingleSubdirectory(extractDir), runtimeDir);
}

// ---------------------------------------------------------------------------
// Copy app payload
// ---------------------------------------------------------------------------

function prepareAppPayload() {
  const required = [
    "bin/agentxl.js",
    "dist",
    "taskpane/dist",
    "manifest",
    "package.json",
    "package-lock.json",
  ];
  for (const rel of required) ensureExists(join(root, rel));

  copyInto(join(root, "bin"), join(appDir, "bin"));
  copyInto(join(root, "dist"), join(appDir, "dist"));
  copyInto(join(root, "taskpane", "dist"), join(appDir, "taskpane", "dist"));
  copyInto(join(root, "manifest"), join(appDir, "manifest"));
  copyInto(join(root, "package.json"), join(appDir, "package.json"));
  copyInto(join(root, "package-lock.json"), join(appDir, "package-lock.json"));

  if (existsSync(join(root, "README.md")))
    copyInto(join(root, "README.md"), join(appDir, "README.md"));
  if (existsSync(join(root, "LICENSE")))
    copyInto(join(root, "LICENSE"), join(appDir, "LICENSE"));
  if (existsSync(join(root, "scripts", "enable-excel-addin.mjs")))
    copyInto(
      join(root, "scripts", "enable-excel-addin.mjs"),
      join(appDir, "scripts", "enable-excel-addin.mjs")
    );

  log("App payload prepared");
}

// ---------------------------------------------------------------------------
// Create launchers
// ---------------------------------------------------------------------------

function writeLaunchers() {
  // --- _internal cmd files ---
  const internalDir = join(payloadDir, "_internal");
  mkdirSync(internalDir, { recursive: true });

  writeFileSync(
    join(internalDir, "Start AgentXL.cmd"),
    [
      "@echo off",
      "set ROOT=%~dp0..",
      '"%ROOT%\\runtime\\node.exe" "%ROOT%\\app\\scripts\\enable-excel-addin.mjs" "%ROOT%\\app\\manifest\\manifest.xml" >nul 2>nul',
      'pushd "%ROOT%\\app"',
      '"%ROOT%\\runtime\\node.exe" "%ROOT%\\app\\bin\\agentxl.js" start %*',
      "popd",
      "",
    ].join("\r\n"),
    "utf-8"
  );

  writeFileSync(
    join(internalDir, "AgentXL Login.cmd"),
    [
      "@echo off",
      "set ROOT=%~dp0..",
      'pushd "%ROOT%\\app"',
      '"%ROOT%\\runtime\\node.exe" "%ROOT%\\app\\bin\\agentxl.js" login %*',
      "popd",
      "",
    ].join("\r\n"),
    "utf-8"
  );

  // --- VBScript launchers (user-facing, no console window) ---

  writeFileSync(
    join(payloadDir, "AgentXL.vbs"),
    [
      "' AgentXL — starts server silently, opens Excel with add-in",
      "Option Explicit",
      "",
      "Dim fso, shell, root, nodePath, serverCmd, attempts, exitCode",
      "",
      'Set fso   = CreateObject("Scripting.FileSystemObject")',
      'Set shell = CreateObject("WScript.Shell")',
      "",
      "root = fso.GetParentFolderName(WScript.ScriptFullName)",
      'If Right(root, 1) <> "\\" Then root = root & "\\"',
      "",
      'nodePath  = root & "runtime\\node.exe"',
      'serverCmd = Chr(34) & root & "_internal\\Start AgentXL.cmd" & Chr(34)',
      "",
      "shell.Run serverCmd, 0, False",
      "",
      "attempts = 0",
      "Do",
      "  WScript.Sleep 1500",
      "  attempts = attempts + 1",
      "  exitCode = shell.Run( _",
      "    Chr(34) & nodePath & Chr(34) & \" -e \" & _",
      "    Chr(34) & \"fetch('https://localhost:3001/api/version',{signal:AbortSignal.timeout(2000)}).then(function(r){if(r.ok)process.exit(0);process.exit(1)}).catch(function(){process.exit(1)})\" & Chr(34), _",
      "    0, True)",
      "  If exitCode = 0 Then Exit Do",
      "Loop While attempts < 20",
      "",
      'shell.Run Chr(34) & nodePath & Chr(34) & " " & _',
      '  Chr(34) & root & "app\\scripts\\enable-excel-addin.mjs" & Chr(34) & " " & _',
      '  Chr(34) & root & "app\\manifest\\manifest.xml" & Chr(34) & " --open-excel", _',
      "  0, False",
      "",
    ].join("\r\n"),
    "utf-8"
  );

  writeFileSync(
    join(payloadDir, "AgentXL Login.vbs"),
    [
      "' AgentXL Login — opens provider sign-in",
      "Option Explicit",
      "",
      "Dim fso, shell, root",
      "",
      'Set fso   = CreateObject("Scripting.FileSystemObject")',
      'Set shell = CreateObject("WScript.Shell")',
      "",
      "root = fso.GetParentFolderName(WScript.ScriptFullName)",
      'If Right(root, 1) <> "\\" Then root = root & "\\"',
      "",
      'shell.Run Chr(34) & root & "_internal\\AgentXL Login.cmd" & Chr(34), 0, True',
      "",
    ].join("\r\n"),
    "utf-8"
  );

  // --- Manifest copy at top level ---
  const manifestDir = join(payloadDir, "manifest");
  mkdirSync(manifestDir, { recursive: true });
  copyInto(
    join(appDir, "manifest", "manifest.xml"),
    join(manifestDir, "manifest.xml")
  );

  // --- README ---
  writeFileSync(
    join(payloadDir, "README.txt"),
    [
      `AgentXL v${pkg.version}`,
      "──────────────────────────────────────",
      "",
      "Quick start:",
      '  1. Double-click "AgentXL.vbs"',
      '  2. If sign-in is needed, run "AgentXL Login.vbs" first',
      "  3. Excel opens with AgentXL in the Home ribbon",
      "",
      "What happens automatically:",
      "  • Starts the AgentXL server silently (no console window)",
      "  • Trusts the localhost HTTPS certificate",
      "  • Registers AgentXL with Excel",
      "  • Opens Excel with AgentXL loaded",
      "",
      "AppSource users:",
      "  If you installed AgentXL from the Office Store, you only need",
      '  the server running. Double-click "AgentXL.vbs" — the add-in',
      "  is already in your Excel ribbon.",
      "",
      `GitHub: https://github.com/satish860/agentxl`,
      "",
    ].join("\r\n"),
    "utf-8"
  );

  log("Launchers created");
}

// ---------------------------------------------------------------------------
// Install production node_modules
// ---------------------------------------------------------------------------

function installDependencies() {
  log("Installing production dependencies...");
  run("npm ci --omit=dev", { cwd: appDir });
  log("Dependencies installed");
}

// ---------------------------------------------------------------------------
// Create ZIP
// ---------------------------------------------------------------------------

function createZip() {
  mkdirSync(distDir, { recursive: true });
  const zipName = `AgentXL-${pkg.version}-windows-x64.zip`;
  const zipPath = join(distDir, zipName);

  run(
    `powershell -NoProfile -Command "Compress-Archive -Path '${payloadDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`
  );

  log(`Release ZIP: ${zipPath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Preserve cache (downloaded Node.js)
  const cacheExists = existsSync(cacheDir);
  const cacheTmp = join(dirname(releaseDir), "windows-cache-tmp");
  if (cacheExists) {
    rmSync(cacheTmp, { recursive: true, force: true });
    cpSync(cacheDir, cacheTmp, { recursive: true });
  }
  rmSync(releaseDir, { recursive: true, force: true });
  if (cacheExists) {
    cpSync(cacheTmp, cacheDir, { recursive: true });
    rmSync(cacheTmp, { recursive: true, force: true });
  }
  mkdirSync(appDir, { recursive: true });
  mkdirSync(runtimeDir, { recursive: true });

  prepareAppPayload();
  await prepareNodeRuntime();
  installDependencies();
  writeLaunchers();
  createZip();

  log("Done ✅");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
