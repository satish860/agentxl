# AgentXL — Citation & Traceability System

> Every value the agent writes to Excel must trace back to: **source file → page/section → exact excerpt.**
>
> This is what makes AgentXL workpapers auditable. Without citations, it's just another AI copilot.

---

## Architecture

```
Layer 1: Extraction (code-first)
  Script reads documents → returns { value, citation } tuples

Layer 2: Excel-native citations (works without taskpane)
  Cell comment + Sources sheet — portable, auditable

Layer 3: Taskpane citation panel (rich UX)
  Click a cell → see full citation with context + link to source
```

---

## Layer 1 — Citation-aware extraction

> The extraction scripts return citation metadata alongside every value.

### Tasks

- [x] **1.1 — Update extraction prompt to require citation tuples**
  - Every extraction script must return `{ value, source, page, excerpt }` per field
  - Agent must not write values to Excel without citation metadata
  - Inferred values marked with `"source": "INFERRED"` and reasoning
  - **Done:** prompt in `folder-context.ts` teaches exact JSON format with example

- [x] **1.2 — Teach extraction scripts to track page numbers**
  - PDF markdown has page breaks (`---` separators from converter)
  - Prompt includes `getPage()` helper that counts `---` separators
  - For XLSX: sheet name + cell reference
  - For DOCX: section heading
  - **Done:** example script in prompt includes page counting function

- [x] **1.3 — Teach extraction scripts to capture surrounding context**
  - Prompt includes `getExcerpt()` helper: ~75 chars before + after match
  - Trims to word boundaries, adds `...` if truncated
  - **Done:** example script in prompt includes excerpt extraction function

---

## Layer 2 — Excel-native citations

> Citations live IN the workbook — portable, works without AgentXL running.

### Tasks

- [x] **2.1 — Agent adds Excel comments with citation on every write**
  - Prompt teaches Office.js `cell.note` pattern with citation format:
    ```
    📄 Source: Operating Lease.pdf
    📑 Page: 14
    💬 "...the lease term shall be twelve (12) months..."
    🤖 Extracted by AgentXL
    ```
  - **Done:** prompt includes exact Office.js code for adding notes

- [x] **2.2 — Agent creates/updates a "Sources" worksheet**
  - Prompt teaches `_AgentXL_Sources` sheet creation with columns:
    `Target Sheet | Target Cell | Value | Source File | Page | Excerpt | Timestamp`
  - Append-only, auto-created if missing
  - **Done:** prompt includes full Office.js code for sheet creation + row append

- [x] **2.3 — Sources sheet formatting**
  - Header: bold, blue background (#4472C4), white text
  - Column widths set for readability
  - **Done:** formatting included in the prompt's sheet creation code

- [x] **2.4 — Citation prompt integration**
  - 3-step workflow is the DEFAULT in `folder-context.ts`:
    1. Extract with citations (bash script)
    2. Write values + comments (excel tool)
    3. Log to _AgentXL_Sources (excel tool)
  - Rules: "NEVER write without citation", "NEVER skip Sources entry"
  - **Done:** full workflow in `folder-context.ts`, ~160 lines of prompt

- [x] **2.5 — Handle "no citation available" gracefully**
  - Prompt teaches `"source": "INFERRED"` pattern
  - Comment format: `⚠️ Inferred — no direct source citation`
  - **Done:** inferred value handling included in prompt

---

## Layer 3 — Taskpane citation panel

> Rich citation UX — click a cell, see full provenance.

### Tasks

- [ ] **3.1 — Server-side citation store**
  - Persist citations per workbook: `~/.agentxl/citations/<workbookId>.json`
  - Schema:
    ```typescript
    interface Citation {
      id: string;
      targetSheet: string;
      targetCell: string;
      value: string;
      sourceFile: string;        // relative path in linked folder
      sourcePage: number | null;
      excerpt: string;
      confidence: "cited" | "inferred";
      timestamp: string;         // ISO
      promptSnippet?: string;    // what the user asked
    }
    ```
  - API: `POST /api/citations` (save), `GET /api/citations?workbookId=...&cell=...` (lookup)
  - **Acceptance test:** citations are persisted and queryable by cell reference

- [ ] **3.2 — Taskpane citation panel UI**
  - New tab/section in the taskpane below the chat
  - When user selects a cell in Excel, panel shows:
    - Value written by AgentXL
    - Source file name (with icon)
    - Page number
    - Excerpt with the matched value highlighted
    - Timestamp
    - Confidence badge: `Cited` (green) or `Inferred` (amber)
  - Empty state: "Select a cell to see its source citation"
  - **Acceptance test:** selecting a cell with a citation shows the panel populated

- [ ] **3.3 — Cell selection listener**
  - Office.js `onSelectionChanged` event handler
  - On selection change: read cell address → query citation API → update panel
  - Debounce rapid selection changes (200ms)
  - **Acceptance test:** rapidly clicking cells doesn't flood the server

- [ ] **3.4 — "Open source file" action**
  - Button in citation panel: "Open source file"
  - Opens the source file in the default application (via server-side `open` command)
  - API: `POST /api/citations/open-source` with file path
  - **Acceptance test:** clicking "Open source file" opens the PDF/document

- [ ] **3.5 — Citation list view**
  - Toggle between "selected cell" view and "all citations" list view
  - List view shows all citations for the current workbook, sorted by timestamp
  - Filterable by sheet, source file, confidence
  - **Acceptance test:** list view shows all citations with working filters

- [ ] **3.6 — Citation export**
  - "Export citations" button → downloads JSON or CSV of all citations
  - Useful for audit trail documentation
  - **Acceptance test:** exported file contains all citation records

---

## Implementation Order

```
Phase A — Foundation (prompt-driven, no new code)
  1.1 → 2.4 → 2.1 → 2.2

Phase B — Quality (extraction improvements)
  1.2 → 1.3 → 2.3 → 2.5

Phase C — Rich UX (taskpane panel)
  3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6
```

**Phase A is the priority.** It makes every extraction traceable with zero new infrastructure — just prompt guidance + the `excel` tool the agent already has.

Phase B improves citation quality (page accuracy, better excerpts).

Phase C adds the premium UX — but Phase A + B already deliver the core value proposition: **every cell has a source trail.**

---

## Success Criteria

### Phase A done
- Agent extracts values from documents and writes them to Excel
- Every written cell has an Excel comment citing the source
- A `_AgentXL_Sources` sheet exists with one row per written cell
- An auditor can trace any value back to its source WITHOUT the taskpane

### Phase B done
- Page numbers in citations are accurate
- Excerpts are meaningful (~150 chars of context)
- Inferred values are visually distinct from cited values

### Phase C done
- Click any cell → taskpane shows full citation with context
- "Open source file" jumps to the document
- Citation list view shows audit trail for the entire workbook
- Citations export to JSON/CSV for documentation

---

*Created: March 8, 2026*
