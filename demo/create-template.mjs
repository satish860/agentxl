/**
 * Generate the demo Excel workbook template.
 * Run: node demo/create-template.mjs
 */

import XLSX from "xlsx";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const headers = ["Metric", "FY 2025", "FY 2024", "Source"];
const rows = [
  ["Net Profit (₹ Cr)", "", "", ""],
  ["Total Deposits (₹ Cr)", "", "", ""],
  ["Total Advances (₹ Cr)", "", "", ""],
  ["Return on Assets (%)", "", "", ""],
  ["Earnings Per Share (₹)", "", "", ""],
  ["Dividend Per Share (₹)", "", "", ""],
  ["Balance Sheet Size (₹ Cr)", "", "", ""],
  ["Return on Equity (%)", "", "", ""],
];

const data = [headers, ...rows];
const ws = XLSX.utils.aoa_to_sheet(data);

// Set column widths
ws["!cols"] = [
  { wch: 28 }, // Metric
  { wch: 16 }, // FY 2025
  { wch: 16 }, // FY 2024
  { wch: 40 }, // Source
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "HDFC Summary");

const outPath = join(__dirname, "HDFC Bank Analysis.xlsx");
XLSX.writeFile(wb, outPath);
console.log(`✅ Created: ${outPath}`);
