/**
 * Single Excel custom tool — the agent writes Office.js code,
 * the taskpane executes it in the active workbook.
 *
 * This replaces the 10-tool approach with one flexible tool:
 * the agent has full Office.js API access and gets real results back.
 */

import { Type } from "@sinclair/typebox";
import { registerPendingExecution } from "../../server/excel-bridge.js";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

/**
 * The `excel` tool definition.
 *
 * The agent sends Office.js code that runs inside:
 *   Excel.run(async (context) => { <code here> })
 *
 * The code has access to `context` (the Excel RequestContext).
 * It should return a value — the return value is sent back to the agent.
 *
 * Common patterns the agent should use:
 * - Read:  context.workbook.worksheets.getActiveWorksheet().getRange("A1:D10").load("values"); await context.sync(); return range.values;
 * - Write: context.workbook.worksheets.getActiveWorksheet().getRange("A1").values = [["Hello"]]; await context.sync();
 * - Chart: const sheet = context.workbook.worksheets.getActiveWorksheet(); const chart = sheet.charts.add("ColumnClustered", sheet.getRange("A1:B5")); await context.sync();
 */
export const excelTool: ToolDefinition = {
  name: "excel",
  label: "Excel",
  description: `Execute Office.js code in the user's active Excel workbook.

The code runs inside Excel.run(async (context) => { ... }).
You have access to \`context\` (Excel.RequestContext).

IMPORTANT RULES:
- Always call \`await context.sync()\` after loading properties or making changes.
- To read properties, call \`.load("propertyName")\` then \`await context.sync()\` before accessing.
- Return a value to send results back (e.g., cell values, sheet names).
- For writes, return a confirmation string describing what was written.
- Do NOT use \`range.note\` or \`cell.note\` for citations/comments. In this runtime, use \`worksheet.comments.add(cellAddress, content)\`.

COMMON PATTERNS:

Read cell values:
\`\`\`
const range = context.workbook.worksheets.getActiveWorksheet().getRange("A1:D10");
range.load("values");
await context.sync();
return range.values;
\`\`\`

Write values:
\`\`\`
const sheet = context.workbook.worksheets.getActiveWorksheet();
sheet.getRange("A1").values = [["Revenue", "Q1", "Q2"], [100, 200, 300]];
await context.sync();
return "Wrote 2 rows to A1:C2";
\`\`\`

Add or replace a citation comment:
\`\`\`
const sheet = context.workbook.worksheets.getActiveWorksheet();
const address = "B5";
try {
  sheet.comments.getItemByCell(address).delete();
  await context.sync();
} catch {}
sheet.comments.add(address, "📄 Source: Lease.pdf\n📑 Page: 14\n💬 ...quoted excerpt...\n🤖 Extracted by AgentXL");
await context.sync();
return "Added citation comment to B5";
\`\`\`

Get all sheet names:
\`\`\`
const sheets = context.workbook.worksheets;
sheets.load("items/name");
await context.sync();
return sheets.items.map(s => s.name);
\`\`\`

Create a chart:
\`\`\`
const sheet = context.workbook.worksheets.getActiveWorksheet();
const chart = sheet.charts.add("ColumnClustered", sheet.getRange("A1:B5"), "Auto");
chart.title.text = "Sales";
await context.sync();
return "Created column chart from A1:B5";
\`\`\`

Format cells:
\`\`\`
const range = context.workbook.worksheets.getActiveWorksheet().getRange("A1:D1");
range.format.font.bold = true;
range.format.fill.color = "#4472C4";
range.format.font.color = "#FFFFFF";
await context.sync();
return "Formatted header row A1:D1";
\`\`\`

Add a worksheet:
\`\`\`
const sheet = context.workbook.worksheets.add("Summary");
sheet.activate();
await context.sync();
return "Added and activated worksheet 'Summary'";
\`\`\``,

  parameters: Type.Object({
    code: Type.String({
      description:
        "Office.js code to execute inside Excel.run(async (context) => { ... }). " +
        "Has access to `context` (Excel.RequestContext). Return a value to get results back.",
    }),
    description: Type.String({
      description:
        "Brief human-readable description of what this code does (shown in UI).",
    }),
  }),

  execute: async (toolCallId, params) => {
    // The actual execution happens in the taskpane via Office.js.
    // We register a pending execution and wait for the taskpane to
    // POST the result back to /api/excel/result.
    try {
      const result = await registerPendingExecution(toolCallId);
      return {
        content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result) }],
        details: {},
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        details: {},
      };
    }
  },
};
