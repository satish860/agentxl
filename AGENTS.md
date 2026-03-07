# AgentXL — Code Agent Context

> Open-source AI agent that lives inside Microsoft Excel. Built by DeltaXY.

---

## What Is This

AgentXL is an open-source Excel add-in that brings an AI agent into the Excel taskpane. Users chat in natural language — the agent reads data, writes formulas, creates charts, formats ranges, and manages worksheets. Everything runs locally on the user's machine.

**Install and run:**
```bash
npm install -g agentxl
agentxl start
```

That's it. No server. No cloud. No account. User provides their own Anthropic API key.

---

## Architecture

```
User runs: agentxl start
  → Local HTTPS server on localhost:3001
  → Serves /taskpane (static HTML/JS/CSS — chat UI)
  → Serves POST /api/agent (Pi SDK → Claude → SSE events)

Excel loads taskpane from https://localhost:3001/taskpane
  → User chats
  → Agent reasons + calls Excel tools
  → Taskpane executes Office.js operations on the spreadsheet
```

### Stack
- **Runtime:** Node.js
- **Agent:** Pi SDK (`@mariozechner/pi-coding-agent`) — session management, tool calling, streaming
- **LLM:** Claude via Anthropic API (or Azure Claude for enterprise)
- **Excel integration:** Office.js (Microsoft Office Add-in API)
- **Taskpane UI:** React (pre-built, served as static files)
- **HTTPS:** OS-trusted localhost cert via office-addin-dev-certs (Office add-ins require HTTPS)

### No Next.js. No Vercel. No CDN. One npm package. One process.

---

## Folder Structure

```
C:\Code\AgentXL\
├── bin/
│   └── agentxl.js              ← CLI entry point ("agentxl start")
├── src/
│   ├── server/
│   │   └── index.ts            ← HTTPS server (~150 lines)
│   │                              - GET /taskpane/* → serves static files
│   │                              - POST /api/agent → Pi SDK session → Claude → SSE
│   ├── agent/
│   │   ├── session.ts          ← Pi SDK: createAgentSession, prompt, subscribe, stream events
│   │   ├── tools/
│   │   │   └── excel-tools.ts  ← 10 Excel tool definitions
│   │   └── provider/
│   │       └── azure-provider.ts  ← Azure Claude support (optional)
│   └── types/
│       └── office.d.ts         ← Office.js type declarations
├── taskpane/
│   ├── index.html              ← Entry point loaded by Excel
│   ├── src/
│   │   ├── app.tsx             ← Chat UI (streaming, thinking blocks, tool cards)
│   │   ├── components/
│   │   │   ├── ThinkingBlock.tsx
│   │   │   └── ToolCard.tsx
│   │   └── lib/
│   │       └── excel-executor.ts  ← Executes Excel operations via Office.js
│   └── styles/
│       └── globals.css
├── manifest/
│   └── manifest.xml            ← Office add-in manifest → localhost:3001
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── LICENSE                     ← MIT
├── README.md
└── AGENTS.md                   ← This file
```

---

## 10 Excel Tools

| Tool | What It Does |
|------|-------------|
| `excel_read_range` | Read data, values, formulas from any range or active selection |
| `excel_write_range` | Write values or formulas to ranges |
| `excel_create_table` | Convert ranges to structured Excel tables |
| `excel_create_chart` | Create charts (column, bar, line, pie, scatter, area, doughnut) |
| `excel_get_workbook_info` | Get workbook metadata (sheets, tables, named ranges, sample data) |
| `excel_format_range` | Apply formatting (fonts, colors, borders, number formats, alignment) |
| `excel_insert_rows` | Insert rows into worksheets |
| `excel_delete_rows` | Delete rows from worksheets |
| `excel_add_worksheet` | Add new worksheets |
| `excel_run_formula` | Evaluate formulas without writing to cells |

---

## How the Pieces Fit

### Server (`src/server/index.ts`)
- HTTPS server on localhost:3001
- Static file serving: `/taskpane/*` → files from `taskpane/` directory
- Agent endpoint: `POST /api/agent` → receives message + Excel context → streams SSE events back
- Single process, single user, no session management complexity

### Agent Session (`src/agent/session.ts`)
- Uses Pi SDK's `createAgentSession` with Excel tools as custom tools
- On `POST /api/agent`:
  1. Receives `{ message, context }` from taskpane
  2. Calls `session.prompt(message)`
  3. Subscribes to events (`message_update`, `tool_execution_start`, `tool_execution_end`, `agent_end`)
  4. Streams events as SSE (`data: ${JSON.stringify(event)}\n\n`)
- API key: checks `ANTHROPIC_API_KEY` env var or Pi SDK's `AuthStorage`

### Excel Tools (`src/agent/tools/excel-tools.ts`)
- Each tool returns an instruction object: `{ operation, params }`
- Tools don't execute Excel operations directly — they describe WHAT to do
- The taskpane client receives the instruction and executes it via Office.js
- This split exists because Office.js runs in the browser (taskpane), not on the server

