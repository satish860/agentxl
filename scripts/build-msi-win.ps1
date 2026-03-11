$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[build-msi-win] Preparing installer payload..."
npm run prepare:installer:win

Write-Host "[build-msi-win] Generating WiX payload fragment..."
node .\scripts\generate-wix-fragment.mjs

$payloadRoot = Join-Path $root 'release\windows\payload'
$stagingRoot = Join-Path $root 'release\windows\msi-staging'
$distDir = Join-Path $root 'release\windows\dist'
New-Item -ItemType Directory -Force -Path $distDir | Out-Null

# ─── Create MSI staging directory (tar.gz + helper files) ──────────
Write-Host "[build-msi-win] Creating MSI staging directory..."
if (Test-Path $stagingRoot) {
  Remove-Item -Recurse -Force $stagingRoot
}
New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null

# Create tar.gz of the payload (app + runtime)
Write-Host "[build-msi-win] Creating payload archive..."
$tarGz = Join-Path $stagingRoot 'agentxl-payload.tar.gz'
Push-Location $payloadRoot
& "$Env:SystemRoot\system32\tar.exe" -czf $tarGz app runtime
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create payload archive."
}
Pop-Location

# Copy installer helper files
$helperFiles = @(
  'install-agentxl.ps1',
  'uninstall-agentxl.ps1',
  'Launch AgentXL Onboarding.cmd',
  'Start AgentXL.cmd',
  'AgentXL Login.cmd',
  'Open Excel with AgentXL.cmd',
  'POST_INSTALL.txt',
  'INSTALLATION_INFO.txt'
)
foreach ($f in $helperFiles) {
  $src = Join-Path $payloadRoot $f
  if (Test-Path $src) {
    Copy-Item -Force $src (Join-Path $stagingRoot $f)
  }
}

# Copy manifest subfolder
$manifestSrc = Join-Path $payloadRoot 'manifest'
$manifestDst = Join-Path $stagingRoot 'manifest'
New-Item -ItemType Directory -Force -Path $manifestDst | Out-Null
Copy-Item -Force (Join-Path $manifestSrc 'manifest.xml') (Join-Path $manifestDst 'manifest.xml')

Write-Host "[build-msi-win] Staging complete. Archive size: $([math]::Round((Get-Item $tarGz).Length / 1MB, 1)) MB"

$packageJson = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$appVersion = $packageJson.version
$outputMsi = Join-Path $distDir "AgentXL-Setup-$appVersion.msi"

function Get-Wix3Command($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  $candidates = @(
    "$Env:ProgramFiles(x86)\WiX Toolset v3.11\bin\$name.exe",
    "$Env:ProgramFiles(x86)\WiX Toolset v3.14\bin\$name.exe",
    "$Env:ProgramFiles\WiX Toolset v3.11\bin\$name.exe",
    "$Env:ProgramFiles\WiX Toolset v3.14\bin\$name.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

$candle = Get-Wix3Command 'candle'
$light = Get-Wix3Command 'light'
if (-not $candle -or -not $light) {
  throw "WiX Toolset v3 not found. Install WiX Toolset 3.14 (`candle.exe` + `light.exe`) and re-run this script."
}

$tempDir = Join-Path $root 'release\windows\wixobj'
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

Write-Host "[build-msi-win] Using WiX v3 candle: $candle"
Write-Host "[build-msi-win] Using WiX v3 light: $light"

& $candle `
  -arch x64 `
  -dAppVersion=$appVersion `
  -dPayloadRoot=$payloadRoot `
  -dStagingRoot=$stagingRoot `
  -out (Join-Path $tempDir '') `
  .\installer\windows\AgentXL.msi.wxs `
  .\release\windows\wix\AgentXL.payload.wxs

if ($LASTEXITCODE -ne 0) {
  throw "WiX v3 candle compilation failed."
}

$wixobjFiles = Get-ChildItem $tempDir -Filter *.wixobj | ForEach-Object { $_.FullName }
& $light `
  -ext WixUIExtension `
  -ext WixUtilExtension `
  -o $outputMsi `
  $wixobjFiles

if ($LASTEXITCODE -ne 0) {
  throw "WiX v3 light linking failed."
}

Write-Host "[build-msi-win] MSI build complete: $outputMsi"
