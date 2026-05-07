/**
 * Auth route — accept an API key from the taskpane UI and save it.
 *
 * The user pastes a key (sk-ant-..., sk-or-..., sk-...) into the UI.
 * The server detects the provider from the prefix, persists the key
 * via the Pi SDK auth storage, and resets the session so the next
 * agent request picks up the new credentials.
 */

import { IncomingMessage, ServerResponse } from "http";
import { sendError, sendJson, parseJsonBody } from "../http.js";
import { detectApiKeyProvider, saveApiKey } from "../../agent/session.js";

const KNOWN_PROVIDERS = new Set(["anthropic", "openrouter", "openai"]);

/** POST /api/auth/apikey — accept and persist an API key. */
export async function handleAuthApiKey(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await parseJsonBody(req);
  if (!body || typeof body !== "object") {
    sendError(res, 400, "Invalid JSON body");
    return;
  }

  const b = body as Record<string, unknown>;
  const key = typeof b.key === "string" ? b.key.trim() : "";
  const explicitProvider =
    typeof b.provider === "string" ? b.provider.trim().toLowerCase() : "";

  if (key.length === 0) {
    sendError(res, 400, "Missing 'key' in request body");
    return;
  }

  // Sanity check on length — keys are at least ~20 chars
  if (key.length < 16) {
    sendError(res, 400, "API key looks too short");
    return;
  }

  let provider = explicitProvider || detectApiKeyProvider(key) || "";

  if (!provider) {
    sendError(
      res,
      400,
      "Could not detect provider from key prefix. Send 'provider' explicitly (anthropic | openrouter | openai)."
    );
    return;
  }

  if (!KNOWN_PROVIDERS.has(provider)) {
    sendError(
      res,
      400,
      `Unsupported provider '${provider}'. Use anthropic, openrouter, or openai.`
    );
    return;
  }

  try {
    saveApiKey(provider, key);
    console.log(`[auth] saved api_key provider=${provider}`);
    sendJson(res, 200, { provider, saved: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendError(res, 500, `Failed to save key: ${message}`);
  }
}
