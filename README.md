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
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/agentxl?color=059669" alt="npm version" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Mac-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node 20+" />
</p>

---

## Quick Start

```bash
npm install -g agentxl
agentxl start
```

That's it. AgentXL starts a local server, walks you through authentication, and you're ready to chat with AI inside Excel.

### First-Time Setup (2 minutes)

**1. Install & start**

```bash
npm install -g agentxl
agentxl start
```

On first run, you'll be asked to authenticate:

```
Choose how to authenticate:

   1. Anthropic (Claude Pro/Max)
   2. GitHub Copilot
   3. Google Cloud Code Assist (Gemini CLI)
   4. Antigravity (Gemini 3, Claude, GPT-OSS)
   5. ChatGPT Plus/Pro (Codex Subscription)
   6. Paste an API key (Anthropic, OpenRouter, OpenAI)
```

> **Already have a Claude Pro, ChatGPT Plus, or GitHub Copilot subscription?** Pick options 1-5 — sign in with your browser, no API key needed.
>
> **Have an API key?** Pick option 6 and paste it.
>
> **No account at all?** Create a free [OpenRouter](https://openrouter.ai) account, grab an API key, and paste it. Free models available instantly.

**2. Trust the certificate (first time only)**

AgentXL generates a self-signed HTTPS certificate for localhost. Your browser or Excel may warn you — this is expected. The certificate is only for `localhost` and never leaves your machine.

On Windows, AgentXL can add it to your trusted certificates automatically. On Mac, you may need to trust it manually in Keychain Access.

**3. Add to Excel**

- Open **Excel** → **File** → **Options** → **Trust Center** → **Trust Center Settings**
- Click **Trusted Add-in Catalogs**
- Add the catalog path shown in the terminal output
- Check **Show in Menu** → **OK** → **OK**
- Restart Excel
- Go to **Insert** → **My Add-ins** → **SHARED FOLDER** tab
- Click **AgentXL** → **Add**
- Click the **AgentXL** button on the **Home** ribbon

> You only need to do this once. After setup, just run `agentxl start` and open Excel.

**4. Chat**

Type a message in the taskpane. The AI reads your spreadsheet context and responds.

---

## What It Does

AgentXL brings an AI assistant directly into Excel's sidebar. You chat in plain English — the agent understands your spreadsheet and takes action.

**Examples:**

| You say | Agent does |
|---------|-----------|
| "Summarize column B" | Reads your data, gives you a summary |
| "Add a SUM formula for the Sales column" | Writes `=SUM(B2:B100)` in the right cell |
| "Create a bar chart of revenue by month" | Inserts a chart from your data |
| "Format the header row — bold, dark background" | Applies formatting via Office.js |
| "Add a new sheet called Q3 Report" | Creates the worksheet |
| "What formula would calculate year-over-year growth?" | Explains and writes the formula |

### 10 Excel Tools

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

### Subscriptions (OAuth — sign in with your browser)

| Provider | What You Need |
|----------|---------------|
| **Anthropic** | Claude Pro or Max subscription |
| **OpenAI Codex** | ChatGPT Plus or Pro subscription |
| **GitHub Copilot** | Copilot Individual or Business |
| **Google** | Cloud Code Assist (Gemini CLI) |

### API Keys (paste your key)

| Provider | Models |
|----------|--------|
| **Anthropic** | Claude Sonnet, Claude Opus |
| **OpenAI** | GPT-4o, GPT-4 Turbo |
| **OpenRouter** | 100+ models — Claude, GPT, Gemini, Llama, Mistral |

> **Cheapest option:** [OpenRouter](https://openrouter.ai) has free-tier models. Create an account, get a key, start chatting.
>
> **Best option:** If you already pay for Claude Pro ($20/mo) or ChatGPT Plus ($20/mo), use that — no extra cost.

### Switch providers anytime

```bash
agentxl login
```

---

## CLI Reference

```
agentxl start [--port 3001] [--verbose]    Start the server
agentxl login                               Set up or change authentication
agentxl --version                           Print version
agentxl --help                              Show help
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `3001` | Port for the HTTPS server |
| `--verbose` | off | Log all HTTP requests |

---

## Requirements

- **Node.js 20** or later
- **Microsoft Excel** desktop (Windows or Mac)
- **An AI provider** — subscription or API key (see [Supported Providers](#supported-providers))

> **Note:** AgentXL works with Excel desktop only. Excel for the web is not supported (Office add-in limitation).

---

## Privacy & Security

- **Local-only server.** Binds to `127.0.0.1` — not accessible from your network.
- **No telemetry.** No analytics. No data collection. No phone-home.
- **No account required.** No sign-up with us. Ever.
- **Your API key stays local.** Stored in `~/.pi/agent/auth.json` on your machine.
- **Data in prompts.** When you ask the agent about your spreadsheet, the relevant data is sent to your chosen LLM provider as part of the prompt. This is the only external communication.
- **Open source.** Read every line of code. MIT license.

---

## Development

```bash
git clone https://github.com/deltaxy-ai/agentxl.git
cd agentxl
npm install
npm run build          # Compile server + taskpane
npm test               # Run all tests (57 tests)
node bin/agentxl.js start
```

### Project Structure

```
bin/agentxl.js              CLI entry point
src/server/index.ts         HTTPS server (~200 lines)
src/server/certs.ts         Self-signed certificate generation
src/agent/session.ts        Pi SDK agent session management
src/agent/models.ts         Model selection (OAuth > API key)
src/agent/tools/             Excel tool definitions
taskpane/src/app.tsx        Chat UI (React)
taskpane/src/main.tsx       React entry point
manifest/manifest.xml       Office add-in manifest
tests/                      Acceptance tests
```

### npm Scripts

| Script | What |
|--------|------|
| `npm run build` | Build server (tsc) + taskpane (Vite) |
| `npm run build:server` | Build server only |
| `npm run build:taskpane` | Build taskpane only |
| `npm run dev:taskpane` | Vite dev server for UI development |
| `npm test` | Run all tests |
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
| HTTPS | Self-signed localhost certificates |

---

## Roadmap

| Module | What | Status |
|--------|------|--------|
| **Module 1** | Chat with AI inside Excel | ✅ Working |
| **Module 2** | Read spreadsheet — agent sees your data | 🔜 Next |
| **Module 3** | Edit spreadsheet — write, format, create tables & charts | Planned |
| **Module 4** | Settings, auto-updates, npm publish, installer | Planned |

---

## Contributing

Contributions welcome! This is an open-source project under MIT license.

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run `npm test` — all 57 tests should pass
5. Submit a PR

---

## Troubleshooting

### "Content blocked — not signed by a valid security certificate"

Excel doesn't trust the self-signed certificate. Fix:

**Windows:**
```bash
certutil -addstore -user "Root" "%USERPROFILE%\.agentxl\certs\localhost.crt"
```

**Mac:**
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.agentxl/certs/localhost.crt
```

Then restart Excel.

### "Port 3001 is already in use"

Another instance is running, or another app uses that port:

```bash
agentxl start --port 3002
```

Update the port in `manifest/manifest.xml` too if you change it.

### Add-in doesn't appear in Excel

1. Make sure the server is running (`agentxl start`)
2. Check Trust Center → Trusted Add-in Catalogs — is the catalog path added?
3. Is "Show in Menu" checked?
4. Restart Excel after adding the catalog

### "No model available"

No authentication configured. Run:

```bash
agentxl login
```

---

## License

MIT — [DeltaXY](https://deltaxy.ai)

Built with [Pi Coding Agent SDK](https://www.npmjs.com/package/@mariozechner/pi-coding-agent).
