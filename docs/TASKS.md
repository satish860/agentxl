# AgentXL — Module 1 Tasks

> "Chat with Claude in Excel" — Developer Version
>
> Goal: User runs `agentxl start` → HTTPS server starts → sideload manifest in Excel → open taskpane → enter API key → chat with AI inside Excel.
>
> No Excel tools yet. Just proving the full pipeline works end-to-end.

---

## Prerequisites

- Node.js 20+
- Excel desktop (Windows or Mac)
- An API key (Anthropic, OpenRouter, OpenAI) or a subscription (Claude Pro, Copilot, etc.)

---

## Task 1: Project Scaffold

**What:** Initialize the project with package.json, TypeScript config, dependencies, and folder structure.

**Files:**
- `package.json`
- `tsconfig.json`
- `.gitignore`
- `.env.example`

**Details:**
- `npm init` — name: `agentxl`, bin: `{ "agentxl": "./bin/agentxl.js" }`
- Production dependencies:
  - `@mariozechner/pi-coding-agent` (agent framework — auth, models, sessions, tools, streaming)
  - `@sinclair/typebox` (tool parameter schemas)
- Dev dependencies:
  - `typescript`, `@types/node`
  - `vite`, `@vitejs/plugin-react` (taskpane bundler)
  - `react`, `react-dom`, `@types/react`, `@types/react-dom`
  - `react-markdown`, `remark-gfm` (markdown rendering in chat)
  - `lucide-react` (icons)
  - `tailwindcss` (styling)
  - `@microsoft/office-js` (Office.js types only)
- `.gitignore`: `node_modules`, `dist`, `taskpane/dist`, `.env`, `*.pem`, `~/.agentxl`
- `.env.example`: `ANTHROPIC_API_KEY=`, `OPENROUTER_API_KEY=`, `OPENAI_API_KEY=`
- Create empty folder structure:
  ```
  bin/
  src/server/
  src/agent/
  src/agent/tools/
  src/agent/provider/
  taskpane/src/
  taskpane/src/components/
  taskpane/src/lib/
  taskpane/src/styles/
  manifest/
  ```

**Done when:** `npm install` succeeds, `npx tsc --noEmit` succeeds with empty source files, folder structure exists.

---

## Task 2: HTTPS Certificate Generation

**What:** Generate self-signed localhost certificates. Office add-ins require HTTPS.

**Files:**
- `src/server/certs.ts`

**Details:**
- Export function `ensureCerts(): { key: string, cert: string }`
- Check if certs exist at `~/.agentxl/certs/localhost.key` and `localhost.crt`
- If they exist, read and return them
- If not, generate:
  - Self-signed CA (Certificate Authority)
  - Localhost certificate signed by that CA
  - Valid for `localhost` and `127.0.0.1`
  - Valid for 1 year
  - Store all files in `~/.agentxl/certs/`
- Use `selfsigned` npm package (lightweight, does exactly this) or Node.js `crypto` module
- Print message on first generation: "Generated HTTPS certificate for localhost"
- Print tip: "If Excel shows a certificate warning, you may need to trust the certificate"

**Done when:** Running the function creates certs in `~/.agentxl/certs/`, subsequent calls reuse them, HTTPS server can use them without errors.

---

## Task 3: HTTPS Server

**What:** Plain Node.js HTTPS server with 5 routes. No Express, no framework.

**Files:**
- `src/server/index.ts`

**Routes:**

| Method | Path | Purpose | Implemented in |
|--------|------|---------|---------------|
| `GET` | `/taskpane/*` | Serve static files | This task |
| `POST` | `/api/agent` | Chat with AI (SSE) | Task 5 |
| `POST` | `/api/config/auth` | Set API key | Task 6 |
| `GET` | `/api/config/status` | Check auth status | Task 6 |
| `GET` | `/api/version` | Return version | This task |

