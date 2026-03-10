param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir
)

$ErrorActionPreference = 'Stop'

$runtimeNode = Join-Path $InstallDir 'runtime\node.exe'
$appRoot = Join-Path $InstallDir 'app'
$appEntrypoint = Join-Path $appRoot 'bin\agentxl.js'

if (-not (Test-Path $runtimeNode)) {
  throw "Bundled Node runtime not found: $runtimeNode"
}

if (-not (Test-Path $appEntrypoint)) {
  throw "AgentXL entrypoint not found: $appEntrypoint"
}

$startCmd = @'
@echo off
set ROOT=%~dp0
pushd "%ROOT%app"
"%ROOT%runtime\node.exe" "%ROOT%app\bin\agentxl.js" start %*
popd
'@

$loginCmd = @'
@echo off
set ROOT=%~dp0
pushd "%ROOT%app"
"%ROOT%runtime\node.exe" "%ROOT%app\bin\agentxl.js" login %*
popd
'@

$openTaskpaneCmd = @'
@echo off
start "" "https://localhost:3001/taskpane/"
'@

Set-Content -Path (Join-Path $InstallDir 'Start AgentXL.cmd') -Value $startCmd -Encoding ASCII
Set-Content -Path (Join-Path $InstallDir 'AgentXL Login.cmd') -Value $loginCmd -Encoding ASCII
Set-Content -Path (Join-Path $InstallDir 'Open AgentXL Taskpane.cmd') -Value $openTaskpaneCmd -Encoding ASCII

$catalogPath = Join-Path $InstallDir 'manifest'
New-Item -ItemType Directory -Force -Path $catalogPath | Out-Null
Copy-Item -Force (Join-Path $appRoot 'manifest\manifest.xml') (Join-Path $catalogPath 'manifest.xml')

$info = @"
AgentXL installed successfully.

Bundled runtime:
  $runtimeNode

Start command:
  $(Join-Path $InstallDir 'Start AgentXL.cmd')

Login command:
  $(Join-Path $InstallDir 'AgentXL Login.cmd')

Excel Trusted Add-in Catalog path:
  $catalogPath

Next steps:
  1. Run Start AgentXL.cmd
  2. Open Excel -> Trusted Add-in Catalogs
  3. Add the catalog path above
  4. Restart Excel and add AgentXL from SHARED FOLDER
"@
Set-Content -Path (Join-Path $InstallDir 'INSTALLATION_INFO.txt') -Value $info -Encoding UTF8

Write-Host "AgentXL self-contained installation complete."
