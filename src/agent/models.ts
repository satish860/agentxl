/**
 * Default model selection.
 *
 * First honors the model configured in Pi settings (`defaultProvider` /
 * `defaultModel`), then falls back to AgentXL's built-in preference order.
 */

import type { Model, Api } from "@mariozechner/pi-ai";
import { SettingsManager, type ModelRegistry } from "@mariozechner/pi-coding-agent";

/** Provider → preferred model ID, checked in priority order. */
const PREFERRED_MODELS: Array<{ provider: string; modelId: string }> = [
  { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
  { provider: "openai-codex", modelId: "gpt-5.1" },
  { provider: "openrouter", modelId: "anthropic/claude-sonnet-4" },
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
 * 2. Subscriptions (OAuth) from AgentXL's preferred fallback list
 * 3. API keys from AgentXL's preferred fallback list
 * 4. First available authenticated model
 *
 * Returns null if no provider has auth configured.
 */
export function getDefaultModel(
  modelRegistry: ModelRegistry,
  cwd?: string
): Model<Api> | null {
  // Only consider models that have auth configured
  const available = modelRegistry.getAvailable();
  if (available.length === 0) return null;

  // First honor Pi's configured default model/provider when possible.
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

  // Split into OAuth (subscriptions) vs API key models
  const oauthModels = available.filter((m) => modelRegistry.isUsingOAuth(m));
  const apiKeyModels = available.filter((m) => !modelRegistry.isUsingOAuth(m));

  // Check preferred models — subscriptions first, then API keys
  for (const pool of [oauthModels, apiKeyModels]) {
    for (const { provider, modelId } of PREFERRED_MODELS) {
      const match = pool.find(
        (m) => m.provider === provider && m.id === modelId
      );
      if (match) return match;
    }
  }

  // Fallback: first OAuth model, then first API key model
  if (oauthModels.length > 0) return oauthModels[0];
  return available[0];
}
