; Inno Setup script for SimpleBeacon Local Agent
; Build: "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer.iss
; Produces a single Setup.exe that installs the agent to the user's local app data,
; creates Start Menu and startup shortcuts, and launches the agent.

#define MyAppName "SimpleBeacon Local Agent"
#define MyAppVersion "1.0.2"
#define MyAppPublisher "SimpleBeacon"
#define MyAppURL "https://simplebeacon.ai"
#define MyAppExeName "start-agent.bat"

[Setup]
AppId={{B1E2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\SimpleBeaconLocalAgent
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputBaseFilename=simplebeacon-local-agent-setup
OutputDir=dist
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "startup"; Description: "Start SimpleBeacon Local Agent when Windows starts"; GroupDescription: "Startup"; Flags: unchecked

[Files]
Source: "dist\portable\agent.cjs"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\portable\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\portable\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\portable\start-agent.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\portable\start-agent.sh"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\portable\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dist\portable\packages\*"; DestDir: "{app}\packages"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dist\portable\.simplebeacon\*"; DestDir: "{app}\.simplebeacon"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\SimpleBeacon\SimpleBeacon Local Agent"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{autostartup}\SimpleBeacon Local Agent"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: startup

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Start SimpleBeacon Local Agent now"; Flags: nowait postinstall skipifsilent
