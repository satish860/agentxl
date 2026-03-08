# AgentXL — Folder-First Product Spec

> Product spec for the document-first, agentic-search version of AgentXL.

---

## 1. Product Thesis

AgentXL helps users turn messy source documents into traceable Excel outputs.

The product is not “chat with Excel.”
The product is:

- point to a local folder of documents
- search the evidence
- read the right files
- answer grounded questions
- map the result into Excel
- preserve traceability back to source files

### Positioning
Built for audit and diligence workflows first — useful anywhere document-heavy work ends in spreadsheets.

### Category
**Document-to-Excel agent**

### Primary emotional outcome
**Relief**

The user should feel:
- less manual copy/paste
- less hunting through folders
- less uncertainty about where a number came from
- more confidence during review

---

## 2. Problem

Today, evidence-heavy spreadsheet work usually looks like this:

1. user receives a folder of PDFs, statements, exports, agreements, support files
2. user opens documents manually
3. user searches for relevant numbers / clauses / tables
4. user copies values into Excel
5. user re-checks where each number came from
6. reviewer asks for support and user hunts for the source again

This is slow, repetitive, and error-prone.

### Existing tools fail in predictable ways
- generic Excel copilots start from the workbook, not the evidence folder
- OCR / extraction tools often stop before structured Excel mapping
- classic RAG stacks add complexity too early
- many AI demos lack traceability and reviewability

---

## 3. Design Principles

Derived from `C:\Source\Business\productdesign.md` and the product vision:

1. **Lead with the outcome**
   - turn documents into traceable Excel workpapers
2. **One primary action**
   - point AgentXL at the local folder
3. **Pain-first framing**
   - stop manual evidence hunting and copy/paste
4. **Evidence over chat**
   - show files, sources, and mappings
5. **Traceability over magic**
   - every important output should be explainable
6. **Method over stack**
   - parse, search, ask, evaluate, fix, repeat
7. **Reviewability over full automation**
   - human can verify before writing to workbook

---

## 4. Non-Goals

Not in scope for the initial product:

- enterprise document management
- cloud sync / shared multi-user workspaces
- embeddings/vector DB as a required foundation
- generic AI assistant for all Excel tasks
- autonomous spreadsheet editing without review in evidence-heavy workflows

---

## 5. Primary Users

### Primary wedge users
- auditors
- due diligence teams
- transaction support analysts
- compliance reviewers

### Adjacent users
- finance ops
- fund operations
- legal ops doing document-to-sheet workflows
- analysts working from support folders into Excel

### User definition
The first user is someone who:
- receives a local folder of supporting files
- works in Excel as the output surface
- needs answers grounded in evidence
- cares where the number came from

---

## 6. Core User Job

> “I have a folder full of source documents and an Excel workbook to populate or check. Help me find the evidence, extract the right facts, and map them into the workbook with traceability.”

---

## 7. Core Workflow

### Canonical flow
1. User opens Excel and launches AgentXL
2. User selects or confirms the target workbook / sheet context
3. User points AgentXL at a **local folder**
4. AgentXL scans folder structure and file metadata
5. User asks a question or gives an instruction
6. AgentXL searches the folder agentically
7. AgentXL reads the most relevant files
8. AgentXL prepares a grounded answer with source traceability
9. User reviews result
10. User maps / confirms writing into Excel
11. AgentXL writes the output and stores traceability metadata

### Example instructions
- “Extract the ending cash balance from this bank statement folder and map it to the cash workpaper.”
- “Compare this trial balance folder to the lead sheet and flag mismatches.”
- “Pull lease start date, end date, and monthly payment from these agreements into the lease schedule.”
- “Show me which cells came from which source files.”

---

## 8. UX Requirements

### 8.1 First-run screen
Must communicate one primary action:

> **Choose a folder of source documents**

Not:
- “Ask about your spreadsheet”
- “What do you want to do with this data?”

### 8.2 Main taskpane layout
Recommended regions:

#### A. Folder / source panel
- selected folder path
- file count
- file type badges
- indexing / scan status
- refresh folder action

#### B. Ask / result panel
- prompt input
- grounded result
- reasoning summary (short, not verbose)
- source citations / supporting files

#### C. Mapping / workbook panel
- target workbook / sheet / range
- mapping preview
- write to Excel action
- traceability / linked cells
- exception list

### 8.3 Core states
- no folder selected
- scanning folder
- ready for question
- searching files
- reading files
- answer ready for review
- mapping ready
- written to workbook
- error / unsupported file / missing evidence

---

## 9. Functional Requirements

### 9.1 Folder selection
The user must be able to:
- choose a local folder
- see the selected path
- reselect / change folder
- refresh the folder contents

### 9.2 File inventory
System should capture:
- relative path
- file name
- file type
- file size
- modified time
- parse status

### 9.3 Supported file types (initial target)
- PDF
- CSV
- XLSX
- TXT / MD

Possible later:
- DOCX
- images with OCR
- email formats

### 9.4 Agentic search behavior
System should:
- inspect file names and folder structure first
- use metadata and light parsing before deep reads
- read only the relevant files when possible
- follow leads across documents when needed
- return which files were searched / read

### 9.5 Grounded answering
Answers should:
- cite source file(s)
- include page / section / table references where available
- distinguish between extracted fact vs inferred conclusion
- avoid unsupported claims

### 9.6 Excel mapping
System should be able to:
- map a value to a target cell or range
- map structured rows into a schedule/table
- create exception lists
- format review-ready outputs
- preserve source traceability metadata

