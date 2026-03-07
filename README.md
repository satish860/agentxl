<p align="center">
  <img src="https://img.shields.io/badge/Excel-AI_Agent-059669?style=for-the-badge&logo=microsoftexcel&logoColor=white" alt="AgentXL" />
</p>

<h1 align="center">AgentXL</h1>

<p align="center">
  <strong>Your spreadsheet just learned to talk.</strong><br>
  An open-source AI agent that lives inside Microsoft Excel.<br>
  Ask questions. Get formulas. Create charts. In plain English.
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/agentxl?color=059669" alt="npm version" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Mac-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node 20+" />
</p>

<!-- TODO: Replace with actual demo GIF showing: type question → agent reads data → writes formula → done -->
<!-- <p align="center"><img src="https://raw.githubusercontent.com/satish860/agentxl/master/docs/demo.gif" alt="AgentXL demo" width="600" /></p> -->

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#what-it-does">What It Does</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#supported-providers">Providers</a> •
  <a href="#troubleshooting">Troubleshooting</a>
</p>

---

Every day, millions of people manually copy, format, and calculate in Excel. AgentXL does it in a sentence.

```bash
npm install -g agentxl
agentxl start
```

No server. No cloud. No account with us. You bring your own AI — Claude, ChatGPT, Copilot, or any API key.

---

## Quick Start

6 steps from install to first message.

### 1. Install

```bash
npm install -g agentxl
```

### 2. Start

```bash
agentxl start
```

The CLI walks you through setup:

```
  ✅ Auth ready
  ✅ HTTPS certificate ready
  ✅ Server running at https://localhost:3001
```

### 3. Choose your AI provider

On first run, the CLI asks how to connect:

