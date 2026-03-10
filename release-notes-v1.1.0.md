# AgentXL v1.1.0

AgentXL 1.1.0 upgrades the Pi SDK integration, fixes Excel citation comments, aligns model selection with Pi settings, and adds a self-contained Windows installer packaging flow.

## Install

### npm

```bash
npm install -g agentxl
agentxl start
```

### Windows

Download the Windows release asset:
- `AgentXL-Windows-Payload-1.1.0.zip`

This release currently includes the self-contained Windows payload built from the installer pipeline. It contains:
- bundled Node.js runtime
- built AgentXL app
- production dependencies
- manifest and install scripts

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
