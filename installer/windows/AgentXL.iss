#define AppName "AgentXL"
#include "..\..\release\windows\version.iss"
#define AppPublisher "DeltaXY"
#define AppURL "https://github.com/satish860/agentxl"

[Setup]
AppId={{D0A4D5D8-2D0C-4C3B-A6DB-2D4B2D8A1141}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={autopf}\AgentXL
DefaultGroupName=AgentXL
DisableProgramGroupPage=yes
OutputDir=..\..\release\windows\dist
OutputBaseFilename=AgentXL-Setup-{#AppVersion}
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName=AgentXL
LicenseFile=..\..\LICENSE

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\..\release\windows\payload\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\AgentXL"; Filename: "wscript.exe"; Parameters: """{app}\AgentXL.vbs"""; Comment: "Start AgentXL and open Excel"
Name: "{group}\AgentXL Login"; Filename: "wscript.exe"; Parameters: """{app}\AgentXL Login.vbs"""; Comment: "Sign in to your AI provider"
Name: "{group}\Uninstall AgentXL"; Filename: "{uninstallexe}"
Name: "{autodesktop}\AgentXL"; Filename: "wscript.exe"; Parameters: """{app}\AgentXL.vbs"""; Tasks: desktopicon; Comment: "Start AgentXL and open Excel"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Run]
; Post-install: configure Office add-in
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\install-agentxl.ps1"" -InstallDir ""{app}"""; StatusMsg: "Configuring Excel add-in..."; Flags: runhidden waituntilterminated
; Post-install: let user launch AgentXL
Filename: "wscript.exe"; Parameters: """{app}\AgentXL Login.vbs"""; Description: "Sign in to your AI provider (required first time)"; Flags: postinstall nowait skipifsilent unchecked
Filename: "wscript.exe"; Parameters: """{app}\AgentXL.vbs"""; Description: "Launch AgentXL now"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\uninstall-agentxl.ps1"""; Flags: runhidden waituntilterminated

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