### 9.7 Traceability
For each mapped output, store enough metadata to answer:
- which file did this come from?
- where in the file was it found?
- what prompt / extraction instruction produced it?
- when was it written?

### 9.8 Review flow
Before writing to Excel, user should be able to:
- inspect the answer
- inspect the source citations
- confirm or cancel the write

---

## 10. System Approach

### 10.1 Retrieval philosophy
Do **not** start with classic RAG.

Initial approach:
- local file enumeration
- direct parsing
- agentic file search
- selective reading
- grounded prompting
- explicit evaluation loop

### 10.2 Why
Because the problem is not “semantic search over a corpus.”
The problem is:
- finding the right file in a messy folder
- extracting the right detail
- reconciling across files
- producing a reviewable spreadsheet output

### 10.3 When heavier infra is allowed
Only add embeddings / vector DB / larger retrieval systems if:
- real eval data shows search quality limits
- folder size / latency becomes a real bottleneck
- semantic retrieval materially outperforms direct search for target tasks

---

## 11. Proposed Internal Modules

### Server-side
- `folder-service`
  - select, validate, refresh, enumerate files
- `parser-service`
  - extract text / tables from supported formats
- `search-service`
  - file metadata search, filename search, content search, ranking
- `trace-service`
  - source references for extracted facts and written workbook outputs
- `mapping-service`
  - translate grounded results into workbook write operations
- `eval-service`
  - benchmarks, pass/fail checks, failure pattern analysis

### Taskpane-side
- folder picker UI
- file inventory UI
- evidence/result viewer
- mapping preview UI
- workbook execution UI

---

## 12. Proposed API / Event Shape

### 12.1 Folder selection endpoint
```json
POST /api/folder/select
{
  "path": "C:\\Users\\user\\Documents\\Audit Pack"
}
```

Response:
```json
{
  "folderId": "folder_123",
  "path": "C:\\Users\\user\\Documents\\Audit Pack",
  "fileCount": 42,
  "supportedFileCount": 39
}
```

### 12.2 Folder status endpoint
```json
GET /api/folder/status
```

Response:
```json
{
  "selected": true,
  "path": "C:\\Users\\user\\Documents\\Audit Pack",
  "fileCount": 42,
  "indexedAt": "2026-03-08T11:00:00Z"
}
```

### 12.3 Agent request
```json
POST /api/agent
{
  "message": "Compare this trial balance folder to the lead sheet and flag mismatches.",
  "context": {
    "folderId": "folder_123",
    "activeSheet": "Lead Sheet",
    "selectedRange": "A1:H40"
  }
}
```

### 12.4 Streaming events to expose in UI
- `folder_scan_start`
- `folder_scan_end`
- `file_search_start`
- `file_search_hit`
- `file_read_start`
- `file_read_end`
- `grounded_answer_ready`
- `mapping_preview_ready`
- `excel_instruction`
- `traceability_written`
- `error`

---

## 13. Evaluation Strategy

Evaluation is a first-class requirement.

### 13.1 Principle
**Evals are Level 0.**

### 13.2 Benchmark format
Create benchmark sets with:
- folder fixture
- user question / instruction
- expected answer structure
- expected source file(s)
- expected target workbook mapping

### 13.3 What to measure
- source file selection accuracy
- extraction accuracy
- table/field normalization accuracy
- mapping accuracy into workbook ranges
- traceability completeness
- exception detection quality

### 13.4 Failure analysis
Track patterns such as:
- wrong file chosen
- wrong table chosen
- date normalization errors
- currency / sign errors
- cross-document mismatch logic errors
- traceability missing or incomplete

### 13.5 Improvement loop
**Parse → Search → Ask → Evaluate → Fix → Repeat**

---

## 14. Milestones

### Milestone 1 — Folder-first shell
- folder selection works
- file inventory visible
- taskpane copy updated to document-first language
- API knows selected folder

### Milestone 2 — Agentic file search
- filename / metadata search
- selective file reading
- grounded answers with cited files

### Milestone 3 — Excel mapping
- preview mapping results
- write into workbook
- show per-cell traceability

### Milestone 4 — Reconciliation workflows
- compare folder evidence to workbook ranges
- generate exception lists
- support trial balance / lead sheet style checks

### Milestone 5 — Eval loop
- benchmark fixtures
- pass/fail evaluation script
- failure categories
- iterative quality improvements

---

## 15. Acceptance Criteria

The product is directionally correct when a user can:

1. point AgentXL at a local folder
2. ask a question grounded in that folder
3. see which files were used
4. review the answer with source traceability
5. write the answer into Excel
6. later inspect which workbook values came from which source files

The product is excellent when this feels simpler than manually opening files and copying values.

---

## 16. Open Questions

1. How should folder selection work inside an Excel WebView across Windows and Mac?
2. Should the CLI support passing a default folder path on launch?
3. How do we persist folder history locally and safely?
4. Where should traceability metadata live for workbook writes?
5. What is the minimum supported parsing stack for PDFs and XLSX?
6. How much pre-processing is acceptable before first answer latency feels bad?
7. Should source snippets be stored or generated on demand?

---

## 17. Summary

AgentXL should be built as a **folder-first, agentic-search, document-to-Excel product**.

Not a generic spreadsheet copilot.
Not a classic RAG demo.

The product starts with evidence, ends in Excel, and earns trust through traceability and evals.

---

*Created: March 8, 2026*