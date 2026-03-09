/**
 * Folder linking, scanning, and inventory routes.
 */

import { IncomingMessage, ServerResponse } from "http";
import { sendJson, sendError, parseJsonBody } from "../http.js";
import {
  getWorkbookFolderLink,
  setWorkbookFolderLink,
} from "../workbook-folder-store.js";
import { pickLocalFolder } from "../folder-picker.js";
import {
  scanAndSaveInventory,
  loadInventory,
} from "../folder-scanner.js";
import { convertDocuments } from "../document-converter.js";

/** GET /api/folder/status */
export function handleFolderStatus(
  req: IncomingMessage,
  res: ServerResponse
): void {
  const rawUrl = req.url ?? "/";
  const url = new URL(rawUrl, "https://localhost");
  const workbookId = url.searchParams.get("workbookId")?.trim();

  if (!workbookId) {
    sendError(res, 400, "Missing workbookId query parameter");
    return;
  }

  const link = getWorkbookFolderLink(workbookId);
  if (!link) {
    sendJson(res, 200, { workbookId, linked: false });
    return;
  }

  const inventory = loadInventory(workbookId);
  sendJson(res, 200, {
    workbookId,
    linked: true,
    folderPath: link.folderPath,
    link,
    ...(inventory
      ? {
          totalFiles: inventory.totalFiles,
          supportedFiles: inventory.supportedFiles,
        }
      : {}),
  });
}

/** POST /api/folder/pick */
export async function handleFolderPick(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await parseJsonBody(req);
    const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const initialPath =
      b && typeof b.initialPath === "string" ? b.initialPath : null;

    const folderPath = await pickLocalFolder(initialPath);
    sendJson(res, 200, {
      picked: Boolean(folderPath),
      folderPath,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to open native folder picker";
    const status = message.toLowerCase().includes("timed out") ? 504 : 500;
    sendError(res, status, message);
  }
}

/** POST /api/folder/select */
export async function handleFolderSelect(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await parseJsonBody(req);

  if (!body || typeof body !== "object") {
    sendError(res, 400, "Missing folder selection payload");
    return;
  }

  const b = body as Record<string, unknown>;
  const workbookId =
    typeof b.workbookId === "string" ? (b.workbookId as string).trim() : "";
  const folderPath =
    typeof b.folderPath === "string" ? (b.folderPath as string).trim() : "";

  if (!workbookId) {
    sendError(res, 400, "Missing workbookId in request body");
    return;
  }

  if (!folderPath) {
    sendError(res, 400, "Missing folderPath in request body");
    return;
  }

  try {
    const link = setWorkbookFolderLink({
      workbookId,
      folderPath,
      workbookName:
        typeof b.workbookName === "string" ? b.workbookName : null,
      workbookUrl:
        typeof b.workbookUrl === "string" ? b.workbookUrl : null,
      host: typeof b.host === "string" ? b.host : null,
      source: typeof b.source === "string" ? b.source : null,
    });

    // Auto-scan the folder on link/update
    let inventory = null;
    let conversion = null;
    try {
      inventory = scanAndSaveInventory(workbookId, link.folderPath);
      // Pre-convert PDFs to Markdown (non-blocking for response)
      conversion = await convertDocuments(inventory);
    } catch {
      // Scan/conversion failure is non-fatal — folder is still linked
    }

    sendJson(res, 200, {
      workbookId,
      linked: true,
      folderPath: link.folderPath,
      link,
      ...(inventory
        ? {
            totalFiles: inventory.totalFiles,
            supportedFiles: inventory.supportedFiles,
          }
        : {}),
      ...(conversion
        ? {
            pdfConverted: conversion.converted,
            pdfOcrConverted: conversion.ocrConverted,
            pdfCached: conversion.cached,
            pdfFailed: conversion.failed,
          }
        : {}),
    });
  } catch (error) {
    sendError(
      res,
      400,
      error instanceof Error ? error.message : "Failed to save folder mapping"
    );
  }
}

/** GET /api/folder/files */
export function handleFolderFiles(
  req: IncomingMessage,
  res: ServerResponse
): void {
  const rawUrl = req.url ?? "/";
  const url = new URL(rawUrl, "https://localhost");
  const workbookId = url.searchParams.get("workbookId")?.trim();

  if (!workbookId) {
    sendError(res, 400, "Missing workbookId query parameter");
    return;
  }

  const link = getWorkbookFolderLink(workbookId);
  if (!link) {
    sendError(
      res,
      404,
      "No folder linked for this workbook. Link a folder first."
    );
    return;
  }

  const inventory = loadInventory(workbookId);
  if (!inventory) {
    sendError(
      res,
      404,
      "No inventory available. Refresh the folder to scan files."
    );
    return;
  }

  sendJson(res, 200, {
    workbookId,
    folderPath: inventory.folderPath,
    scannedAt: inventory.scannedAt,
    totalFiles: inventory.totalFiles,
    supportedFiles: inventory.supportedFiles,
    files: inventory.files,
  });
}

/** POST /api/folder/refresh */
export async function handleFolderRefresh(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await parseJsonBody(req);

  if (!body || typeof body !== "object") {
    sendError(res, 400, "Missing request body");
    return;
  }

  const b = body as Record<string, unknown>;
  const workbookId =
    typeof b.workbookId === "string" ? (b.workbookId as string).trim() : "";

  if (!workbookId) {
    sendError(res, 400, "Missing workbookId in request body");
    return;
  }

  const link = getWorkbookFolderLink(workbookId);
  if (!link) {
    sendError(
      res,
      404,
      "No folder linked for this workbook. Link a folder first."
    );
    return;
  }

  try {
    const inventory = scanAndSaveInventory(workbookId, link.folderPath);

    // Pre-convert PDFs to Markdown
    let conversion = null;
    try {
      conversion = await convertDocuments(inventory);
    } catch {
      // Conversion failure is non-fatal
    }

    sendJson(res, 200, {
      workbookId,
      folderPath: inventory.folderPath,
      scannedAt: inventory.scannedAt,
      totalFiles: inventory.totalFiles,
      supportedFiles: inventory.supportedFiles,
      ...(conversion
        ? {
            pdfConverted: conversion.converted,
            pdfOcrConverted: conversion.ocrConverted,
            pdfCached: conversion.cached,
            pdfFailed: conversion.failed,
          }
        : {}),
    });
  } catch (error) {
    sendError(
      res,
      500,
      error instanceof Error ? error.message : "Failed to scan folder"
    );
  }
}
