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

<!-- TODO: Replace with actual demo GIF showing: select local folder → ask question → trace answer to source → map into Excel -->
<!-- <p align="center"><img src="https://raw.githubusercontent.com/satish860/agentxl/master/docs/demo.gif" alt="AgentXL demo" width="600" /></p> -->

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#the-method">The Method</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#supported-providers">Providers</a> •
  <a href="#troubleshooting">Troubleshooting</a>
</p>

---

Most spreadsheet work does not start in Excel. It starts in messy PDFs, statements, exports, agreements, and support folders.

AgentXL is being built for that workflow:

- **point to a local folder of source documents**
- **ask a question or give an instruction**
- **let the agent search the evidence and read the right files**
- **map the grounded result into Excel with traceability**

Built for audit and diligence workflows first — useful anywhere document-heavy work ends in spreadsheets.

```bash
npm install -g agentxl
agentxl start
```

No server. No cloud account with us. No classic RAG stack. You bring your own AI model.

---

## Quick Start

## Windows — Quick Start (no coding required)

1. Download the latest `.zip` from [GitHub Releases](https://github.com/satish860/agentxl/releases)
2. Extract to a folder (e.g. `Desktop\AgentXL`)
3. Double-click **AgentXL.vbs**
4. If sign-in is needed, run **AgentXL Login.vbs** first
5. Excel opens with AgentXL in the **Home** ribbon

The Windows release is self-contained — bundled Node.js, no system install required.

Alternatively, install the add-in directly from Excel (see [Install the Excel add-in](#5-add-to-excel) below).

### 1. Install

**Option A — npm**

```bash
npm install -g agentxl
```

This is the simplest cross-platform install path.

**Option B — Windows release (no Node.js needed)**

1. Download the latest `.zip` from [GitHub Releases](https://github.com/satish860/agentxl/releases)
2. Extract to a folder
3. Double-click **AgentXL.vbs**

The release ZIP is self-contained: it bundles its own Node.js runtime, the built app, and production dependencies. No separate Node.js installation required.

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

You should see the AgentXL UI. This confirms the server, HTTPS, and UI all work before you touch Excel.

### 5. Add to Excel

Choose one method:

**Option A — Office Store (simplest)**
1. Open Excel → **Insert** → **Get Add-ins**
2. Search **"AgentXL"** → click **Add**

> The Office Store listing is pending review. Use Option B or C in the meantime.

**Option B — Upload hosted manifest (no Trust Center needed)**
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

**Option D — Windows release auto-setup**
- Double-click **AgentXL.vbs** from the extracted release folder
- It handles certificate trust, add-in registration, and opens Excel automatically

### 6. Start from a document folder

Open Excel, launch **AgentXL**, and the first-run taskpane now guides the user through:

1. **Connect** — sign in with your model provider if needed
2. **Folder** — choose the local folder with supporting documents
3. **Ask** — send a grounded question about that folder

From there, the working flow is:

1. select the workbook you want to populate
2. point AgentXL at a local folder of supporting files
3. ask a grounded question
4. review the answer and source traceability
5. map the output into Excel

Example prompts:

- **"Compare this trial balance folder to the lead sheet and flag mismatches."**
- **"Extract the cash balance from the bank statement folder and map it to the cash workpaper."**
- **"Pull lease terms from these agreements into the lease schedule."**
- **"Show me which workbook cells came from which source files."**

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
- **Not generic spreadsheet chat.** The primary action is not “ask Excel a question.”
- **Not automation theater.** The goal is reviewable outputs with sources, not flashy demos.
- **Not a 36-tool architecture diagram.** One parser, one model, direct file search, and an eval loop beat unnecessary layers.

---

## The Method

AgentXL follows a simple method inspired by real document-processing systems:

1. **Parse the files**
   - PDFs, Excel files, CSVs, statements, agreements, support docs
2. **Search the folder agentically**
   - inspect filenames, structure, metadata, and contents
   - read the right files instead of pre-building a giant stack
3. **Ask the model to extract or answer**
   - one grounded task at a time
4. **Map the result into Excel**
   - workpapers, schedules, exception lists, summaries
5. **Measure whether it was right**
   - evals, failure analysis, correction loops
6. **Improve the system**
   - fix repeated failure patterns, then measure again

### The core loop

**Parse → Search → Ask → Evaluate → Fix → Repeat**

That is the product.

---

## Core Workflow

AgentXL is designed around a folder-first workflow:

1. **Link a local folder** — point AgentXL at a folder of source documents (PDFs, CSVs, Excel files, text)
2. **AgentXL scans the folder** — builds an inventory of supported files, shows counts in the UI
3. **Ask a question or give an instruction** — the agent knows what files are available
4. **The agent searches and reads the relevant files** — using `read`, `grep`, `find`, `ls` tools (visible as live badges in the UI)
5. **Review the grounded result** — answers cite the source file and content
6. **Write the output into Excel** — as a workpaper, schedule, or exception list *(coming next)*

The agent's working directory is set to your linked folder. When you say "list the files," it lists *your documents*, not the AgentXL project.

---

## Current Build Status

| Area | Status |
|------|--------|
| Excel taskpane shell | ✅ Done |
| Local server + auth flow | ✅ Done |
| Model connection | ✅ Done |
| Workbook identity resolution | ✅ Done |
| Folder linking + native picker | ✅ Done |
| Folder scanning + file inventory | ✅ Done |
| Folder-aware agent (cwd, context) | ✅ Done |
| Agentic file search (read, grep, find, ls) | ✅ Done |
| Tool call visibility in UI | ✅ Done |
| Source traceability into Excel | 🔜 Next |
| Excel write tools | Planned |
| Eval-driven extraction improvement loop | Planned |

---

## What It Does

The target behavior looks like this:

| You ask | AgentXL does |
|---------|---------------|
| "Extract the ending cash balance from the bank statement folder and map it to the cash workpaper" | Finds the relevant statement, extracts the value, and writes it into Excel |
| "Compare this trial balance export folder to the lead sheet and flag mismatches" | Reconciles source documents against the workbook and surfaces exceptions |
| "Pull lease start date, end date, and monthly payment from these agreements into the lease schedule" | Reads the agreements and maps structured fields into the schedule |
| "Show me which cells in this sheet came from which source files" | Returns traceability for mapped workbook values |
| "Create a support summary for this balance from the source folder" | Searches the folder, answers from evidence, and structures the output for review |
| "Format this output as a clean review-ready workpaper" | Applies spreadsheet formatting after the data is mapped |

### Underlying Excel Tools

These are implementation tools, not the product story:

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

```text
agentxl start
  → Local HTTPS server on localhost:3001
  → Serves taskpane UI at /taskpane
  → Connects to your chosen model

You point AgentXL at a local folder
  → PDFs, statements, exports, agreements, support files
  → Agent searches the folder
  → Agent reads the relevant documents
  → You ask a question or request a mapping

Excel loads the taskpane
  → Agent returns a grounded result with source traceability
  → Taskpane writes the output into Excel via Office.js
```

### Architecture

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
│  │                 │◄──────►│     localhost:3001        │   │
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
                                 │ Anthropic / OpenAI /    │
                                 │ OpenRouter / Azure /    │
                                 │ Google / Copilot        │
                                 └──────────────────────────┘
```

### Why no classic RAG?

Because most teams do not need a 9-layer retrieval stack to answer grounded questions from a folder of documents.

AgentXL starts simpler:

- local files
- direct parsing
- agentic search
- selective reading
- one model
- explicit evals

If scale later demands heavier infrastructure, add it later. Measure first.

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
> **Switch anytime:** `agentxl login`

---

## Privacy & Security

- **Local-only server.** Binds to `127.0.0.1` — not accessible from your network.
- **Folder-first workflow.** You start from a local document folder on your machine.
- **No telemetry.** No analytics. No data collection. No phone-home.
- **No account required.** No sign-up with us. Ever.
- **Your API key stays local.** Stored in `~/.pi/agent/auth.json` on your machine.
- **Open source.** Read every line of code. MIT license.

When you ask the agent about your documents or workbook, the relevant content is sent to your chosen model provider as part of the prompt. This is the only external communication.

---

## Troubleshooting

### Taskpane is blank or won't load in Excel

**Most common first-run issue.** Usually means Excel doesn't trust the HTTPS certificate.

1. **Is the server running?** Check for `✅ Server running` in your terminal.
2. **Does it work in the browser?** Open https://localhost:3001/taskpane/
   - ✅ UI loads → server and cert are fine. Issue is Excel setup.
   - ❌ Browser warns about certificate → cert isn't trusted yet.
3. **Certificate not trusted?**
   ```bash
   npx office-addin-dev-certs install
   ```
   Then restart Excel.
4. **Browser works but not Excel?** Excel uses the OS trust store. Make sure the certificate authority is installed system-wide.

### Add-in doesn't appear in Excel

1. Is the server running?
2. Did you try the automated Windows onboarding path first?
   - Start Menu: `Launch AgentXL onboarding`
   - zip build: `Launch AgentXL Onboarding.cmd`
3. If automatic setup failed, did you add the catalog path in Trust Center → Trusted Add-in Catalogs?
4. Did you check **Show in Menu**?
5. Did you restart Excel?
6. Look in **Insert → My Add-ins → SHARED FOLDER**

### Port 3001 is already in use

```bash
agentxl start --port 3002
```

> If you change the port, update `manifest/manifest.xml` to match.

### Building the Windows release

```bash
npm run prepare:release:win
```

This creates a self-contained ZIP in `release/windows/dist/` containing:
- Portable Node.js runtime (no system install needed)
- Built AgentXL app + production dependencies
- Manifest for Excel sideloading
- VBScript launchers (double-click to start)

GitHub Actions builds and publishes this automatically on tagged releases.

### "No model available"

```bash
agentxl login
```

### Taskpane says "Waiting for credentials…"

Run `agentxl login` in another terminal. The taskpane detects the change automatically.

### "Server disconnected — reconnecting…"

Restart the server:

```bash
agentxl start
```

---

## CLI Reference

```text
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
npm test               # 101 unit/integration tests
npm run test:e2e       # 12 end-to-end tests (Playwright)
node bin/agentxl.js start
```

### Project Structure

```text
bin/agentxl.js                       CLI entry point
bin/agentxl-folder-picker.exe        Native folder picker (Windows)
src/server/index.ts                  HTTPS server + API endpoints
src/server/certs.ts                  Certificate generation
src/server/workbook-identity.ts      Workbook identity resolution
src/server/workbook-folder-store.ts  Workbook → folder mapping (JSON)
src/server/folder-scanner.ts         Recursive file scanner + inventory
src/server/folder-picker.ts          Native/PowerShell folder picker
src/agent/session.ts                 Pi SDK agent session (cwd-aware)
src/agent/models.ts                  Model selection
taskpane/src/app.tsx                 Taskpane UI orchestrator
taskpane/src/hooks/                  useAgentStatus, useChatStream,
                                     useWorkbookIdentity, useFolderLink
taskpane/src/components/             WelcomeScreen, FolderLinkScreen,
                                     MessageBubble (tool call badges),
                                     ChatInput, ThinkingBlock
taskpane/src/lib/                    API client, stream handler, types
manifest/manifest.xml                Office add-in manifest
tests/                               105 tests (unit + integration + e2e)
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

## Contributing

Contributions welcome. MIT license.

```bash
npm test          # 101 tests should pass
npm run test:e2e  # 12 e2e tests should pass
```

If you contribute, keep the philosophy simple:

- fewer layers
- grounded outputs
- explicit traceability
- evals before infrastructure

---

## License

MIT — [DeltaXY](https://deltaxy.ai)

Built with [Pi Coding Agent SDK](https://www.npmjs.com/package/@mariozechner/pi-coding-agent).