| If you have... | Pick | Why |
|---------------|------|-----|
| **Claude Pro/Max** subscription | Option 1 — sign in with browser | Best quality, no extra cost |
| **ChatGPT Plus/Pro** subscription | Option 2 — sign in with browser | If you already pay for ChatGPT |
| **GitHub Copilot** subscription | Option 3 — sign in with browser | If you already have Copilot |
| **An API key** | Option 5 — paste your key | Direct access, pay-per-use |
| **Nothing yet** | [Get a free OpenRouter key](https://openrouter.ai) | Free models, no credit card |

> **Already use Pi?** AgentXL shares credentials from `~/.pi/agent/auth.json`. No extra login needed.

### 4. Verify in browser

Open **https://localhost:3001/taskpane/** in your browser.

You should see the AgentXL chat UI. This confirms the server, HTTPS, and UI all work — before you touch Excel.

### 5. Add to Excel (one-time setup)

You only do this once. After this, just `agentxl start` and click the ribbon button.

1. **Excel** → **File** → **Options** → **Trust Center** → **Trust Center Settings**
2. Click **Trusted Add-in Catalogs**
3. Add the catalog path printed in your terminal
4. Check **Show in Menu** → **OK** → **OK**
5. **Restart Excel**
6. **Insert** → **My Add-ins** → **SHARED FOLDER** tab → **AgentXL** → **Add**

### 6. Send your first message

Click **AgentXL** on the Home ribbon. Try:

> "What do you want to do with this data?"

Or use a quick action: **Summarize this data** · **Create a chart** · **Write a formula**

---

## After Setup

Your daily workflow:

```bash
agentxl start          # Start the server
                        # Open Excel → click AgentXL on the ribbon → chat
```

Switch providers anytime:

```bash
agentxl login
```

---

## What It Does

| You say | Agent does |
|---------|-----------|
| "Summarize column B" | Reads your data, gives you a summary |
| "Add a SUM formula for Sales" | Writes `=SUM(B2:B100)` in the right cell |
| "Create a bar chart of revenue by month" | Inserts a chart from your data |
| "Format headers — bold, dark background" | Applies formatting |
| "Add a new sheet called Q3 Report" | Creates the worksheet |
| "What formula calculates YoY growth?" | Explains and writes the formula |

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

- **Everything runs locally.** No cloud server. No account with us. No data collection.
- **Your data stays on your machine.** Only your chosen AI provider sees the data you ask about.
- **You bring your own AI.** Use your existing subscription or any API key.
- **Single process.** `npm install -g agentxl` → `agentxl start`. That's it.

---

## Supported Providers

### Subscriptions (sign in with your browser — no API key)

| Provider | What You Need | Best for |
|----------|---------------|----------|
| **Anthropic** | Claude Pro or Max ($20/mo) | Best quality |
| **OpenAI Codex** | ChatGPT Plus or Pro ($20/mo) | Already paying for ChatGPT |
| **GitHub Copilot** | Copilot Individual or Business | Already have Copilot |
| **Google** | Cloud Code Assist (Gemini CLI) | Google Cloud users |

### API Keys (paste your key)

| Provider | Models | Best for |
|----------|--------|----------|
| **Anthropic** | Claude Sonnet, Opus | Direct API access |
| **OpenAI** | GPT-4o, GPT-4 Turbo | Direct API access |
| **OpenRouter** | 100+ models | Cheapest — free models available |

> **Cheapest:** [OpenRouter](https://openrouter.ai) has free-tier models. No credit card needed.
>
> **Best quality:** Claude Pro — if you already pay $20/mo, no extra cost.
>
> **Switch anytime:** `agentxl login`

---

## Privacy & Security

- **Local-only server.** Binds to `127.0.0.1` — not accessible from your network.
- **No telemetry.** No analytics. No data collection. No phone-home.
- **No account required.** No sign-up with us. Ever.
- **Your API key stays local.** Stored in `~/.pi/agent/auth.json` on your machine.
- **Open source.** Read every line of code. MIT license.

When you ask the agent about your spreadsheet, the relevant data is sent to your chosen LLM provider as part of the prompt. This is the only external communication.

---

## Troubleshooting

### Taskpane is blank or won't load in Excel

**Most common first-run issue.** Usually means Excel doesn't trust the HTTPS certificate.

1. **Is the server running?** Check for `✅ Server running` in your terminal.

2. **Does it work in the browser?** Open https://localhost:3001/taskpane/
   - ✅ Chat UI loads → server and cert are fine. Issue is Excel setup.
   - ❌ Browser warns about certificate → cert isn't trusted yet.

3. **Certificate not trusted?**
   ```bash
   npx office-addin-dev-certs install
   ```
   Then restart Excel. First run may prompt for admin access — that's normal and one-time only.

4. **Browser works but not Excel?** Excel uses the OS trust store. Make sure the certificate authority is installed system-wide (the command above does this).

### Add-in doesn't appear in Excel

1. Is the server running?
2. Did you add the catalog path in Trust Center → Trusted Add-in Catalogs?
3. Did you check "Show in Menu"?
4. Did you restart Excel?
5. Look in Insert → My Add-ins → **SHARED FOLDER** tab

### Port 3001 is already in use

```bash
agentxl start --port 3002
```

> If you change the port, update `manifest/manifest.xml` to match.

### "No model available"

```bash
agentxl login
```

### Taskpane says "Waiting for credentials…"

Run `agentxl login` in another terminal. The taskpane detects the change automatically.

### "Server disconnected — reconnecting…"

Restart the server: `agentxl start`. The taskpane reconnects automatically.

---

## CLI Reference

```
agentxl start [--port 3001] [--verbose]    Start the server
agentxl login                               Set up or change authentication
agentxl --version                           Print version
agentxl --help                              Show help
```

---

## Requirements

- **Node.js 20+**
- **Microsoft Excel** desktop (Windows or Mac)
- **An AI provider** — subscription or API key

> Excel for the web is not supported (Office add-in limitation).

---

## Development

```bash
git clone https://github.com/satish860/agentxl.git
cd agentxl
npm install
npm run build
npm test               # 64 tests
node bin/agentxl.js start
```

### Project Structure

```
bin/agentxl.js                  CLI entry point
src/server/index.ts             HTTPS server
src/server/certs.ts             Certificate generation
src/agent/session.ts            Pi SDK agent session
src/agent/models.ts             Model selection
taskpane/src/app.tsx            Chat UI orchestrator
taskpane/src/hooks/             useAgentStatus, useChatStream
taskpane/src/components/        UI components
taskpane/src/lib/               API client, types, stream handler
manifest/manifest.xml           Office add-in manifest
tests/                          Acceptance + E2E tests (Playwright)
```

---

## Roadmap

| Module | What | Status |
|--------|------|--------|
| **Module 1** | Chat with AI inside Excel | ✅ Done |
| **Module 2** | Read spreadsheet — agent sees your data | 🔜 Next |
| **Module 3** | Edit spreadsheet — write, format, tables & charts | Planned |
| **Module 4** | Settings, auto-updates, npm publish | Planned |

---

## Contributing

Contributions welcome! MIT license.

```bash
npm test    # 64 tests should pass
```

---

## License

MIT — [DeltaXY](https://deltaxy.ai)

Built with [Pi Coding Agent SDK](https://www.npmjs.com/package/@mariozechner/pi-coding-agent).
