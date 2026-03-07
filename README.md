<p align="center">
  <img src="https://img.shields.io/badge/Excel-AI_Agent-059669?style=for-the-badge&logo=microsoftexcel&logoColor=white" alt="AgentXL" />
</p>

<h1 align="center">AgentXL</h1>

<p align="center">
  <strong>Open-source AI agent that lives inside Microsoft Excel.</strong><br>
  Chat in natural language — read data, write formulas, create charts, format ranges.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#what-it-does">What It Does</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#supported-providers">Providers</a> •
  <a href="#troubleshooting">Troubleshooting</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/agentxl?color=059669" alt="npm version" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Mac-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node 20+" />
</p>

---

## Quick Start

6 steps from install to first message. Takes about 3 minutes.

### 1. Install

```bash
npm install -g agentxl
```

### 2. Start

```bash
agentxl start
```

The CLI walks you through authentication on first run. You'll see:

```
  ✅ Auth ready
  ✅ HTTPS certificate ready (trusted by OS)
  ✅ Server running at https://localhost:3001
```

### 3. Choose your AI provider

On first run, the CLI asks how to connect. Pick what fits you:

| If you have... | Pick |
|---------------|------|
| **Claude Pro/Max** ($20/mo subscription) | Option 1 — sign in with browser, no API key |
| **ChatGPT Plus/Pro** ($20/mo subscription) | Option 2 — sign in with browser, no API key |
| **GitHub Copilot** subscription | Option 3 — sign in with browser |
| **An API key** (Anthropic, OpenAI, OpenRouter) | Option 5 — paste your key |
| **Nothing yet** | Create a free [OpenRouter](https://openrouter.ai) account → get API key → paste it |

> **Already use Pi?** AgentXL shares credentials from `~/.pi/agent/auth.json`. No extra login needed.

### 4. Verify in browser

Open **https://localhost:3001/taskpane/** in your browser. You should see the AgentXL chat interface. This confirms the server, HTTPS, and UI all work before you touch Excel.

### 5. Add to Excel (one-time setup)

This is a one-time setup. After this, just run `agentxl start` and click the ribbon button.

1. **Excel** → **File** → **Options** → **Trust Center** → **Trust Center Settings**
2. Click **Trusted Add-in Catalogs**
3. Add the catalog path printed in your terminal (the folder containing `manifest.xml`)
4. Check **Show in Menu** → **OK** → **OK**
5. **Restart Excel**
6. Go to **Insert** → **My Add-ins** → **SHARED FOLDER** tab
7. Click **AgentXL** → **Add**

The AgentXL button appears on the **Home** ribbon tab.

### 6. Send your first message

Click **AgentXL** on the ribbon. The taskpane opens. Try:

> "What can you help me with in this workbook?"

Or use one of the quick actions: **Summarize data**, **Create chart**, **Write formula**.

---

## After Setup

Once you've done the one-time Excel setup:

```bash
agentxl start     # Start the server
                   # Open Excel → click AgentXL on the ribbon
                   # Chat.
```

Switch providers anytime:

```bash
agentxl login     # Re-authenticate with a different provider
```

---

## What It Does

AgentXL brings an AI assistant directly into Excel's sidebar. You chat in plain English — the agent understands your spreadsheet and takes action.

| You say | Agent does |
|---------|-----------|
| "Summarize column B" | Reads your data, gives you a summary |
| "Add a SUM formula for Sales" | Writes `=SUM(B2:B100)` in the right cell |
| "Create a bar chart of revenue by month" | Inserts a chart from your data |
| "Format the header row — bold, dark background" | Applies formatting via Office.js |
| "Add a new sheet called Q3 Report" | Creates the worksheet |
| "What formula calculates year-over-year growth?" | Explains and writes the formula |

### Excel Tools

| Tool | What It Does |
|------|-------------|
| `excel_read_range` | Read data, values, formulas from any range |
| `excel_write_range` | Write values or formulas to ranges |
| `excel_create_table` | Convert ranges to structured Excel tables |
| `excel_create_chart` | Create charts (column, bar, line, pie, scatter, area, doughnut) |
| `excel_get_workbook_info` | Get workbook metadata — sheets, tables, named ranges |
| `excel_format_range` | Apply formatting — fonts, colors, borders, number formats |
| `excel_insert_rows` | Insert rows into worksheets |
| `excel_delete_rows` | Delete rows from worksheets |
| `excel_add_worksheet` | Add new worksheets |
| `excel_run_formula` | Evaluate formulas without writing to cells |

---

## How It Works

```
agentxl start
  → Local HTTPS server on localhost:3001
  → Serves chat UI at /taskpane
  → Streams AI responses via SSE

Excel loads the taskpane
  → You type a message
  → Agent reasons about your spreadsheet
  → Taskpane executes actions via Office.js
```

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     YOUR MACHINE                         │
│                                                          │
│  ┌─────────────────┐       ┌──────────────────────────┐  │
│  │     Excel        │       │   AgentXL Server         │  │
│  │                  │       │   (localhost:3001)        │  │
│  │  ┌────────────┐  │ HTTPS │                          │  │
│  │  │  Taskpane   │◄─┼──────┤  Chat UI (React)         │  │
│  │  │  (sidebar)  │  │      │  Agent session (Pi SDK)  │  │
│  │  │  Office.js  │──┼──────►  SSE streaming           │  │
│  │  └────────────┘  │       │                          │  │
│  └─────────────────┘       └────────────┬─────────────┘  │
│                                          │                │
└──────────────────────────────────────────┼────────────────┘
                                           │ API call
                                           ▼
                              ┌──────────────────────┐
                              │   Anthropic / OpenAI  │
                              │   OpenRouter / Azure   │
                              │   Google / Copilot     │
                              └──────────────────────┘
```

**Key points:**

- **Everything runs locally.** No cloud server. No account with us. No data collection.
- **Your data stays on your machine.** The only external call is to the LLM provider you choose.
- **You bring your own AI.** Use your existing subscription (Claude Pro, ChatGPT Plus, Copilot) or any API key.
- **Single process.** One npm package. One command. `agentxl start`.

---

## Supported Providers

### Subscriptions (sign in with your browser — no API key)

| Provider | What You Need | Best for |
|----------|---------------|----------|
| **Anthropic** | Claude Pro or Max ($20/mo) | Best quality, recommended |
| **OpenAI Codex** | ChatGPT Plus or Pro ($20/mo) | If you already pay for ChatGPT |
| **GitHub Copilot** | Copilot Individual or Business | If you already have Copilot |
| **Google** | Cloud Code Assist (Gemini CLI) | If you use Google Cloud |

### API Keys (paste your key)

| Provider | Models | Best for |
|----------|--------|----------|
| **Anthropic** | Claude Sonnet, Opus | Direct API access |
| **OpenAI** | GPT-4o, GPT-4 Turbo | Direct API access |
| **OpenRouter** | 100+ models | Cheapest — free models available |

> **Cheapest:** [OpenRouter](https://openrouter.ai) has free-tier models. Create an account, get a key, start chatting.
>
> **Best quality:** Claude Pro subscription — if you already pay $20/mo, there's no extra cost.
>
> **Switch anytime:** Run `agentxl login` to change providers.

---

## Troubleshooting

### Taskpane is blank or won't load in Excel

**This is the most common first-run issue.** It usually means Excel doesn't trust the HTTPS certificate.

**Check these in order:**

1. **Is the server running?** You should see `✅ Server running` in your terminal.

2. **Does it work in the browser?** Open https://localhost:3001/taskpane/ in Chrome or Edge.
   - ✅ If the chat UI loads → server and cert are fine, the issue is Excel setup.
   - ❌ If the browser warns about the certificate → the cert isn't trusted yet.

3. **Certificate not trusted?** AgentXL uses Microsoft's `office-addin-dev-certs` to generate localhost certificates and install them in your OS trust store. If this didn't work:

   **Windows:**
   ```bash
   npx office-addin-dev-certs install
   ```

   **Mac:**
   ```bash
   npx office-addin-dev-certs install
   ```

   Then restart Excel. The first run may prompt for admin/keychain access — this is expected and only happens once.

4. **Certificate works in browser but not in Excel?** Excel uses the OS trust store, not the browser's. Make sure the certificate authority is installed system-wide (the `install` command above does this).

### Add-in doesn't appear in Excel

1. Is the server running? (`agentxl start`)
2. Did you add the catalog path in Trust Center → Trusted Add-in Catalogs?
3. Did you check "Show in Menu"?
4. Did you restart Excel after adding the catalog?
5. Look in Insert → My Add-ins → **SHARED FOLDER** tab (not the store tab)

### "Port 3001 is already in use"

Another instance of AgentXL (or another app) is using that port:

```bash
agentxl start --port 3002
```

> **Note:** If you change the port, you'll need to update `manifest/manifest.xml` to match.

### "No model available"

No authentication configured. Run:

```bash
agentxl login
```

### Taskpane says "Waiting for credentials…"

The server is running but no auth is configured. Run `agentxl login` in another terminal. The taskpane will detect the change automatically — no reload needed.

### Taskpane says "Server disconnected — reconnecting…"

The server stopped while the taskpane was open. Restart it:

```bash
agentxl start
```

The taskpane reconnects automatically when the server comes back.

---

## CLI Reference

```
agentxl start [--port 3001] [--verbose]    Start the server
agentxl login                               Set up or change authentication
agentxl --version                           Print version
agentxl --help                              Show help
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `3001` | Port for the HTTPS server |
| `--verbose` | off | Log all HTTP requests |

---

## Requirements

- **Node.js 20** or later
- **Microsoft Excel** desktop (Windows or Mac)
- **An AI provider** — subscription or API key (see [Supported Providers](#supported-providers))

> Excel for the web is not supported (Office add-in limitation).

---

## Privacy & Security

- **Local-only server.** Binds to `127.0.0.1` — not accessible from your network.
- **No telemetry.** No analytics. No data collection. No phone-home.
- **No account required.** No sign-up with us. Ever.
- **Your API key stays local.** Stored in `~/.pi/agent/auth.json` on your machine.
- **Open source.** Read every line of code. MIT license.

When you ask the agent about your spreadsheet, the relevant data is sent to your chosen LLM provider as part of the prompt. This is the only external communication.

---

## Development

```bash
git clone https://github.com/deltaxy-ai/agentxl.git
cd agentxl
npm install
npm run build          # Compile server + taskpane
npm test               # Run all tests (64 tests)
node bin/agentxl.js start
```

### Project Structure

```
bin/agentxl.js                  CLI entry point
src/server/index.ts             HTTPS server
src/server/certs.ts             Certificate generation (office-addin-dev-certs)
src/agent/session.ts            Pi SDK agent session
src/agent/models.ts             Model selection (OAuth > API key)
taskpane/src/app.tsx            Chat UI orchestrator
taskpane/src/hooks/             useAgentStatus, useChatStream
taskpane/src/components/        UI components
taskpane/src/lib/               API client, types, stream handler
manifest/manifest.xml           Office add-in manifest
tests/                          Acceptance + E2E tests
```

### npm Scripts

| Script | What |
|--------|------|
| `npm run build` | Build server (tsc) + taskpane (Vite) |
| `npm run build:server` | Build server only |
| `npm run build:taskpane` | Build taskpane only |
| `npm run dev:taskpane` | Vite dev server for UI development |
| `npm test` | Run all tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm start` | Start the server |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Agent framework | [Pi Coding Agent SDK](https://www.npmjs.com/package/@mariozechner/pi-coding-agent) |
| LLM | Claude, GPT-4o, or any OpenRouter model |
| Excel integration | Office.js (Microsoft Office Add-in API) |
| Taskpane UI | React 19 + Tailwind CSS v4 |
| Bundler | Vite 6 |
| HTTPS | office-addin-dev-certs (OS-trusted localhost certs) |

---

## Roadmap

| Module | What | Status |
|--------|------|--------|
| **Module 1** | Chat with AI inside Excel | ✅ Working |
| **Module 2** | Read spreadsheet — agent sees your data | 🔜 Next |
| **Module 3** | Edit spreadsheet — write, format, tables & charts | Planned |
| **Module 4** | Settings, auto-updates, npm publish | Planned |

---

## Contributing

Contributions welcome! MIT license.

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run `npm test` — all 64 tests should pass
5. Submit a PR

---

## License

MIT — [DeltaXY](https://deltaxy.ai)

Built with [Pi Coding Agent SDK](https://www.npmjs.com/package/@mariozechner/pi-coding-agent).
