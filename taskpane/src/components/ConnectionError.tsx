import { AlertCircle, ArrowRight, Download, LaptopMinimal, RefreshCw } from "lucide-react";
import { OnboardingFrame } from "./OnboardingFrame";

const isHosted =
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1";

/** Shown when the app cannot connect to the AgentXL server on initial load. */
export function ConnectionError() {
  return (
    <OnboardingFrame
      title="Start AgentXL first"
      subtitle={
        isHosted
          ? "The add-in is loaded, but the local AgentXL server is not reachable at localhost:3001."
          : "Excel can see the add-in, but the local AgentXL server is not reachable yet."
      }
      badge="AgentXL setup"
      footer={
        <div className="flex items-center gap-2 text-[12px] text-gray-400">
          <RefreshCw size={13} className="animate-spin" />
          Reconnecting…
        </div>
      }
    >
      <div className="rounded-3xl border border-red-100 bg-[linear-gradient(135deg,_#fff5f5_0%,_#ffffff_100%)] p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <AlertCircle size={18} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-900">The local server is not running</p>
            <p className="mt-1 text-[12px] leading-5 text-gray-600">
              AgentXL needs a local server for document processing and AI. Start it, then this screen will recover automatically.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {isHosted && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-emerald-600">
                <Download size={16} />
              </div>
              <div>
                <p className="text-[12px] font-medium text-gray-800">Don't have AgentXL installed?</p>
                <p className="mt-1 text-[11px] leading-5 text-gray-500">
                  Download the latest release from{" "}
                  <a
                    href="https://github.com/satish860/agentxl/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 underline"
                  >
                    GitHub Releases
                  </a>
                  . Extract the ZIP, double-click <span className="font-medium text-gray-700">AgentXL.vbs</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-emerald-600">
              <LaptopMinimal size={16} />
            </div>
            <div>
              <p className="text-[12px] font-medium text-gray-800">Windows release</p>
              <p className="mt-1 text-[11px] leading-5 text-gray-500">
                Double-click <span className="font-medium text-gray-700">AgentXL.vbs</span> from the extracted release folder. It starts the server silently.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-emerald-600">
              <ArrowRight size={16} />
            </div>
            <div>
              <p className="text-[12px] font-medium text-gray-800">npm users</p>
              <p className="mt-1 text-[11px] leading-5 text-gray-500">
                Run <code className="rounded bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-700">agentxl start</code> and wait for <span className="font-medium text-gray-700">https://localhost:3001</span> to come up.
              </p>
            </div>
          </div>
        </div>
      </div>
    </OnboardingFrame>
  );
}
