# AgentXL — Technical Architecture

> Complete technical specification for the AgentXL system.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Architecture](#2-component-architecture)
3. [Server](#3-server)
4. [Agent Layer](#4-agent-layer)
5. [Taskpane (Client)](#5-taskpane-client)
6. [Office Add-in Integration](#6-office-add-in-integration)
7. [Authentication & API Key Management](#7-authentication--api-key-management)
8. [Auto-Update System](#8-auto-update-system)
9. [Data Flow](#9-data-flow)
10. [Distribution & Packaging](#10-distribution--packaging)
11. [Module Breakdown](#11-module-breakdown)
12. [File Structure](#12-file-structure)
13. [Technology Stack](#13-technology-stack)
14. [Security Considerations](#14-security-considerations)
15. [Reference Implementation](#15-reference-implementation)

---

## 1. System Overview

AgentXL is a local-first AI agent that runs inside Microsoft Excel as a taskpane add-in. The system has three runtime components:

```
┌──────────────────────────────────────────────────────────┐
│                     USER'S MACHINE                       │
│                                                          │
│  ┌────────────────┐     ┌───────────────────────────┐    │
│  │   Excel         │     │  AgentXL Server            │    │
│  │                 │     │  (Node.js, localhost:3001) │    │
│  │  ┌───────────┐ │     │                           │    │
│  │  │ Taskpane  │◄├─────┤► GET  /taskpane/*         │    │
│  │  │ (WebView) │ │HTTPS│  POST /api/agent          │    │
│  │  │ Office.js │ │ SSE │  GET  /api/config/status  │    │
│  │  │    ↕      │ │     │  GET  /api/version        │    │
│  │  └───────────┘ │     │                           │    │
│  │       ↕        │     │  ┌─────────────────────┐  │    │
│  │  [Spreadsheet] │     │  │ Pi SDK              │  │    │
│  │                 │     │  │  → Agent Session    │  │    │
│  └────────────────┘     │  │  → Tool Execution   │  │    │
│                          │  │  → Auth Storage     │  │    │
│                          │  └──────────┬──────────┘  │    │
│                          └─────────────┼─────────────┘    │
│                                        │                  │
└────────────────────────────────────────┼──────────────────┘
                                         │ HTTPS
                                         ▼
                              ┌─────────────────────┐
                              │  LLM API Provider    │
                              │  (Anthropic, OpenAI, │
                              │   OpenRouter, Azure) │
                              └─────────────────────┘
```

### Key Principles

| Principle | Implementation |
|-----------|---------------|
| **Local-first** | Server runs on user's machine. No cloud hosting. |
| **Data stays private** | Spreadsheet data never leaves the machine except in LLM prompts. |
| **Zero configuration** | Auto-start on boot, auto-update, default model selection. |
| **Non-technical users** | No terminal, no commands, no model picking. |
| **Tool describes, client executes** | Server tools return instructions. Taskpane executes via Office.js. |

---

## 2. Component Architecture

### 2a. Three Runtime Components

| Component | Runtime | Role |
|-----------|---------|------|
| **AgentXL Server** | Node.js process (background) | HTTPS server, Pi SDK agent, API endpoint |
| **Taskpane UI** | WebView inside Excel | Chat interface, Excel operation execution |
| **Office Add-in Manifest** | XML file registered with Excel | Tells Excel where to find the taskpane |

### 2b. Component Boundaries

```
┌─ SERVER (Node.js) ───────────────────────────────────┐
│                                                       │
│  Responsibilities:                                    │
│  • Serve static files (taskpane HTML/JS/CSS)          │
│  • Manage Pi SDK agent session                        │
│  • Stream LLM responses via SSE                       │
│  • Check for and apply updates                        │
│  • HTTPS with OS-trusted localhost certificate        │
│                                                       │
│  CANNOT do:                                           │
│  • Access Excel spreadsheet (no Office.js in Node)    │
│  • Run in the browser                                 │
│                                                       │
└───────────────────────────────────────────────────────┘

┌─ TASKPANE (Browser/WebView) ─────────────────────────┐
│                                                       │
│  Responsibilities:                                    │
│  • Render chat UI (messages, thinking, tool cards)    │
│  • Send user messages to server                       │
│  • Read SSE event stream from server                  │
│  • Execute Excel operations via Office.js             │
│  • Auto-reconnect on server restart                   │
│                                                       │
│  CANNOT do:                                           │
│  • Call LLM APIs directly (CORS, no Pi SDK)           │
│  • Access file system                                 │
│  • Run Node.js code                                   │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## 3. Server

### 3a. HTTPS Server (`src/server/index.ts`)

~150 lines. Plain Node.js `https.createServer()`. No Express, no framework.

**Routes:**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/taskpane/*` | Serve static files (HTML, JS, CSS, assets) |
| `POST` | `/api/agent` | Send message to agent, stream SSE response |
| `GET` | `/api/config/status` | Check authentication status |
| `GET` | `/api/version` | Return current version |

**Static File Serving:**

```
GET /taskpane           → taskpane/index.html
GET /taskpane/app.js    → taskpane/dist/app.js
GET /taskpane/style.css → taskpane/dist/style.css
```

MIME types handled: `.html`, `.js`, `.css`, `.png`, `.svg`, `.json`

**HTTPS Certificate:**

Office Add-ins require HTTPS, even for localhost. Uses Microsoft's `office-addin-dev-certs`:
- Generates localhost certificate AND installs CA into OS trust store
- Certs stored at `~/.office-addin-dev-certs/` (Microsoft's default location)
- Chrome, Edge, and Excel all trust localhost automatically
- First run may prompt for admin/keychain access (one-time)
- Reuses existing certs on subsequent runs

### 3b. Agent Endpoint (`POST /api/agent`)

**Request:**
```json
{
  "message": "Create a chart from the sales data",
  "context": {
    "activeSheet": "Sheet1",
    "selectedRange": "A1:D10",
    "workbookInfo": { "sheets": ["Sheet1", "Sheet2"] }
  }
}
```

**Response:** Server-Sent Events (SSE) stream

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type":"agent_start"}

data: {"type":"message_update","message":{"content":[{"type":"thinking","thinking":"Let me look at..."}]}}

data: {"type":"tool_execution_start","toolCallId":"t1","toolName":"excel_read_range"}

data: {"type":"tool_execution_end","toolCallId":"t1","toolName":"excel_read_range","result":{"content":[...],"details":{"operation":"read_range","params":{"range":"A1:D10"}}}}

data: {"type":"excel_instruction","toolName":"excel_read_range","operation":"read_range","params":{"range":"A1:D10"}}

data: {"type":"message_update","message":{"content":[{"type":"text","text":"Here's what I found..."}]}}

data: {"type":"agent_end"}
```

**SSE Event Types:**

| Event Type | When | Contains |
|------------|------|----------|
| `agent_start` | Agent begins processing | - |
| `message_update` | Streaming text/thinking | Full message content array |
| `tool_execution_start` | Tool call begins | toolCallId, toolName |
| `tool_execution_end` | Tool call completes | toolCallId, result, details |
| `excel_instruction` | Excel tool completed | operation, params (for client execution) |
| `agent_end` | Agent finished | - |
| `error` | Error occurred | error message |

### 3c. Status Endpoint (`GET /api/config/status`)

```json
// Response
{
  "authenticated": true,
  "provider": "anthropic",
  "version": "1.2.0"
}
```

### 3d. Version Endpoint (`GET /api/version`)

```json
{
  "version": "1.2.0",
  "buildDate": "2026-03-07"
}
```

---

## 4. Agent Layer

### 4a. Session Management (`src/agent/session.ts`)

Uses Pi SDK's `createAgentSession` with Excel-specific configuration:

```typescript
// Session initialization
const { session } = await createAgentSession({
  model,                           // Auto-selected based on provider
  thinkingLevel: "medium",
  authStorage,                     // Pi SDK AuthStorage
  modelRegistry,                   // Pi SDK ModelRegistry
  customTools: excelTools,         // 10 Excel tool definitions
  sessionManager: SessionManager.inMemory(),
  settingsManager: SettingsManager.inMemory({
    compaction: { enabled: false },
  }),
});
```

**Model Auto-Selection:**

| Provider | Default Model |
|----------|--------------|
| Anthropic | `claude-sonnet-4-20250514` |
| OpenRouter | `anthropic/claude-sonnet-4` |
| OpenAI | `gpt-4o` |
| Azure | Configured deployment name |
| Claude Pro/Max (OAuth) | `claude-sonnet-4-20250514` |

User never chooses a model. We pick the best available.

**Session Lifecycle:**

```
Server starts
  → Wait for auth (API key or OAuth)
  → Create Pi SDK agent session
  → Session persists across multiple chat messages
  → Session resets on server restart or explicit reset
```

### 4b. Excel Tools (`src/agent/tools/excel-tools.ts`)

10 tools defined using Pi SDK's `ToolDefinition` interface with TypeBox schemas.

**Critical pattern:** Tools do NOT execute Excel operations. They return instruction objects.

```typescript
// Tool execute function returns instructions, not results
async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
  return {
    content: [{ type: "text", text: "Reading range A1:C10" }],
    details: {
      operation: "read_range",           // What to do
      params: { range: "A1:C10" },       // How to do it
    },
  };
}
```

The `details` object is sent to the taskpane via SSE as an `excel_instruction` event.

**Tool Definitions:**

| Tool | Operation | Parameters |
|------|-----------|-----------|
| `excel_read_range` | `read_range` | range?, includeFormulas? |
| `excel_write_range` | `write_range` | range, values[][], formulas[][]? |
| `excel_create_table` | `create_table` | range, tableName, hasHeaders? |
| `excel_create_chart` | `create_chart` | dataRange, chartType, title?, position? |
| `excel_get_workbook_info` | `get_workbook_info` | includeData? |
| `excel_format_range` | `format_range` | range, format{} |
| `excel_insert_rows` | `insert_rows` | startRow, count?, sheet? |
| `excel_delete_rows` | `delete_rows` | startRow, count?, sheet? |
| `excel_add_worksheet` | `add_worksheet` | name, activate? |
| `excel_run_formula` | `run_formula` | formula |

**Chart Types Supported:**
`ColumnClustered`, `ColumnStacked`, `BarClustered`, `Line`, `Pie`, `XYScatter`, `Area`, `Doughnut`

**Format Options:**
`bold`, `italic`, `fontSize`, `fontColor`, `backgroundColor`, `numberFormat`, `horizontalAlignment`, `verticalAlignment`

### 4c. Azure Provider (`src/agent/provider/azure-provider.ts`)

Optional. For enterprise Azure Claude deployments.

```
Environment Variables:
  ANTHROPIC_ENDPOINT     → Azure endpoint URL
  ANTHROPIC_API_KEY      → Azure API key
  ANTHROPIC_DEPLOYMENT   → Model deployment name (default: claude-opus-4-5)
```

Registers as a custom provider in Pi SDK's ModelRegistry. Takes priority over direct Anthropic when configured.

---

## 5. Taskpane (Client)

### 5a. Build & Serving

The taskpane is a **React application pre-built into static files**.

```
Development:
  taskpane/src/**  →  (Vite/esbuild build)  →  taskpane/dist/**

Production:
  Server serves taskpane/dist/* as static files at /taskpane/*
```

**Entry point:** `taskpane/index.html`
- Loads Office.js from Microsoft CDN
- Loads bundled React app
- Initializes Office.js, then renders the chat UI

### 5b. Application Structure (`taskpane/src/`)

```
taskpane/src/
├── app.tsx                    ← Main chat UI component
├── components/
│   ├── ThinkingBlock.tsx      ← Collapsible thinking/reasoning display
│   ├── ToolCard.tsx           ← Tool execution card (running/completed/error)
│   ├── Onboarding.tsx         ← Welcome + auth setup screens
│   └── Settings.tsx           ← Settings panel
├── lib/
│   └── excel-executor.ts      ← Office.js operations executor
└── styles/
    └── globals.css             ← Styles (Tailwind CSS)
```

### 5c. Chat UI (`taskpane/src/app.tsx`)

**State:**
```typescript
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  blocks?: ContentBlock[];       // Thinking, tool calls, text
}

interface ContentBlock {
  type: "text" | "thinking" | "tool";
  content?: string;              // For text/thinking
  id?: string;                   // For tool (toolCallId)
  name?: string;                 // For tool (tool name)
  args?: string;                 // For tool (JSON args)
  result?: string;               // For tool (result text)
  status?: "running" | "completed" | "error";
}
```

**Message flow:**
```
User types message → Enter
  → Add user message to state
  → Gather Excel context (active sheet, selected range) via Office.js
  → POST /api/agent { message, context }
  → Read SSE stream
  → On message_update: update streaming blocks (thinking, text)
  → On tool_execution_start: add tool card (status: running)
  → On tool_execution_end: update tool card (status: completed)
  → On excel_instruction: execute via excel-executor.ts
  → On agent_end: finalize assistant message, reset streaming state
```

**Auto-reconnect:**
```
SSE connection lost
  → Show "Reconnecting..." banner
  → Retry every 2 seconds
  → On reconnect: banner disappears, chat continues
```

### 5d. Excel Executor (`taskpane/src/lib/excel-executor.ts`)

Receives instruction objects from SSE events. Executes them using Office.js.

```typescript
interface ExcelInstruction {
  type: "excel_instruction";
  operation: string;              // "read_range", "write_range", etc.
  params: Record<string, any>;    // Operation-specific parameters
}

// Entry point
async function executeExcelInstruction(instruction: ExcelInstruction): Promise<ExcelExecutionResult>
```

**All operations follow the same pattern:**
```typescript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  // ... perform operation ...
  await context.sync();
});
```

**Operation implementations:**

| Operation | Office.js API Used |
|-----------|-------------------|
| `read_range` | `range.load("values", "formulas")` → `context.sync()` |
| `write_range` | `range.values = [...]` → `context.sync()` |
| `create_table` | `sheet.tables.add(range, hasHeaders)` |
| `create_chart` | `sheet.charts.add(chartType, dataRange)` |
| `get_workbook_info` | `workbook.worksheets.load()`, `workbook.tables.load()` |
| `format_range` | `range.format.font.*`, `range.format.fill.*` |
| `insert_rows` | `range.insert("Down")` |
| `delete_rows` | `range.delete("Up")` |
| `add_worksheet` | `workbook.worksheets.add(name)` |
| `run_formula` | Write to temp cell → read value → clear |

### 5e. Auth State in Taskpane

Auth is handled by the CLI (`agentxl login`), not the taskpane. The taskpane checks auth status and displays the appropriate screen:

```
GET /api/config/status → { authenticated: true/false, provider, version }

If not authenticated:
  → Show "Run agentxl login in your terminal"
  → Poll every 2s for auth changes (auto-detects when user runs agentxl login)

If authenticated:
  → Show chat UI with provider label
```

### 5f. Office.js Initialization

```typescript
// Load Office.js from CDN
<script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>

// Initialize
Office.onReady((info) => {
  if (info.host === Office.HostType.Excel) {
    // Office.js ready — render app
    setIsOfficeReady(true);
  }
});
```

**Excel context gathered before each message:**
```typescript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  sheet.load("name");
  const selection = context.workbook.getSelectedRange();
  selection.load("address");
  await context.sync();

  // Send with message: { activeSheet: sheet.name, selectedRange: selection.address }
});
```

---

## 6. Office Add-in Integration

### 6a. Manifest (`manifest/manifest.xml`)

XML file that registers AgentXL with Excel:

```xml
<OfficeApp xsi:type="TaskPaneApp">
  <Id>unique-guid-here</Id>
  <DisplayName DefaultValue="AgentXL" />
  <Description DefaultValue="AI-powered Excel assistant" />

  <!-- Where to load the taskpane from -->
  <DefaultSettings>
    <SourceLocation DefaultValue="https://localhost:3001/taskpane" />
  </DefaultSettings>

  <Permissions>ReadWriteDocument</Permissions>

  <!-- Ribbon button on Home tab -->
  <ExtensionPoint xsi:type="PrimaryCommandSurface">
    <OfficeTab id="TabHome">
      <Group id="AgentXLGroup">
        <Control xsi:type="Button" id="TaskpaneButton">
          <Label resid="TaskpaneButton.Label" />
          <Action xsi:type="ShowTaskpane">
            <SourceLocation resid="Taskpane.Url" />
          </Action>
        </Control>
      </Group>
    </OfficeTab>
  </ExtensionPoint>
</OfficeApp>
```

**Key URLs in manifest — all localhost:**
```
Taskpane:  https://localhost:3001/taskpane
Icons:     https://localhost:3001/taskpane/assets/icon-*.png
```

### 6b. Registration Methods

| Method | User Type | How |
|--------|-----------|-----|
| **Trusted Add-in Catalog** | Developers | Excel → Trust Center → add catalog folder → restart → Insert → My Add-ins → SHARED FOLDER |
| **Windows Registry** | Installer (future) | Write registry key to auto-register manifest |
| **Network share** | Enterprise IT | Place manifest on trusted network share |
| **Microsoft 365 Admin** | Enterprise IT | Deploy via admin center |

For developers: Trusted Add-in Catalog is a one-time setup. After that, just run `agentxl start` and click the ribbon button. The Windows installer (future) uses registry-based registration — no manual setup needed.

### 6c. Permissions

Manifest requests `ReadWriteDocument` — the minimum needed to read data and write values/formulas/charts.

---

## 7. Authentication & API Key Management

### 7a. Architecture

Auth is handled by the CLI (`agentxl login` / `agentxl start`), not the taskpane.

```
┌─ CLI ──────────┐     ┌─ Server ──────────────────────┐
│                 │     │                                │
│ agentxl login   │────►│ Pi SDK AuthStorage             │
│ agentxl start   │     │   └─► ~/.pi/agent/auth.json    │
│                 │     │                                │
└─────────────────┘     └────────────────────────────────┘

┌─ Taskpane ─────┐     ┌─ Server ──────────────────────┐
│                 │     │                                │
│ Status check    │◄────│ GET /api/config/status          │
│ Auth polling    │     │   └─► Check if auth exists      │
│                 │     │                                │
└─────────────────┘     └────────────────────────────────┘
```

### 7b. Storage

Credentials are stored via Pi SDK's `AuthStorage`:

```
~/.pi/agent/
└── auth.json            ← API keys + OAuth tokens (shared with Pi)

~/.office-addin-dev-certs/
├── localhost.key         ← HTTPS private key
└── localhost.crt         ← HTTPS certificate (OS-trusted)
```

**auth.json** (Pi SDK format):
```json
{
  "anthropic": { "type": "api_key", "key": "sk-ant-..." }
}
```

Falls back to `~/.agentxl/auth.json` if Pi auth doesn't exist.

### 7c. Auth Resolution Order

1. `~/.agentxl/auth.json` (AgentXL-specific)
2. `~/.pi/agent/auth.json` (shared with Pi — most common)
3. Environment variables (`ANTHROPIC_API_KEY`, etc.)

### 7d. Auth Flow

Auth is handled by the CLI, not the server:

1. `agentxl start` or `agentxl login` checks for existing credentials
2. If none found: presents outcome-focused auth menu (subscriptions, API key, free tier)
3. OAuth: opens browser → token saved automatically
4. API key: auto-detects provider from prefix (`sk-ant-` → Anthropic, etc.)
5. Credentials saved via Pi SDK `AuthStorage`

### 7e. Supported Auth Methods

| Method | Flow |
|--------|------|
| **API Key (Anthropic)** | Paste key → validate → store |
| **API Key (OpenRouter)** | Paste key → validate → store |
| **API Key (OpenAI)** | Paste key → validate → store |
| **API Key (Azure)** | Paste key + endpoint → validate → store |
| **OAuth (Claude Pro/Max)** | Select provider → browser OAuth → token stored |
| **OAuth (ChatGPT Plus)** | Select provider → browser OAuth → token stored |
| **OAuth (GitHub Copilot)** | Select provider → browser OAuth → token stored |

---

## 8. Auto-Update System

### 8a. Update Check Flow

```
┌─ AgentXL Server ────────────────────────────────────────┐
│                                                          │
│  On startup:                                             │
│    → Check https://api.agentxl.com/updates/check         │
│    → If newer version: download & apply before serving   │
│                                                          │
│  While running (every N hours):                          │
│    → Check update endpoint                               │
│    → If newer version:                                   │
│      → Download update package                           │
│      → Wait for idle (no active SSE streams)             │
│      → Apply update                                      │
│      → Restart server process                            │
│                                                          │
│  On urgent flag:                                         │
│    → Apply immediately (don't wait for idle)             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 8b. Update Endpoint

```
GET https://api.agentxl.com/updates/check?current=1.2.0&platform=win32

Response:
{
  "latest": "1.3.0",
  "downloadUrl": "https://api.agentxl.com/updates/download/1.3.0/win32",
  "checkIntervalHours": 4,
  "urgent": false,
  "changelog": "Better chart formatting, bug fixes"
}
```

**Server-controlled interval:** The update endpoint returns `checkIntervalHours`. No client update needed to change check frequency.

### 8c. Update Schedule

| Phase | Interval | Rationale |
|-------|----------|-----------|
| v1.x (early) | 4 hours | Rapid iteration, quick bug fixes |
| v2.x (stable) | 24 hours | Stable, less churn |
| Server override | Any | Endpoint can change interval anytime |

### 8d. Taskpane Resilience During Updates

```
Server restarts for update (1-2 seconds)
  → Taskpane SSE connection drops
  → Taskpane shows "Reconnecting..." banner
  → Taskpane retries connection every 2 seconds
  → Server comes back up
  → Taskpane reconnects, banner disappears
  → Chat history preserved (in-memory on taskpane side)
  → If mid-conversation: user can resend last message
```

---

## 9. Data Flow

### 9a. Complete Message Flow

```
 ┌──────────┐        ┌───────────┐        ┌──────────┐
 │ Taskpane │        │  Server   │        │ LLM API  │
 │ (WebView)│        │(localhost)│        │(Anthropic│
 │          │        │           │        │ /OpenAI) │
 └────┬─────┘        └─────┬─────┘        └────┬─────┘
      │                     │                    │
      │  1. Gather Excel    │                    │
      │     context via     │                    │
      │     Office.js       │                    │
      │                     │                    │
      │  2. POST /api/agent │                    │
      │  {message, context} │                    │
      ├────────────────────►│                    │
      │                     │                    │
      │                     │  3. session.prompt  │
      │                     │     (Pi SDK)        │
      │                     ├───────────────────►│
      │                     │                    │
      │                     │  4. LLM streams    │
      │                     │     response       │
      │                     │◄───────────────────┤
      │                     │                    │
      │  5. SSE: thinking,  │                    │
      │     text deltas     │                    │
      │◄────────────────────┤                    │
      │                     │                    │
      │                     │  6. LLM calls tool │
      │                     │     (excel_read_   │
      │                     │      range)        │
      │                     │◄───────────────────┤
      │                     │                    │
      │                     │  7. Tool returns   │
      │                     │     instruction    │
      │                     │     {operation,    │
      │                     │      params}       │
      │                     │                    │
      │  8. SSE:            │                    │
      │  excel_instruction  │                    │
      │◄────────────────────┤                    │
      │                     │                    │
      │  9. Execute via     │                    │
      │     Office.js       │                    │
      │  (read/write/chart) │                    │
      │                     │                    │
      │  10. SSE:           │                    │
      │  agent_end          │                    │
      │◄────────────────────┤                    │
      │                     │                    │
```

### 9b. Tool Execution Detail (Read Operation)

```
LLM decides to call excel_read_range(range: "A1:D10")
  │
  ▼
Server: Tool execute() runs
  → Returns: { content: ["Reading A1:D10"], details: { operation: "read_range", params: { range: "A1:D10" } } }
  → Pi SDK sends tool result back to LLM
  → Server also sends excel_instruction event to taskpane via SSE
  │
  ▼
Taskpane: Receives excel_instruction event
  → Calls executeExcelInstruction({ operation: "read_range", params: { range: "A1:D10" } })
  → Office.js: Excel.run → getRange("A1:D10") → load("values") → sync()
  → Returns data: { values: [[...], [...]], rowCount: 10, columnCount: 4 }
  │
  ▼
LLM: Receives tool result with the data
  → Reasons about the data
  → Responds to user or calls another tool
```

### 9c. Data That Leaves the Machine

| Data | Destination | When |
|------|-------------|------|
| User's chat message | LLM API | Every message |
| Excel context (sheet name, selection) | LLM API | Every message (appended to prompt) |
| Spreadsheet data (from read operations) | LLM API | When agent reads ranges |
| Version check | api.agentxl.com | Every 4h/24h |

**Data that NEVER leaves:**
- API keys (stored locally, sent only to the provider's API)
- Full workbook contents (only requested ranges are sent)
- Chat history (stored in-memory on taskpane, not on server)

---

## 10. Distribution & Packaging

### 10a. npm Package (Developer Channel)

```json
// package.json
{
  "name": "agentxl",
  "bin": {
    "agentxl": "./bin/agentxl.js"
  }
}
```

```bash
npm install -g agentxl
agentxl start [--port 3001]
```

### 10b. Windows Installer (User Channel)

```
AgentXL-Setup.exe
  ├── Bundled Node.js runtime (user never sees it)
  ├── AgentXL server code
  ├── Pre-built taskpane static files
  ├── Manifest XML
  └── Installer script:
        1. Copy files to Program Files\AgentXL\
        2. Generate HTTPS certificates (office-addin-dev-certs)
        3. Register Office add-in manifest (Windows Registry)
        4. Add to Windows startup (Registry: HKCU\...\Run)
        5. Start background service
        6. Create Start Menu shortcut
```

**Packaging tool:** `pkg` or `nexe` to bundle Node.js + server code into a single `.exe`

**Installer framework:** Inno Setup, NSIS, or Electron (if tray icon needed)

### 10c. System Tray Application

Lightweight tray app (Electron or native Node.js tray):

```
Responsibilities:
  → Start/stop the HTTPS server
  → Show status (running/error/update available)
  → Provide right-click menu (Open Excel, Settings, Quit)
  → Start on Windows boot
```

---

## 11. Module Breakdown

### Module 1: "Chat with Claude in Excel" ✅

**Goal:** Complete pipeline working. User chats with AI inside Excel.

**Delivers:**
- `bin/agentxl.js` — CLI entry point with guided setup wizard
- `src/server/index.ts` — HTTPS server with OS-trusted certs (office-addin-dev-certs)
- `src/agent/session.ts` — Pi SDK session (no Excel tools yet)
- `taskpane/` — React chat UI (modularized: hooks, components, stream handler)
- `manifest/manifest.xml` — Office add-in manifest for localhost
- `POST /api/agent` — SSE streaming
- `GET /api/config/status` — Auth check
- Auth via CLI (`agentxl login`) with outcome-focused menu
- Auto-reconnect on connection loss, auth polling
- 64 tests (certs, server, session, E2E via Playwright)

**No Excel tools.** Just chatting with AI inside Excel.

**Demo:** `npm install -g agentxl` → `agentxl start` → add to Excel (one-time) → "What can you help me with?"

---

### Module 2: "Read My Spreadsheet"

**Goal:** Agent can see and understand spreadsheet data.

**Delivers:**
- `excel_get_workbook_info` tool
- `excel_read_range` tool
- `excel-executor.ts` — read operations (Office.js)
- `ToolCard.tsx` component — shows tool execution in chat
- Excel context sent with each message (active sheet, selection)

**Demo:** Put data in Excel → "What data do I have?" → agent reads and describes it.

---

### Module 3: "Edit My Spreadsheet"

**Goal:** Agent can modify the spreadsheet.

**Delivers:**
- `excel_write_range` tool
- `excel_format_range` tool
- `excel_create_table` tool
- `excel_run_formula` tool
- `excel-executor.ts` — write/format operations
- `ThinkingBlock.tsx` component — shows agent reasoning

**Demo:** "Make headers bold, add a SUM row" → spreadsheet changes in real time.

---

### Module 4: "Full Excel Agent + Ship It"

**Goal:** Complete agent with all tools. Distribution-ready.

**Delivers:**
- `excel_create_chart` tool
- `excel_insert_rows` / `excel_delete_rows` tools
- `excel_add_worksheet` tool
- `excel-executor.ts` — chart, row, worksheet operations
- Settings panel in taskpane
- Auto-update system (check endpoint, download, apply, restart)
- npm package config (bin field, publish setup)
- Windows installer build pipeline
- README with demo GIF

**Demo:** "Analyze sales data, create summary in new sheet with chart" → full multi-step agentic workflow.

---

## 12. File Structure

```
C:\Code\AgentXL\
├── bin/
│   └── agentxl.js                    ← CLI entry point (guided setup wizard)
├── src/
│   ├── server/
│   │   ├── index.ts                  ← HTTPS server (~200 lines)
│   │   └── certs.ts                  ← Certificate generation (office-addin-dev-certs)
│   ├── agent/
│   │   ├── session.ts                ← Pi SDK session management
│   │   ├── models.ts                 ← Model selection (OAuth > API key)
│   │   ├── tools/
│   │   │   └── excel-tools.ts        ← 10 Excel tool definitions
│   │   └── provider/
│   │       └── azure-provider.ts     ← Azure Claude support
│   └── types/
│       └── office.d.ts               ← Office.js type declarations
├── taskpane/
│   ├── index.html                    ← Entry point (loads Office.js + app bundle)
│   ├── src/
│   │   ├── app.tsx                   ← Chat UI orchestrator (~100 lines)
│   │   ├── hooks/
│   │   │   ├── useAgentStatus.ts     ← Status fetch, reconnect, auth polling
│   │   │   └── useChatStream.ts      ← Send, abort, streaming, error handling
│   │   ├── components/
│   │   │   ├── WelcomeScreen.tsx     ← Logo + quick actions
│   │   │   ├── MessageBubble.tsx     ← User/assistant/system messages
│   │   │   ├── ChatInput.tsx         ← Textarea + send/stop buttons
│   │   │   ├── ThinkingBlock.tsx     ← Collapsible thinking display
│   │   │   ├── ConnectionError.tsx   ← "Can't connect" screen
│   │   │   └── AuthRequired.tsx      ← "Run agentxl login" screen
│   │   ├── lib/
│   │   │   ├── api.ts                ← API client, provider labels
│   │   │   ├── types.ts              ← Typed Message, SSE events
│   │   │   ├── stream-handler.ts     ← SSE event → message updates
│   │   │   └── excel-executor.ts     ← Office.js operation executor (Module 2+)
│   │   └── styles/
│   │       └── globals.css           ← Tailwind CSS v4
│   └── dist/                         ← Pre-built static files (git-ignored)
├── manifest/
│   └── manifest.xml                  ← Office add-in manifest
├── tests/
│   ├── certs.test.ts                 ← Certificate tests (3)
│   ├── server.test.ts                ← Server acceptance tests (32)
│   ├── session.test.ts               ← Session + SSE tests (19)
│   └── e2e.test.ts                   ← Playwright E2E tests (10)
├── docs/
│   ├── USER_FLOW.md                  ← User experience flows
│   ├── TASKS.md                      ← Module 1 task tracker
│   └── TECHNICAL_ARCHITECTURE.md     ← This document
├── .gitignore
├── package.json
├── tsconfig.json
├── LICENSE                           ← MIT
├── README.md
└── AGENTS.md
```

---

## 13. Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Runtime** | Node.js 20+ | Pi SDK requirement, cross-platform |
| **Agent Framework** | Pi SDK (`@mariozechner/pi-coding-agent`) | Session management, tool calling, streaming, auth |
| **LLM** | Claude (Anthropic), GPT-4o (OpenAI), or any via OpenRouter | User's choice of provider |
| **Server** | Plain `https.createServer()` | No framework needed for 4 routes |
| **Taskpane UI** | React 19 | Component model, streaming state management |
| **Styling** | Tailwind CSS | Rapid UI development, small bundle |
| **Excel API** | Office.js | Microsoft's official add-in API |
| **Schema Validation** | TypeBox (`@sinclair/typebox`) | Tool parameter schemas (Pi SDK standard) |
| **Markdown** | react-markdown + remark-gfm | Render agent responses |
| **Icons** | Lucide React | Consistent icon set |
| **Build** | Vite | Fast taskpane bundling |
| **Packaging (npm)** | npm with `bin` field | Developer distribution |
| **Packaging (Windows)** | pkg + Inno Setup | Auditor distribution |

### Dependencies (Production)

```
@mariozechner/pi-coding-agent    ← Agent framework (includes Pi AI, Pi Agent)
@sinclair/typebox                ← Tool parameter schemas
react, react-dom                 ← Taskpane UI
react-markdown, remark-gfm      ← Markdown rendering
lucide-react                     ← Icons
```

### Dependencies (Development)

```
typescript                       ← Type safety
vite                             ← Taskpane bundler
@types/react                     ← React types
@microsoft/office-js             ← Office.js types
tailwindcss                      ← Styling
```

---

## 14. Security Considerations

### 14a. API Key Security

| Risk | Mitigation |
|------|------------|
| Key in transit | HTTPS only (localhost cert). Key sent to localhost, never over network. |
| Key at rest | Stored in `~/.agentxl/auth.json` with 0600 permissions (user-only read/write). |
| Key in memory | Held in Node.js process memory. Cleared on process exit. |
| Key exposure to LLM | API key is never included in prompts. Pi SDK handles auth headers separately. |

### 14b. Data Privacy

| Data | Exposure |
|------|----------|
| Spreadsheet data | Only ranges explicitly read by the agent are sent to the LLM API. Never sent to AgentXL servers. |
| Chat messages | Sent to LLM API only. Not logged or stored server-side. |
| Workbook metadata | Sheet names, table names sent as context. Minimal exposure. |

### 14c. Network Security

| Vector | Mitigation |
|--------|------------|
| HTTPS cert | OS-trusted via office-addin-dev-certs, generated locally, never shared. |
| Localhost binding | Server binds to `127.0.0.1` only. Not accessible from other machines. |
| Update endpoint | HTTPS to api.agentxl.com. Verify package integrity (checksum). |
| CORS | Server sets CORS headers for localhost origin only. |

### 14d. Office.js Sandbox

The taskpane WebView runs in a sandboxed environment:
- Cannot access file system
- Cannot execute system commands
- Can only interact with Excel through Office.js API
- Limited to `ReadWriteDocument` permission scope

---

## 15. Reference Implementation

Source: https://github.com/deepak-chowdry/agent-excel

### What to Port (logic reused, adapted to new architecture)

| Reference File | AgentXL File | Notes |
|----------------|-------------|-------|
| `agent-pi/tools/excel-tools.ts` | `src/agent/tools/excel-tools.ts` | Port directly. 10 tool definitions. |
| `agent-pi/init.ts` | `src/agent/session.ts` | Extract Pi SDK session logic. Remove Vercel/serverless workarounds. |
| `agent-pi/provider/azure-provider.ts` | `src/agent/provider/azure-provider.ts` | Port directly. |
| `lib/excel-executor.ts` | `taskpane/src/lib/excel-executor.ts` | Port directly. Office.js operations. |
| `app/taskpane/page.tsx` | `taskpane/src/app.tsx` | Port chat UI. Remove Next.js (`"use client"`, imports). |
| `components/blocks/ThinkingBlock.tsx` | `taskpane/src/components/ThinkingBlock.tsx` | Port directly. |
| `components/blocks/ToolCard.tsx` | `taskpane/src/components/ToolCard.tsx` | Port. Remove `@/components/ui` → inline or use Radix directly. |

### What NOT to Port

| Reference File | Why |
|----------------|-----|
| `app/api/agent/route.ts` | Next.js API route. Replace with plain HTTP handler. |
| `app/page.tsx` | Next.js landing page. Not needed. |
| `next.config.ts` | Next.js config. Not needed. |
| `postcss.config.mjs` | Next.js PostCSS. Use Vite instead. |
| `components.json` | shadcn/ui config. Not needed. |
| `lib/use-agent.ts` | Next.js React hook. Not needed. |
| `lib/utils.ts` | `cn()` utility. Inline or simplify. |
| `app/globals.css` | Next.js globals. Replace with own styles. |

### Key Changes from Reference

| Aspect | Reference (Deepak) | AgentXL |
|--------|-------------------|---------|
| Framework | Next.js 16 | Plain Node.js HTTPS server |
| Hosting | Vercel (cloud) | localhost (local) |
| Manifest URLs | `agent-excel-six.vercel.app` | `localhost:3001` |
| Session dirs | `/tmp/.pi` (serverless hack) | Standard `~/.agentxl/` |
| API key | Environment variable | Taskpane onboarding UI |
| Model selection | Hardcoded | Auto-select based on provider |
| UI components | shadcn/ui | Inline (no component library dependency) |
| Build | Next.js build | Vite |

---

*Created: March 7, 2026*
