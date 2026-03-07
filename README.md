# AgentXL

> Open-source AI agent that lives inside Microsoft Excel. Built by [DeltaXY](https://deltaxy.ai).

```
npm install -g agentxl
agentxl start
```

Chat in natural language — the agent reads data, writes formulas, creates charts, formats ranges, and manages worksheets. Everything runs locally on your machine.

---

## 🚧 Status: In Development

### Module 1: "Chat with Claude in Excel" — In Progress

Building the core pipeline: CLI → HTTPS server → Excel taskpane → Pi Coding Agent → Claude → streaming chat.

| # | Task | Status |
|---|------|--------|
| 1 | Project scaffold (package.json, tsconfig, dependencies, folder structure) | ✅ Done |
| 2 | HTTPS certificate generation for localhost | ⬜ Next |
| 3 | HTTPS server (static file serving + API endpoints) | ⬜ |
| 4 | CLI entry point (`agentxl start`) | ⬜ |
| 5 | Pi Coding Agent session + SSE streaming | ⬜ |
| 6 | Auth configuration endpoints (API key + OAuth) | ⬜ |
| 7 | Taskpane build setup (React + Vite + Tailwind) | ⬜ |
| 8 | Onboarding UI (welcome + API key setup) | ⬜ |
| 9 | Chat UI (streaming responses, markdown) | ⬜ |
| 10 | Office add-in manifest for localhost | ⬜ |
| 11 | Build pipeline + end-to-end test | ⬜ |

### Upcoming Modules

| Module | What | Status |
|--------|------|--------|
| **Module 1** | Chat with AI inside Excel (no Excel tools) | 🔨 In progress |
| **Module 2** | Read spreadsheet — agent can see your data | ⬜ |
| **Module 3** | Edit spreadsheet — agent writes, formats, creates tables | ⬜ |
| **Module 4** | Full agent — charts, worksheets, auto-updates, ship it | ⬜ |

---

## How It Works

```
User runs: agentxl start
  → Local HTTPS server on localhost:3001
  → Serves /taskpane (chat UI)
  → Serves POST /api/agent (Pi Coding Agent → Claude → SSE)

Excel loads taskpane from https://localhost:3001/taskpane
  → User chats in natural language
  → Agent reasons + calls Excel tools
  → Taskpane executes operations via Office.js
```

### Architecture

```
┌──────────────────────────────────────────────────────┐
│                   USER'S MACHINE                     │
│                                                      │
│  ┌──────────────┐     ┌─────────────────────────┐    │
│  │   Excel      │     │  AgentXL Server          │    │
│  │              │     │  (localhost:3001)         │    │
│  │  ┌────────┐  │     │                          │    │
│  │  │Taskpane│◄─┼─────┤► Static files (chat UI)  │    │
│  │  │(WebView│  │HTTPS│  Pi Coding Agent session  │    │
│  │  │       )│◄─┼─────┤► SSE streaming            │    │
│  │  │Office.js  │     │                          │    │
│  │  └────────┘  │     └──────────┬───────────────┘    │
│  └──────────────┘                │                    │
│                                  │ HTTPS              │
└──────────────────────────────────┼────────────────────┘
                                   ▼
                        ┌─────────────────────┐
                        │  LLM API            │
                        │  Anthropic / OpenAI  │
                        │  OpenRouter / Azure  │
                        └─────────────────────┘
```

### Key Design Decisions

| Decision | Why |
|----------|-----|
| Local-first | Your data never leaves your machine (except in LLM prompts) |
| Pi Coding Agent | Multi-provider model switching, auth, sessions, tool orchestration |
| No Next.js | ~150 line HTTPS server does everything needed |
| Tools describe, client executes | Excel tools return instructions; taskpane runs them via Office.js |

---

## 10 Excel Tools (Module 2-4)

| Tool | What It Does |
|------|-------------|
| `excel_read_range` | Read data, values, formulas from any range |
| `excel_write_range` | Write values or formulas to ranges |
| `excel_create_table` | Convert ranges to structured tables |
| `excel_create_chart` | Create charts (column, bar, line, pie, scatter, area, doughnut) |
| `excel_get_workbook_info` | Get workbook metadata (sheets, tables, named ranges) |
| `excel_format_range` | Apply formatting (fonts, colors, borders, number formats) |
| `excel_insert_rows` | Insert rows into worksheets |
| `excel_delete_rows` | Delete rows from worksheets |
| `excel_add_worksheet` | Add new worksheets |
| `excel_run_formula` | Evaluate formulas without writing to cells |

---

## Stack

- **Runtime:** Node.js
- **Agent:** [Pi Coding Agent](https://www.npmjs.com/package/@mariozechner/pi-coding-agent) — session management, tool calling, multi-provider model switching, streaming
- **LLM:** Claude, GPT-4o, or any model via OpenRouter / Azure
- **Excel:** Office.js (Microsoft Office Add-in API)
- **Taskpane UI:** React + Tailwind CSS (pre-built, served as static files)

---

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/USER_FLOW.md](docs/USER_FLOW.md) | Complete user experience — install to daily use |
| [docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md) | Full technical specification |
| [docs/TASKS.md](docs/TASKS.md) | Module 1 task breakdown |

---

## License

MIT — Built by [DeltaXY](https://deltaxy.ai)
