# AgentXL — User Flow

> User experience for the folder-first, document-to-Excel version of AgentXL.

---

## 1. Product UX in One Sentence

AgentXL lets a user **point to a local folder of source documents, ask a grounded question, review the answer with traceability, and map it into Excel**.

---

## 2. Who This Flow Is For

Primary wedge:
- auditors
- due diligence teams
- transaction support analysts
- compliance reviewers

Broader applicability:
- any user whose work starts in messy documents and ends in spreadsheets

The user is not looking for a generic Excel copilot.
The user is trying to complete evidence-heavy spreadsheet work faster and with more confidence.

---

## 3. First Touch

### 3.1 Discovery
A user sees AgentXL on GitHub, social media, or a referral and understands:

> **Turn source documents into traceable Excel workpapers.**

The story is:
- not “chat with your spreadsheet”
- not “AI for auditors only”
- but “document-heavy work that ends in Excel”

### 3.2 Install

```bash
npm install -g agentxl
agentxl start
```

The CLI should make the first run feel simple and finite.

---

## 4. First Run

### 4.1 CLI setup
Current CLI flow:
- authenticate if needed
- create/trust localhost certificate
- start the local server
- print next steps

The user sees:
- auth ready
- certificate ready
- server running

### 4.2 Browser verification
User opens:
- `https://localhost:3001/taskpane/`

This confirms:
- server works
- cert is trusted
- taskpane UI is reachable

### 4.3 Excel setup
One-time sideloading via Trusted Add-in Catalog:
1. open Excel settings
2. add catalog path
3. restart Excel
4. insert AgentXL add-in

---

## 5. First Meaningful Product Moment

The first meaningful moment should not be:
> “Ask about your spreadsheet.”

It should be:
> **Choose the folder with the supporting documents.**

### Ideal first-run taskpane state
The user opens AgentXL in Excel and sees:
- workbook context is available
- primary call to action: choose a local folder
- concise explanation that AgentXL searches source files and maps answers into Excel

### Desired emotional outcome
**Relief**

The user should feel:
- “Finally, I don't have to hunt through these files manually.”
- “I can see where the answer came from.”
- “This will help me populate or review the workbook faster.”

---

## 6. Canonical User Flow

### 6.1 Open workbook
The user opens the Excel workbook they want to populate, reconcile, or review.

### 6.2 Open AgentXL
The user clicks the AgentXL button on the Excel ribbon.

### 6.3 Select folder
The user points AgentXL at a local folder containing source files such as:
- PDFs
- CSV exports
- XLSX support files
- statements
- agreements
- support schedules

### 6.4 Folder scan / inventory
AgentXL scans the folder and shows:
- folder path
- number of files
- supported file types
- scan / ready state

### 6.5 Ask a grounded question
Examples:
- “Compare this trial balance folder to the lead sheet and flag mismatches.”
- “Extract the ending cash balance from the bank statement folder and map it to the cash workpaper.”
- “Pull lease terms from these agreements into the lease schedule.”
- “Show me which workbook cells came from which source files.”

### 6.6 Agentic search
AgentXL:
- searches the folder
- selects relevant files
- reads the right documents
- extracts or compares the required information

### 6.7 Review result
Before writing to Excel, the user should be able to inspect:
- grounded answer
- source files used
- page / section / table references where available
- any exceptions or uncertainties

### 6.8 Confirm mapping
The user chooses to:
- write the answer into Excel
- revise the instruction
- inspect more traceability
- cancel

### 6.9 Write to Excel
Taskpane executes the workbook changes via Office.js.

### 6.10 Traceability available after write
Later, the user should still be able to ask:
- “Which file did this cell come from?”
- “Why was this value written here?”
- “What support was used?”

---

## 7. Core Taskpane States

### 7.1 Loading
Used while connecting to the local server.

### 7.2 Unauthenticated
Shown when no provider auth exists.
User is told to run:
```bash
agentxl login
```

### 7.3 No folder selected
Primary state for authenticated first use.
Main CTA:
> **Choose a folder of source documents**

### 7.4 Scanning folder
The taskpane shows:
- selected path
- progress / activity
- supported files found

