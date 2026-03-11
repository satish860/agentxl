# AgentXL v1.1.0

AgentXL 1.1.0 upgrades the Pi SDK integration, fixes Excel citation comments, aligns model selection with Pi settings, and adds a self-contained Windows installer packaging flow.

## Install

### For testers on Windows

1. Download:
   - `AgentXL-Windows-Payload-1.1.0.zip`
2. Extract it to a normal folder such as `Desktop\\AgentXL`
3. Double-click:
   - `Launch AgentXL Onboarding.cmd`
4. If sign-in is needed, run:
   - `AgentXL Login.cmd`
5. Retry `Launch AgentXL Onboarding.cmd`

The Windows flow now tries to automate:
- trusting the localhost Office certificate
- registering AgentXL with Office
- enabling localhost loopback when needed
- opening Excel with AgentXL sideloaded

If a locked-down Office environment blocks automatic setup, use the manual manifest fallback.

### npm

```bash
npm install -g agentxl
agentxl start
```

### Windows package details

This Windows package is self-contained. It includes:
- bundled Node.js runtime
- built AgentXL app
- production dependencies
- manifest folder
- simple launcher scripts

## Highlights

- upgraded `@mariozechner/pi-coding-agent` to `0.57.1`
- AgentXL now honors Pi `defaultProvider` / `defaultModel` from `~/.pi/agent/settings.json`
- verified `openai-codex / gpt-5.4` model resolution
- fixed CLI auth bootstrap after Pi SDK upgrade
- fixed Excel citation comments to use `worksheet.comments.add(...)`
- added runtime guard against unsupported `cell.note` / `range.note`
- added self-contained Windows installer packaging scripts
- added release docs and release-check scripts

## Notes

- The final Windows `.exe` installer can be built from this repo with Inno Setup 6 using:

```bash
npm run build:installer:win
```

- Release docs live in `docs/RELEASING.md`.
