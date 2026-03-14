# AgentXL — Code Agent Context

> Local-first document-to-Excel agent for evidence-heavy work. Built by DeltaXY.

---

## What This Is

AgentXL is **not** a generic Excel chatbot.

AgentXL is a local-first Excel add-in for workflows where the **source of truth lives in documents** and the **final output lives in Excel**.

The core workflow is:

1. User points AgentXL at a **local folder** of source documents
2. User asks a grounded question or gives a mapping instruction
3. AgentXL **searches the folder agentically**, reads the relevant files, and extracts the answer
4. AgentXL maps the grounded result into Excel with **traceability back to source files**

Primary wedge:
- audit
- due diligence
- transaction support
- compliance / evidence review

Broader market:
- any document-heavy professional workflow that ends in spreadsheets

**Install and run:**
```bash
npm install -g agentxl
agentxl install
agentxl start
```

No cloud server. No account with us. User brings their own model/provider.

---

## Product Positioning

### One-line definition
AgentXL turns source documents into traceable Excel workpapers.

### What we are optimizing for
- **Relief**, not novelty
- **Outcome over tool**
- **Evidence over chat**
- **Folder-first workflow**
- **Traceability over automation theater**
- **Evals before infrastructure**

### What we are not building
- not a generic “ask Excel anything” assistant
- not a classic RAG stack with embeddings/vector DB as the starting point
- not a feature buffet of charts, formulas, and worksheet tricks as the main story

Excel is the execution surface, not the product identity.

---

## Core Product Method

AgentXL follows this method:

**Parse → Search → Ask → Evaluate → Fix → Repeat**

This is intentionally aligned with the product philosophy from:
- `C:\Source\Business\productdesign.md`
- your blog post: **You Don't Need 36 Tools to Build Agentic RAG**

Implications for implementation:
- prefer simple parsing + direct file reading over heavyweight infra
- use **agentic file search** over local folders
- treat Excel tools as low-level execution primitives
- design for explicit source traceability
- build eval loops early for extraction / mapping correctness

---

## Architecture (Target)

```text
User runs: agentxl start
  → Local HTTPS server on localhost:3001
  → Serves /taskpane UI
  → Serves API endpoints for agent orchestration

User opens Excel taskpane
  → Selects workbook / sheet context
  → Points AgentXL at a local folder of evidence files
  → Agent searches files, reads relevant documents, and prepares grounded results
  → Taskpane writes mapped outputs into Excel via Office.js
```

### Stack
- **Runtime:** Node.js
- **Agent runtime:** Pi SDK (`@mariozechner/pi-coding-agent`)
- **LLM:** user-selected provider via Pi auth / API key
- **Excel integration:** Office.js
- **Taskpane UI:** React (static build)
- **HTTPS:** `office-addin-dev-certs`

### Architectural principle
**Documents are the source. Excel is the destination.**

---

## Current State vs Target State

### Current repo has
- local HTTPS server
- Pi SDK session + streaming
- Excel taskpane shell
- auth flow
- low-level Excel tool execution path

### Target repo needs
- local folder selection
- document inventory / indexing metadata
- agentic file search
- selective file reading / parsing
- grounded extraction with citations / traceability
- Excel mapping workflows
- eval and correction loop for document tasks

If existing code or docs conflict with this document, prefer **this document + README + product spec**.

---

## Folder Structure

