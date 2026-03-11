import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, FolderOpen, Link2, RefreshCw, ShieldCheck } from "lucide-react";
import { OnboardingFrame } from "./OnboardingFrame";

interface FolderLinkScreenProps {
  workbookId: string;
  workbookName: string | null;
  currentFolderPath?: string | null;
  isSaving: boolean;
  isPickingFolder: boolean;
  error: string | null;
  onPickFolder: () => Promise<string | null>;
  onSave: (folderPath: string) => Promise<void> | void;
  onCancel?: () => void;
}

export function FolderLinkScreen({
  workbookId,
  workbookName,
  currentFolderPath,
  isSaving,
  isPickingFolder,
  error,
  onPickFolder,
  onSave,
  onCancel,
}: FolderLinkScreenProps) {
  const [folderPath, setFolderPath] = useState(currentFolderPath ?? "");

  useEffect(() => {
    setFolderPath(currentFolderPath ?? "");
  }, [currentFolderPath]);

  const trimmedFolderPath = folderPath.trim();
  const helperCopy = useMemo(
    () =>
      isPickingFolder
        ? "If the picker does not appear, keep typing the folder path manually."
        : "Tip: pick the engagement folder that contains the supporting evidence you want AgentXL to search.",
    [isPickingFolder]
  );

  async function handlePickFolder() {
    const picked = await onPickFolder();
    if (picked) {
      setFolderPath(picked);
    }
  }

  return (
    <OnboardingFrame
      currentStep={2}
      title="Choose the folder with your supporting documents"
      subtitle="Start from the evidence folder, not from spreadsheet chat. AgentXL will search the files you point it to and map the grounded result back into Excel."
      footer={
        <div className="flex items-start gap-2 text-[11px] leading-5 text-gray-400">
          <ShieldCheck size={13} className="mt-0.5 shrink-0" />
          <span>
            Folder links are saved per workbook so the next session can reopen in the same context.
          </span>
        </div>
      }
    >
      <div className="rounded-3xl border border-emerald-100 bg-[linear-gradient(135deg,_#effcf3_0%,_#ffffff_100%)] p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <FolderOpen size={18} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-900">One workbook, one evidence folder</p>
            <p className="mt-1 text-[12px] leading-5 text-gray-600">
              Choose the local folder that contains the documents for this workbook. You can change it later.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-4 grid gap-2">
          {workbookName ? (
            <div className="rounded-2xl bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Workbook</p>
              <p className="mt-1 text-[12px] font-medium text-gray-800 break-words">{workbookName}</p>
            </div>
          ) : null}
          <div className="rounded-2xl bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Workbook ID</p>
            <p className="mt-1 break-all text-[11px] text-gray-500">{workbookId}</p>
          </div>
        </div>

        <label className="block text-[12px] font-medium text-gray-700">Folder path</label>
        <input
          value={folderPath}
          onChange={(e) => setFolderPath(e.target.value)}
          placeholder="C:\\Clients\\ABC\\Support"
          disabled={isSaving}
          className="mt-2 w-full rounded-2xl border border-gray-200 px-3 py-3 text-[13px] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 disabled:opacity-50"
        />

        <div className="mt-3 flex gap-2">
          <button
            onClick={handlePickFolder}
            disabled={isSaving || isPickingFolder}
            className="rounded-2xl border border-gray-200 px-3 py-2.5 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
          >
            {isPickingFolder ? "Trying to open…" : "Browse for folder"}
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-5 text-gray-400">{helperCopy}</p>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] leading-5 text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onSave(trimmedFolderPath)}
            disabled={!trimmedFolderPath || isSaving}
            className="btn-press inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-[13px] font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600"
          >
            {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Link2 size={14} />}
            {currentFolderPath ? "Update folder" : "Link folder"}
          </button>

          {onCancel ? (
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="rounded-2xl border border-gray-200 px-4 py-3 text-[13px] font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2">
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-emerald-600">
              <FileText size={16} />
            </div>
            <div>
              <p className="text-[12px] font-medium text-gray-800">What AgentXL will do from here</p>
              <p className="mt-1 text-[11px] leading-5 text-gray-500">
                Search the linked folder, read the relevant files, and prepare grounded outputs that can be written into Excel.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-emerald-600">
              <ChevronRight size={16} />
            </div>
            <div>
              <p className="text-[12px] font-medium text-gray-800">Next step</p>
              <p className="mt-1 text-[11px] leading-5 text-gray-500">
                After linking the folder, you can ask for a mismatch review, a mapped value, or source traceability.
              </p>
            </div>
          </div>
        </div>
      </div>
    </OnboardingFrame>
  );
}
