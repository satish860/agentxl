# AgentXL — User Flow

> Complete user experience from first touch to daily use.

---

## 1. Discovery & Installation

### 1a. Developer Path (npm)

```
Developer sees AgentXL on GitHub / Hacker News / Reddit
  → README says: npm install -g agentxl
  → They run: agentxl start
  → CLI walks through setup:

  ┌──────────────────────────────────────┐
  │         AgentXL v1.0.0              │
  │      AI agent for Microsoft Excel    │
  └──────────────────────────────────────┘

  ✅ Auth ready
  ✅ HTTPS certificate ready (trusted by OS)
  ✅ Server running at https://localhost:3001

  ─────────────────────────────────────────────────
  All systems go. Here's what to do next:
  ─────────────────────────────────────────────────

  🌐 Test in browser (confirm everything works):
     https://localhost:3001/taskpane/

  📎 Load in Excel (one-time setup):
     1. Excel → File → Options → Trust Center → Trust Center Settings
     2. Trusted Add-in Catalogs → add path: [manifest folder]
     3. Check "Show in Menu" → OK → OK
     4. Restart Excel
     5. Insert → My Add-ins → SHARED FOLDER → AgentXL → Add

  After setup, just run 'agentxl start' and click
  AgentXL on the Home ribbon. No re-sideloading needed.

  💬 Try your first message:
     "What can you help me with in this workbook?"
```

### 1b. Auditor Path (Windows Installer) — Future

```
Auditor receives link from IT or visits agentxl.com
  → Clicks "Download for Windows"
  → Downloads AgentXL-Setup.exe (~50MB, bundled Node.js runtime)
  → Double-clicks installer
  → Standard Windows install wizard:
      "Welcome to AgentXL Setup"
      → Next → Install → Finish
  → Installer does:
      1. Installs AgentXL files to Program Files
      2. Generates HTTPS certificate for localhost
      3. Registers Office add-in manifest (no manual setup)
      4. Adds AgentXL to Windows startup (auto-start on boot)
      5. Starts the background service immediately
  → System tray icon appears: "AgentXL ✓ Running"
  → Done. No terminal. No commands. No manual steps.
```

### 1c. Enterprise Path (IT Deployment) — Future

```
IT admin deploys AgentXL via:
  → Group Policy / Intune / SCCM
  → Pre-configured with:
      - API key or Azure endpoint baked into config
      - Model selection pre-set
      - Update server pointed to internal mirror (optional)
  → User turns on laptop → AgentXL is just there
  → No setup required by the end user at all
```

---

## 2. First Launch — Onboarding

### 2a. Auth Setup (CLI — Current Implementation)

Auth is handled entirely in the CLI. On first run, `agentxl start` prompts:

```
  No API credentials found. Let's get you set up.

  How would you like to connect?

    Use an existing subscription (no API key needed):
      1. Claude Pro/Max — sign in with your Anthropic account
      2. ChatGPT Plus/Pro — sign in with your OpenAI account
      3. GitHub Copilot — sign in with your GitHub account
      4. Gemini — sign in with your Google account

    Use an API key:
      5. Paste an API key (Anthropic, OpenRouter, or OpenAI)

    No account yet?
      → Create a free OpenRouter account at https://openrouter.ai
        Get an API key instantly. Free models available.
```

- OAuth: opens browser for sign-in, saves token automatically
- API key: auto-detects provider from prefix (`sk-ant-` → Anthropic, `sk-or-` → OpenRouter, `sk-` → OpenAI)
- Credentials stored in `~/.pi/agent/auth.json` (shared with Pi)
- Subsequent runs skip auth if credentials exist
- `agentxl login` to change providers anytime

### 2b. Opening AgentXL in Excel

```
User opens Excel
  → Home tab on the ribbon shows "AgentXL" button
  → User clicks it
  → Taskpane opens on the right side of Excel
  → Welcome screen appears with quick actions
```

### 2c. Welcome Screen

