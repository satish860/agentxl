# AgentXL — Project Brief

## What

Open-source AI agent that lives inside Microsoft Excel as a taskpane add-in. Users chat in natural language — the agent reads, writes, charts, formats, and manages their spreadsheet.

## Why

DeltaXY (deltaxy.ai) needs independent distribution and brand visibility. AgentXL is the vehicle — free, open-source, MIT-licensed. Every GitHub star, every npm download, every blog reader sees "Built by DeltaXY."

## How It Works

```
npm install -g agentxl
agentxl start
→ HTTPS server on localhost:3001
→ Excel loads taskpane from localhost
→ User chats → Pi SDK → Claude → Excel operations
```

One package. One process. One command. No cloud. No account. User's own API key.

## What Exists

Deepak built a working prototype (https://github.com/deepak-chowdry/agent-excel) using Next.js + Pi SDK + Office.js. It works — 10 Excel tools, streaming chat, thinking blocks, tool execution cards.

**This project rebuilds it as a standalone npm package:** strip Next.js, replace with a simple HTTPS server, bundle the taskpane UI as static files, add a CLI entry point.

## Stack

- Node.js + TypeScript
- Pi SDK (`@mariozechner/pi-coding-agent`) for agent orchestration
- Office.js for Excel manipulation
- React for taskpane UI (pre-built, served static)
- Claude (Anthropic API or Azure)

## Target

- `npm install -g agentxl && agentxl start` → working Excel AI agent in 5 minutes
- MIT license, GitHub at `deltaxy-ai/agentxl`
- Launch with blog post, Reddit (r/excel), X article, Hacker News

## Competitive Edge

| | AgentXL | cellm (918★) | sv-excel-agent (153★) | Copilot |
|---|---------|-------------|----------------------|---------|
| Type | Agent (multi-tool) | Formula (`=LLM()`) | External (MCP) | Closed AI |
| Lives in Excel | ✅ Taskpane | ✅ Cell formulas | ❌ External | ✅ Built-in |
| Runs locally | ✅ | ❌ API calls from browser | ❌ | ❌ |
| Open source | ✅ MIT | ✅ | ✅ MIT | ❌ |
| Price | Free | Free | Free | $30/user/month |
| Thinking visible | ✅ | ❌ | ❌ | ❌ |

## Timeline

2 focused days to rebuild + 1 day for README + content = launch ready.

## Full Context

- Architecture, build order, file-by-file spec: `AGENTS.md` (this folder)
- Business strategy, launch plan, revenue model: `C:\Source\Business\projects\AgentXL\AGENTS.md`
