import type { ReactNode } from "react";

const STEPS = [
  { id: 1, label: "Connect" },
  { id: 2, label: "Folder" },
  { id: 3, label: "Ask" },
] as const;

interface OnboardingFrameProps {
  currentStep?: 1 | 2 | 3;
  title: string;
  subtitle: string;
  badge?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function OnboardingFrame({
  currentStep,
  title,
  subtitle,
  badge = "AgentXL onboarding",
  children,
  footer,
}: OnboardingFrameProps) {
  return (
    <div className="min-h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(22,163,74,0.14),_transparent_38%),linear-gradient(180deg,_#f5fbf5_0%,_#f8fafc_48%,_#ffffff_100%)]">
      <div className="mx-auto flex min-h-full w-full max-w-[360px] flex-col justify-center px-4 py-5">
        <div className="rounded-[28px] border border-emerald-100/80 bg-white/95 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-800">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-semibold text-white">
                AX
              </span>
              {badge}
            </div>
            {currentStep ? (
              <div className="text-[11px] font-medium text-gray-400">
                Step {currentStep} of {STEPS.length}
              </div>
            ) : null}
          </div>

          {currentStep ? (
            <div className="mb-5 grid grid-cols-3 gap-2">
              {STEPS.map((step) => {
                const isActive = step.id === currentStep;
                const isComplete = step.id < currentStep;
                return (
                  <div
                    key={step.id}
                    className={[
                      "rounded-2xl border px-2.5 py-2 text-center transition-colors",
                      isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : isComplete
                          ? "border-emerald-100 bg-emerald-50/60 text-emerald-700"
                          : "border-gray-200 bg-gray-50 text-gray-400",
                    ].join(" ")}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                      {step.id}
                    </div>
                    <div className="mt-1 text-[11px] font-medium">{step.label}</div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="mb-5">
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-gray-950">
              {title}
            </h1>
            <p className="mt-2 text-[13px] leading-6 text-gray-500">{subtitle}</p>
          </div>

          <div className="space-y-4">{children}</div>

          {footer ? <div className="mt-5 border-t border-gray-100 pt-4">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
