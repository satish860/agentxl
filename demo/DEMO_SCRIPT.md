# AgentXL Demo — HDFC Bank Annual Report

## What you need

- AgentXL running (`agentxl start`)
- Excel open with AgentXL taskpane visible
- The `demo/evidence/` folder with the HDFC Bank PDFs
- Screen recorder (OBS, Windows Game Bar `Win+G`, or Loom)

## Recording setup

- Resolution: 1920×1080
- Show Excel + AgentXL taskpane side by side
- Keep it under 90 seconds
- No narration needed (captions are better for social/GitHub)

## Demo flow

### 1. Show the folder (5 sec)

Open File Explorer showing `demo/evidence/`:
- `HDFC-Bank-Integrated-Annual-Report-2024-25.pdf` (12 MB, 591 pages)
- `HDFC-Bank-Financial-Results-FY2025.pdf` (3.3 MB)

Point: "This is a real HDFC Bank annual report. 591 pages."

### 2. Open Excel with an empty workbook (5 sec)

Create a blank workbook or use the template:
- Sheet name: "HDFC Summary"
- Row 1 headers: A1=`Metric`, B1=`FY 2025`, C1=`FY 2024`, D1=`Source`
- Row 2: A2=`Net Profit (₹ Cr)`
- Row 3: A3=`Total Deposits (₹ Cr)`
- Row 4: A4=`Total Advances (₹ Cr)`
- Row 5: A5=`Return on Assets (%)`
- Row 6: A6=`Earnings Per Share (₹)`
- Row 7: A7=`Dividend Per Share (₹)`

### 3. Link the folder in AgentXL (10 sec)

In the taskpane:
- Paste or browse to the `demo/evidence/` folder path
- Click "Link folder"
- Wait for scan to complete (should show 2 supported files)

### 4. Ask the question (10 sec)

Type:

> Extract the key financial metrics from the HDFC Bank annual report — net profit, total deposits, total advances, ROA, EPS, and dividend per share for FY 2025 and FY 2024. Map them into the workbook starting at B2.

### 5. Watch the agent work (30-40 sec)

The agent will:
- Read the converted PDF markdown
- Find the financial highlights section
- Extract values with page references
- Show what it found in the response
- Write values into Excel with citation comments
- Create the `_AgentXL_Sources` sheet

### 6. Show the result (15 sec)

- Hover over a cell to show the citation comment
  (should show: Source file, page, excerpt)
- Click on the `_AgentXL_Sources` sheet to show the audit trail
- Done.

## Key moments to capture

1. **The folder** — real documents, not toy data
2. **The extraction** — agent reading a 591-page PDF
3. **The citation comment** — hover over a cell, see the source
4. **The Sources sheet** — full audit trail

## Fallback prompts (if the first one doesn't work perfectly)

- "What was HDFC Bank's net profit for FY 2025? Write it to B2 with a citation."
- "Compare HDFC Bank's deposits between FY 2025 and FY 2024. Map the values into B3 and C3."
- "Find the earnings per share from the annual report and write it to B6."

## Post-recording

- Trim dead time
- Add captions/subtitles (use CapCut, Descript, or similar)
- Export as MP4
- Upload to GitHub release or embed in landing page
