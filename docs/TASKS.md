# AgentXL — Implementation Tasks

> Task roadmap for the folder-first, document-to-Excel version of AgentXL.

---

## 1. Goal

Build AgentXL into a product where a user can:

1. open Excel
2. point AgentXL at a local folder of source documents
3. ask a grounded question
4. review the answer with traceability
5. map the result into Excel

This roadmap replaces the older spreadsheet-chat-first framing.

---

## 2. Guiding Principles

- **Folder-first** over spreadsheet-first
- **Agentic file search** over classic RAG by default
- **Traceability** over magic
- **Evaluation** before complexity
- **Excel as destination**, not identity

---

## 3. Current Base

Already present in the repo:
- local HTTPS server
- Pi SDK auth + session management
- SSE chat streaming
- Excel taskpane shell
- Office.js execution path
- build/test setup

These pieces are useful foundations, but they are not yet the finished product workflow.

---

## 4. Implementation Phases

## Phase 1 — Reframe the existing shell

### Task 1.1 — Update stale user-facing copy
**Goal:** Remove spreadsheet-first wording from current UI shell.

**Files likely involved:**
- `taskpane/src/components/WelcomeScreen.tsx`
- `taskpane/src/components/ChatInput.tsx`
- `package.json`

**Changes:**
- replace generic spreadsheet prompts with folder/document prompts
- update package description and keywords to reflect document-to-Excel positioning
- keep UI minimal and outcome-focused

**Status:** Pending

---

## Phase 2 — Folder-first workflow foundation

### Task 2.1 — Add folder selection capability
**Goal:** Let user choose a local folder of source documents.

**Requirements:**
- select folder path
- show selected path in UI
- persist current folder in server/runtime state
- support reselecting folder

**Potential files:**
- `src/server/index.ts`
- `src/server/folder-service.ts` (new)
- `taskpane/src/components/` (new folder picker UI)
- `taskpane/src/lib/api.ts`

**Status:** Pending

### Task 2.2 — Folder status endpoint
**Goal:** Expose selected folder info to the taskpane.

**API:**
- `GET /api/folder/status`
- `POST /api/folder/select`
- `POST /api/folder/refresh`

**Response should include:**
- path
- selected/not selected
- file count
- supported file count
- last scanned timestamp

**Status:** Pending

### Task 2.3 — File inventory model
**Goal:** Represent files in the selected folder consistently.

**Fields:**
- relative path
- file name
- extension
- size
- modified time
- parse status
- supported flag

**Status:** Pending

---

## Phase 3 — Parsing pipeline

### Task 3.1 — Basic file enumeration
**Goal:** Recursively list supported files in the selected folder.

**Initial supported types:**
- PDF
- CSV
- XLSX
- TXT
- MD

**Status:** Pending

### Task 3.2 — Parsing layer
**Goal:** Normalize file contents into text/tables usable by the agent.

**Likely module:**
- `src/agent/parser/`

**Responsibilities:**
- PDF text extraction
- CSV reading
- XLSX sheet extraction
- TXT/MD plain text handling

**Status:** Pending

### Task 3.3 — Parse status reporting
**Goal:** Surface parse success/failure per file in the UI or logs.

**Status:** Pending

---

## Phase 4 — Agentic file search

### Task 4.1 — Metadata-first search
**Goal:** Search files cheaply before deep reads.

**Signals:**
- file name
- folder name
- extension
- modified time
- simple keyword matches

**Status:** Pending

### Task 4.2 — Selective deep reads
**Goal:** Read only the most relevant files in more detail.

**Behavior:**
- inspect promising files first
- read more when confidence is low
- follow references across files when needed

**Status:** Pending

### Task 4.3 — Search/result event streaming
**Goal:** Let the taskpane show what the agent is doing.

**Potential SSE events:**
- `folder_scan_start`
- `folder_scan_end`
- `file_search_start`
- `file_search_hit`
- `file_read_start`
- `file_read_end`

**Status:** Pending

---

## Phase 5 — Grounded answering

### Task 5.1 — Folder-aware prompts
**Goal:** Ensure agent prompts are grounded in selected folder context, not just workbook context.

**Current:**
- `/api/agent` includes active sheet / selected range context

**Target:**
- include folder context
- include search results / file references
- return grounded answers, not generic chat answers

**Status:** Pending

### Task 5.2 — Source citations
**Goal:** Return which files supported the answer.

**Minimum output:**
- file name/path
- page/section/table if available
- source snippets later if needed

**Status:** Pending

### Task 5.3 — Unsupported / insufficient evidence handling
**Goal:** Explicitly say when the answer cannot be grounded.

**Status:** Pending

---

## Phase 6 — Excel mapping

