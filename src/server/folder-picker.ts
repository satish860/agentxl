import { execFile } from "child_process";
import { existsSync } from "fs";
import { platform } from "os";
import { dirname, extname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FolderPickerHelperResponse {
  ok: boolean;
  cancelled?: boolean;
  folderPath?: string | null;
  error?: string;
}

interface CommandInvocation {
  command: string;
  args: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getProjectRoot(): string {
  return join(__dirname, "..", "..");
}

function getPickerTimeoutMs(): number {
  const raw = process.env.AGENTXL_PICK_FOLDER_TIMEOUT_MS?.trim();
  const parsed = raw ? Number(raw) : NaN;

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  // No timeout by default — let the user take as long as they need.
  // The picker is a blocking dialog; it closes when the user picks or cancels.
  return 0;
}

function toFriendlyPickerError(error: unknown): Error {
  if (error instanceof Error) {
    const execError = error as Error & {
      code?: string | number | null;
      signal?: string | null;
      killed?: boolean;
    };

    const message = execError.message.toLowerCase();
    if (
      execError.killed ||
      execError.signal === "SIGTERM" ||
      message.includes("timed out") ||
      message.includes("timeout")
    ) {
      return new Error(
        "Native folder picker timed out. Paste the folder path manually instead."
      );
    }

    return error;
  }

  return new Error("Failed to open native folder picker");
}

function execFileAsync(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        windowsHide: true,
        // 0 means no timeout — let the user take as long as they need.
        timeout: timeoutMs > 0 ? timeoutMs : 0,
      },
      (error, stdout) => {
        if (error) {
          reject(toFriendlyPickerError(error));
          return;
        }
        resolve(stdout.toString());
      }
    );
  });
}

function getFolderPickerHelperPath(): string | null {
  const override = process.env.AGENTXL_FOLDER_PICKER_HELPER?.trim();
  if (override) {
    return override;
  }

  const projectRoot = getProjectRoot();
  const candidates = [
    join(projectRoot, "bin", "agentxl-folder-picker.exe"),
    join(
      projectRoot,
      "tools",
      "folder-picker-win",
      "bin",
      "Release",
      "net8.0-windows",
      "win-x64",
      "publish",
      "agentxl-folder-picker.exe"
    ),
    join(
      projectRoot,
      "tools",
      "folder-picker-win",
      "bin",
      "Release",
      "net8.0-windows",
      "publish",
      "agentxl-folder-picker.exe"
    ),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function buildHelperInvocation(
  helperPath: string,
  initialPath?: string | null
): CommandInvocation {
  const helperExt = extname(helperPath).toLowerCase();
  const args: string[] = [];

  if (initialPath && initialPath.trim().length > 0) {
    args.push("--initial-path", initialPath.trim());
  }

  if ([".js", ".mjs", ".cjs"].includes(helperExt)) {
    return {
      command: process.execPath,
      args: [helperPath, ...args],
    };
  }

  return {
    command: helperPath,
    args,
  };
}

function parseHelperResponse(stdout: string): FolderPickerHelperResponse {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("Folder picker helper returned no output");
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = Array.from(new Set([lines.at(-1) ?? trimmed, trimmed]));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as FolderPickerHelperResponse;
      if (parsed && typeof parsed.ok === "boolean") {
        return parsed;
      }
    } catch {
      // Try next candidate.
    }
  }

  throw new Error("Folder picker helper returned invalid JSON");
}

async function pickLocalFolderWithHelper(
  helperPath: string,
  timeoutMs: number,
  initialPath?: string | null
): Promise<string | null> {
  const invocation = buildHelperInvocation(helperPath, initialPath);
  const stdout = await execFileAsync(
    invocation.command,
    invocation.args,
    timeoutMs
  );
  const response = parseHelperResponse(stdout);

  if (!response.ok) {
    throw new Error(response.error || "Folder picker helper failed");
  }

  if (response.cancelled) {
    return null;
  }

  const folderPath =
    typeof response.folderPath === "string" ? response.folderPath.trim() : "";
  return folderPath.length > 0 ? folderPath : null;
}

async function pickLocalFolderWithPowerShell(timeoutMs: number): Promise<string | null> {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "[System.Windows.Forms.Application]::EnableVisualStyles()",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'Choose the folder with your supporting documents'",
    "$dialog.ShowNewFolderButton = $false",
    "$dialog.UseDescriptionForTitle = $true",
    "$dialog.RootFolder = [System.Environment+SpecialFolder]::MyDocuments",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }",
  ].join("; ");

  const stdout = await execFileAsync(
    "powershell",
    ["-NoProfile", "-STA", "-Command", script],
    timeoutMs
  );

  const selected = stdout.trim();
  return selected.length > 0 ? selected : null;
}

export interface FolderPickerStrategy {
  platform: string;
  method: "native-helper" | "powershell" | "osascript" | "manual-only";
  helperPath: string | null;
}

/** Detect which folder picker strategy will be used at runtime. */
export function getFolderPickerStrategy(): FolderPickerStrategy {
  const currentPlatform = platform();

  if (currentPlatform === "win32") {
    const helperPath = getFolderPickerHelperPath();
    if (helperPath) {
      return { platform: "win32", method: "native-helper", helperPath };
    }
    return { platform: "win32", method: "powershell", helperPath: null };
  }

  if (currentPlatform === "darwin") {
    return { platform: "darwin", method: "osascript", helperPath: null };
  }

  return { platform: currentPlatform, method: "manual-only", helperPath: null };
}

export async function pickLocalFolder(
  initialPath?: string | null
): Promise<string | null> {
  const testDelayRaw = process.env.AGENTXL_PICK_FOLDER_TEST_DELAY_MS?.trim();
  const testDelayMs = testDelayRaw ? Number(testDelayRaw) : NaN;
  if (Number.isFinite(testDelayMs) && testDelayMs > 0) {
    await sleep(testDelayMs);
  }

  const testError = process.env.AGENTXL_PICK_FOLDER_TEST_ERROR?.trim();
  if (testError) {
    throw new Error(testError);
  }

  const testPath = process.env.AGENTXL_PICK_FOLDER_TEST_PATH;
  if (testPath && testPath.trim().length > 0) {
    return testPath.trim();
  }

  const currentPlatform = platform();
  const timeoutMs = getPickerTimeoutMs();

  if (currentPlatform === "win32") {
    const helperPath = getFolderPickerHelperPath();

    if (helperPath) {
      try {
        return await pickLocalFolderWithHelper(helperPath, timeoutMs, initialPath);
      } catch (error) {
        const helperError =
          error instanceof Error ? error.message : "Folder picker helper failed";

        if (helperError.toLowerCase().includes("timed out")) {
          throw error instanceof Error ? error : new Error(helperError);
        }

        try {
          return await pickLocalFolderWithPowerShell(timeoutMs);
        } catch (fallbackError) {
          const fallbackMessage =
            fallbackError instanceof Error
              ? fallbackError.message
              : "PowerShell folder picker fallback failed";
          throw new Error(
            `${helperError}. PowerShell fallback also failed: ${fallbackMessage}`
          );
        }
      }
    }

    return pickLocalFolderWithPowerShell(timeoutMs);
  }

  if (currentPlatform === "darwin") {
    const stdout = await execFileAsync(
      "osascript",
      [
        "-e",
        'POSIX path of (choose folder with prompt "Choose the folder with your supporting documents")',
      ],
      timeoutMs
    );
    const selected = stdout.trim();
    return selected.length > 0 ? selected.replace(/\/$/, "") : null;
  }

  throw new Error("Native folder picker is not supported on this platform yet");
}
