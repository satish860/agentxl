import { useState } from "react";
import { ExternalLink, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { saveApiKey } from "../lib/api";
import { OnboardingFrame } from "./OnboardingFrame";

interface AuthRequiredProps {
  /** Called after a key is accepted — parent should re-fetch /api/config/status. */
  onSaved?: (provider: string) => void;
}

function detectProvider(key: string): string | null {
  const k = key.trim();
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("sk-")) return "openai";
  return null;
}

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  openrouter: "OpenRouter",
  openai: "OpenAI",
};

export function AuthRequired({ onSaved }: AuthRequiredProps) {
  const [key, setKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = key.trim();
  const detected = detectProvider(trimmed);

  async function handleSave() {
    setError(null);
    if (trimmed.length < 16) {
      setError("That key looks too short. Paste the full API key.");
      return;
    }
    setIsSaving(true);
    try {
      const result = await saveApiKey(trimmed);
      onSaved?.(result.provider);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the API key."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <OnboardingFrame
      currentStep={1}
      title="Connect your model provider"
      subtitle="Paste an API key to get started. AgentXL stores it locally and uses it only to call your chosen provider."
      footer={
        <div className="flex items-start gap-2 text-[11px] leading-5 text-gray-400">
          <ShieldCheck size={13} className="mt-0.5 shrink-0" />
          <span>
            Saved to <code className="rounded bg-white px-1 py-0.5 text-[10px]">~/.agentxl/auth.json</code>.
            Your key never leaves your machine except to call the provider you chose.
          </span>
        </div>
      }
    >
      <div className="rounded-3xl border border-emerald-100 bg-[linear-gradient(135deg,_#ecfdf3_0%,_#ffffff_100%)] p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <KeyRound size={18} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-900">Paste an API key</p>
            <p className="mt-1 text-[12px] leading-5 text-gray-600">
              The provider is detected from the key prefix.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <label className="block text-[12px] font-medium text-gray-700">API key</label>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-or-..."
          disabled={isSaving}
          className="mt-2 w-full rounded-2xl border border-gray-200 px-3 py-3 font-mono text-[12px] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isSaving && trimmed) handleSave();
          }}
        />

        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
          <span>
            {trimmed.length === 0
              ? "Supported prefixes: sk-or-… (OpenRouter), sk-ant-… (Anthropic), sk-… (OpenAI)"
              : detected
                ? `Detected: ${PROVIDER_LABEL[detected]}`
                : "Provider not detected — we'll ask you to confirm."}
          </span>
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] leading-5 text-red-700">
            {error}
          </div>
        ) : null}

        <button
          onClick={handleSave}
          disabled={!trimmed || isSaving}
          className="btn-press mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-[13px] font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600"
        >
          {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <KeyRound size={14} />}
          {isSaving ? "Saving…" : "Save and continue"}
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
        <p className="text-[12px] font-medium text-gray-800">Don't have a key?</p>
        <ul className="mt-2 grid gap-2 text-[11px] leading-5 text-gray-600">
          <li>
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
            >
              OpenRouter <ExternalLink size={11} />
            </a>{" "}
            — recommended, 100+ models, free tier.
          </li>
          <li>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
            >
              Anthropic <ExternalLink size={11} />
            </a>{" "}
            — direct Claude API access.
          </li>
          <li>
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
            >
              OpenAI <ExternalLink size={11} />
            </a>{" "}
            — GPT-4o.
          </li>
        </ul>
      </div>
    </OnboardingFrame>
  );
}
