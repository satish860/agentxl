# AgentXL — Module 1 Tasks

> "Chat with Claude in Excel" — Developer Version
>
> Goal: User runs `npm install -g agentxl` → `agentxl start` → authenticates via CLI → HTTPS server starts → add to Excel via Trusted Add-in Catalog → open taskpane → chat with AI inside Excel.
>
> No Excel tools yet. Just proving the full pipeline works end-to-end.

---

## Prerequisites

- Node.js 20+
- Excel desktop (Windows or Mac)
- A subscription (Claude Pro/Max, ChatGPT Plus, GitHub Copilot) or an API key (Anthropic, OpenRouter, OpenAI)

---

## Task 1: Project Scaffold ✅

**What:** Initialize the project with package.json, TypeScript config, dependencies, and folder structure.

**Files:** `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`

**Status:** Complete.

---

## Task 2: HTTPS Certificate Generation ✅

**What:** Generate OS-trusted localhost certificates using Microsoft's `office-addin-dev-certs`. Office add-ins require HTTPS, and Excel blocks untrusted certificates.

**Files:** `src/server/certs.ts`

**Details:**
- Uses `office-addin-dev-certs` (Microsoft's official package for Office Add-in development)
- Generates certs AND installs CA into OS trust store automatically
- Chrome, Edge, and Excel all trust localhost without manual steps
- Certs stored at `~/.office-addin-dev-certs/` (Microsoft's default location)
- First run may prompt for admin/keychain access — expected, one-time only

**Status:** Complete. 3 tests passing.

---

## Task 3: HTTPS Server ✅

**What:** Plain Node.js HTTPS server. No Express, no framework.

**Files:** `src/server/index.ts`

**Routes:**

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| `GET` | `/taskpane/*` | Serve static files | ✅ |
| `POST` | `/api/agent` | Chat with AI (SSE) | ✅ |
| `GET` | `/api/config/status` | Check auth status | ✅ |
| `GET` | `/api/version` | Return version | ✅ |

**Details:**
- Binds to `127.0.0.1` only
- CORS headers on all responses, OPTIONS preflight
- 405 for known routes with wrong method
- Content-Length on static files, cache headers (no-cache for HTML, max-age for assets)
- Path traversal protection
- SPA fallback for non-file paths
- Verbose request logging via `setVerbose()`
- `startServer(port, certs?)` and `stopServer()` exports

**Status:** Complete. 32 tests passing.

---

## Task 4: CLI Entry Point ✅

**What:** `bin/agentxl.js` — guided setup wizard when user types `agentxl start`.

**Files:** `bin/agentxl.js`

**Commands:**
- `agentxl start [--port 3001] [--verbose]` — authenticate (if needed) → start server → print next steps
- `agentxl login` — standalone auth setup
- `agentxl --version` — print version
- `agentxl --help` — print usage

**Start flow:**
```
  ┌──────────────────────────────────────┐
  │         AgentXL v1.0.0              │
  │      AI agent for Microsoft Excel    │
  └──────────────────────────────────────┘

  ✅ Auth ready
  ✅ HTTPS certificate ready (trusted by OS)
  ✅ Server running at https://localhost:3001

  [Next steps: browser test → one-time Excel setup → first message]
```

**Auth flow on first run (via Pi SDK):**
- Outcome-focused menu: subscriptions grouped, API key grouped, "no account yet?" path
- OAuth providers: `authStorage.login()` opens browser, saves token
- API key: auto-detects provider from prefix, saves via `authStorage.set()`
- Credentials shared with Pi (`~/.pi/agent/auth.json`) — same subscriptions, auto-refreshed tokens
- Skips auth if already authenticated

**Status:** Complete. Graceful shutdown with repeated-signal guard.

---

## Task 5: Agent Session + SSE Streaming ✅

**What:** Pi SDK agent session and the `POST /api/agent` SSE endpoint.

**Files:** `src/agent/session.ts`, `src/agent/models.ts`

**`src/agent/models.ts` — Default model selection:**
- Prefers subscriptions (OAuth) over API keys — subscriptions are already paid for
- Priority: Anthropic → OpenAI Codex → OpenRouter → OpenAI
- Uses `ModelRegistry.getAvailable()` (auth-aware) + `isUsingOAuth()` to rank
- Falls back to first available model

**`src/agent/session.ts` — Session management:**
- Auth resolution: `~/.agentxl/auth.json` → falls back to `~/.pi/agent/auth.json`
- Module-level singleton session
- `createAgentSession()` with `thinkingLevel: "medium"`, no built-in tools, in-memory session/settings
- Exports: `initSession()`, `getSession()`, `isAuthenticated()`, `getAuthProvider()`, `resetSession()`, `abortSession()`

**SSE endpoint (`POST /api/agent`):**
- 401 if not authenticated
- Prepends Excel context to message: `[Context: Active sheet: ..., Selected range: ...]`
- Streams all Pi SDK events as SSE (`data: {...}\n\n`)
- Closes stream on `agent_end`, handles client disconnect with `completed` guard
- Error events sent as `{ type: "error", error: "..." }`

**Status:** Complete. 19 tests passing (including live LLM SSE streaming tests).

---

## Task 6: Taskpane — Build Setup ✅

**What:** Set up React + Vite + Tailwind for the taskpane UI.

**Files:**
- `taskpane/index.html`
- `taskpane/vite.config.ts`
- `taskpane/tsconfig.json`
- `taskpane/src/main.tsx` (React entry point)
- `taskpane/src/styles/globals.css` (Tailwind directives)

**Details:**
- Vite + React 19 + Tailwind v4 + `@tailwindcss/typography`
- Build output: `taskpane/dist/`
- Base path: `/taskpane/`
- Office.js loaded from Microsoft CDN
- Tailwind v4 CSS-based (no `tailwind.config.js`)

**Status:** Complete.

---

## Task 7: Taskpane — Chat UI ✅

**What:** Main chat interface with streaming responses, modularized into hooks and components.

**Files:**
- `taskpane/src/app.tsx` — thin orchestrator (~100 lines)
- `taskpane/src/hooks/useAgentStatus.ts` — status fetch, reconnect, auth polling
- `taskpane/src/hooks/useChatStream.ts` — send, abort, streaming, error handling
- `taskpane/src/components/WelcomeScreen.tsx` — logo + quick actions
- `taskpane/src/components/MessageBubble.tsx` — user/assistant/system messages
- `taskpane/src/components/ChatInput.tsx` — textarea + send/stop buttons
- `taskpane/src/components/ThinkingBlock.tsx` — collapsible thinking display
- `taskpane/src/components/ConnectionError.tsx` — "can't connect" screen
- `taskpane/src/components/AuthRequired.tsx` — "run agentxl login" screen
- `taskpane/src/lib/types.ts` — typed `Message`, `AgentSSEEvent`, `AssistantMessageEvent`
- `taskpane/src/lib/stream-handler.ts` — SSE event → message updates (no React dependency)
- `taskpane/src/lib/api.ts` — API client, provider labels, SSE parsing

**Features:**
- Welcome screen with quick action buttons (Summarize, Chart, Formula)
- SSE parsing via `assistantMessageEvent` deltas
- Collapsible thinking blocks
- Markdown rendering (react-markdown + remark-gfm + typography)
- Reconnect banner on server failure (polls every 2s)
- Auth polling when unauthenticated (detects `agentxl login` automatically)
- Card-style assistant bubbles, right-aligned green user messages
- Friendly provider labels (anthropic → Claude, etc.)
- Stop button, Enter/Shift+Enter, auto-scroll, auto-resize textarea
- Input disabled during server-down state

**Status:** Complete.

---

## Task 8: Manifest ✅

**What:** Office add-in manifest XML for localhost.

**Files:**
- `manifest/manifest.xml`

**Details:**
- Taskpane URL: `https://localhost:3001/taskpane/`
- Display name: "AgentXL"
- Provider: "DeltaXY"
- Ribbon button on Home tab
- Permissions: `ReadWriteDocument`
- Placeholder icons (16/32/64/80px)
- Registration via Trusted Add-in Catalog (one-time setup)

**Status:** Complete. Verified working in Excel.

---

## Task 9: E2E Tests ✅

**What:** Playwright browser-based E2E tests covering the full pipeline.

**Files:** `tests/e2e.test.ts`

**Tests:**
1. Server health: version endpoint, auth status
2. Taskpane loads without JS errors
3. Welcome screen with quick actions
4. Textarea and send button present
5. Quick action fills textarea
6. Send message → streaming response from Claude
7. Follow-up message (session persists)
8. Stop button appears during streaming
9. Server stop/restart cycle

**Status:** Complete. 10 tests passing.

---

## All Tasks Complete ✅

| Task | Tests | Status |
|------|-------|--------|
| Task 1: Project Scaffold | — | ✅ |
| Task 2: HTTPS Certs | 3 | ✅ |
| Task 3: HTTPS Server | 32 | ✅ |
| Task 4: CLI + Auth | — | ✅ |
| Task 5: Agent Session + SSE | 19 | ✅ |
| Task 6: Taskpane Build Setup | — | ✅ |
| Task 7: Chat UI | — | ✅ |
| Task 8: Manifest | — | ✅ |
| Task 9: E2E Tests | 10 | ✅ |
| **Total** | **64** | **✅ All passing** |

---

## What Module 1 Does NOT Include

| Not included | Comes in |
|-------------|----------|
| Excel tools (read, write, format, chart) | Module 2 & 3 |
| ToolCard component | Module 2 |
| excel-executor.ts | Module 2 |
| Settings panel in taskpane | Module 4 |
| Taskpane-based auth onboarding | Module 4 |
| Auto-update system | Module 4 |
| Windows installer | Module 4 |
| System tray app | Module 4 |
| npm publish | Module 4 |

---

*Created: March 7, 2026*
*Updated: March 7, 2026 — All 9 tasks complete. Module 1 done.*
