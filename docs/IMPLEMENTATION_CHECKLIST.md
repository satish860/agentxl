# AgentXL — Implementation Checklist

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

## Phase 1 — Workbook identity and folder linking

### 1. Workbook identity resolution
- [x] Add workbook identity resolution so every open workbook gets an AgentXL `workbookId`

**Acceptance test**
- Taskpane opens in Excel
- Taskpane sends workbook context to server
- Server returns a stable `workbookId`
- Reopening the same workbook returns the same `workbookId` under the same conditions

**Expected outcome**
- AgentXL can uniquely refer to “this workbook” in later APIs

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
- Taskpane can ask: “Does this workbook already have a linked folder?”

---

### 4. Taskpane folder-linking flow
- [x] Add a no-folder state and ready state in the taskpane

**Acceptance test**
- If no folder is linked, taskpane shows a primary “Choose folder” flow
- If a folder is linked, taskpane shows ready state immediately
- User can change/relink the folder from the UI

**Expected outcome**
- Ribbon click now leads to the correct folder-first experience

---

## Phase 2 — Folder scanning and agent context

### 5. Folder scanning and file inventory
- [ ] Add recursive folder scanning and basic file inventory

**Acceptance test**
- Selecting a folder returns file count
- Supported files are detected correctly
- Inventory includes file name, path, extension, size, and modified time
- Rescanning updates the inventory

**Expected outcome**
- AgentXL understands what files are available in the selected folder

---

### 6. Folder-aware agent requests
- [ ] Make `/api/agent` resolve folder context from `workbookId`

**Acceptance test**
- Agent request with valid `workbookId` includes linked folder context on the server side
- Agent request with no linked folder returns a clear error or actionable response
- Folder context is not required to be manually re-entered in every prompt

**Expected outcome**
- The Pi-backed agent knows which folder belongs to the active workbook

---

### 7. Basic document tools for the agent
- [ ] Add initial document tools for listing, inspecting, reading, and searching files

**Acceptance test**
- Agent can list files in the linked folder
- Agent can inspect file metadata
- Agent can read supported files
- Agent can search for likely relevant files before deeper reads

**Expected outcome**
- Agent can work with evidence files instead of only workbook context

---

## Phase 3 — Review and traceability

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

### 9. Traceability record storage
- [ ] Store traceability records for workbook writes

**Acceptance test**
- After a write, the system stores workbook, sheet, range, value, source file, source reference, prompt, and timestamp
- A lookup by workbook + sheet + range returns the traceability record
- Traceability persists across server restarts

**Expected outcome**
- AgentXL can answer: “Where did this cell come from?”

---

## Phase 4 — Quality loop

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
5. [ ] Folder scanning and file inventory
6. [ ] Folder-aware agent requests
7. [ ] Basic document tools for the agent
8. [ ] Review-before-write flow
9. [ ] Traceability record storage
10. [ ] Benchmark fixtures
11. [ ] Pass/fail evaluation script
12. [ ] Failure analysis loop

---

## Next task to implement

**Task 5 — Folder scanning and file inventory**

Task 4 is complete. Do not start Task 6 until Task 5 passes acceptance testing.
