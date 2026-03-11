$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[build-msi-win] Preparing installer payload..."
npm run prepare:installer:win

Write-Host "[build-msi-win] Generating WiX payload fragment..."
node .\scripts\generate-wix-fragment.mjs

$payloadRoot = Join-Path $root 'release\windows\payload'
$distDir = Join-Path $root 'release\windows\dist'
New-Item -ItemType Directory -Force -Path $distDir | Out-Null

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
