$ErrorActionPreference = 'Stop'

$root = 'C:\code\AgentXL'
$payloadRoot = Join-Path $root 'release\windows\payload'
$stagingRoot = Join-Path $root 'release\windows\msi-staging'
$distDir = Join-Path $root 'release\windows\dist'
$tempDir = Join-Path $root 'release\windows\wixobj'

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$appVersion = '1.1.0'
$outputMsi = Join-Path $distDir "AgentXL-Setup-$appVersion.msi"

$candle = 'C:\Program Files (x86)\WiX Toolset v3.14\bin\candle.exe'
$light = 'C:\Program Files (x86)\WiX Toolset v3.14\bin\light.exe'

Write-Host "[build-msi] Running candle..."
& $candle `
  -arch x64 `
  "-dAppVersion=$appVersion" `
  "-dPayloadRoot=$payloadRoot" `
  "-dStagingRoot=$stagingRoot" `
  -out (Join-Path $tempDir '') `
  .\installer\windows\AgentXL.msi.wxs `
  .\release\windows\wix\AgentXL.payload.wxs

if ($LASTEXITCODE -ne 0) {
  throw "candle failed with exit code $LASTEXITCODE"
}

Write-Host "[build-msi] Running light..."
$wixobjFiles = Get-ChildItem $tempDir -Filter *.wixobj | ForEach-Object { $_.FullName }
& $light `
  -ext WixUIExtension `
  -ext WixUtilExtension `
  -o $outputMsi `
  $wixobjFiles

if ($LASTEXITCODE -ne 0) {
  throw "light failed with exit code $LASTEXITCODE"
}

$size = [math]::Round((Get-Item $outputMsi).Length / 1MB, 1)
Write-Host "[build-msi] MSI built: $outputMsi ($size MB)"