```
┌─────────────────────────────────┐
│                                 │
│       ┌──────────┐              │
│       │    AX    │              │
│       └──────────┘              │
│                                 │
│         AgentXL                 │
│  Your AI assistant for Excel    │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 📊 Summarize data         │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 📈 Create chart            │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ✍️  Write formula          │  │
│  └───────────────────────────┘  │
│                                 │
│  Claude • v1.0.0                │
│                                 │
│ ┌─────────────────────────┬──┐  │
│ │ Ask about your data...  │ →│  │
│ └─────────────────────────┴──┘  │
│                                 │
└─────────────────────────────────┘
```

### 2d. Unauthenticated State

If the server is running but no auth is configured:

```
┌─────────────────────────────────┐
│                                 │
│           🔑                    │
│                                 │
│  Authentication required        │
│                                 │
│  Run `agentxl login` in your    │
│  terminal to set up credentials.│
│                                 │
│  🔄 Waiting for credentials…   │
│                                 │
└─────────────────────────────────┘
```

The taskpane polls for auth changes — when the user runs `agentxl login` in another terminal, the UI updates automatically.

### 2e. Future: Taskpane-Based Onboarding

Full onboarding UI within the taskpane is planned for a future module:
- Welcome screen → Connect to AI → Choose path
- Subscription (OAuth) / API Key / Free (OpenRouter)
- Settings panel for changing providers

---

## 3. Daily Use — The Chat Experience

### 3a. Opening AgentXL (Day 2+)

```
Developer path (current):
  → Run `agentxl start` in terminal
  → Open Excel → Click "AgentXL" on ribbon
  → Taskpane opens → Chat UI ready immediately
  → No login. No setup. Just chat.

Auditor path (future):
  → Boot laptop → AgentXL auto-starts (tray icon appears)
  → Open Excel → Click "AgentXL" on ribbon
  → Taskpane opens → Chat UI ready immediately
```

### 3b. The Chat Interface

```
┌─────────────────────────────────┐
│                                 │
│       ┌──────────┐              │
│       │    AX    │              │
│       └──────────┘              │
│                                 │
│  Your AI assistant for Excel    │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 📊 Summarize data         │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 📈 Create chart            │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ✍️  Write formula          │  │
│  └───────────────────────────┘  │
│                                 │
│ ┌─────────────────────────┬──┐  │
│ │ Ask about your data...  │ →│  │
│ └─────────────────────────┴──┘  │
│ Enter to send, Shift+Enter      │
│ for new line                    │
│                                 │
└─────────────────────────────────┘
```

### 3c. A Typical Interaction

```
USER: "What data do I have?"

  ┌─ Thinking ─────────────────┐
  │ Let me look at the workbook │
  │ to understand what data...  │
  └────────────────────────────┘

  ┌─ 📊 Getting workbook info ─┐
  │ ✓ Completed                │
  └────────────────────────────┘

  ┌─ 📖 Reading range ─────────┐
  │ ✓ Completed                │
  └────────────────────────────┘

AGENT: "You have a spreadsheet with sales data
  in Sheet1. It contains 150 rows with columns:
  - Date (Jan 2025 - Dec 2025)
  - Region (North, South, East, West)
  - Product (A, B, C)
  - Revenue
  - Units Sold

  Total revenue is $2.4M across all regions.
  Would you like me to analyze or visualize
  this data?"
```

### 3d. Multi-Step Agent Workflow

```
USER: "Create a summary by region with a chart"

  ┌─ Thinking ──────────────────────┐
  │ I'll create a new sheet with     │
  │ a summary table grouped by       │
  │ region, then add a chart...      │
  └─────────────────────────────────┘

  ┌─ 📄 Adding worksheet ──────────┐
  │ ✓ Created "Regional Summary"    │
  └─────────────────────────────────┘

  ┌─ ✍️ Writing to range ───────────┐
  │ ✓ Wrote summary data to A1:C5   │
  └─────────────────────────────────┘

  ┌─ 🎨 Formatting range ──────────┐
  │ ✓ Applied header formatting     │
  └─────────────────────────────────┘

  ┌─ 📊 Creating chart ────────────┐
  │ ✓ Created bar chart at E2       │
  └─────────────────────────────────┘

AGENT: "Done! I've created a 'Regional Summary'
  sheet with:
  - A summary table showing revenue by region
  - Headers formatted in bold with blue background
  - A bar chart comparing regional performance

  North leads with $780K, followed by East at
  $650K. Would you like to drill into any region?"
```

