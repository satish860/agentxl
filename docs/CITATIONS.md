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

- [ ] **1.1 — Update extraction prompt to require citation tuples**
  - Every extraction script must return `{ value, source, page, excerpt }` per field
  - Agent must not write values to Excel without citation metadata
  - Example output format:
    ```json
    {
      "leaseTerm": {
        "value": "12 months",
        "source": "Operating Lease (Aircraft 2).pdf",
        "page": 14,
        "excerpt": "...the lease term shall be twelve (12) months from the Delivery Date..."
      },
      "returnLocation": {
        "value": "Chennai, India",
        "source": "Operating Lease (Aircraft 2).pdf",
        "page": 42,
        "excerpt": "...Aircraft shall be redelivered to Lessor at Chennai International Airport..."
      }
    }
    ```
  - **Acceptance test:** agent extracts 3+ fields from test documents, every field has source + excerpt

- [ ] **1.2 — Teach extraction scripts to track page numbers**
  - PDF markdown has page breaks (`---` separators from converter)
  - Script counts page breaks to determine which page a match came from
  - For XLSX: track sheet name + cell reference
  - For DOCX: track section/heading
  - **Acceptance test:** page numbers in citations match actual PDF pages

- [ ] **1.3 — Teach extraction scripts to capture surrounding context**
  - Excerpt should be ~100-200 chars around the matched value
  - Include enough context that an auditor can verify without opening the source file
  - **Acceptance test:** excerpts are meaningful and include the extracted value in context

---

## Layer 2 — Excel-native citations

> Citations live IN the workbook — portable, works without AgentXL running.

### Tasks

- [ ] **2.1 — Agent adds Excel comments with citation on every write**
  - After writing a value to a cell, agent adds a Note (comment) via Office.js:
    ```
    📄 Source: Operating Lease (Aircraft 2).pdf
    📑 Page: 14
    💬 "...the lease term shall be twelve (12) months from the Delivery Date..."
    🤖 Extracted by AgentXL
    ```
  - Comment format is compact but readable
  - **Acceptance test:** every cell written by the agent has a comment with source info

- [ ] **2.2 — Agent creates/updates a "Sources" worksheet**
  - Auto-created worksheet named `_AgentXL_Sources` (underscore prefix = convention for system sheets)
  - Columns: `Target Sheet | Target Cell | Value | Source File | Page | Excerpt | Timestamp`
  - Appended to (not overwritten) on each extraction
  - Frozen header row, auto-filter enabled
  - **Acceptance test:** Sources sheet exists after first extraction, contains one row per written cell

- [ ] **2.3 — Sources sheet formatting**
  - Header row: bold, colored background
  - Source File column: wrapped text
  - Excerpt column: wrapped text, wider column
  - Timestamp: ISO format
  - **Acceptance test:** Sources sheet is readable without manual formatting

- [ ] **2.4 — Citation prompt integration**
  - Update `folder-context.ts` prompt to instruct the agent:
    1. Extract with citations (Layer 1)
    2. Write value to target cell
    3. Add Excel comment with citation
    4. Append row to `_AgentXL_Sources` sheet
  - This must be the DEFAULT behavior, not opt-in
  - **Acceptance test:** end-to-end test — ask agent to extract a value → cell has value + comment + Sources row

- [ ] **2.5 — Handle "no citation available" gracefully**
  - If the agent infers a value but can't cite a specific source, the comment should say:
    ```
    ⚠️ Inferred — no direct source citation available
    🤖 Extracted by AgentXL
    ```
  - Sources sheet marks the row as `Inferred` in a Status column
  - **Acceptance test:** inferred values are visually distinct from cited values

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