**Details:**
- `https.createServer()` with certs from Task 2
- Bind to `127.0.0.1` only (not `0.0.0.0` — no network exposure)
- Default port: `3001`, configurable via `--port`
- Static file serving for `/taskpane/*`:
  - Map URL path to `taskpane/dist/` directory
  - `/taskpane` and `/taskpane/` → `taskpane/dist/index.html`
  - Handle MIME types: `.html`, `.js`, `.css`, `.png`, `.svg`, `.json`, `.ico`
  - 404 for missing files
- `/api/version` → return `{ version }` from package.json
- CORS headers: `Access-Control-Allow-Origin: *` (localhost only, safe)
- Request body parsing for POST routes (JSON)
- Export `startServer(port: number): Promise<void>`

**Done when:** Server starts, `https://localhost:3001/api/version` returns version, `https://localhost:3001/taskpane/` serves static files (once taskpane is built).

---

## Task 4: CLI Entry Point

**What:** `bin/agentxl.js` — runs when user types `agentxl start`.

**Files:**
- `bin/agentxl.js`

**Details:**
- Hashbang: `#!/usr/bin/env node`
- Parse command line args:
  - `agentxl start [--port 3001]` — start the server
  - `agentxl --version` — print version
  - `agentxl --help` — print usage
- On `start`:
  1. Print AgentXL banner (name + version)
  2. Call `ensureCerts()` from Task 2
  3. Call `startServer(port)` from Task 3
  4. Print:
     ```
     🚀 AgentXL running at https://localhost:3001

     📎 First time? Sideload the add-in in Excel:
        Excel → Insert → My Add-ins → Upload My Add-in
        Select: [absolute path to manifest/manifest.xml]

     💡 Or test in browser: https://localhost:3001/taskpane
     ```
  5. Handle `SIGINT` / `SIGTERM` → graceful shutdown with message "AgentXL stopped"
- No arg parsing library needed — just `process.argv` for 2 flags

**Done when:** `node bin/agentxl.js start` starts the server, `--version` prints version, `--help` prints usage, Ctrl+C exits cleanly.

---

## Task 5: Agent Session + SSE Streaming

**What:** Pi Coding Agent session and the `POST /api/agent` endpoint.

**Files:**
- `src/agent/session.ts`
- `src/agent/models.ts`

**`src/agent/models.ts` — Default model selection:**
- Function `getDefaultModel(modelRegistry, authStorage): Model`
- Check providers in order: Anthropic → OpenRouter → OpenAI
- For each, pick the best model:
  - Anthropic → `claude-sonnet-4-20250514`
  - OpenRouter → `anthropic/claude-sonnet-4` (or first available)
  - OpenAI → `gpt-4o`
- Return the first model that has a valid key configured
- If no model available, return `null` (server will return 401 on /api/agent)

**`src/agent/session.ts` — Session management:**
- Import from `@mariozechner/pi-coding-agent`:
  - `createAgentSession`, `AuthStorage`, `ModelRegistry`, `SessionManager`, `SettingsManager`
- Create `AuthStorage` at `~/.agentxl/auth.json`
- Create `ModelRegistry` with that AuthStorage
- Module-level singleton: one session, persists across requests
- Export `initSession()`:
  - Get default model via `getDefaultModel()`
  - `createAgentSession()` with:
    - Selected model
    - `thinkingLevel: "medium"`
    - `SessionManager.inMemory()` (no file persistence for now)
    - `SettingsManager.inMemory({ compaction: { enabled: false } })`
    - No built-in tools (no read/bash/edit/write — Excel-only agent)
    - No custom tools yet (Module 2)
  - Return session
- Export `getSession()`: return existing session or init new one
- Export `isAuthenticated(): boolean`: check if any provider has a key
- Export `resetSession()`: dispose and recreate (called when auth changes)

