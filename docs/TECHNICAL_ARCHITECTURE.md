# AgentXL — Technical Architecture

> Technical architecture for the folder-first, document-to-Excel version of AgentXL.

---

## 1. System Overview

AgentXL is a **local-first document-to-Excel agent** that runs inside Microsoft Excel as a taskpane add-in.

It is designed for workflows where:
- the **source of truth** lives in a local folder of documents
- the **final output** lives in Excel
- users need **grounded answers** and **traceability**

### Product principle
**Documents are the source. Excel is the destination.**

### Method
**Parse → Search → Ask → Evaluate → Fix → Repeat**

---

## 2. Runtime Components

AgentXL has three primary runtime components.

```text
┌─────────────────────────────────────────────────────────────┐
│                        USER'S MACHINE                       │
│                                                             │
│  Local document folder                                      │
│  PDFs / CSVs / XLSX / TXT / support files                   │
│              │                                              │
│              ▼                                              │
│  ┌────────────────┐     ┌───────────────────────────────┐   │
│  │     Excel      │     │        AgentXL Server         │   │
│  │                │     │   Node.js on localhost:3001   │   │
│  │  ┌──────────┐  │HTTPS│                               │   │
│  │  │ Taskpane │◄─┼────►│  /taskpane/*                  │   │
│  │  │ Office.js│  │ SSE │  /api/agent                   │   │
│  │  └──────────┘  │     │  /api/config/status           │   │
│  │                │     │  /api/version                 │   │
│  └────────────────┘     │                               │   │
│                         │  Pi SDK agent session         │   │
│                         │  folder/file services         │   │
│                         │  parsers + search             │   │
│                         └──────────────┬────────────────┘   │
│                                        │                    │
└────────────────────────────────────────┼────────────────────┘
                                         │ HTTPS
                                         ▼
                              ┌──────────────────────────┐
                              │       LLM Provider       │
                              │ Anthropic / OpenAI /     │
                              │ OpenRouter / Azure /     │
                              │ Google / Copilot         │
                              └──────────────────────────┘
```

### Responsibilities

| Component | Runtime | Responsibilities |
|-----------|---------|------------------|
| **AgentXL Server** | Node.js | HTTPS server, auth, Pi SDK session, document search/orchestration, SSE streaming |
| **Taskpane UI** | Excel WebView | folder/workbook UX, chat/result display, mapping review, Office.js execution |
| **Office Add-in Manifest** | XML | tells Excel where to load the taskpane |

---

## 3. Architecture Principles

### 3.1 Local-first
- server runs on the user's machine
- local files remain on the machine
- no hosted AgentXL backend required

### 3.2 Folder-first
The main user action is:
> point AgentXL at a local folder of source documents

Not:
> ask the spreadsheet a generic question

### 3.3 Agentic search over classic RAG
AgentXL should start with:
- file enumeration
- metadata inspection
- selective parsing
- direct reading of relevant files
- grounded prompting

It should **not** assume embeddings/vector DB infrastructure from day one.

### 3.4 Traceability first
Every important output should be explainable:
- what file was used
- where in the file the evidence came from
- what was written into Excel
- when it was written

### 3.5 Evals before infrastructure
Quality should be driven by:
- benchmark folders
- expected answers
- expected mappings
- failure analysis

Not by adding more stack layers prematurely.

---

## 4. Current Implementation State

The current repository already has:
- HTTPS localhost server
- auth flow via Pi SDK
- taskpane shell in Excel
- SSE chat streaming
- low-level Excel execution path

The current repository does **not yet fully have**:
- folder selection workflow
- document inventory UI
- agentic file search
- parsing pipeline for local support folders
- source traceability into workbook outputs
- eval loop for document workflows

So the architecture below distinguishes between **current** and **target**.

---

## 5. Current Server Architecture

### 5.1 Server entry point
`src/server/index.ts`

Current responsibilities:
- serve static taskpane files from `/taskpane/*`
- expose `POST /api/agent`
- expose `GET /api/config/status`
- expose `GET /api/version`
- stream responses as SSE