### Task 6.1 — Mapping preview model
**Goal:** Represent proposed Excel writes before execution.

**Should include:**
- destination sheet/range
- value(s) to write
- source trace metadata
- operation type

**Status:** Pending

### Task 6.2 — Workbook write flow
**Goal:** Let user confirm writes before they happen.

**Requirements:**
- preview result
- confirm or cancel
- execute via Office.js

**Status:** Pending

### Task 6.3 — Traceability persistence
**Goal:** Preserve enough metadata to answer “which file did this cell come from?”

**Open question:**
- where should traceability metadata live for workbook writes?

**Status:** Pending

---

## Phase 7 — Reconciliation workflows

### Task 7.1 — Source-to-workbook comparison
**Goal:** Compare document-derived values against workbook values.

**Examples:**
- trial balance folder vs lead sheet
- bank statement vs cash workpaper
- agreement terms vs lease schedule

**Status:** Pending

### Task 7.2 — Exception list generation
**Goal:** Produce review-ready mismatch or support-gap lists in Excel.

**Status:** Pending

### Task 7.3 — Review-ready formatting
**Goal:** Apply formatting only after grounded outputs are produced.

**Important:**
Formatting is secondary. Grounding and traceability come first.

**Status:** Pending

---

## Phase 8 — Taskpane UX evolution

### Task 8.1 — Replace generic welcome screen
**Goal:** Make “choose folder” the main CTA.

**Status:** Pending

### Task 8.2 — Add folder panel
**Goal:** Show selected path, file count, scan status.

**Status:** Pending

### Task 8.3 — Add evidence/result panel
**Goal:** Show grounded answer and sources.

**Status:** Pending

### Task 8.4 — Add mapping/review panel
**Goal:** Show mapping preview, write action, and exceptions.

**Status:** Pending

---

## Phase 9 — Evaluation loop

### Task 9.1 — Benchmark fixtures
**Goal:** Create repeatable test folders and expected outputs.

**Each fixture should include:**
- sample folder
- question/instruction
- expected answer
- expected source file(s)
- expected Excel mapping

**Status:** Pending

### Task 9.2 — Pass/fail evaluation script
**Goal:** Measure correctness explicitly.

**Metrics:**
- file selection correctness
- extraction correctness
- mapping correctness
- traceability completeness

**Status:** Pending

### Task 9.3 — Failure analysis
**Goal:** Categorize recurring failure patterns.

**Examples:**
- wrong file picked
- wrong date format
- wrong table chosen
- wrong sign/currency handling
- missing citation
- wrong target cell/range

**Status:** Pending

### Task 9.4 — Improvement loop
**Goal:** Feed evaluation failures back into prompts, parsing, and search logic.

**Status:** Pending

---

## Phase 10 — Hardening

### Task 10.1 — Large folder handling
**Goal:** Keep performance acceptable on bigger evidence folders.

**Status:** Pending

### Task 10.2 — Incremental refresh
**Goal:** Refresh only changed files when possible.

**Status:** Pending

### Task 10.3 — Better error handling
**Goal:** Graceful handling for unsupported files, locked files, parse failures, and missing evidence.

**Status:** Pending

### Task 10.4 — Cross-platform checks
**Goal:** Validate folder selection and local file behavior on Windows and Mac.

**Status:** Pending

---

## 5. Near-Term Recommended Order

1. **Fix stale UI/package copy**
2. **Add folder selection + folder status API**
3. **Add file inventory model + basic scanning**
4. **Add parsing for initial file types**
5. **Add metadata-first + selective file search**
6. **Return grounded answers with citations**
7. **Add mapping preview + confirm write flow**
8. **Add traceability persistence**
9. **Add benchmark fixtures and pass/fail evals**

---

## 6. Success Criteria by Phase

### Phase 1 success
No more spreadsheet-first messaging in the shell.

### Phase 2 success
User can select a folder and see folder status in the taskpane.

### Phase 3 success
System can parse initial supported file types.

### Phase 4 success
Agent can search a folder and identify likely relevant files.

### Phase 5 success
Agent returns grounded answers with source references.

### Phase 6 success
User can review and write a grounded result into Excel.

### Phase 7 success
User can reconcile source files against workbook content.

### Phase 9 success
We can measure whether the system is actually right.

---

## 7. Out of Scope for Now

- vector DB / embeddings-first infrastructure
- generic “AI for all spreadsheet tasks” positioning
- cloud multi-user collaboration
- enterprise deployment automation beyond local-first core
- broad feature work unrelated to document-to-Excel workflows

---

## 8. Summary

The implementation roadmap should move AgentXL from:

> chat shell inside Excel

to:

> folder-first, agentic-search, traceable document-to-Excel workflow

That is the actual product.

---

*Updated: March 8, 2026*