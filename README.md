<p align="center">
  <img src="https://img.shields.io/badge/Excel-Document_to_Workpaper-059669?style=for-the-badge&logo=microsoftexcel&logoColor=white" alt="AgentXL" />
</p>

<h1 align="center">AgentXL</h1>

<p align="center">
  <strong>Turn source documents into traceable Excel workpapers.</strong><br>
  A local-first agent for document-heavy work that ends in spreadsheets.<br>
  Point AgentXL at a folder, let it search the evidence, then map grounded answers into Excel.
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/agentxl?color=059669" alt="npm version" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Mac-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node 20+" />
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#the-method">The Method</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#supported-providers">Providers</a> •
  <a href="#troubleshooting">Troubleshooting</a>
</p>

---

Most spreadsheet work does not start in Excel. It starts in messy PDFs, statements, exports, agreements, and support folders.

AgentXL is built for that workflow:

- **point to a local folder of source documents**
- **ask a question or give an instruction**
- **let the agent search the evidence and read the right files**
- **map the grounded result into Excel with traceability**

Built for audit and diligence workflows first — useful anywhere document-heavy work ends in spreadsheets.

---

## Quick Start

### 3 commands. That's it.

```bash
npm install -g agentxl
agentxl install
agentxl start
```

| Command | What it does | When |
|---------|-------------|------|
| `npm install -g agentxl` | Installs AgentXL | Once |
| `agentxl install` | Registers the add-in with Excel (certs + manifest + loopback) | Once |
| `agentxl start` | Starts the local server | Every time |

After `agentxl install`, open Excel → **AgentXL** appears on the **Home** ribbon. No Trust Center. No manual sideloading.

> On first run, `agentxl start` will ask you to sign in with your AI provider.

---

### Windows — no coding required