### 5.2 Current API surface

| Method | Path | Purpose | State |
|--------|------|---------|-------|
| `GET` | `/taskpane/*` | serve taskpane assets | current |
| `POST` | `/api/agent` | send prompt, stream SSE | current |
| `GET` | `/api/config/status` | auth status | current |
| `GET` | `/api/version` | version info | current |

### 5.3 Current request shape

```json
{
  "message": "Compare the trial balance to the lead sheet",
  "context": {
    "activeSheet": "Lead Sheet",
    "selectedRange": "A1:H40"
  }
}
```

### 5.4 Current streaming shape
The server forwards Pi SDK events over SSE and the taskpane renders them.

---

## 6. Target Server Architecture

The target server should add document-first capabilities.

### 6.1 Planned services
- **folder service**
  - store current folder path
  - enumerate files
  - refresh inventory
- **parser service**
  - parse supported file types into normalized text/tables
- **search service**
  - metadata and content-guided agentic file search
- **traceability service**
  - attach source references to answers and Excel writes
- **mapping service**
  - convert grounded results into Excel write instructions
- **eval service**
  - run benchmarks and analyze failure patterns

### 6.2 Planned API surface

| Method | Path | Purpose | State |
|--------|------|---------|-------|
| `POST` | `/api/folder/select` | select a local folder | planned |
| `GET` | `/api/folder/status` | selected folder + stats | planned |
| `POST` | `/api/folder/refresh` | rescan folder | planned |
| `GET` | `/api/folder/files` | list indexed files | planned |
| `POST` | `/api/agent` | grounded question / mapping request | current, to extend |
| `GET` | `/api/trace/:id` | traceability lookup | planned |

### 6.3 Example planned folder-select request

```json
{
  "path": "C:\\Users\\user\\Documents\\Support Pack"
}
```

Example response:

```json
{
  "selected": true,
  "path": "C:\\Users\\user\\Documents\\Support Pack",
  "fileCount": 42,
  "supportedFileCount": 39
}
```

---

## 7. Agent Layer

### 7.1 Current state
`src/agent/session.ts`

Current behavior:
- creates a Pi SDK agent session
- resolves auth from AgentXL or Pi auth storage
- chooses an available model
- streams agent responses
- no document tools yet

### 7.2 Target state
The agent should orchestrate document workflows, not generic spreadsheet chat.

Planned tool layers:

#### Low-level Excel tools
- `excel_read_range`
- `excel_write_range`
- `excel_create_table`
- `excel_create_chart`
- `excel_get_workbook_info`
- `excel_format_range`
- `excel_insert_rows`
- `excel_delete_rows`
- `excel_add_worksheet`
- `excel_run_formula`

#### Higher-level document tools
- `document_list_folder`
- `document_get_file_metadata`
- `document_read_file`
- `document_extract_text`
- `document_extract_table`
- `document_search_folder`
- `document_answer_question`
- `document_trace_sources`
- `document_compare_to_workbook`
- `document_map_to_excel`

### 7.3 Tool boundary rule
Excel tools are **execution primitives**.
They are not the product story.

The product behavior is things like:
- map the cash balance from the statement folder into the workbook
- compare source exports against workbook values
- trace workbook cells back to supporting files

---

## 8. Taskpane Architecture

### 8.1 Current state
Current taskpane provides:
- auth-aware loading state
- welcome screen
- chat UI
- streaming message rendering
- Office.js execution path for workbook actions

### 8.2 Target state
The taskpane should evolve from a chat-first shell into a document workflow UI.

Recommended regions:

#### A. Folder panel
- selected folder path
- file count
- refresh action
- scan/index status

#### B. Ask / answer panel
- prompt input
- grounded answer
- supporting files used
- source citations

#### C. Mapping panel
- workbook/sheet/range context
- mapping preview
- write to Excel action
- exception list
- traceability view

### 8.3 Taskpane states
- loading
- unauthenticated
- no folder selected
- scanning folder
- ready for question
- searching files
- reading files
- answer ready
- mapping ready
- write completed
- error

