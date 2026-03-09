/**
 * Office.js adapter — thin layer over the Office runtime.
 *
 * Isolates all `window.Office` / `window.Excel` probing
 * behind clean functions. No domain logic here.
 */

import type { ExcelContext, WorkbookIdentityInput } from "./api";

/** Extract workbook name from a URL or file path. */
export function getWorkbookNameFromUrl(
  url: string | null | undefined
): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\\/g, "/");
  const lastSegment = normalized.split("/").filter(Boolean).pop();
  return lastSegment && lastSegment.length > 0 ? lastSegment : null;
}

/**
 * Read the active Excel context (sheet name, selected range).
 * Returns undefined when Office.js is not available (browser preview).
 */
export async function readExcelContext(): Promise<ExcelContext | undefined> {
  try {
    const win = window as unknown as Record<string, unknown>;
    if (typeof win.Excel === "undefined") return undefined;

    const Excel = win.Excel as any;
    return await Excel.run(async (ctx: any) => {
      const sheet = ctx.workbook.worksheets.getActiveWorksheet();
      const range = ctx.workbook.getSelectedRange();
      sheet.load("name");
      range.load("address");
      await ctx.sync();
      return {
        activeSheet: sheet.name,
        selectedRange: range.address,
      };
    });
  } catch {
    return undefined;
  }
}

/**
 * Build workbook identity input from Office.js context.
 * Falls back to browser-based identity when Office.js is not available.
 */
export async function readWorkbookIdentityInput(): Promise<WorkbookIdentityInput> {
  const win = window as unknown as Record<string, unknown>;
  const office = (win.Office as any) ?? null;

  const workbookUrl =
    typeof office?.context?.document?.url === "string"
      ? office.context.document.url
      : null;
  let workbookName = getWorkbookNameFromUrl(workbookUrl);

  try {
    if (typeof win.Excel !== "undefined") {
      const Excel = win.Excel as any;
      const excelName = await Excel.run(async (ctx: any) => {
        const workbook = ctx.workbook;
        if (typeof workbook.load === "function") {
          workbook.load("name");
          await ctx.sync();
        }
        return typeof workbook.name === "string" ? workbook.name : null;
      });

      if (typeof excelName === "string" && excelName.trim().length > 0) {
        workbookName = excelName.trim();
      }
    }
  } catch {
    // Ignore Office.js failures — URL/browser fallback is enough.
  }

  return {
    workbookName: workbookName ?? document.title ?? "AgentXL Workbook",
    workbookUrl,
    host:
      typeof office?.context?.host === "string"
        ? office.context.host
        : "browser",
    source:
      typeof win.Excel !== "undefined" ? "excel-taskpane" : "browser-preview",
  };
}
