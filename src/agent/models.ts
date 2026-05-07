/**
 * Default model selection.
 *
 * First honors the model configured in Pi settings (`defaultProvider` /
 * `defaultModel`), then falls back to AgentXL's built-in preference order.
 */

import type { Model, Api } from "@mariozechner/pi-ai";
import { SettingsManager, type ModelRegistry } from "@mariozechner/pi-coding-agent";

/**
 * Providers AgentXL knows how to drive end-to-end via API key.
 * Anything else (OAuth-only providers, leftover Pi credentials, etc.) is
 * ignored so we don't accidentally route requests through a stale token.
 */
export const SUPPORTED_PROVIDERS = new Set<string>([
  "openrouter",
  "anthropic",
  "openai",
]);

/** Provider → preferred model ID, checked in priority order. */
const PREFERRED_MODELS: Array<{ provider: string; modelId: string }> = [
  { provider: "openrouter", modelId: "anthropic/claude-sonnet-4.6" },
  { provider: "openrouter", modelId: "anthropic/claude-sonnet-4.5" },
  { provider: "openrouter", modelId: "anthropic/claude-sonnet-4" },
  { provider: "anthropic", modelId: "claude-sonnet-4-6" },
  { provider: "anthropic", modelId: "claude-sonnet-4-5-20250929" },
  { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
  { provider: "openai", modelId: "gpt-4o" },
];

/** Read the user's configured default model from Pi settings, if available. */
function getConfiguredModelPreference(
  cwd?: string
): { provider?: string; modelId?: string } | null {
  try {
    const settings = SettingsManager.create(cwd || process.cwd());
    const provider = settings.getDefaultProvider()?.trim();
    const modelId = settings.getDefaultModel()?.trim();

    if (!provider && !modelId) return null;
    return {
      provider: provider || undefined,
      modelId: modelId || undefined,
    };
  } catch {
    // Invalid/missing settings should not break model resolution.
    return null;
  }
}

/**
 * Get the best available model based on configured auth.
 *
 * Priority:
 * 1. Pi settings (`defaultProvider` / `defaultModel`) if that model is available
 * 2. AgentXL's preferred list (OpenRouter first, then Anthropic, then OpenAI)
 * 3. Any OpenRouter model, otherwise first available authenticated model
 *
 * Returns null if no provider has auth configured.
 */
export function getDefaultModel(
  modelRegistry: ModelRegistry,
  cwd?: string
): Model<Api> | null {
  // Only consider providers AgentXL supports. Other authenticated providers
  // (e.g., stale Pi OAuth tokens for antigravity / gemini-cli) are ignored
  // so the user gets prompted to paste a real key instead of crashing on a
  // 404 from a token we never intended to use.
  const available = modelRegistry
    .getAvailable()
    .filter((m) => SUPPORTED_PROVIDERS.has(m.provider));
  if (available.length === 0) return null;

  // First honor Pi's configured default model/provider when possible
  // (still constrained to supported providers via `available`).
  const configured = getConfiguredModelPreference(cwd);
  if (configured?.provider && configured?.modelId) {
    const exact = available.find(
      (m) => m.provider === configured.provider && m.id === configured.modelId
    );
    if (exact) return exact;
  }

  if (configured?.modelId) {
    const byId = available.find((m) => m.id === configured.modelId);
    if (byId) return byId;
  }

  if (configured?.provider) {
    const byProvider = available.find((m) => m.provider === configured.provider);
    if (byProvider) return byProvider;
  }

  for (const { provider, modelId } of PREFERRED_MODELS) {
    const match = available.find(
      (m) => m.provider === provider && m.id === modelId
    );
    if (match) return match;
  }

  const openrouterAny = available.find((m) => m.provider === "openrouter");
  if (openrouterAny) return openrouterAny;
  return available[0];
}
