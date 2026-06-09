; Inno Setup installer for TagFusion
; Compile with ISCC.exe (https://jrsoftware.org/isinfo.php)
; Bundles the WebView2 Evergreen Bootstrapper so the user never sees a
; "WebView2 missing" dialog on first run.

#define MyAppName        "TagFusion"
#define MyAppVersion     "1.0.0"
#define MyAppPublisher   "TagFusion"
#define MyAppExeName     "TagFusion.exe"
#define PublishDir       "..\Backend\TagFusion\bin\Release\net8.0-windows\win-x64\publish"
#define WebView2BootstrapperUrl "https://go.microsoft.com/fwlink/p/?LinkId=2124703"

[Setup]
AppId={{8B0F3D5A-2E9B-4E3F-A1F7-1D7B2C9E4F0A}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputBaseFilename=TagFusion-Setup-{#MyAppVersion}
SetupIconFile=..\assets\Logo.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
CloseApplications=yes
RestartApplications=no
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "german";  MessagesFile: "compiler:Languages\German.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Application payload — entire publish output (includes wwwroot/, Tools/, runtime DLLs)
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; WebView2 Evergreen Bootstrapper — downloaded at build time (~2 MB).
; If file is missing, run: curl.exe -L -o "installer\MicrosoftEdgeWebview2Setup.exe" "{#WebView2BootstrapperUrl}"
Source: "MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: NeedsWebView2

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; Install WebView2 silently if not present
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; Flags: waituntilterminated; Check: NeedsWebView2; StatusMsg: "Installiere WebView2 Runtime..."
; Launch the app at the end of the installer (optional)
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
// Detect whether the WebView2 Runtime is already installed.
// Per-machine and per-user variants both qualify.
function NeedsWebView2(): Boolean;
var
  Version: string;
begin
  Result := True;
  // Per-machine (HKLM\WOW6432Node)
  if RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0') then
    Result := False
  // Per-user
  else if RegQueryStringValue(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0') then
    Result := False;
end;
