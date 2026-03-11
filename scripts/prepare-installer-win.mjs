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
    "scripts/enable-excel-addin.mjs",
  ];

  for (const rel of requiredPaths) {
    ensureExists(join(root, rel));
  }

  copyInto(join(root, "bin"), join(appDir, "bin"));
  copyInto(join(root, "dist"), join(appDir, "dist"));
  copyInto(join(root, "taskpane", "dist"), join(appDir, "taskpane", "dist"));
  copyInto(join(root, "manifest"), join(appDir, "manifest"));
  copyInto(join(root, "scripts", "enable-excel-addin.mjs"), join(appDir, "scripts", "enable-excel-addin.mjs"));
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
    "\"%ROOT%runtime\\node.exe\" \"%ROOT%app\\scripts\\enable-excel-addin.mjs\" \"%ROOT%app\\manifest\\manifest.xml\" >nul 2>nul",
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

  const openExcelCmd = [
    "@echo off",
    "set ROOT=%~dp0",
    "start \"AgentXL Server\" cmd /c \"\"%ROOT%Start AgentXL.cmd\"\"",
    "timeout /t 4 /nobreak >nul",
    "\"%ROOT%runtime\\node.exe\" \"%ROOT%app\\scripts\\enable-excel-addin.mjs\" \"%ROOT%app\\manifest\\manifest.xml\" --open-excel",
    "",
  ].join("\r\n");

  const onboardingCmd = [
    "@echo off",
    "title AgentXL",
    "set ROOT=%~dp0",
    "",
    "echo.",
    'echo  ========================================',
    'echo           AgentXL is starting...',
    'echo  ========================================',
    "echo.",
    "",
    ":: Start the server in background",
    "echo  [1/3] Starting AgentXL server...",
    'start "AgentXL Server" /min cmd /c ""%ROOT%Start AgentXL.cmd""',
    "",
    ":: Wait for server to be ready",
    "echo  [2/3] Waiting for server to be ready...",
    "set ATTEMPTS=0",
    ":WAIT_LOOP",
    "set /a ATTEMPTS+=1",
    "if %ATTEMPTS% GTR 20 goto FALLBACK",
    "timeout /t 1 /nobreak >nul",
    `"%ROOT%runtime\\node.exe" -e "fetch('https://localhost:3001/api/version',{signal:AbortSignal.timeout(2000)}).then(r=>{if(r.ok)process.exit(0);process.exit(1)}).catch(()=>process.exit(1))" >nul 2>nul`,
    "if errorlevel 1 goto WAIT_LOOP",
    "",
    ":: Server is up - open Excel with add-in",
    "echo  [3/3] Opening Excel with AgentXL add-in...",
    '"%ROOT%runtime\\node.exe" "%ROOT%app\\scripts\\enable-excel-addin.mjs" "%ROOT%app\\manifest\\manifest.xml" --open-excel >nul 2>nul',
    "",
    ":: Also open the browser as a fallback view",
    "timeout /t 2 /nobreak >nul",
    'start "" "https://localhost:3001/taskpane/"',
    "",
    "echo.",
    'echo  ========================================',
    'echo         AgentXL is running!',
    'echo.',
    'echo   Look for the AgentXL panel in Excel.',
    'echo   Or use your browser:',
    'echo   https://localhost:3001/taskpane/',
    'echo.',
    'echo   Keep this window open while using',
    'echo   AgentXL. Close it to stop the server.',
    'echo  ========================================',
    "echo.",
    "echo  Press any key to stop AgentXL...",
    "pause >nul",
    'taskkill /fi "WINDOWTITLE eq AgentXL Server*" /f >nul 2>nul',
    "exit /b",
    "",
    ":FALLBACK",
    "echo.",
    "echo  Server is still starting. Opening browser...",
    'start "" "https://localhost:3001/taskpane/"',
    "echo.",
    "echo  Refresh the browser page in a moment.",
    "echo  Press any key to stop AgentXL...",
    "pause >nul",
    'taskkill /fi "WINDOWTITLE eq AgentXL Server*" /f >nul 2>nul',
    "exit /b",
    "",
  ].join("\r\n");

  const manifestRoot = join(payloadDir, "manifest");
  mkdirSync(manifestRoot, { recursive: true });
  copyInto(join(appDir, "manifest", "manifest.xml"), join(manifestRoot, "manifest.xml"));

  writeFileSync(join(payloadDir, "Start AgentXL.cmd"), startCmd, "utf-8");
  writeFileSync(join(payloadDir, "AgentXL Login.cmd"), loginCmd, "utf-8");
  writeFileSync(join(payloadDir, "Open Excel with AgentXL.cmd"), openExcelCmd, "utf-8");
  writeFileSync(join(payloadDir, "Launch AgentXL Onboarding.cmd"), onboardingCmd, "utf-8");

  const info = [
    "AgentXL portable Windows build",
    "",
    "Fastest path:",
    "1. Double-click 'Launch AgentXL Onboarding.cmd'",
    "2. If sign-in is needed, run 'AgentXL Login.cmd' once and retry",
    "3. Wait for Excel to open, then click AgentXL on the Home tab if the pane is not already visible",
    "",
    "What this does automatically:",
    "- trusts the localhost Office certificate",
    "- registers AgentXL with Office for development",
    "- enables localhost loopback when needed",
    "- opens Excel with AgentXL sideloaded",
    "",
    `Manifest location: ${manifestRoot}`,
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
