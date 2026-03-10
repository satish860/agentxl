# Releasing AgentXL

## npm package

1. Update version:

```bash
npm version <patch|minor|major> --no-git-tag-version
```

2. Run release checks:

```bash
npm run release:check
```

3. Publish to npm:

```bash
npm run release:publish:npm
```

## Windows installer

The Windows installer is self-contained. It bundles:
- the built AgentXL app
- production `node_modules`
- a bundled Node.js runtime
- Excel manifest files and shortcuts

### Prepare payload

```bash
npm run prepare:installer:win
```

Output:

```text
release/windows/payload
```

### Build the `.exe`

Install **Inno Setup 6**, then run:

```bash
npm run build:installer:win
```

Output:

```text
release/windows/dist
```

## Full Windows release check

```bash
npm run release:check:win
```

This runs:
- tests
- app build
- npm pack
- self-contained installer payload build
- installer build if Inno Setup is installed

## Notes

- The installer version is generated from `package.json`.
- The bundled Node runtime defaults to the current local Node version.
- Override the bundled runtime at build time with:

```bash
set AGENTXL_NODE_VERSION=22.17.0
npm run prepare:installer:win
```