```text
C:\Code\AgentXL\
├── bin/
│   └── agentxl.js                     ← CLI entry point
├── src/
│   ├── server/
│   │   └── index.ts                   ← HTTPS server + API endpoints
│   ├── agent/
│   │   ├── session.ts                 ← Pi SDK agent session
│   │   ├── models.ts                  ← Model/provider resolution
│   │   ├── tools/
│   │   │   ├── excel-tools.ts         ← Low-level Excel execution tools
│   │   │   └── document-tools.ts      ← Planned: folder/file/search/extract tools
│   │   ├── search/                    ← Planned: agentic file search helpers
│   │   └── parser/                    ← Planned: file parsing / normalization
│   └── types/
│       └── office.d.ts                ← Office.js type declarations
├── taskpane/
│   ├── index.html                     ← Taskpane entry point
│   ├── src/
│   │   ├── app.tsx                    ← Taskpane orchestrator
│   │   ├── components/                ← UI pieces
│   │   └── lib/                       ← API client, stream handling, Excel executor
├── docs/
│   ├── FOLDER_FIRST_PRODUCT_SPEC.md   ← Product spec for document-first workflow
│   ├── TECHNICAL_ARCHITECTURE.md      ← Legacy / partially stale
│   ├── USER_FLOW.md                   ← Legacy / partially stale
│   └── TASKS.md                       ← Legacy module checklist
├── manifest/
│   └── manifest.xml
├── README.md
└── AGENTS.md
```

---

## Product Surface vs Implementation Surface

### Product surface (what users care about)
- choose local document folder
- search evidence
- answer grounded questions
- map outputs into Excel
- trace cells back to source files
- reconcile source files against workbook content

### Implementation surface (how we do it)
- file listing / metadata
- parsers for PDFs / CSV / XLSX / TXT
- selective reads
- model prompts
- Office.js write / format operations

### Important rule
Do **not** confuse low-level Excel primitives with the product itself.

`excel_write_range` is implementation.

“Map the cash balance from the bank statement folder into the cash workpaper with a citation” is product behavior.

---

## Planned Tool Architecture

### Low-level Excel tools (existing / near-existing)
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

### Higher-level document tools (planned)
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

The higher-level document tools are the real product layer.

---

## UX Direction

The primary user action should be:

> **Point AgentXL at the local folder with the supporting documents.**

Not:

> Ask your spreadsheet a question.

### Taskpane should evolve toward
- folder picker / folder status
- file inventory panel
- search / evidence status
- grounded answer area
- traceability / citations
- mapping preview into Excel
- exception list / review state

Chat remains useful, but chat should be in service of the workflow — not the identity of the product.

---

## Delivery Priorities

### Phase 1 — Foundation
1. local folder selection
2. file listing + metadata
3. parse supported file types
4. basic agentic search across local files
5. grounded answers from selected files

### Phase 2 — Excel mapping
6. map extracted results into workbook ranges
7. show source traceability for mapped outputs
8. reconcile workbook values against source files
9. generate exception lists / review-ready outputs

### Phase 3 — Quality loop
10. benchmark set for document tasks
11. pass/fail evals on extraction and mapping
12. failure pattern analysis
13. prompt / workflow improvements based on evals

### Phase 4 — Workflow hardening
14. larger folder support
15. better file type coverage
16. caching / incremental refresh
17. review UX improvements

---

## Non-Goals (for now)

- full enterprise document management system
- generic semantic search platform
- multi-user cloud collaboration
- classic embeddings/vector DB stack as a default dependency
- positioning as an all-purpose Excel copilot

If scale later requires heavier retrieval infrastructure, add it later — after measuring real failure modes.

---

## Legacy Docs Warning

Some repo docs and UI strings still reflect an earlier “AI for Excel / spreadsheet chat” direction.

Treat these as historical unless updated:
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/USER_FLOW.md`
- `docs/TASKS.md`
- some taskpane quick actions / placeholders
- some package metadata / keywords

Prefer the following sources of truth:
1. `AGENTS.md`
2. `README.md`
3. `docs/FOLDER_FIRST_PRODUCT_SPEC.md`

---

## Business Context

AgentXL’s wedge is **audit + diligence**, but the product should not be framed as “only for auditors.”

Correct framing:
- built for audit and diligence workflows first
- useful anywhere document-heavy work ends in spreadsheets

Commercial expansion can go deeper into audit-specific workflows, but the open-source core should remain a strong **document-to-Excel agent**.

---

## References

- Product design principles: `C:\Source\Business\productdesign.md`
- Business strategy: `C:\Source\Business\projects\AgentXL\AGENTS.md`
- Product spec: `docs/FOLDER_FIRST_PRODUCT_SPEC.md`

---

*Updated: March 8, 2026*