### 7.5 Ready for question
Folder selected and workbook context available.
The user can now ask grounded questions.

### 7.6 Searching files
AgentXL shows that it is looking through the folder.

### 7.7 Reading files
AgentXL shows which documents are being opened or inspected.

### 7.8 Answer ready
The user sees the grounded answer with source traceability.

### 7.9 Mapping ready
The output is ready to be written into Excel.

### 7.10 Written to workbook
The user sees success confirmation and traceability remains available.

### 7.11 Error states
Examples:
- folder unavailable
- unsupported file type
- no relevant evidence found
- workbook target unclear
- model / network error

---

## 8. Welcome Experience

### Current implementation
Current taskpane still behaves more like a chat shell.
This is a transitional state.

### Target welcome screen
The welcome screen should communicate:

- **primary action:** choose a folder
- **secondary action:** ask a grounded question
- **trust signal:** data stays local except prompt content sent to chosen model provider

### Good copy direction
- “Choose the folder with your supporting documents”
- “Search the evidence and map the result into Excel”
- “Trace every output back to source files”

### Bad copy direction
- “What do you want to do with this data?”
- “Ask about your spreadsheet”
- “Create charts and formulas”

---

## 9. Input Experience

The input should frame the job correctly.

### Good placeholder territory
- “Ask about the selected document folder…”
- “Ask a grounded question about your source files…”
- “Search the folder and map the answer into Excel…”

### Bad placeholder territory
- “Ask about your spreadsheet…”

---

## 10. Review Experience

A critical UX requirement is reviewability before write.

Before any important workbook change, the user should see:
- proposed output
- destination sheet/range
- source file references
- confidence / caveat indicators where helpful

The product should feel trustworthy, not magical.

---

## 11. Example End-to-End Flows

### 11.1 Trial balance vs lead sheet
1. user opens lead sheet workbook
2. user selects folder with trial balance exports
3. user asks for mismatch analysis
4. AgentXL finds the relevant export files
5. AgentXL compares source numbers to workbook values
6. user reviews mismatch list
7. user writes exception list into Excel

### 11.2 Bank statement to cash workpaper
1. user opens cash workpaper workbook
2. user selects bank statement folder
3. user asks for ending cash balance mapping
4. AgentXL finds the statement
5. AgentXL extracts the value and cites the source
6. user confirms target cell
7. AgentXL writes the value into Excel

### 11.3 Agreement to lease schedule
1. user opens lease schedule workbook
2. user selects folder with agreements
3. user asks for start date, end date, monthly payment
4. AgentXL reads relevant agreements
5. AgentXL structures the extracted fields
6. user reviews mapping preview
7. AgentXL writes rows into the schedule

---

## 12. Trust and Objection Handling

The #1 objection is usually:
> **Can I trust where this number came from?**

The flow must answer this early by showing:
- source files used
- exact references when possible
- explicit review before workbook write
- local-first behavior

---

## 13. Daily Use Flow

### Current daily flow
```bash
agentxl start
```
Then:
- open Excel
- launch AgentXL
- use the taskpane

### Target daily flow
1. start AgentXL
2. open workbook
3. select or reuse last document folder
4. ask question
5. review grounded answer
6. map result into Excel

A strong product eventually makes step 3 almost frictionless through folder memory / recent folders.

---

## 14. Current vs Target UX

| Area | Current | Target |
|------|---------|--------|
| Primary interaction | chat shell | folder-first workflow |
| Prompt framing | spreadsheet-centric | document/evidence-centric |
| Welcome screen | generic quick actions | choose folder + grounded tasks |
| Result model | assistant response | grounded answer + traceability + mapping preview |
| Trust model | conversational | reviewable, evidence-backed |

---

## 15. Success Criteria

The user flow is working when a user can:
1. choose a local folder
2. ask a grounded question
3. see which files were used
4. verify where the answer came from
5. write the result into Excel
6. later trace workbook outputs back to source files

The user flow is excellent when this feels faster and safer than manually opening files and copying values.

---

## 16. Summary

AgentXL’s UX should feel like a calm, high-trust workspace for turning source documents into Excel outputs.

It should start from the **folder**, not from generic spreadsheet chat.

---

*Updated: March 8, 2026*