1. Download the latest `.zip` from [GitHub Releases](https://github.com/satish860/agentxl/releases)
2. Extract to a folder (e.g. `Desktop\AgentXL`)
3. Double-click **AgentXL.vbs**
4. If sign-in is needed, run **AgentXL Login.vbs** first
5. Excel opens with AgentXL in the **Home** ribbon

The release ZIP is self-contained — bundled Node.js, no system install required.

---

### Choose your AI provider

On first run, the CLI asks how to connect:

| If you have... | Pick | Why |
|---------------|------|-----|
| **Claude Pro/Max** subscription | Option 1 — sign in with browser | Best quality, no extra cost |
| **ChatGPT Plus/Pro** subscription | Option 2 — sign in with browser | If you already pay for ChatGPT |
| **GitHub Copilot** subscription | Option 3 — sign in with browser | If you already have Copilot |
| **An API key** | Option 5 — paste your key | Direct access, pay-per-use |
| **Nothing yet** | [Get a free OpenRouter key](https://openrouter.ai) | Free models, no credit card |

> **Already use Pi?** AgentXL shares credentials from `~/.pi/agent/auth.json`. No extra login needed.

---

### Start from a document folder

1. Open Excel → click **AgentXL** on the Home ribbon
2. Link a **local folder** containing your source documents
3. Ask a question — the agent searches the folder, reads the files, returns grounded answers

Example prompts:

- **"Extract the relevant values from the source documents and map them into Excel."**
- **"Compare this trial balance folder to the lead sheet and flag mismatches."**
- **"Pull lease terms from these agreements into the lease schedule."**
- **"Show me which workbook cells came from which source files."**

---

## Alternative install methods

### Install the Excel add-in only (if you already have the server)

**Option A — Office Store (coming soon)**
1. Open Excel → **Insert** → **Get Add-ins**
2. Search **"AgentXL"** → click **Add**

> The Office Store listing is pending review. Use the `agentxl install` command or Option B/C below.

**Option B — Upload hosted manifest**
1. Download [`manifest.xml`](https://satish860.github.io/agentxl/manifest/manifest.xml)
2. Open Excel → **Insert** → **Get Add-ins** → **My Add-ins** → **Upload My Add-in**
3. Browse to the downloaded `manifest.xml` → **Upload**

**Option C — Shared folder catalog (persistent, Windows)**
1. **Excel** → **File** → **Options** → **Trust Center** → **Trust Center Settings**
2. Click **Trusted Add-in Catalogs**
3. Add the `manifest` folder path from your release ZIP or the path printed by `agentxl start`
4. Check **Show in Menu** → **OK** → **OK**
5. **Restart Excel**
6. **Insert** → **My Add-ins** → **SHARED FOLDER** → **AgentXL** → **Add**

---

## What AgentXL Is

AgentXL is **not** an Excel chatbot.

It is a **document-to-Excel agent** for evidence-heavy work.

The source of truth lives in documents. The final output lives in Excel. AgentXL sits in between:

- searching through local files
- reading the relevant documents
- extracting grounded facts
- reconciling across sources
- mapping outputs into workpapers
- preserving source traceability

This makes it a fit for:

- audit
- due diligence
- transaction support
- compliance reviews
- finance ops
- any workflow where messy documents become structured spreadsheets

---

## What AgentXL Is Not

- **Not classic RAG.** No need to start with embeddings, vector DBs, and a retrieval stack.
- **Not generic spreadsheet chat.** The primary action is not "ask Excel a question."
- **Not automation theater.** The goal is reviewable outputs with sources, not flashy demos.
- **Not a 36-tool architecture diagram.** One parser, one model, direct file search, and an eval loop beat unnecessary layers.

---

## The Method

AgentXL follows a simple method:

1. **Parse the files** — PDFs, Excel files, CSVs, statements, agreements
2. **Search the folder agentically** — inspect filenames, structure, metadata, and contents
3. **Ask the model to extract or answer** — one grounded task at a time
4. **Map the result into Excel** — workpapers, schedules, exception lists
5. **Measure whether it was right** — evals, failure analysis, correction loops
6. **Improve the system** — fix repeated failure patterns, then measure again

### The core loop

**Parse → Search → Ask → Evaluate → Fix → Repeat**

---

## How It Works

```text
┌─────────────────────────────────────────────────────────────┐
│                        YOUR MACHINE                         │
│                                                             │
│  Local document folder                                      │
│  PDFs / statements / CSVs / agreements / support files      │
│              │                                              │
│              ▼                                              │
│  ┌─────────────────┐        ┌───────────────────────────┐   │
│  │      Excel      │ HTTPS  │     AgentXL Server        │   │
│  │                 │◄──────►│     localhost:3001         │   │
│  │  Taskpane UI    │        │                           │   │
│  │  Office.js      │        │  agentic file search      │   │
│  │                 │        │  selective file reading    │   │
│  └─────────────────┘        │  model prompt + response   │   │
│                              │  SSE event streaming       │   │
│                              └──────────────┬────────────┘   │
│                                             │                │
└─────────────────────────────────────────────┼────────────────┘
                                              │ model API
                                              ▼
                                 ┌──────────────────────────┐
                                 │ Anthropic / OpenAI /     │
                                 │ OpenRouter / Azure /     │
                                 │ Google / Copilot         │
                                 └──────────────────────────┘
```

---

## Supported Providers

### Subscriptions (sign in with your browser)

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
> **Switch anytime:** `agentxl login`

---

## Privacy & Security

- **Local-only server.** Binds to `127.0.0.1` — not accessible from your network.
- **No telemetry.** No analytics. No data collection. No phone-home.
- **No account required.** No sign-up with us. Ever.
- **Your API key stays local.** Stored in `~/.pi/agent/auth.json` on your machine.
- **Open source.** Read every line of code. MIT license.

When you ask the agent about your documents, the relevant content is sent to your chosen model provider as part of the prompt. This is the only external communication.

---

## CLI Reference

```text
agentxl start [--port 3001] [--verbose]    Start the server
agentxl install [--open]                    Register add-in with Excel (one-time)
agentxl login                               Set up or change authentication
agentxl --version                           Print version
agentxl --help                              Show help
```

---

## Troubleshooting

### Taskpane is blank or won't load

1. **Is the server running?** Check for `✅ Server running` in your terminal.
2. **Does it work in the browser?** Open https://localhost:3001/taskpane/
3. **Certificate not trusted?** Run `agentxl install` again — it handles cert trust.

### Add-in doesn't appear in Excel

Run `agentxl install` — it registers the manifest automatically. Then restart Excel.

If that doesn't work, use the manual shared folder catalog method (see [Alternative install methods](#alternative-install-methods)).

### Port 3001 already in use

```bash
agentxl start --port 3002
```

### "No model available"

```bash
agentxl login
```

### Building the Windows release

```bash
npm run prepare:release:win
```

Creates a self-contained ZIP in `release/windows/dist/` — portable Node.js + app + launchers. GitHub Actions builds this automatically on tagged releases.

---

## Requirements

- **Node.js 20+**
- **Microsoft Excel** desktop (Windows or Mac)
- **An AI provider** — subscription or API key

---

## Development

```bash
git clone https://github.com/satish860/agentxl.git
cd agentxl
npm install
npm run build
npm test
node bin/agentxl.js start
```

---

## Roadmap

| Module | What | Status |
|--------|------|--------|
| **Module 1** | Local taskpane shell, auth, and streaming chat | ✅ Done |
| **Module 2** | Folder-first workflow: link folders, scan files, agent reads documents | ✅ Done |
| **Module 3** | Source extraction, traceable citations, and Excel mapping | 🔜 Next |
| **Module 4** | Eval loop, failure analysis, and workflow hardening | Planned |

---

## License

MIT — [DeltaXY](https://deltaxy.ai)

Built with [Pi Coding Agent SDK](https://www.npmjs.com/package/@mariozechner/pi-coding-agent).
