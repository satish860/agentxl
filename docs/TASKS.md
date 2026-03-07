# AgentXL — Module 1 Tasks

> "Chat with Claude in Excel" — Developer Version
>
> Goal: User runs `npm install -g agentxl` → `agentxl start` → authenticates via CLI → HTTPS server starts → sideload manifest in Excel → open taskpane → chat with AI inside Excel.
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

**What:** Generate self-signed localhost certificates. Office add-ins require HTTPS.

**Files:** `src/server/certs.ts`

**Status:** Complete. Certs stored at `~/.agentxl/certs/`. Auto-regenerates when expired. 6 tests passing.

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

**Status:** Complete. 33 tests passing.

---

## Task 4: CLI Entry Point ✅

**What:** `bin/agentxl.js` — runs when user types `agentxl start`.

**Files:** `bin/agentxl.js`

**Commands:**
- `agentxl start [--port 3001] [--verbose]` — authenticate (if needed) → start server
- `agentxl login` — standalone auth setup
- `agentxl --version` — print version
- `agentxl --help` — print usage

**Auth flow on first run (via Pi SDK):**
```
No API credentials found. Let's set you up.

Choose how to authenticate:

   1. Anthropic (Claude Pro/Max)
   2. GitHub Copilot
   3. Google Cloud Code Assist (Gemini CLI)
   4. Antigravity (Gemini 3, Claude, GPT-OSS)
   5. ChatGPT Plus/Pro (Codex Subscription)
   6. Paste an API key (Anthropic, OpenRouter, OpenAI)
```

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
- Exports: `initSession()`, `getSession()`, `isAuthenticated()`, `getAuthProvider()`, `resetSession()`

**SSE endpoint (`POST /api/agent`):**
- 401 if not authenticated
- Prepends Excel context to message: `[Context: Active sheet: ..., Selected range: ...]`
- Streams all Pi SDK events as SSE (`data: {...}\n\n`)
- Closes stream on `agent_end`, handles client disconnect
- Error events sent as `{ type: "error", error: "..." }`

**Status:** Complete. 17 tests passing (including live LLM SSE streaming tests).

---

## Task 6: Taskpane — Build Setup

**What:** Set up React + Vite + Tailwind for the taskpane UI.

**Files:**
- `taskpane/index.html`
- `taskpane/vite.config.ts`
- `taskpane/tsconfig.json`
- `taskpane/src/main.tsx` (React entry point)
- `taskpane/src/styles/globals.css` (Tailwind directives)

**Details:**
- `taskpane/index.html`:
  - Load Office.js from Microsoft CDN: `<script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>`
  - Load our React bundle: `<script type="module" src="/src/main.tsx"></script>` (Vite dev) or built asset
  - Minimal HTML: `<div id="root"></div>`
- `taskpane/vite.config.ts`:
  - React plugin
  - Tailwind v4 via `@tailwindcss/vite` plugin
  - Build output: `taskpane/dist/`
  - Base path: `/taskpane/`
- `taskpane/src/main.tsx`:
  - Wait for Office.js to initialize (or proceed without it for browser testing)
  - Render `<App />` into `#root`
- Tailwind v4 setup — CSS-based, no `tailwind.config.js`:
  - `globals.css` uses `@import "tailwindcss";` (v4 pattern)
  - No `postcss.config.js` needed — Tailwind v4 runs as a Vite plugin

**Done when:** `npm run build:taskpane` produces `taskpane/dist/index.html` + JS/CSS bundles. Server serves it at `https://localhost:3001/taskpane/`.

---

## Task 7: Taskpane — Chat UI

**What:** Main chat interface with streaming responses. Since auth is handled by the CLI, the taskpane goes straight to chat.

**Files:**
- `taskpane/src/app.tsx`
- `taskpane/src/components/ThinkingBlock.tsx` (simple, for thinking text)

**Details:**
- **State management:**
  ```
  messages: Message[]           — chat history
  input: string                 — current input text
  isStreaming: boolean           — is agent responding
  streamingContent: string      — current streaming text
  ```
- **On app load:**
  - `GET /api/config/status` → verify auth
  - If not authenticated → show message: "Run `agentxl login` in your terminal to set up credentials"
  - If authenticated → show chat UI
- **Welcome screen (no messages):**
  - AgentXL icon
  - "Your AI assistant for Excel"
  - Quick action buttons:
    - 📊 "Summarize data"
    - 📈 "Create chart"
    - ✍️ "Write formula"
  - Clicking a quick action fills the input field
- **Chat area (has messages):**
  - User messages: right-aligned, subtle background
  - Assistant messages: left-aligned, card-style with border
  - System messages (errors): centered, muted
  - Auto-scroll to bottom on new content
- **Input area:**
  - Textarea (auto-grows, max 5 lines)
  - Send button (arrow icon)
  - Enter to send, Shift+Enter for new line
  - Disabled while streaming
