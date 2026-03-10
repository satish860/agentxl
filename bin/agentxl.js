#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { createInterface } from "readline";
import { config as loadDotenv } from "dotenv";

// Load .env from project root (before any other imports)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
loadDotenv({ path: join(projectRoot, ".env") });

// ---------------------------------------------------------------------------
// Package info
// ---------------------------------------------------------------------------

const pkgPath = join(__dirname, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const VERSION = pkg.version;

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name) {
  const eqIdx = args.findIndex((a) => a.startsWith(`--${name}=`));
  if (eqIdx !== -1) return args[eqIdx].split("=")[1];
  const spaceIdx = args.indexOf(`--${name}`);
  if (spaceIdx !== -1 && args[spaceIdx + 1]) return args[spaceIdx + 1];
  return undefined;
}

const hasFlag = (name) => args.includes(`--${name}`);

// ---------------------------------------------------------------------------
// Terminal I/O helpers
// ---------------------------------------------------------------------------

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptSecret(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const rl = createInterface({ input: process.stdin, terminal: false });
    if (process.stdin.isTTY) process.stdin.setRawMode?.(false);
    rl.on("line", (line) => {
      rl.close();
      process.stdout.write("\n");
      resolve(line.trim());
    });
  });
}

async function openUrl(url) {
  const { exec } = await import("child_process");
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd);
}

// ---------------------------------------------------------------------------
// Step-by-step progress output
// ---------------------------------------------------------------------------

/** Print a step status: ✅ done, ⏳ in progress, ❌ failed */
function step(icon, text) {
  console.log(`  ${icon} ${text}`);
}

// ---------------------------------------------------------------------------
// Auth flow using Pi SDK
// ---------------------------------------------------------------------------

async function checkAuth() {
  const { AuthStorage } = await import("@mariozechner/pi-coding-agent");

  const piAuthPath = join(homedir(), ".pi", "agent", "auth.json");
  const agentxlAuthPath = join(homedir(), ".agentxl", "auth.json");
  const authPath = existsSync(piAuthPath) ? piAuthPath : agentxlAuthPath;
  const authStorage = AuthStorage.create(authPath);

  return authStorage.list().length > 0;
}

