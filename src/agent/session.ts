/**
 * Pi SDK agent session management.
 *
 * Module-level singleton: one session, persists across requests.
 * Provides init, get, reset, and auth-check exports for the server.
 */

import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import {
  createAgentSession,
  createReadOnlyTools,
  createBashTool,
  AuthStorage,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSession,
} from "@mariozechner/pi-coding-agent";
import { getDefaultModel, SUPPORTED_PROVIDERS } from "./models.js";
import { excelTool } from "./tools/excel.js";
import { AGENTXL_SYSTEM_PROMPT } from "./prompt/system-prompt.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const AGENTXL_DIR = join(homedir(), ".agentxl");
const AGENTXL_AUTH_PATH = join(AGENTXL_DIR, "auth.json");
const PI_AUTH_PATH = join(homedir(), ".pi", "agent", "auth.json");

/**
 * Resolve auth file path.
 * Uses AgentXL's own auth.json if it exists, otherwise falls back to
 * Pi's auth.json. This lets users who already have Pi set up reuse
 * the same API keys without re-entering them.
 */
function resolveAuthPath(): string {
  if (existsSync(AGENTXL_AUTH_PATH)) return AGENTXL_AUTH_PATH;
  if (existsSync(PI_AUTH_PATH)) return PI_AUTH_PATH;
  return AGENTXL_AUTH_PATH; // default (will be created on first auth)
}

// ---------------------------------------------------------------------------
// Singletons — rebuilt on resetSession() to pick up auth changes
// ---------------------------------------------------------------------------

let authStorage = AuthStorage.create(resolveAuthPath());
let modelRegistry = new ModelRegistry(authStorage);

/** Active agent session (null until first prompt) */
let currentSession: AgentSession | null = null;

/** The cwd the current session was created with */
let currentSessionCwd: string | null = null;

/** Provider selected for the active session */
let selectedProvider: string | null = null;

// ---------------------------------------------------------------------------
// Internal: rebuild auth/model singletons
// ---------------------------------------------------------------------------

/**
 * Rebuild AuthStorage and ModelRegistry from current auth path.
 * Called by resetSession() so runtime auth changes are picked up.
 */
function rebuildAuth(): void {
  authStorage = AuthStorage.create(resolveAuthPath());
  modelRegistry = new ModelRegistry(authStorage);
  selectedProvider = null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize a new agent session.
 * Picks the best available model, creates a Pi SDK session with read-only
 * tools pointed at the given working directory (linked folder).
 *
 * @param cwd - Working directory for file tools. Defaults to process.cwd().
 */
export async function initSession(cwd?: string): Promise<AgentSession> {
  // Refresh to pick up any new keys
  modelRegistry.refresh();

  const effectiveCwd = cwd || process.cwd();
  const model = getDefaultModel(modelRegistry, effectiveCwd);
  if (!model) {
    throw new Error(
      "No model available. Run 'agentxl login' to set up authentication " +
        "(API key or subscription)."
    );
  }

  // Track the selected provider
  selectedProvider = model.provider;
  console.log(
    `[session] init provider=${model.provider} model=${model.id} cwd=${effectiveCwd}`
  );
  const readOnly = createReadOnlyTools(effectiveCwd);
  const bash = createBashTool(effectiveCwd);
  const tools = [...readOnly, bash];

  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: true },
  });

  // Build a ResourceLoader that appends AgentXL's behavioral rules
  // on top of Pi's built-in system prompt (tool docs, skills, AGENTS.md).
  const resourceLoader = new DefaultResourceLoader({
    cwd: effectiveCwd,
    settingsManager,
    appendSystemPrompt: AGENTXL_SYSTEM_PROMPT,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    model,
    cwd: effectiveCwd,
    thinkingLevel: "medium",
    tools,                    // read, grep, find, ls, bash — pointed at linked folder
    customTools: [excelTool], // Single Excel tool — agent writes Office.js code
    resourceLoader,           // Pi base prompt + AgentXL append
    sessionManager: SessionManager.inMemory(),
    settingsManager,
    authStorage,
    modelRegistry,
  });

  currentSession = session;
  currentSessionCwd = effectiveCwd;
  return session;
}

/**
 * Get the current session, or create one if none exists.
 * If `cwd` is provided and differs from the current session's cwd,
 * the session is recreated so file tools point to the correct folder.
 *
 * @param cwd - Working directory for file tools (linked folder path).
 */
export async function getSession(cwd?: string): Promise<AgentSession> {
  const effectiveCwd = cwd || process.cwd();

  // Recreate session if the working directory changed
  if (currentSession && currentSessionCwd !== effectiveCwd) {
    console.log(
      `[session] cwd changed (${currentSessionCwd} → ${effectiveCwd}) — disposing session`
    );
    currentSession.dispose();
    currentSession = null;
    currentSessionCwd = null;
  }

  if (currentSession) {
    return currentSession;
  }
  return initSession(effectiveCwd);
}

/**
 * Check if a supported provider has auth configured.
 *
 * Only counts AgentXL's known providers (openrouter / anthropic / openai)
 * — stale OAuth credentials for unsupported providers (e.g., a leftover
 * Pi setup for antigravity or gemini-cli) are ignored so the UI keeps
 * prompting for a real API key instead of routing through a dead token.
 */
export function isAuthenticated(): boolean {
  modelRegistry.refresh();
  const available = modelRegistry.getAvailable();
  return available.some((m) => SUPPORTED_PROVIDERS.has(m.provider));
}

/**
 * Get the provider for the model the session is actually using.
 * Before a session is created, returns the provider that getDefaultModel()
 * would select — same ranking logic, same result.
 */
export function getAuthProvider(): string | null {
  // If a session exists, return its actual provider
  if (selectedProvider) return selectedProvider;

  // No session yet — preview what getDefaultModel() would pick
  modelRegistry.refresh();
  const model = getDefaultModel(modelRegistry, currentSessionCwd ?? process.cwd());
  return model?.provider ?? null;
}

/**
 * Dispose the current session, rebuild auth, and clear state.
 * Called when auth changes so the next request creates a fresh session
 * from the current auth source.
 */
export function resetSession(): void {
  if (currentSession) {
    currentSession.dispose();
    currentSession = null;
    currentSessionCwd = null;
  }
  rebuildAuth();
}

/**
 * Detect an API-key provider from the key prefix.
 * Mirrors the auto-detection used in the CLI login flow.
 */
export function detectApiKeyProvider(key: string): string | null {
  const k = key.trim();
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("sk-")) return "openai";
  return null;
}

/**
 * Save an API key for a provider and reset the session so the next
 * request picks up the new credentials.
 *
 * @param provider - One of: anthropic, openrouter, openai (others passed through).
 * @param key      - The raw API key string.
 */
export function saveApiKey(provider: string, key: string): void {
  authStorage.set(provider, { type: "api_key", key });
  resetSession();
}

/**
 * Abort the current in-flight prompt, if any.
 * Used on client disconnect to stop wasting tokens.
 */
export async function abortSession(): Promise<void> {
  if (currentSession) {
    try {
      await currentSession.abort();
    } catch {
      // Ignore errors during abort — session may already be idle
    }
  }
}

// Exports for testing
export { authStorage, modelRegistry };
