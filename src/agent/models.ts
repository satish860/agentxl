/**
 * Default model selection per provider.
 *
 * Checks providers in order: Anthropic → OpenRouter → OpenAI.
 * Prefers subscriptions (OAuth) over API keys — subscriptions are already paid for.
 * Returns the first model that has auth configured.
 */

import type { Model, Api } from "@mariozechner/pi-ai";
import type { ModelRegistry } from "@mariozechner/pi-coding-agent";

/** Provider → preferred model ID, checked in priority order. */
const PREFERRED_MODELS: Array<{ provider: string; modelId: string }> = [
  { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
  { provider: "openai-codex", modelId: "gpt-5.1" },
  { provider: "openrouter", modelId: "anthropic/claude-sonnet-4" },
  { provider: "openai", modelId: "gpt-4o" },
];

/**
 * Get the best available model based on configured auth.
 *
 * Priority:
 * 1. Subscriptions (OAuth) — Anthropic, OpenAI Codex (already paid for)
 * 2. API keys — OpenRouter, OpenAI, etc.
 *
 * Within each tier, checks PREFERRED_MODELS in order.
 * Returns null if no provider has auth configured.
 */
export function getDefaultModel(
  modelRegistry: ModelRegistry
): Model<Api> | null {
  // Only consider models that have auth configured
  const available = modelRegistry.getAvailable();
  if (available.length === 0) return null;

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
