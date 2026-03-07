# AgentXL — User Flow

> Complete user experience from first touch to daily use.

---

## 1. Discovery & Installation

### 1a. Developer Path (npm)

```
Developer sees AgentXL on GitHub / Hacker News / Reddit
  → README says: npm install -g agentxl
  → They run: agentxl start
  → Terminal shows:
      🚀 AgentXL running at https://localhost:3001
      📎 First time? Sideload the add-in in Excel:
         Excel → Insert → My Add-ins → Upload My Add-in
         Select: C:\Users\you\.agentxl\manifest.xml
  → They sideload the manifest once
  → Done
```

### 1b. Auditor Path (Windows Installer)

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
      3. Registers Office add-in manifest (no manual sideloading)
      4. Adds AgentXL to Windows startup (auto-start on boot)
      5. Starts the background service immediately
  → System tray icon appears: "AgentXL ✓ Running"
  → Done. No terminal. No commands. No manual steps.
```

### 1c. Enterprise Path (IT Deployment)

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

### 2a. Opening AgentXL in Excel

```
User opens Excel
  → Home tab on the ribbon shows "AgentXL" button
  → User clicks it
  → Taskpane opens on the right side of Excel
  → First time: Onboarding screen appears
```

### 2b. Onboarding Screen 1 — Welcome

```
┌─────────────────────────────────┐
│                                 │
│       ┌──────────┐              │
│       │  AgentXL │              │
│       │   logo   │              │
│       └──────────┘              │
│                                 │
│  Your AI assistant for Excel    │
│                                 │
│  AgentXL reads your data,       │
│  writes formulas, creates       │
│  charts, and formats your       │
│  spreadsheets — all from a      │
│  simple chat.                   │
│                                 │
│  Everything runs on your        │
│  machine. Your data stays       │
│  private.                       │
│                                 │
│  [Get Started →]                │
│                                 │
└─────────────────────────────────┘
```

### 2c. Onboarding Screen 2 — Connect to AI

```
┌─────────────────────────────────┐
│                                 │
│  🔐 Connect to AI              │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🔑 I have a subscription  │  │
│  │ Claude Pro/Max, ChatGPT+, │  │
│  │ GitHub Copilot             │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🔧 I have an API key      │  │
│  │ Anthropic, OpenAI,        │  │
│  │ OpenRouter, Azure         │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🚀 Get started free       │  │
│  │ No account? Start here    │  │
│  └───────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

### 2d. Path A — Subscription (OAuth)

```
┌─────────────────────────────────┐
│                                 │
│  ← Back                        │
│                                 │
│  Select your provider:          │
│                                 │
│  ┌───────────────────────────┐  │
│  │ ◉ Claude Pro / Max        │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ○ ChatGPT Plus / Pro      │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ○ GitHub Copilot          │  │
│  └───────────────────────────┘  │
│                                 │
│  [Sign in →]                    │
│                                 │
│  Your browser will open for     │
│  sign-in. Come back here        │
│  when done.                     │
│                                 │
└─────────────────────────────────┘

User clicks "Sign in"
  → Browser opens → OAuth flow with selected provider
  → Token saved automatically
  → Taskpane updates: "✅ Connected!"
  → [Start chatting →]
```

### 2e. Path B — API Key

```
┌─────────────────────────────────┐
│                                 │
│  ← Back                        │
│                                 │
│  Select your provider:          │
│                                 │
│  ○ Anthropic                    │
│  ○ OpenAI                       │
│  ○ OpenRouter                   │
│  ○ Azure                        │
│                                 │
│  Paste your API key:            │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  [Connect →]                    │
│                                 │
│  🔒 Your key is stored locally  │
│  on your machine only.          │
│                                 │
└─────────────────────────────────┘

User pastes key → clicks Connect
  → Taskpane sends to server: POST /api/config/auth
  → Server validates key (quick test call)
  → Success: "✅ Connected!" → [Start chatting →]
  → Failure: "❌ Invalid key. Please check and try again."
```

### 2f. Path C — Get Started Free (OpenRouter)

```
┌─────────────────────────────────┐
│                                 │
│  ← Back                        │
│                                 │
│  🚀 Free in 3 easy steps       │
│                                 │
│  ❶ Create an OpenRouter account │
│     Sign in with Google —       │
│     takes 30 seconds.           │
│                                 │
│     [Open OpenRouter →]         │
│                                 │
│  ❷ Create an API key            │
│     Go to the Keys page and     │
│     click "Create Key"          │
│                                 │
│     [Open Keys Page →]          │
│                                 │
│  ❸ Paste your key here          │
│  ┌───────────────────────────┐  │
│  │ sk-or-...                 │  │
│  └───────────────────────────┘  │
│                                 │
│  [Connect →]                    │
│                                 │
│  ✨ Free models available       │
│     immediately.                │
│     No credit card needed.      │
│                                 │
└─────────────────────────────────┘

User follows steps → pastes key → Connect
  → Same flow as Path B
  → Provider auto-detected as OpenRouter from key prefix "sk-or-"
```

### 2g. Onboarding Complete

```
┌─────────────────────────────────┐
│                                 │
│  ✅ You're all set!             │
│                                 │
│  Try asking:                    │
│                                 │
│  "Summarize the data in my      │
│   spreadsheet"                  │
│                                 │
│  "Make the headers bold and     │
│   add a total row"              │
│                                 │
│  "Create a chart from the       │
│   sales data"                   │
│                                 │
│  [Start chatting →]             │
│                                 │
└─────────────────────────────────┘
```