---

## 9. Office.js Boundary

Office.js runs only in the taskpane WebView, not on the Node.js server.

### Implication
The server should describe **what** to do in Excel.
The taskpane should execute **how** to do it with Office.js.

This architecture still holds in the folder-first product.

Example:
- server finds the right value in a source document
- server returns mapping instruction
- taskpane writes that value into Excel

---

## 10. Data Flow

### 10.1 Current data flow

```text
User types message in taskpane
  → taskpane sends message to /api/agent
  → server calls Pi SDK session
  → SSE events stream back
  → taskpane renders result
```

### 10.2 Target data flow

```text
User selects local folder
  → taskpane sends folder path to server
  → server scans files and stores inventory

User asks grounded question
  → taskpane sends question + workbook context + folder context
  → agent searches folder metadata and files
  → agent reads relevant files
  → agent produces grounded result + traceability + mapping suggestion
  → taskpane shows review state
  → user confirms write
  → taskpane executes Excel write via Office.js
```

---

## 11. Supported File Types

### Initial target
- PDF
- CSV
- XLSX
- TXT
- MD

### Possible later
- DOCX
- images with OCR
- email formats

---

## 12. Search Strategy

AgentXL should use a layered search strategy.

### 12.1 Step 1 — cheap signals first
- filename
- folder path
- modified time
- extension
- file size

### 12.2 Step 2 — light content inspection
- partial text extraction
- headings / first-page info
- table signatures
- obvious identifiers

### 12.3 Step 3 — selective deep reads
- parse the most promising files in more detail
- follow references across files if needed
- avoid reading everything deeply by default

### 12.4 Step 4 — grounded answer generation
- produce answer only from inspected evidence
- include source references
- separate extraction from inference when possible

---

## 13. Traceability Model

For every mapped output, AgentXL should retain:
- source file path
- page / section / table reference when available
- extraction prompt or operation
- target workbook location
- timestamp

This enables:
- “Which file did this cell come from?”
- “Why was this value written here?”
- “What evidence supported this answer?”

---

## 14. Evaluation Architecture

Evaluation is a required subsystem, not a nice-to-have.

### 14.1 Benchmark format
A benchmark case should contain:
- fixture folder
- user instruction
- expected answer
- expected source file(s)
- expected mapping output

### 14.2 Metrics
- file selection correctness
- extraction correctness
- normalization correctness
- mapping correctness
- traceability completeness
- exception detection quality

### 14.3 Improvement loop
Benchmark failures should feed:
- prompt changes
- parser improvements
- search heuristics
- mapping logic improvements

---

## 15. Security & Privacy

- localhost-only server
- no AgentXL cloud backend
- no telemetry requirement
- user-controlled model/provider
- only relevant prompt content leaves the machine to the chosen model provider

### Important nuance
Even in a local-first system, selected document content may still be sent to the chosen LLM provider as part of the prompt.
That should be made explicit in UX and docs.

---

## 16. Repository Mapping

### Current key files
- `src/server/index.ts` — HTTPS server and API routes
- `src/agent/session.ts` — Pi SDK session management
- `src/agent/models.ts` — provider/model resolution
- `taskpane/src/app.tsx` — taskpane orchestrator
- `taskpane/src/components/` — UI components
- `manifest/manifest.xml` — Office add-in manifest

### Planned additions
- `src/agent/tools/document-tools.ts`
- `src/agent/search/`
- `src/agent/parser/`
- `src/server/folder-service.ts`
- `src/server/trace-service.ts`
- `docs/FOLDER_FIRST_PRODUCT_SPEC.md`

---

## 17. Summary

AgentXL should be implemented as a **folder-first, agentic-search, document-to-Excel system**.

The architecture should optimize for:
- local evidence folders
- grounded file search
- selective document reading
- traceable Excel outputs
- eval-driven improvement

Not for generic spreadsheet chat or premature retrieval infrastructure.

---

*Updated: March 8, 2026*