**SSE endpoint in `src/server/index.ts`:**
- On `POST /api/agent`:
  - Parse body: `{ message: string, context?: { activeSheet?, selectedRange? } }`
  - If not authenticated → return 401 `{ error: "Not authenticated" }`
  - Get or create session
  - Set response headers for SSE: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
  - Prepend context to message if provided: `[Context: Active sheet: Sheet1, Selected range: A1:D10]\n\n{message}`
  - Subscribe to session events
  - Call `session.prompt(fullMessage)`
  - On each event, write: `data: ${JSON.stringify(event)}\n\n`
  - On `agent_end` → close the response stream, unsubscribe
  - On error → write error event, close stream

**Done when:** With a valid API key in `~/.agentxl/auth.json`, `POST /api/agent` with `{ "message": "Hello" }` streams SSE events back with Claude's response.

---

## Task 6: Auth Configuration Endpoints

**What:** Endpoints for the taskpane to set API keys and check auth status.

**Files:**
- `src/agent/auth.ts` (auth helpers)
- Updates to `src/server/index.ts` (route handlers)

**`src/agent/auth.ts`:**
- Export `detectProvider(key: string): string`:
  - `sk-ant-*` → `"anthropic"`
  - `sk-or-*` → `"openrouter"`
  - `sk-*` → `"openai"`
  - Otherwise → `"unknown"`
- Export `saveApiKey(provider: string, key: string)`:
  - Call `authStorage.setRuntimeApiKey(provider, key)`
  - Also write to `~/.agentxl/auth.json` in Pi SDK compatible format:
    ```json
    { "anthropic": { "type": "api_key", "key": "sk-ant-..." } }
    ```
  - Trigger session reset (new key → new session with new model)
- Export `getAuthStatus(): { authenticated: boolean, provider: string | null }`

**`POST /api/config/auth` handler:**
- Parse body: `{ provider?: string, key: string }`
- If provider not specified, auto-detect from key prefix
- Call `saveApiKey(provider, key)`
- Return `{ success: true, provider }`
- On error → return `{ success: false, error: "..." }`

**`GET /api/config/status` handler:**
- Call `getAuthStatus()`
- Return `{ authenticated: true/false, provider: "anthropic" | null, version: "1.0.0" }`

**Done when:** `POST /api/config/auth` with `{ "key": "sk-ant-..." }` saves the key, `GET /api/config/status` returns authenticated status, subsequent `POST /api/agent` calls work with the saved key.

---

## Task 7: Taskpane — Build Setup

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
- npm scripts in root `package.json`:
  - `build:taskpane` → `cd taskpane && vite build`
  - `dev:taskpane` → `cd taskpane && vite dev` (for standalone UI development)
  - `build` → `tsc && npm run build:taskpane`

**Done when:** `npm run build:taskpane` produces `taskpane/dist/index.html` + JS/CSS bundles. Opening `taskpane/dist/index.html` shows a blank React app. Server serves it at `https://localhost:3001/taskpane/`.

---

## Task 8: Taskpane — Onboarding UI

**What:** Welcome screen and API key setup flow.

**Files:**
- `taskpane/src/components/Onboarding.tsx`

**Details:**
- Component renders when `GET /api/config/status` returns `{ authenticated: false }`
- **Screen 1 — Welcome:**
  - AgentXL logo/icon
  - "Your AI assistant for Excel"
  - "Everything runs on your machine. Your data stays private."
  - [Get Started →] button
- **Screen 2 — Choose path:**
  - Three cards:
    - 🔑 "I have a subscription" → Screen 3a
    - 🔧 "I have an API key" → Screen 3b
    - 🚀 "Get started free" → Screen 3c
- **Screen 3a — Subscription (OAuth):**
  - Provider selection: Claude Pro/Max, ChatGPT Plus/Pro, GitHub Copilot
  - [Sign in →] button
  - "Your browser will open for sign-in"
  - Note: OAuth flow needs Pi SDK's auth flow. For Module 1, this may just show instructions or trigger the flow if Pi SDK supports it from the server. If complex, defer full OAuth to a later module and show "Coming soon" or guide them to get an API key instead.
