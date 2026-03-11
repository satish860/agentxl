import { KeyRound, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { OnboardingFrame } from "./OnboardingFrame";

/** Shown when the server is running but no auth is configured. Polls for changes. */
export function AuthRequired() {
  return (
    <OnboardingFrame
      currentStep={1}
      title="Connect your model provider"
      subtitle="AgentXL uses your own model credentials. As soon as sign-in is complete, this screen will continue automatically."
      footer={
        <div className="flex items-center gap-2 text-[12px] text-gray-400">
          <RefreshCw size={13} className="animate-spin" />
          Waiting for credentials…
        </div>
      }
    >
      <div className="rounded-3xl border border-amber-100 bg-[linear-gradient(135deg,_#fff9eb_0%,_#ffffff_100%)] p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <KeyRound size={18} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-900">Finish sign-in once</p>
            <p className="mt-1 text-[12px] leading-5 text-gray-600">
              If you installed the Windows package, open <span className="font-medium text-gray-800">AgentXL Login</span>
              . If you launched from a terminal, run <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-gray-700">agentxl login</code>.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-emerald-600">
              <ShieldCheck size={16} />
            </div>
            <div>
              <p className="text-[12px] font-medium text-gray-800">Your documents stay local</p>
              <p className="mt-1 text-[11px] leading-5 text-gray-500">
                AgentXL works from local folders and your workbook. It uses your chosen model provider for reasoning.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-emerald-600">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-[12px] font-medium text-gray-800">What happens next</p>
              <p className="mt-1 text-[11px] leading-5 text-gray-500">
                After sign-in, you will choose the folder with your supporting documents, then ask a grounded question.
              </p>
            </div>
          </div>
        </div>
      </div>
    </OnboardingFrame>
  );
}
