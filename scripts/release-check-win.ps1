$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[release-check-win] Running tests..."
npm test

Write-Host "[release-check-win] Building app..."
npm run build

Write-Host "[release-check-win] Creating npm tarball..."
npm pack

Write-Host "[release-check-win] Preparing self-contained Windows installer payload..."
npm run prepare:installer:win

$candle = Get-Command candle -ErrorAction SilentlyContinue
$light = Get-Command light -ErrorAction SilentlyContinue
if ($candle -and $light) {
  Write-Host "[release-check-win] WiX found. Building MSI..."
  npm run build:msi:win
} else {
  Write-Host "[release-check-win] WiX not found. Skipping MSI compilation."
}

$iscc = Get-Command iscc -ErrorAction SilentlyContinue
if ($iscc) {
  Write-Host "[release-check-win] Inno Setup found. Building installer..."
  npm run build:installer:win
} else {
  Write-Host "[release-check-win] Inno Setup not found. Skipping .exe compilation."
}

Write-Host "[release-check-win] Release checks complete."
