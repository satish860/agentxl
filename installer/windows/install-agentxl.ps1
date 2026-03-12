param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir
)

$ErrorActionPreference = 'Stop'

$runtimeNode = Join-Path $InstallDir 'runtime\node.exe'
$appRoot = Join-Path $InstallDir 'app'
$npmCli = Join-Path $InstallDir 'runtime\node_modules\npm\bin\npm-cli.js'
$appEntrypoint = Join-Path $appRoot 'bin\agentxl.js'
$enableScript = Join-Path $appRoot 'scripts\enable-excel-addin.mjs'
$manifestPath = Join-Path $appRoot 'manifest\manifest.xml'

if (-not (Test-Path $runtimeNode)) {
  throw "Bundled Node runtime not found: $runtimeNode"
}

if (-not (Test-Path $appRoot)) {
  throw "App directory not found: $appRoot"
}

# ─── Step 1: Install node_modules ──────────────────────────────────
Write-Host "Installing dependencies (this may take a minute)..."

$npmCmd = if (Test-Path $npmCli) { $npmCli } else {
  # Fallback: npm might be alongside node.exe
  $npmBin = Join-Path (Split-Path $runtimeNode) 'npm.cmd'
  if (Test-Path $npmBin) { $npmBin } else { $null }
}

if ($npmCli -and (Test-Path $npmCli)) {
  & $runtimeNode $npmCli ci --omit=dev --prefix $appRoot 2>&1
} else {
  # Try using npm.cmd from the runtime directory
  $env:PATH = "$(Split-Path $runtimeNode);$env:PATH"
  Push-Location $appRoot
  & npm ci --omit=dev 2>&1
  Pop-Location
}

if ($LASTEXITCODE -ne 0) {
  Write-Host "WARNING: npm install failed (exit code $LASTEXITCODE)."
  Write-Host "You may need to run 'npm ci --omit=dev' manually in: $appRoot"
}

# ─── Step 2: Verify key files exist ───────────────────────────────
if (-not (Test-Path $appEntrypoint)) {
  throw "AgentXL entrypoint not found: $appEntrypoint"
}

if (-not (Test-Path $enableScript)) {
  throw "Excel setup helper not found: $enableScript"
}

if (-not (Test-Path $manifestPath)) {
  throw "Manifest not found: $manifestPath"
}

# ─── Step 3: Configure Office add-in ──────────────────────────────
Write-Host "Configuring Office for AgentXL..."
& $runtimeNode $enableScript $manifestPath --machine-cert 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "WARNING: Automatic Office configuration failed (exit code $LASTEXITCODE)."
  Write-Host "You can configure Office manually using the manifest folder after install."
  Write-Host "See INSTALLATION_INFO.txt for details."
}

# ─── Step 4: Write manifest mirror ────────────────────────────────
$catalogPath = Join-Path $InstallDir 'manifest'
New-Item -ItemType Directory -Force -Path $catalogPath | Out-Null
Copy-Item -Force $manifestPath (Join-Path $catalogPath 'manifest.xml')

# ─── Step 5: Installation info ────────────────────────────────────
$info = @"
AgentXL installed successfully.

Bundled runtime:
  $runtimeNode

Double-click AgentXL from Start Menu or Desktop to launch.

What the installer did:
  - installed Node.js dependencies
  - trusted the localhost Office certificate
  - registered AgentXL with Office
  - enabled localhost loopback when needed

Manifest mirror folder:
  $catalogPath

If Excel was already open during install, close and reopen it.
If the AgentXL pane is not visible, click AgentXL on Excel's Home tab.
"@
Set-Content -Path (Join-Path $InstallDir 'INSTALLATION_INFO.txt') -Value $info -Encoding UTF8

Write-Host "AgentXL installation complete."