### 3e. Error States

```
SERVER DISCONNECTED:
┌─────────────────────────────────┐
│ ⚠️ Server disconnected —        │
│    reconnecting…                │
│   (auto-retries every 2s)       │
└─────────────────────────────────┘

NOT AUTHENTICATED:
┌─────────────────────────────────┐
│ 🔑 Authentication required      │
│                                 │
│ Run `agentxl login` in your     │
│ terminal to set up credentials. │
│                                 │
│ 🔄 Waiting for credentials…    │
└─────────────────────────────────┘

SERVER NOT RUNNING:
┌─────────────────────────────────┐
│ ❌ Can't connect to server      │
│                                 │
│ Make sure `agentxl start` is    │
│ running in your terminal.       │
│                                 │
│ ● Reconnecting…                 │
└─────────────────────────────────┘

API ERROR:
┌─────────────────────────────────┐
│ ⚠️ An error occurred            │
│ [error message from provider]   │
└─────────────────────────────────┘
```

---

## 4. Settings & Configuration

### Current (Module 1)

Settings are managed via CLI:

```bash
agentxl login          # Change auth provider
agentxl start --port   # Change port
agentxl start --verbose # Enable request logging
```

### Future (Module 4)

Settings panel within the taskpane:

```
┌─────────────────────────────────┐
│ ← Settings                     │
│                                 │
│ CONNECTION                      │
│ ┌───────────────────────────┐   │
│ │ Provider: Anthropic     ▼ │   │
│ │ Status:  ✅ Connected     │   │
│ │ [Change provider]         │   │
│ └───────────────────────────┘   │
│                                 │
│ ABOUT                           │
│ ┌───────────────────────────┐   │
│ │ Version: 1.2.0            │   │
│ │ [Check for updates]       │   │
│ └───────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

---

## 5. Updates

### Current (Module 1)

Manual — user updates via npm:

```bash
npm install -g agentxl@latest
```

### Future (Module 4)

Auto-update system:

```
AgentXL service running in background
  → Every 4 hours: checks update endpoint
  → New version found → downloads silently
  → Waits for idle (no active chat)
  → Restarts server (1-2 seconds)
  → Taskpane auto-reconnects
  → User never noticed
```

---

## 6. System Tray (Future — Module 4)

Lightweight tray app for the auditor/installer path:

```
System tray icon: AgentXL icon (small, unobtrusive)

Hover tooltip: "AgentXL — Running"

Right-click menu:
  ✓ Running
  ─────────────
  Open Excel
  Settings
  Check for Updates
  ─────────────
  Quit AgentXL
```

---

## 7. Uninstall

### Developer Path
```
npm uninstall -g agentxl
```

### Auditor Path (Future)
```
Windows Settings → Apps → AgentXL → Uninstall
  → Removes all files
  → Removes startup entry
  → Removes Office add-in registration
  → Optionally removes config (~/.pi/agent/)
  → Clean uninstall
```

---

## Flow Summary

```
Install (once)
  → npm install -g agentxl

First run (once)
  → agentxl start
  → CLI guides: auth → cert → server → next steps
  → Test in browser: https://localhost:3001/taskpane/
  → Add to Excel via Trusted Add-in Catalog (one-time)
  → Click AgentXL on ribbon → chat

Daily use (forever)
  → agentxl start
  → Open Excel → click AgentXL
  → Chat
  → Close Excel → Ctrl+C in terminal

Switch providers (anytime)
  → agentxl login
```

---

*Created: March 7, 2026*
*Updated: March 7, 2026 — Synced with implemented CLI flow, auth via CLI, Trusted Add-in Catalog setup*
