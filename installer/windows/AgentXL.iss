#define AppName "AgentXL"
#include "..\..\release\windows\version.iss"
#define AppPublisher "DeltaXY"
#define AppURL "https://github.com/satish860/agentxl"
#define AppExeName "Start AgentXL.cmd"

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
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#AppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\..\release\windows\payload\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\AgentXL\Start AgentXL"; Filename: "{app}\Start AgentXL.cmd"
Name: "{autoprograms}\AgentXL\AgentXL Login"; Filename: "{app}\AgentXL Login.cmd"
Name: "{autoprograms}\AgentXL\Open AgentXL Taskpane"; Filename: "{app}\Open AgentXL Taskpane.cmd"
Name: "{autoprograms}\AgentXL\Open AgentXL Manifest Folder"; Filename: "{sys}\explorer.exe"; Parameters: '"{app}\manifest"'
Name: "{autoprograms}\AgentXL\Installation Info"; Filename: "{app}\INSTALLATION_INFO.txt"
Name: "{autodesktop}\Start AgentXL"; Filename: "{app}\Start AgentXL.cmd"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File \"{app}\install-agentxl.ps1\" -InstallDir \"{app}\""; Flags: waituntilterminated
Filename: "notepad.exe"; Parameters: "\"{app}\INSTALLATION_INFO.txt\""; Description: "View installation info"; Flags: postinstall shellexec skipifsilent unchecked

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File \"{app}\uninstall-agentxl.ps1\""; Flags: runhidden waituntilterminated