### Taskpane UI (`taskpane/`)
- React chat interface loaded by Excel in an embedded WebView
- Sends user messages to `localhost:3001/api/agent`
- Reads SSE stream, renders: thinking blocks, tool execution cards, text responses
- On `tool_execution_end` events with Excel instructions: calls `excel-executor.ts`
- `excel-executor.ts` uses Office.js API to actually modify the spreadsheet

### Manifest (`manifest/manifest.xml`)
- Tells Excel where to load the taskpane from: `https://localhost:3001/taskpane`
- Adds "AgentXL" button to the Home ribbon tab
- User registers via Trusted Add-in Catalog (one-time setup)

---

## CLI (`bin/agentxl.js`)

```
agentxl start [--port 3001]
  1. Check for API key (ANTHROPIC_API_KEY env var or Pi SDK auth)
     → If missing: prompt user to enter it, save via Pi SDK AuthStorage
  2. Generate/check HTTPS cert for localhost (office-addin-dev-certs)
  3. Start HTTPS server on specified port
  4. Print:
     "🚀 AgentXL running at https://localhost:3001"
     "📎 First time? Sideload the add-in in Excel:"
     "   Add to Excel via Trusted Add-in Catalog (one-time)"
     "   Select: [path to manifest.xml]"
```

---

## Reference Implementation

Deepak built a working prototype: https://github.com/deepak-chowdry/agent-excel

**What to port (reuse the logic, rewrite for new architecture):**
- `agent-pi/tools/excel-tools.ts` → `src/agent/tools/excel-tools.ts` (10 tool definitions — port directly)
- `agent-pi/provider/azure-provider.ts` → `src/agent/provider/azure-provider.ts` (port directly)
- `lib/excel-executor.ts` → `taskpane/src/lib/excel-executor.ts` (port directly)
- `app/taskpane/page.tsx` → `taskpane/src/app.tsx` (port chat UI, remove Next.js dependencies)
- `components/blocks/ThinkingBlock.tsx` → `taskpane/src/components/ThinkingBlock.tsx` (port directly)
- `components/blocks/ToolCard.tsx` → `taskpane/src/components/ToolCard.tsx` (port directly)
- `agent-pi/init.ts` → `src/agent/session.ts` (extract Pi SDK session logic, remove Next.js wrappers)

**What to NOT port:**
- `app/api/agent/route.ts` — Next.js API route. Replace with plain HTTP handler in `src/server/index.ts`
- `app/page.tsx` — Next.js landing page. Not needed.
- `next.config.ts`, `postcss.config.mjs`, `components.json` — Next.js config. Not needed.
- `lib/use-agent.ts` — React hook for Next.js. Not needed (taskpane handles streaming directly).

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| No Next.js | Unnecessary complexity. A ~150 line HTTPS server does everything needed. |
| Everything local | No server dependency. No BYOK panel. No multi-user sessions. Pi SDK handles auth. |
| Static taskpane | Pre-built React bundle served as static files. No SSR needed for a chat UI. |
| Tools describe, client executes | Excel tools return instructions. Taskpane executes via Office.js. Because Office.js runs in the browser, not Node.js. |
| Single session | One user, one machine, one Pi SDK agent session. No session management needed. |
| MIT license | Maximize adoption. Code isn't the moat — domain expertise is. |
| npm package | `npm install -g agentxl` → instant distribution. npm downloads = public social proof. |

---

## Build Order

| # | What | Depends On | Effort |
|---|------|-----------|--------|
| 1 | `src/agent/tools/excel-tools.ts` — port 10 tools from reference | Nothing | 1 hour |
| 2 | `src/agent/session.ts` — Pi SDK session init + prompt + event streaming | #1 | 2 hours |
| 3 | `src/server/index.ts` — HTTPS server with static serving + SSE endpoint | #2 | 2-3 hours |
| 4 | `bin/agentxl.js` — CLI entry point with API key check | #3 | 1 hour |
| 5 | Port taskpane UI (app.tsx, components, excel-executor, styles) | Nothing (parallel) | 2-3 hours |
| 6 | `manifest/manifest.xml` — update URLs to localhost:3001 | #3 | 15 min |
| 7 | HTTPS cert generation for localhost | #3 | 1 hour |
| 8 | `package.json` with bin field + npm publish config | #4 | 30 min |
| 9 | Test end-to-end: install globally → start → sideload → chat → Excel operations | All | 1-2 hours |
| 10 | README.md | #9 (needs working demo for GIF) | 3-4 hours |

**Total: ~14-17 hours (2 focused days)**

---

## Business Context

Full business strategy, competitive landscape, launch plan, and revenue model: `C:\Source\Business\projects\AgentXL\AGENTS.md`

**Summary:** AgentXL is DeltaXY's open-source distribution + brand engine. Free core drives GitHub stars, npm downloads, blog traffic. Commercial layer (AgentXL for Audit) adds SPV audit tools + document extraction for €150-200/user/month. DeltaXY owns all IP. Zero GT overlap.

---

*Created: March 6, 2026*
