import { execFile } from "child_process";
import { platform } from "os";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPickerTimeoutMs(): number {
  const raw = process.env.AGENTXL_PICK_FOLDER_TIMEOUT_MS?.trim();
  const parsed = raw ? Number(raw) : NaN;

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return 15000;
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
        timeout: timeoutMs,
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

export async function pickLocalFolder(): Promise<string | null> {
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
