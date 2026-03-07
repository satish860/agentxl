#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { createInterface } from "readline";

// ---------------------------------------------------------------------------
// Package info
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    // Mute output for secret input
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
// Auth flow using Pi SDK
// ---------------------------------------------------------------------------

async function runAuthFlow() {
  const { AuthStorage } = await import("@mariozechner/pi-coding-agent");
  const { getOAuthProviders } = await import("@mariozechner/pi-ai");

  // Use Pi's auth path — shared credentials, auto-refreshed tokens
  const piAuthPath = join(homedir(), ".pi", "agent", "auth.json");
  const agentxlAuthPath = join(homedir(), ".agentxl", "auth.json");
  const authPath = existsSync(piAuthPath) ? piAuthPath : agentxlAuthPath;
  const authStorage = new AuthStorage(authPath);

  // Check if already authenticated
  const existing = authStorage.list();
  if (existing.length > 0) {
    return true;
  }

  console.log(`
   No API credentials found. Let's set you up.

   Choose how to authenticate:
`);

  // Build menu: OAuth providers + API key option
  const oauthProviders = getOAuthProviders();
  const choices = [];

  for (const p of oauthProviders) {
    choices.push({ type: "oauth", id: p.id, name: p.name, provider: p });
  }
  choices.push({ type: "apikey", id: "apikey", name: "Paste an API key (Anthropic, OpenRouter, OpenAI)" });

  for (let i = 0; i < choices.length; i++) {
    console.log(`   ${i + 1}. ${choices[i].name}`);
  }
  console.log("");

  const answer = await prompt("   Enter choice (1-" + choices.length + "): ");
  const idx = parseInt(answer, 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= choices.length) {
    console.error("\n   Invalid choice. Run 'agentxl start' to try again.\n");
    return false;
  }

  const choice = choices[idx];

  if (choice.type === "oauth") {
    // OAuth login flow
    console.log(`\n   Signing in with ${choice.name}...\n`);

    try {
      await authStorage.login(choice.id, {
        onAuth: (info) => {
          console.log(`   🌐 Opening browser for sign-in...`);
          console.log(`      ${info.url}\n`);
          if (info.instructions) {
            console.log(`      ${info.instructions}\n`);
          }
          openUrl(info.url);
        },
        onPrompt: async (p) => {
          const answer = await prompt(`   ${p.message}: `);
          return answer;
        },
        onProgress: (message) => {
          console.log(`   ${message}`);
        },
        onManualCodeInput: async () => {
          const code = await prompt("   Enter the code from the browser: ");
          return code;
        },
      });

      console.log(`\n   ✅ Signed in with ${choice.name}!\n`);
      return true;
    } catch (err) {
      console.error(`\n   ❌ Sign-in failed: ${err.message}\n`);
      return false;
    }
  } else {
    // API key flow
    console.log(`
   Paste your API key below.
   Supported providers: Anthropic (sk-ant-...), OpenRouter (sk-or-...), OpenAI (sk-...)
`);

    const key = await promptSecret("   API key: ");

    if (!key) {
      console.error("\n   No key entered. Run 'agentxl start' to try again.\n");
      return false;
    }

    // Auto-detect provider from key prefix
    let provider;
    if (key.startsWith("sk-ant-")) provider = "anthropic";
    else if (key.startsWith("sk-or-")) provider = "openrouter";
    else if (key.startsWith("sk-")) provider = "openai";
    else {
      // Ask
      const p = await prompt("   Could not detect provider. Enter provider name (anthropic/openrouter/openai): ");
      provider = p.toLowerCase();
    }

    authStorage.set(provider, { type: "api_key", key });
    console.log(`\n   ✅ API key saved for ${provider}.\n`);
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
  agentxl login              Set up API credentials
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

function printBanner(port) {
  const manifestPath = resolve(__dirname, "..", "manifest", "manifest.xml");
  const manifestExists = existsSync(manifestPath);

  console.log(`
   ╔═══════════════════════════════════════╗
   ║          AgentXL v${VERSION.padEnd(20)}║
   ║       AI agent for Microsoft Excel    ║
   ╚═══════════════════════════════════════╝

🚀 AgentXL running at https://localhost:${port}
`);

  if (manifestExists) {
    console.log(`📎 First time? Sideload the add-in in Excel:
   Excel → Insert → My Add-ins → Upload My Add-in
   Select: ${manifestPath}
`);
  }

  console.log(`💡 Or test in browser: https://localhost:${port}/taskpane/
`);
}

async function start() {
  const port = parseInt(getFlag("port") || "3001", 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`Error: Invalid port number. Must be 1-65535.`);
    process.exit(1);
  }

  // Import compiled server modules
  let ensureCerts, startServer, stopServer, setVerbose;
  try {
    const certs = await import("../dist/server/certs.js");
    const server = await import("../dist/server/index.js");
    ensureCerts = certs.ensureCerts;
    startServer = server.startServer;
    stopServer = server.stopServer;
    setVerbose = server.setVerbose;
  } catch (err) {
    console.error("Error: Could not load AgentXL server modules.");
    console.error("   Run 'npm run build' first to compile TypeScript.");
    console.error(`   ${err.message}`);
    process.exit(1);
  }

  // Check auth — run onboarding if needed
  const authed = await runAuthFlow();
  if (!authed) {
    process.exit(1);
  }

  // Enable verbose logging if requested
  if (hasFlag("verbose")) {
    setVerbose(true);
  }

  // Generate/load HTTPS certificates
  const certPair = await ensureCerts();

  // Start the server
  await startServer(port, certPair);

  // Print banner after successful start
  printBanner(port);

  // Graceful shutdown (guard against repeated signals)
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\nAgentXL stopped");
    // Force exit after 2s if server.close() hangs on open connections
    const forceExit = setTimeout(() => process.exit(0), 2000);
    forceExit.unref?.();
    stopServer().then(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function login() {
  const authed = await runAuthFlow();
  if (authed) {
    console.log("   Run 'agentxl start' to launch the server.\n");
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
    console.error(`\n❌ ${err.message || err}`);
    process.exit(1);
  });
} else if (command === "login") {
  login().catch((err) => {
    console.error(`\n❌ ${err.message || err}`);
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
