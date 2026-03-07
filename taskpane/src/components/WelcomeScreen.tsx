import { BarChart3, FileSpreadsheet, Calculator, Shield } from "lucide-react";
import { getProviderLabel, type ConfigStatus } from "../lib/api";

const QUICK_ACTIONS = [
  { icon: FileSpreadsheet, label: "Summarize this data", prompt: "Summarize the data in this spreadsheet" },
  { icon: BarChart3, label: "Create a chart", prompt: "Create a chart from the selected data" },
  { icon: Calculator, label: "Write a formula", prompt: "Help me write a formula" },
];

interface WelcomeScreenProps {
  status: ConfigStatus;
  onQuickAction: (prompt: string) => void;
}

/** Shown when authenticated but no messages yet. */
export function WelcomeScreen({ status, onQuickAction }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center mb-4">
        <span className="text-white text-lg font-bold tracking-tight">AX</span>
      </div>
      <p className="text-[15px] font-semibold text-gray-900 mb-0.5">
        What do you want to do with this data?
      </p>
      <p className="text-xs text-gray-400 mb-6">
        Or pick a quick action below
      </p>

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

      <p className="text-[10px] text-gray-300 mt-2">
        {getProviderLabel(status.provider)} • v{status.version}
      </p>
    </div>
  );
}