- **Sending a message:**
  1. Add user message to state
  2. Clear input, set `isStreaming = true`
  3. Gather Excel context if Office.js is available
  4. `fetch("POST /api/agent", { message, context })`
  5. Read SSE stream via `response.body.getReader()`
  6. On `message_update` with text → update streaming content
  7. On `message_update` with thinking → show in ThinkingBlock (italic/collapsible)
  8. On `agent_end` → finalize message, clear streaming state
  9. On error → show as system message
- **Markdown rendering:**
  - `react-markdown` + `remark-gfm`
  - Supports: bold, italic, lists, tables, code blocks, links
- **Auto-reconnect:**
  - If fetch fails, show "Reconnecting..." banner, retry every 2s
- **No tool cards yet** — Module 2

**Done when:** User can type a message, see streaming response rendered as markdown, send follow-ups. Works in browser and inside Excel taskpane.

---

## Task 8: Manifest

**What:** Office add-in manifest XML for localhost.

**Files:**
- `manifest/manifest.xml`
- `taskpane/public/assets/icon-16.png`
- `taskpane/public/assets/icon-32.png`
- `taskpane/public/assets/icon-80.png`

**Details:**
- Taskpane URL: `https://localhost:3001/taskpane/`
- Icon URLs: `https://localhost:3001/taskpane/assets/icon-*.png`
- Display name: "AgentXL"
- Description: "AI-powered Excel assistant"
- Provider name: "DeltaXY"
- Ribbon button on Home tab: "AgentXL"
- Permissions: `ReadWriteDocument`
- Placeholder icons for Module 1

**Done when:** User can sideload manifest in Excel, "AgentXL" button appears on ribbon, clicking opens taskpane from `https://localhost:3001/taskpane/`.

---

## Task 9: Build Pipeline & End-to-End Test

**What:** Wire everything together. Full build, full test.

**Build flow:**
```
npm run build
  → tsc compiles src/ → dist/
  → vite builds taskpane/src/ → taskpane/dist/
```

**End-to-end test checklist:**
```
[ ] npm install                              → dependencies installed
[ ] npm run build                            → compiles without errors
[ ] agentxl start                            → auth prompt (if needed) → server starts
[ ] https://localhost:3001/api/version       → returns { version: "1.0.0" }
[ ] https://localhost:3001/api/config/status → returns { authenticated: true }
[ ] https://localhost:3001/taskpane/         → serves chat UI
[ ] Send "Hello" in chat                     → Claude responds, streaming markdown
[ ] Follow-up message                        → conversation continues
[ ] Excel: sideload manifest.xml             → AgentXL button appears on ribbon
[ ] Click AgentXL button                     → taskpane opens inside Excel
[ ] Chat works inside Excel                  → same as browser test
[ ] Ctrl+C in terminal                       → server stops cleanly
[ ] Restart server                           → auth persisted, no re-auth
```

**Done when:** All checklist items pass.

---

## Task Dependencies

```
Task 1: Project Scaffold ✅
  │
  ├──► Task 2: HTTPS Certs ✅
  │      │
  │      ▼
  ├──► Task 3: HTTPS Server ✅
  │      │
  │      ▼
  ├──► Task 4: CLI + Auth Onboarding ✅
  │      │
  │      ▼
  ├──► Task 5: Agent Session + SSE ✅
  │
  │    (Server side done)
  │
  ├──► Task 6: Taskpane Build Setup
  │      │
  │      ▼
  ├──► Task 7: Chat UI
  │
  │    (Taskpane done)
  │
  ├──► Task 8: Manifest
  │
  └──► Task 9: Build Pipeline + E2E Test
```

---

## What Module 1 Does NOT Include

| Not included | Comes in |
|-------------|----------|
| Excel tools (read, write, format, chart) | Module 2 & 3 |
| ToolCard component | Module 2 |
| excel-executor.ts | Module 2 |
| Settings panel in taskpane | Module 4 |
| Auto-update system | Module 4 |
| Windows installer | Module 4 |
| System tray app | Module 4 |
| npm publish | Module 4 |

---

## Test Summary

| Test Suite | Tests | Status |
|------------|-------|--------|
| `tests/certs.test.ts` | 6 | ✅ All passing |
| `tests/server.test.ts` | 33 | ✅ All passing |
| `tests/session.test.ts` | 17 | ✅ All passing |
| **Total** | **56** | **✅ All passing** |

---

## Estimated Remaining Effort

| Task | Effort |
|------|--------|
| Task 6: Taskpane Build Setup | 1 hour |
| Task 7: Chat UI | 2-3 hours |
| Task 8: Manifest | 30 min |
| Task 9: Build + E2E Test | 1-2 hours |
| **Remaining** | **~5-7 hours** |

---

*Created: March 7, 2026*
*Updated: March 7, 2026 — Tasks 1-5 complete, Task 6 (auth endpoints) removed (auth handled by CLI)*
