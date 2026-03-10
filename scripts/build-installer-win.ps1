$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[build-installer-win] Preparing installer payload..."
npm run prepare:installer:win

$iscc = Get-Command iscc -ErrorAction SilentlyContinue
if (-not $iscc) {
  $commonPaths = @(
    "$Env:ProgramFiles(x86)\Inno Setup 6\ISCC.exe",
    "$Env:ProgramFiles\Inno Setup 6\ISCC.exe"
  )

  foreach ($candidate in $commonPaths) {
    if (Test-Path $candidate) {
      $iscc = Get-Item $candidate
      break
    }
  }
}

if (-not $iscc) {
  throw "Inno Setup compiler (ISCC.exe) not found. Install Inno Setup 6 and re-run this script."
}

Write-Host "[build-installer-win] Using ISCC: $($iscc.Source)"
& $iscc.Source "installer\windows\AgentXL.iss"

Write-Host "[build-installer-win] Installer build complete."
