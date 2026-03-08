import { Search, FileSpreadsheet, FolderOpen, Shield } from "lucide-react";
import { type ConfigStatus } from "../lib/api";

const QUICK_ACTIONS = [
  {
    icon: FolderOpen,
    label: "Compare source files to this sheet",
    prompt: "Compare the selected document folder to this sheet and flag mismatches",
  },
  {
    icon: FileSpreadsheet,
    label: "Map a value into Excel",
    prompt: "Extract the relevant value from the selected document folder and map it into Excel",
  },
  {
    icon: Search,
    label: "Trace cells to source files",
    prompt: "Show me which workbook cells came from which source files",
  },
];

interface WelcomeScreenProps {
  status: ConfigStatus;
  workbookId: string | null;
  linkedFolderPath: string;
  onQuickAction: (prompt: string) => void;
  onChangeFolder: () => void;
}

/** Shown when authenticated, workbook is resolved, and a folder is linked. */
export function WelcomeScreen({
  status,
  workbookId,
  linkedFolderPath,
  onQuickAction,
  onChangeFolder,
}: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center mb-4">
        <span className="text-white text-lg font-bold tracking-tight">AX</span>
      </div>
      <p className="text-[15px] font-semibold text-gray-900 mb-0.5">
        Choose a folder, then ask a grounded question
      </p>
      <p className="text-xs text-gray-400 mb-4">
        AgentXL searches source files and maps answers into Excel
      </p>

      <div className="w-full max-w-[280px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-left mb-5">
        <p className="text-[11px] text-gray-400 mb-1">Linked folder</p>
        <p className="text-[12px] text-gray-700 break-all">{linkedFolderPath}</p>
        <button
          onClick={onChangeFolder}
          className="mt-3 text-[12px] font-medium text-emerald-600 hover:text-emerald-700"
        >
          Change folder
        </button>
      </div>

      {/* Quick actions — outcome-focused chips */}
      <div className="flex flex-col gap-2 w-full max-w-[260px]">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onQuickAction(action.prompt)}
            className="chip-hover flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-200 text-left bg-white"
          >
            <action.icon size={15} className="text-emerald-600 shrink-0" />
            <span className="text-[13px] text-gray-700">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Privacy line — addresses #1 objection */}
      <div className="flex items-center gap-1.5 mt-6 text-[11px] text-gray-400">
        <Shield size={10} className="shrink-0" />
        <span>Your data stays on your machine</span>
      </div>

      <div className="mt-2 space-y-1">
        <p className="text-[10px] text-gray-300">
          Version {status.version}
        </p>
        {workbookId && (
          <p className="text-[10px] text-gray-300">
            Workbook ID: {workbookId}
          </p>
        )}
      </div>
    </div>
  );
}
