# AgentXL - Implementation Checklist

> Canonical execution checklist for the folder-first, document-to-Excel workflow.
>
> Rule: **do one task at a time**. A task is only marked complete when its **acceptance test passes**.

---

## Working Agreement

- Complete tasks **sequentially**.
- Do **not** start the next task until the current one passes acceptance testing.
- Every task should produce a user-visible improvement, API capability, or durable system behavior.
- When a task is done, change `[ ]` to `[x]` in this file.

---

## Phase 1 - Workbook identity and folder linking

### 1. Workbook identity resolution
- [x] Add workbook identity resolution so every open workbook gets an AgentXL `workbookId`

**Acceptance test**
- Taskpane opens in Excel
- Taskpane sends workbook context to server
- Server returns a stable `workbookId`
- Reopening the same workbook returns the same `workbookId` under the same conditions

**Expected outcome**
- AgentXL can uniquely refer to "this workbook" in later APIs

---

### 2. Workbook → folder mapping storage
- [x] Add local server-side storage for `workbookId -> folderPath`

**Acceptance test**
- Server can save a folder path for a given `workbookId`
- Server can load that folder path later
- Updating the folder path overwrites the previous mapping
- Mapping persists across server restarts

**Expected outcome**
- AgentXL can remember which evidence folder belongs to which workbook

---

### 3. Folder status API
- [x] Add folder status endpoints for the current workbook

**Acceptance test**
- `GET /api/folder/status` returns linked/not-linked state for a valid `workbookId`
- `POST /api/folder/select` stores a folder for a valid `workbookId`
- Invalid requests return clear errors

**Expected outcome**
- Taskpane can ask: "Does this workbook already have a linked folder?"

---

### 4. Taskpane folder-linking flow
- [x] Add a no-folder state and ready state in the taskpane

**Acceptance test**
- If no folder is linked, taskpane shows a primary "Choose folder" flow
- If a folder is linked, taskpane shows ready state immediately
- User can change/relink the folder from the UI

**Expected outcome**
- Ribbon click now leads to the correct folder-first experience

---

## Phase 2 - Folder scanning and agent context

### 5. Folder scanning and file inventory
- [x] Add recursive folder scanning and basic file inventory

**Acceptance test**
- Selecting a folder returns file count
- Supported files are detected correctly
- Inventory includes file name, path, extension, size, and modified time
- Rescanning updates the inventory

**Expected outcome**
- AgentXL understands what files are available in the selected folder

---

### 6. Folder-aware agent requests
- [x] Make `/api/agent` resolve folder context from `workbookId`

**Acceptance test**
- Agent request with valid `workbookId` includes linked folder context on the server side
- Agent request with no linked folder returns a clear error or actionable response
- Folder context is not required to be manually re-entered in every prompt

**Expected outcome**
- The Pi-backed agent knows which folder belongs to the active workbook

---

### 7. Basic document tools for the agent
- [x] Add initial document tools for listing, inspecting, reading, and searching files

**Resolution:** Pi SDK's built-in `readOnlyTools` (read, grep, find, ls) already provide
full file access. Session `cwd` is set to the linked folder so tools operate on the
user's documents. Tool calls are visible in the UI as live badges. No custom tools needed.

**Acceptance test**
- Agent can list files in the linked folder ✅ (ls with cwd set to linked folder)
- Agent can inspect file metadata ✅ (ls, find)
- Agent can read supported files ✅ (read tool)
- Agent can search for likely relevant files before deeper reads ✅ (grep, find)

**Expected outcome**
- Agent can work with evidence files instead of only workbook context

---

## Phase 3 — Citations and traceability

> Full task breakdown: [`docs/CITATIONS.md`](./CITATIONS.md)

### Layer 1 — Citation-aware extraction (prompt-driven)
- [ ] 1.1 Update extraction prompt to require `{ value, source, page, excerpt }` tuples
- [ ] 1.2 Teach extraction scripts to track page numbers from PDF markdown
- [ ] 1.3 Teach extraction scripts to capture surrounding context (~150 chars)

### Layer 2 — Excel-native citations (works without taskpane)
- [ ] 2.1 Agent adds Excel comments with citation on every write
- [ ] 2.2 Agent creates/updates `_AgentXL_Sources` worksheet
- [ ] 2.3 Sources sheet formatting (header, column widths, auto-filter)
- [ ] 2.4 Citation prompt integration in `folder-context.ts` (default behavior)
- [ ] 2.5 Handle "no citation available" — inferred values marked distinctly

### Layer 3 — Taskpane citation panel (rich UX)
- [ ] 3.1 Server-side citation store (`~/.agentxl/citations/<workbookId>.json`)
- [ ] 3.2 Taskpane citation panel UI (value, source, page, excerpt, confidence)
- [ ] 3.3 Cell selection listener (Office.js `onSelectionChanged` → query citations)
- [ ] 3.4 "Open source file" action
- [ ] 3.5 Citation list view (all citations, filterable)
- [ ] 3.6 Citation export (JSON/CSV)

**Implementation order:** Phase A (1.1 → 2.4 → 2.1 → 2.2) → Phase B (1.2 → 1.3 → 2.3 → 2.5) → Phase C (3.1–3.6)

**Success criteria:**
- Every cell written by the agent has an Excel comment citing the source
- `_AgentXL_Sources` sheet provides a portable audit trail
- An auditor can trace any value WITHOUT the taskpane running

---

### 8. Review-before-write flow
- [ ] Add mapping preview before Excel writes happen

**Acceptance test**
- Agent returns grounded answer plus proposed workbook destination
- Taskpane shows mapping preview before write
- User can confirm or cancel the write
- Excel is only modified after explicit confirmation

**Expected outcome**
- The product becomes reviewable and trustworthy before workbook changes

---

## Phase 4 - Quality loop

### 10. Benchmark fixtures
- [ ] Add benchmark fixtures for document-to-Excel tasks

**Acceptance test**
- Benchmark cases can be defined with folder fixture, prompt, expected answer, and expected mapping
- Benchmarks can be run repeatedly

**Expected outcome**
- We have repeatable test cases for real workflows

---

### 11. Pass/fail evaluation script
- [ ] Add explicit pass/fail evaluation for extraction and mapping tasks

**Acceptance test**
- Evaluation reports pass/fail for benchmark cases
- Failures identify which part broke (file selection, extraction, mapping, traceability)

**Expected outcome**
- We can measure whether the system is actually correct

---

### 12. Failure analysis loop
- [ ] Add failure categorization and improvement workflow

**Acceptance test**
- Repeated failures can be grouped by pattern
- The system or developer workflow can identify the dominant error types

**Expected outcome**
- Quality improves through structured iteration, not guesswork

---

## Current execution order

1. [x] Workbook identity resolution
2. [x] Workbook → folder mapping storage
3. [x] Folder status API
4. [x] Taskpane folder-linking flow
5. [x] Folder scanning and file inventory
6. [x] Folder-aware agent requests
7. [x] Basic document tools for the agent (covered by Pi SDK readOnlyTools + cwd)
8. [ ] Review-before-write flow
9. [ ] Traceability record storage
10. [ ] Benchmark fixtures
11. [ ] Pass/fail evaluation script
12. [ ] Failure analysis loop

---

## Next task to implement

**Task 8 - Review-before-write flow**

Task 7 is complete. Do not start Task 9 until Task 8 passes acceptance testing.