- **Screen 3b — API Key:**
  - Provider selection: Anthropic, OpenAI, OpenRouter, Azure
  - Paste field for API key
  - [Connect →] button
  - "🔒 Your key is stored locally on your machine only"
  - On connect: `POST /api/config/auth { provider, key }`
  - Success → Screen 4
  - Failure → show error, stay on screen
- **Screen 3c — Free (OpenRouter):**
  - Step 1: "Create an OpenRouter account" + [Open OpenRouter →] link (opens `https://openrouter.ai`)
  - Step 2: "Create an API key" + [Open Keys Page →] link (opens `https://openrouter.ai/keys`)
  - Step 3: Paste field for key
  - [Connect →] button
  - "✨ Free models available immediately. No credit card needed."
  - On connect: same as 3b with provider auto-detected as "openrouter"
- **Screen 4 — Connected:**
  - "✅ You're all set!"
  - Sample prompts they can try
  - [Start chatting →] button → transitions to chat UI
- All screens have ← Back navigation
- Styling: clean, simple, Tailwind. Not fancy — functional.

**Done when:** Opening taskpane without auth shows onboarding flow. Entering a valid API key saves it and transitions to chat. Entering an invalid key shows an error.

---

## Task 9: Taskpane — Chat UI

**What:** Main chat interface with streaming responses.

**Files:**
- `taskpane/src/app.tsx`

**Details:**
- **State management:**
  ```
  messages: Message[]           — chat history
  input: string                 — current input text
  isStreaming: boolean           — is agent responding
  streamingContent: string      — current streaming text
  isAuthenticated: boolean      — show chat vs onboarding
  ```
- **On app load:**
  - `GET /api/config/status`
  - If authenticated → show chat UI
  - If not → show Onboarding component (Task 8)
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
  2. Clear input, reset textarea height
  3. Set `isStreaming = true`
  4. Gather Excel context if Office.js is available:
     ```
     Excel.run → get active sheet name + selected range address
     ```
     If Office.js not available (browser testing), skip context
  5. `fetch("POST /api/agent", { message, context })`
  6. Read response as SSE stream:
     ```
     const reader = response.body.getReader()
     while (true) {
       const { done, value } = await reader.read()
       // parse "data: {...}\n\n" lines
       // handle event types
     }
     ```
  7. On `message_update` with text content → update `streamingContent`
  8. On `message_update` with thinking content → show thinking text (simple italic for now, ThinkingBlock component comes in Module 3)
  9. On `agent_end` → finalize assistant message, clear streaming state
  10. On error → show error as system message
- **Markdown rendering:**
  - Assistant text rendered with `react-markdown` + `remark-gfm`
  - Supports: bold, italic, lists, tables, code blocks, links
- **Auto-reconnect:**
  - If fetch fails (server down/restarting), show "Reconnecting..." banner
  - Retry every 2 seconds
  - On success, banner disappears
- **No tool cards yet** — those come in Module 2. If a tool event comes through, ignore it or show a simple text line.

**Done when:** User can type a message, see streaming response from Claude rendered as markdown, send follow-up messages. Chat history preserved in session. Works in both browser (without Excel) and inside Excel taskpane.

---

## Task 10: Manifest

**What:** Office add-in manifest XML for localhost.

**Files:**
- `manifest/manifest.xml`
- `taskpane/public/assets/icon-16.png`
- `taskpane/public/assets/icon-32.png`
- `taskpane/public/assets/icon-80.png`

**Details:**
- Based on Deepak's manifest, with all URLs changed:
  - `https://agent-excel-six.vercel.app` → `https://localhost:3001`
  - Taskpane URL: `https://localhost:3001/taskpane/`
  - Icon URLs: `https://localhost:3001/taskpane/assets/icon-*.png`
- Update metadata:
  - Display name: "AgentXL"
  - Description: "AI-powered Excel assistant"
  - Provider name: "DeltaXY"
  - New unique GUID for the add-in ID
- Ribbon button on Home tab: "AgentXL" with icon
- Permissions: `ReadWriteDocument`
- Placeholder icons: simple solid-color squares with "AX" text or a simple icon. Doesn't need to be polished for Module 1.

