import { useEffect, useState } from "react";
import { FolderOpen, Link2, RefreshCw } from "lucide-react";

interface FolderLinkScreenProps {
  workbookId: string;
  workbookName: string | null;
  currentFolderPath?: string | null;
  isSaving: boolean;
  error: string | null;
  onSave: (folderPath: string) => Promise<void> | void;
  onCancel?: () => void;
}

export function FolderLinkScreen({
  workbookId,
  workbookName,
  currentFolderPath,
  isSaving,
  error,
  onSave,
  onCancel,
}: FolderLinkScreenProps) {
  const [folderPath, setFolderPath] = useState(currentFolderPath ?? "");

  useEffect(() => {
    setFolderPath(currentFolderPath ?? "");
  }, [currentFolderPath]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center mb-4">
        <FolderOpen size={20} className="text-white" />
      </div>

      <p className="text-[15px] font-semibold text-gray-900 mb-1">
        Choose the folder with your supporting documents
      </p>
      <p className="text-xs text-gray-400 mb-5 max-w-[280px]">
        Paste the full path to your local folder below.
      </p>

      <div className="w-full max-w-[320px] rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm">
        <div className="space-y-1 mb-4">
          {workbookName && (
            <p className="text-[12px] text-gray-700">
              <span className="font-medium">Workbook:</span> {workbookName}
            </p>
          )}
          <p className="text-[11px] text-gray-400 break-all">
            <span className="font-medium text-gray-500">Workbook ID:</span> {workbookId}
          </p>
        </div>

        <label className="block text-[12px] font-medium text-gray-700 mb-2">
          Folder path
        </label>

        <input
          value={folderPath}
          onChange={(e) => setFolderPath(e.target.value)}
          placeholder="C:\\Clients\\ABC\\Support"
          disabled={isSaving}
          autoFocus
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
        />

        <p className="mt-2 text-[11px] text-gray-400">
          Right-click any folder in File Explorer → Copy as path, then paste here.
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onSave(folderPath)}
            disabled={!folderPath.trim() || isSaving}
            className="btn-press flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:hover:bg-emerald-600"
          >
            {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Link2 size={14} />}
            {currentFolderPath ? "Update folder" : "Link folder"}
          </button>

          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-[13px] text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
