import { readdirSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const root = dirname(dirname(__filename));
const payloadRoot = join(root, "release", "windows", "payload");
const outputPath = join(root, "release", "windows", "wix", "AgentXL.payload.wxs");

const roots = [
  { id: "APPDIR", name: "app", path: join(payloadRoot, "app") },
  { id: "RUNTIMEDIR", name: "runtime", path: join(payloadRoot, "runtime") },
  { id: "MANIFESTDIR", name: "manifest", path: join(payloadRoot, "manifest") },
];

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hashId(prefix, value) {
  const hash = crypto.createHash("sha1").update(value).digest("hex").slice(0, 16).toUpperCase();
  return `${prefix}_${hash}`;
}

function windowsRelativePath(absPath) {
  return relative(payloadRoot, absPath).split("/").join("\\");
}

function walkDirectory(absPath, directoryId, componentIds, depth = 2) {
  const indent = "  ".repeat(depth);
  const childIndent = "  ".repeat(depth + 1);
  const entries = readdirSync(absPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const lines = [];

  for (const entry of entries) {
    const entryPath = join(absPath, entry.name);
    const relPath = windowsRelativePath(entryPath);

    if (entry.isDirectory()) {
      const dirId = hashId("DIR", relPath);
      lines.push(`${indent}<Directory Id="${dirId}" Name="${escapeXml(entry.name)}">`);
      const nestedLines = walkDirectory(entryPath, dirId, componentIds, depth + 1);
      for (const line of nestedLines) {
        lines.push(line);
      }
      lines.push(`${indent}</Directory>`);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const componentId = hashId("CMP", relPath);
    const fileId = hashId("FIL", relPath);
    componentIds.push(componentId);
    lines.push(`${indent}<Component Id="${componentId}" Guid="*" Win64="yes">`);
    lines.push(
      `${childIndent}<File Id="${fileId}" KeyPath="yes" Source="$(var.PayloadRoot)\\${escapeXml(relPath)}" />`
    );
    lines.push(`${indent}</Component>`);
  }

  return lines;
}

function buildFragment() {
  for (const rootDir of roots) {
    if (!existsSync(rootDir.path)) {
      throw new Error(`Missing payload directory: ${rootDir.path}. Run npm run prepare:installer:win first.`);
    }
  }

  const componentIds = [];
  const xml = [];
  xml.push('<?xml version="1.0" encoding="UTF-8"?>');
  xml.push('<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">');

  for (const rootDir of roots) {
    xml.push('  <Fragment>');
    xml.push(`    <DirectoryRef Id="${rootDir.id}">`);
    const directoryLines = walkDirectory(rootDir.path, rootDir.id, componentIds, 3);
    for (const line of directoryLines) {
      xml.push(line);
    }
    xml.push('    </DirectoryRef>');
    xml.push('  </Fragment>');
  }

  xml.push('  <Fragment>');
  xml.push('    <ComponentGroup Id="AgentXLPayloadComponents">');
  for (const componentId of componentIds) {
    xml.push(`      <ComponentRef Id="${componentId}" />`);
  }
  xml.push('    </ComponentGroup>');
  xml.push('  </Fragment>');
  xml.push('</Wix>');
  xml.push('');

  return xml.join("\n");
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, buildFragment(), "utf-8");
console.log(`[generate-wix-fragment] Wrote ${outputPath}`);