**Done when:** User can sideload `manifest/manifest.xml` in Excel (Insert → My Add-ins → Upload My Add-in), "AgentXL" button appears on Home ribbon, clicking it opens taskpane loading from `https://localhost:3001/taskpane/`.

---

## Task 11: Build Pipeline & End-to-End Test

**What:** Wire everything together. Build scripts, TypeScript compilation, full test.

**Files:**
- Updates to `package.json` (scripts)
- Updates to `tsconfig.json` (if needed)

**npm scripts:**
```json
{
  "build": "tsc && npm run build:taskpane",
  "build:server": "tsc",
  "build:taskpane": "cd taskpane && npx vite build",
  "dev:taskpane": "cd taskpane && npx vite dev",
  "start": "node dist/server/index.js"
}
```

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
[ ] node bin/agentxl.js start                → server starts, prints banner
[ ] https://localhost:3001/api/version       → returns { version: "1.0.0" }
[ ] https://localhost:3001/api/config/status → returns { authenticated: false }
[ ] https://localhost:3001/taskpane/         → serves onboarding UI
[ ] Enter API key via onboarding UI          → POST /api/config/auth succeeds
[ ] https://localhost:3001/api/config/status → returns { authenticated: true }
[ ] Chat UI appears                          → send "Hello"
[ ] Claude responds                          → streaming markdown renders
[ ] Follow-up message works                  → conversation continues
[ ] Excel: sideload manifest.xml             → AgentXL button appears on ribbon
[ ] Click AgentXL button                     → taskpane opens inside Excel
[ ] Onboarding flow works in Excel           → enter key, get to chat
[ ] Chat works inside Excel                  → same as browser test
[ ] Ctrl+C in terminal                       → server stops cleanly
[ ] Restart server                           → API key persisted, no re-auth needed
```

**Done when:** All checklist items pass.

---

## Task Dependencies

```
Task 1: Project Scaffold
  │
  ├──► Task 2: HTTPS Certs
  │      │
  │      ▼
  ├──► Task 3: HTTPS Server
  │      │
  │      ▼
  ├──► Task 4: CLI Entry Point
  │      │
  │      ▼
  ├──► Task 5: Agent Session + SSE ◄── Task 6: Auth Endpoints
  │
  │    (Server side done)
  │
  ├──► Task 7: Taskpane Build Setup
  │      │
  │      ▼
  ├──► Task 8: Onboarding UI
  │      │
  │      ▼
  ├──► Task 9: Chat UI
  │
  │    (Taskpane done)
  │
  ├──► Task 10: Manifest
  │
  └──► Task 11: Build Pipeline + E2E Test
```

**Parallelizable:** Tasks 2-6 (server) and Tasks 7-9 (taskpane) can be built independently. They connect when the server serves the built taskpane files.

---

## What Module 1 Does NOT Include

| Not included | Comes in |
|-------------|----------|
| Excel tools (read, write, format, chart) | Module 2 & 3 |
| ToolCard component | Module 2 |
| ThinkingBlock component (styled) | Module 3 |
| excel-executor.ts | Module 2 |
| Settings panel in taskpane | Module 4 |
| Auto-update system | Module 4 |
| Windows installer | Module 4 |
| System tray app | Module 4 |
| npm publish | Module 4 |

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Task 1: Project Scaffold | 30 min |
| Task 2: HTTPS Certs | 45 min |
| Task 3: HTTPS Server | 1 hour |
| Task 4: CLI Entry Point | 30 min |
| Task 5: Agent Session + SSE | 2 hours |
| Task 6: Auth Endpoints | 1 hour |
| Task 7: Taskpane Build Setup | 1 hour |
| Task 8: Onboarding UI | 2 hours |
| Task 9: Chat UI | 2-3 hours |
| Task 10: Manifest | 30 min |
| Task 11: Build + E2E Test | 1-2 hours |
| **Total** | **~12-14 hours** |

---

*Created: March 7, 2026*
