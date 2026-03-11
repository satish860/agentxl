import { FileSpreadsheet, FolderOpen, Search, Shield, Sparkles } from "lucide-react";
import { getProviderLabel, type ConfigStatus } from "../lib/api";
import { OnboardingFrame } from "./OnboardingFrame";

const QUICK_ACTIONS = [
  {
    icon: FolderOpen,
    label: "Compare source files to this sheet",
    description: "Find mismatches between supporting documents and workbook values.",
    prompt: "Compare the selected document folder to this sheet and flag mismatches",
  },
  {
    icon: FileSpreadsheet,
    label: "Map a value into Excel",
    description: "Extract a grounded value from the folder and place it in the workbook.",
    prompt: "Extract the relevant value from the selected document folder and map it into Excel",
  },
  {
    icon: Search,
    label: "Trace cells to source files",
    description: "See which files support the numbers already written into Excel.",
    prompt: "Show me which workbook cells came from which source files",
  },
];

interface WelcomeScreenProps {
  status: ConfigStatus;
  workbookId: string | null;
  linkedFolderPath: string;
  totalFiles?: number;
  supportedFiles?: number;
  onQuickAction: (prompt: string) => void;
  onChangeFolder: () => void;
}

/** Shown when authenticated, workbook is resolved, and a folder is linked. */
export function WelcomeScreen({
  status,
  workbookId,
  linkedFolderPath,
  totalFiles,
  supportedFiles,
  onQuickAction,
  onChangeFolder,
}: WelcomeScreenProps) {
  const providerLabel = getProviderLabel(status.provider);

  return (
    <OnboardingFrame
      currentStep={3}
      title="Ask a grounded question about this folder"
      subtitle="AgentXL will search the linked documents, answer from evidence, and help map the result into Excel with traceability."
      badge="AgentXL ready"
      footer={
        <div className="space-y-1.5 text-[11px] text-gray-400">
          <p>Version {status.version}</p>
          {workbookId ? <p className="break-all">Workbook ID: {workbookId}</p> : null}
        </div>
      }
    >
      <div className="rounded-3xl border border-emerald-100 bg-[linear-gradient(135deg,_#ecfdf3_0%,_#ffffff_100%)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-gray-900">Linked evidence folder</p>
            <p className="mt-1 break-all text-[12px] leading-5 text-gray-600">{linkedFolderPath}</p>
          </div>
          <button
            onClick={onChangeFolder}
            className="shrink-0 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-50"
          >
            Change
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Model</p>
            <p className="mt-1 text-[12px] font-medium text-gray-800">{providerLabel}</p>
          </div>
          <div className="rounded-2xl bg-white px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Files</p>
            <p className="mt-1 text-[12px] font-medium text-gray-800">
              {typeof supportedFiles === "number" ? supportedFiles : "—"}
              {typeof totalFiles === "number" ? (
                <span className="font-normal text-gray-500"> / {totalFiles} supported</span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-emerald-600">
            <Shield size={16} />
          </div>
          <div>
            <p className="text-[12px] font-medium text-gray-800">High-trust workflow</p>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">
              Ask from the source folder first. AgentXL is built to show what files support the answer before important workbook writes.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onQuickAction(action.prompt)}
            className="chip-hover w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-emerald-600">
                <action.icon size={16} />
              </div>
              <div>
                <p className="text-[13px] font-medium text-gray-800">{action.label}</p>
                <p className="mt-1 text-[11px] leading-5 text-gray-500">{action.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-emerald-600">
            <Sparkles size={16} />
          </div>
          <div>
            <p className="text-[12px] font-medium text-gray-800">Good first prompt</p>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">
              “Extract the relevant value from the selected document folder and map it into Excel with a citation.”
            </p>
          </div>
        </div>
      </div>
    </OnboardingFrame>
  );
}