---

## 3. Daily Use — The Chat Experience

### 3a. Opening AgentXL (Day 2+)

```
User turns on laptop
  → AgentXL service auto-starts (tray icon appears)
  → User opens Excel
  → Clicks "AgentXL" on ribbon (or it's already open from last time)
  → Taskpane opens → Chat UI ready immediately
  → No login. No setup. Just chat.
```

### 3b. The Chat Interface

```
┌─────────────────────────────────┐
│                                 │
│       ┌──────────┐              │
│       │  AgentXL │              │
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
CONNECTION LOST (server restarted for update):
┌─────────────────────────────────┐
│ ⟳ Reconnecting...              │
│   (1-2 seconds, auto-resolves)  │
└─────────────────────────────────┘

API KEY EXPIRED:
┌─────────────────────────────────┐
│ ⚠️ Your API key is no longer    │
│ valid. Please update it.        │
│ [Update key →]                  │
└─────────────────────────────────┘

RATE LIMITED:
┌─────────────────────────────────┐
│ ⏳ Too many requests. Please    │
│ wait a moment and try again.    │
│ (Auto-retries in 30 seconds)    │
└─────────────────────────────────┘

SERVER NOT RUNNING:
┌─────────────────────────────────┐
│ ❌ Cannot connect to AgentXL    │
│                                 │
│ The AgentXL service isn't       │
│ running. Check the system tray  │
│ or restart AgentXL.             │
│                                 │
│ [Troubleshoot →]                │
└─────────────────────────────────┘
```

---

## 4. Settings & Configuration

### 4a. Accessing Settings

```
Gear icon (⚙️) in the chat input area or top-right corner
  → Opens settings panel within the taskpane
```

### 4b. Settings Screen

```
┌─────────────────────────────────┐
│ ← Settings                     │
│                                 │
│ CONNECTION                      │
│ ┌───────────────────────────┐   │
│ │ Provider: Anthropic     ▼ │   │
│ │ Status:  ✅ Connected     │   │
│ │ [Change API key]          │   │
│ └───────────────────────────┘   │
│                                 │
│ ABOUT                           │
│ ┌───────────────────────────┐   │
│ │ Version: 1.2.0            │   │
│ │ [Check for updates]       │   │
│ └───────────────────────────┘   │
│                                 │
│ SUPPORT                         │
│ ┌───────────────────────────┐   │
│ │ [Documentation →]         │   │
│ │ [Report an issue →]       │   │
│ └───────────────────────────┘   │
│                                 │
│ [Reset AgentXL]                 │
│                                 │
└─────────────────────────────────┘
```

---

## 5. Updates

### 5a. Silent Update (User Sees Nothing)

```
AgentXL service running in background
  → Every 4 hours (later 24h): checks update endpoint
  → New version found → downloads silently
  → Waits for idle (no active chat)
  → Restarts server (1-2 seconds)
  → Taskpane auto-reconnects
  → User never noticed
```

### 5b. Post-Update Banner (Optional)

```
User opens taskpane after an update:

┌─────────────────────────────────┐
│ ✨ AgentXL updated to v1.3.0   │
│ New: Better chart formatting    │
│                          [ OK ] │
└─────────────────────────────────┘
```

### 5c. Urgent Update (Critical Fix)

```
Update endpoint returns: { urgent: true }
  → Server applies update immediately
  → Taskpane briefly shows "Reconnecting..."
  → Back to normal in 1-2 seconds
```

### 5d. Update Check Intervals

```
v1.x (early, iterating fast):  Every 4 hours
v2.x (stable):                 Every 24 hours
Server-controlled:             Update endpoint returns checkIntervalHours
                               No client update needed to change frequency
```

---

## 6. System Tray (Background Service)

### 6a. Normal State

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

### 6b. Update Available

```
Tray icon: small badge/dot indicating update

Right-click menu:
  ✓ Running
  ✨ Update available (v1.3.0)
  ─────────────
  Open Excel
  Settings
  ─────────────
  Quit AgentXL
```

### 6c. Error State

```
Tray icon: warning indicator

Right-click menu:
  ⚠️ API key expired
  ─────────────
  Open Excel
  Settings
  ─────────────
  Quit AgentXL
```

---

## 7. Uninstall

### Developer Path
```
npm uninstall -g agentxl
```

### Auditor Path
```
Windows Settings → Apps → AgentXL → Uninstall
  → Removes all files
  → Removes startup entry
  → Removes Office add-in registration
  → Optionally removes config (~/.agentxl/)
  → Clean uninstall
```

---

## Flow Summary

```
Install (once)
  → npm install OR Windows installer

First open (once)
  → Welcome screen → Connect to AI → Choose path
  → Paste key or OAuth → Connected → Start chatting

Daily use (forever)
  → Boot laptop → AgentXL auto-starts
  → Open Excel → Click AgentXL button
  → Chat → Agent reads/writes/charts/formats
  → Close Excel → AgentXL stays in tray

Updates (automatic)
  → Check every 4h → Download → Apply when idle
  → User never notices

Settings (rarely)
  → Gear icon → Change key / Check version
```

---

*Created: March 7, 2026*
