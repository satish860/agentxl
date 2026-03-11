param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir
)

$ErrorActionPreference = 'Stop'

$runtimeNode = Join-Path $InstallDir 'runtime\node.exe'
$appRoot = Join-Path $InstallDir 'app'
$appEntrypoint = Join-Path $appRoot 'bin\agentxl.js'
$enableScript = Join-Path $appRoot 'scripts\enable-excel-addin.mjs'
$manifestPath = Join-Path $appRoot 'manifest\manifest.xml'

if (-not (Test-Path $runtimeNode)) {
  throw "Bundled Node runtime not found: $runtimeNode"
}

if (-not (Test-Path $appEntrypoint)) {
  throw "AgentXL entrypoint not found: $appEntrypoint"
}

if (-not (Test-Path $enableScript)) {
  throw "Excel setup helper not found: $enableScript"
}

if (-not (Test-Path $manifestPath)) {
  throw "Manifest not found: $manifestPath"
}

Write-Host "Configuring Office for AgentXL..."
& $runtimeNode $enableScript $manifestPath --machine-cert
if ($LASTEXITCODE -ne 0) {
  throw "Could not configure Office for AgentXL."
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

$openExcelCmd = @'
@echo off
set ROOT=%~dp0
start "AgentXL Server" cmd /c ""%ROOT%Start AgentXL.cmd""
timeout /t 4 /nobreak >nul
"%ROOT%runtime\node.exe" "%ROOT%app\scripts\enable-excel-addin.mjs" "%ROOT%app\manifest\manifest.xml" --open-excel --machine-cert
'@

Set-Content -Path (Join-Path $InstallDir 'Start AgentXL.cmd') -Value $startCmd -Encoding ASCII
Set-Content -Path (Join-Path $InstallDir 'AgentXL Login.cmd') -Value $loginCmd -Encoding ASCII
Set-Content -Path (Join-Path $InstallDir 'Open AgentXL Taskpane.cmd') -Value $openTaskpaneCmd -Encoding ASCII
Set-Content -Path (Join-Path $InstallDir 'Open Excel with AgentXL.cmd') -Value $openExcelCmd -Encoding ASCII

$catalogPath = Join-Path $InstallDir 'manifest'
New-Item -ItemType Directory -Force -Path $catalogPath | Out-Null
Copy-Item -Force (Join-Path $appRoot 'manifest\manifest.xml') (Join-Path $catalogPath 'manifest.xml')

$info = @"
AgentXL installed successfully.

Bundled runtime:
  $runtimeNode

Fastest path:
  $(Join-Path $InstallDir 'Open Excel with AgentXL.cmd')

Login command:
  $(Join-Path $InstallDir 'AgentXL Login.cmd')

What the installer already did:
  - trusted the localhost Office certificate
  - registered AgentXL with Office
  - enabled localhost loopback when needed

Manifest mirror folder:
  $catalogPath

If Excel was already open during install, close Excel and open it again.
"@
Set-Content -Path (Join-Path $InstallDir 'INSTALLATION_INFO.txt') -Value $info -Encoding UTF8

Write-Host "AgentXL self-contained installation complete."
