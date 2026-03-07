import { BarChart3, FileSpreadsheet, Calculator } from "lucide-react";
import { getProviderLabel, type ConfigStatus } from "../lib/api";

const QUICK_ACTIONS = [
  { icon: FileSpreadsheet, label: "Summarize data", prompt: "Summarize the data in this spreadsheet" },
  { icon: BarChart3, label: "Create chart", prompt: "Create a chart from the selected data" },
  { icon: Calculator, label: "Write formula", prompt: "Help me write a formula" },
];

interface WelcomeScreenProps {
  status: ConfigStatus;
  onQuickAction: (prompt: string) => void;
}

/** Shown when authenticated but no messages yet. */
export function WelcomeScreen({ status, onQuickAction }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mb-4">
        <span className="text-white text-xl font-bold">AX</span>
      </div>
      <h1 className="text-base font-semibold text-gray-900 mb-1">AgentXL</h1>
      <p className="text-xs text-gray-500 mb-6">
        Your AI assistant for Excel
      </p>

      {/* Quick actions */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onQuickAction(action.prompt)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-gray-200 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <action.icon size={16} className="text-gray-400 shrink-0" />
            <span className="text-sm text-gray-700">{action.label}</span>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-gray-400 mt-6">
        {getProviderLabel(status.provider)} • v{status.version}
      </p>
    </div>
  );
}
