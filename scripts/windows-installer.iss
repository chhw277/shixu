#ifndef AppVersion
  #error AppVersion must be supplied
#endif
#define AppName "拾序"

[Setup]
AppId={{29D446ED-A57C-4FD3-B0CE-828F627181BA}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Shixu
DefaultDirName={localappdata}\Programs\Shixu
DefaultGroupName={#AppName}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=..\artifacts
OutputBaseFilename=Shixu-{#AppVersion}-Windows-x64-Setup
SetupIconFile=..\build\shixu.ico
UninstallDisplayIcon={app}\Shixu.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
DisableProgramGroupPage=yes

[Files]
Source: "..\artifacts\拾序-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\Shixu.exe"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\Shixu.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Shixu.exe"; Description: "Launch Shixu"; Flags: nowait postinstall skipifsilent

; User tasks remain in %APPDATA%\拾序\data when updating or uninstalling.