async function runAuthFlow() {
  const { AuthStorage } = await import("@mariozechner/pi-coding-agent");

  const piAuthPath = join(homedir(), ".pi", "agent", "auth.json");
  const agentxlAuthPath = join(homedir(), ".agentxl", "auth.json");
  const authPath = existsSync(piAuthPath) ? piAuthPath : agentxlAuthPath;
  const authStorage = AuthStorage.create(authPath);

  // Check if already authenticated
  if (authStorage.list().length > 0) {
    return true;
  }

  console.log(`
  No API credentials found. Let's get you set up.

  How would you like to connect?

    Use an existing subscription (no API key needed):
      1. Claude Pro/Max — sign in with your Anthropic account
      2. ChatGPT Plus/Pro — sign in with your OpenAI account
      3. GitHub Copilot — sign in with your GitHub account
      4. Gemini — sign in with your Google account

    Use an API key:
      5. Paste an API key (Anthropic, OpenRouter, or OpenAI)

    No account yet?
      → Create a free OpenRouter account at https://openrouter.ai
        Get an API key instantly. Free models available.
`);

  // Build choices — OAuth providers + API key
  const oauthProviders = authStorage.getOAuthProviders();
  const choices = [];
  for (const p of oauthProviders) {
    choices.push({ type: "oauth", id: p.id, name: p.name, provider: p });
  }
  choices.push({ type: "apikey", id: "apikey", name: "Paste an API key" });

  const answer = await prompt("  Enter choice (1-" + choices.length + "): ");
  const idx = parseInt(answer, 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= choices.length) {
    console.error("\n  Invalid choice. Run 'agentxl login' to try again.\n");
    return false;
  }

  const choice = choices[idx];

  if (choice.type === "oauth") {
    console.log(`\n  Signing in with ${choice.name}...\n`);

    try {
      await authStorage.login(choice.id, {
        onAuth: (info) => {
          console.log(`  🌐 Opening browser for sign-in...`);
          console.log(`     ${info.url}\n`);
          if (info.instructions) {
            console.log(`     ${info.instructions}\n`);
          }
          openUrl(info.url);
        },
        onPrompt: async (p) => {
          const answer = await prompt(`  ${p.message}: `);
          return answer;
        },
        onProgress: (message) => {
          console.log(`  ${message}`);
        },
        onManualCodeInput: async () => {
          const code = await prompt("  Enter the code from the browser: ");
          return code;
        },
      });

      console.log(`\n  ✅ Signed in with ${choice.name}\n`);
      return true;
    } catch (err) {
      console.error(`\n  ❌ Sign-in failed: ${err.message}\n`);
      return false;
    }
  } else {
    // API key flow
    console.log(`
  Paste your API key below.

  Key prefixes:
    sk-ant-...  → Anthropic (Claude)
    sk-or-...   → OpenRouter (100+ models)
    sk-...      → OpenAI (GPT-4o)
`);

    const key = await promptSecret("  API key: ");

    if (!key) {
      console.error("\n  No key entered. Run 'agentxl login' to try again.\n");
      return false;
    }

    // Auto-detect provider from key prefix
    let provider;
    if (key.startsWith("sk-ant-")) provider = "anthropic";
    else if (key.startsWith("sk-or-")) provider = "openrouter";
    else if (key.startsWith("sk-")) provider = "openai";
    else {
      const p = await prompt("  Could not detect provider. Enter provider name (anthropic/openrouter/openai): ");
      provider = p.toLowerCase();
    }

    authStorage.set(provider, { type: "api_key", key });
    console.log(`\n  ✅ API key saved for ${provider}\n`);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
AgentXL v${VERSION} — AI agent for Microsoft Excel

Usage:
  agentxl start [options]    Start the AgentXL server
  agentxl login              Set up or change API credentials
  agentxl --version          Print version
  agentxl --help             Show this help

Options:
  --port <number>            Port to listen on (default: 3001)
  --verbose                  Log all HTTP requests

Examples:
  agentxl start
  agentxl start --port 3002
  agentxl login
`);
}

async function start() {
  const port = parseInt(getFlag("port") || "3001", 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`Error: Invalid port number. Must be 1-65535.`);
    process.exit(1);
  }

  console.log(`
  ┌──────────────────────────────────────┐
  │         AgentXL v${VERSION.padEnd(19)}│
  │      AI agent for Microsoft Excel    │
  └──────────────────────────────────────┘
`);

  // ── Step 1: Load modules ───────────────────────────────────────────────
  let ensureCerts, startServer, stopServer, setVerbose, getFolderPickerStrategy;
  try {
    const certs = await import("../dist/server/certs.js");
    const server = await import("../dist/server/index.js");
    const picker = await import("../dist/server/folder-picker.js");
    ensureCerts = certs.ensureCerts;
    startServer = server.startServer;
    stopServer = server.stopServer;
    setVerbose = server.setVerbose;
    getFolderPickerStrategy = picker.getFolderPickerStrategy;
  } catch (err) {
    step("❌", "Could not load AgentXL server modules");
    console.error("     Run 'npm run build' first to compile TypeScript.");
    console.error(`     ${err.message}`);
    process.exit(1);
  }

  // ── Step 2: Check auth ─────────────────────────────────────────────────
  const hasAuth = await checkAuth();
  if (hasAuth) {
    step("✅", "Auth ready");
  } else {
    const authed = await runAuthFlow();
    if (!authed) process.exit(1);
    step("✅", "Auth ready");
  }

  // ── Step 3: HTTPS certificates ─────────────────────────────────────────
  try {
    const certPair = await ensureCerts();
    step("✅", "HTTPS certificate ready");

    // ── Step 4: Start server ───────────────────────────────────────────────
    if (hasFlag("verbose")) setVerbose(true);
    await startServer(port, certPair);
    step("✅", `Server running at https://localhost:${port}`);
  } catch (err) {
    step("❌", `Server failed to start: ${err.message}`);
    process.exit(1);
  }

  // ── Step 5: OCR status ─────────────────────────────────────────────────
  if (process.env.AZURE_MISTRAL_ENDPOINT && process.env.AZURE_MISTRAL_API_KEY) {
    step("✅", "OCR ready (Azure Mistral)");
  } else if (process.env.MISTRAL_API_KEY) {
    step("✅", "OCR ready (Mistral direct)");
  } else {
    step("ℹ️", "OCR not configured — scanned PDFs won't be readable");
    step("  ", "Set AZURE_MISTRAL_ENDPOINT + AZURE_MISTRAL_API_KEY in .env");
  }

  // ── Step 6: Folder picker strategy ────────────────────────────────────
  const pickerStrategy = getFolderPickerStrategy();
  const pickerLabels = {
    "native-helper": "Native folder picker helper",
    "powershell": "PowerShell folder picker (fallback)",
    "osascript": "macOS folder picker (osascript)",
    "manual-only": "Manual path entry only",
  };
  const pickerLabel = pickerLabels[pickerStrategy.method] || pickerStrategy.method;
  if (pickerStrategy.method === "native-helper") {
    step("✅", `Folder picker: ${pickerLabel}`);
  } else if (pickerStrategy.method === "powershell" || pickerStrategy.method === "osascript") {
    step("⚠️", `Folder picker: ${pickerLabel}`);
    if (pickerStrategy.platform === "win32") {
      step("  ", "Build the native helper for a better experience:");
      step("  ", "  npm run build:folder-picker:win");
    }
  } else {
    step("ℹ️", `Folder picker: ${pickerLabel}`);
  }

  // ── Post-start guidance ────────────────────────────────────────────────
  const manifestPath = resolve(__dirname, "..", "manifest", "manifest.xml");
  const manifestExists = existsSync(manifestPath);

  console.log(`
  ─────────────────────────────────────────────────
  All systems go. Here's what to do next:
  ─────────────────────────────────────────────────

  🌐 Test in browser (confirm everything works):
     https://localhost:${port}/taskpane/

  📎 Load in Excel (one-time setup):
     1. Excel → File → Options → Trust Center → Trust Center Settings
     2. Trusted Add-in Catalogs → add path: ${manifestExists ? dirname(manifestPath) : "[manifest folder]"}
     3. Check "Show in Menu" → OK → OK
     4. Restart Excel
     5. Insert → My Add-ins → SHARED FOLDER → AgentXL → Add

  After setup, just run 'agentxl start' and click
  AgentXL on the Home ribbon. No re-sideloading needed.

  💬 Try your first message:
     "What can you help me with in this workbook?"
`);

  // ── Graceful shutdown ──────────────────────────────────────────────────
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\n  AgentXL stopped. Goodbye!\n");
    const forceExit = setTimeout(() => process.exit(0), 2000);
    forceExit.unref?.();
    stopServer().then(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function login() {
  console.log("");
  const authed = await runAuthFlow();
  if (authed) {
    console.log("  Run 'agentxl start' to launch the server.\n");
  }
  process.exit(authed ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (hasFlag("version") || command === "--version") {
  console.log(VERSION);
  process.exit(0);
}

if (hasFlag("help") || command === "--help" || command === "help") {
  printHelp();
  process.exit(0);
}

if (command === "start") {
  start().catch((err) => {
    console.error(`\n  ❌ ${err.message || err}\n`);
    process.exit(1);
  });
} else if (command === "login") {
  login().catch((err) => {
    console.error(`\n  ❌ ${err.message || err}\n`);
    process.exit(1);
  });
} else if (!command) {
  printHelp();
  process.exit(0);
} else {
  console.error(`Unknown command: ${command}`);
  console.error(`Run 'agentxl --help' for usage.`);
  process.exit(1);
}
