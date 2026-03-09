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
  AuthStorage,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSession,
} from "@mariozechner/pi-coding-agent";
import { getDefaultModel } from "./models.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const AGENTXL_DIR = join(homedir(), ".agentxl");
const AGENTXL_AUTH_PATH = join(AGENTXL_DIR, "auth.json");
const PI_AUTH_PATH = join(homedir(), ".pi", "agent", "auth.json");

/**
 * Resolve auth file path.
 * Uses AgentXL's own auth.json if it exists, otherwise falls back to
 * Pi's auth.json. This lets users who already have Pi set up get seamless
 * auth — same subscriptions, same OAuth tokens, auto-refreshed.
 */
function resolveAuthPath(): string {
  if (existsSync(AGENTXL_AUTH_PATH)) return AGENTXL_AUTH_PATH;
  if (existsSync(PI_AUTH_PATH)) return PI_AUTH_PATH;
  return AGENTXL_AUTH_PATH; // default (will be created on first auth)
}

// ---------------------------------------------------------------------------
// Singletons — rebuilt on resetSession() to pick up auth changes
// ---------------------------------------------------------------------------

let authStorage = new AuthStorage(resolveAuthPath());
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
  authStorage = new AuthStorage(resolveAuthPath());
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

  const model = getDefaultModel(modelRegistry);
  if (!model) {
    throw new Error(
      "No model available. Run 'agentxl login' to set up authentication " +
        "(API key or subscription)."
    );
  }

  // Track the selected provider
  selectedProvider = model.provider;

  const effectiveCwd = cwd || process.cwd();
  const tools = createReadOnlyTools(effectiveCwd);

  const { session } = await createAgentSession({
    model,
    cwd: effectiveCwd,
    thinkingLevel: "medium",
    tools,                    // read, grep, find, ls — pointed at linked folder
    customTools: [],          // Excel tools come later
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: false },
    }),
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
 * Check if any provider has auth configured.
 * Fast check — does not refresh OAuth tokens.
 */
export function isAuthenticated(): boolean {
  modelRegistry.refresh();
  const available = modelRegistry.getAvailable();
  return available.length > 0;
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
  const model = getDefaultModel(modelRegistry);
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
