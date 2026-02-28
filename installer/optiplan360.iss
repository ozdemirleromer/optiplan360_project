
; =============================================================================
; OptiPlan 360 Inno Setup Script
; =============================================================================
; Bu script, OptiPlan 360 için bir Windows kurulum sihirbazı oluşturur.
; Gerekli bağımlılıkları kontrol eder, dosyaları kopyalar ve dağıtım 
; script'ini çalıştırır.
; =============================================================================

#define AppName "OptiPlan 360"
#define AppVersion "1.0.0"
#define AppPublisher "Your Company Name"
#define AppURL "https://www.yourcompany.com"
#define DeployScript "deploy.ps1"

[Setup]
AppId={{F2A5B8A0-5B4A-4C8E-A4E2-D2B7861937A9}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={autopf64}\OptiPlan360_Source
DisableDirPage=yes
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputBaseFilename=OptiPlan360_Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"

[Files]
; Proje kaynak kodları ve dağıtım dosyaları
; Not: Bu script'i çalıştırmadan önce 'frontend\dist' klasörünün mevcut olduğundan emin olun.
Source: "..\frontend\dist\*"; DestDir: "{app}\frontend\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\backend\*"; DestDir: "{app}\backend"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\web.config"; DestDir: "{app}"
Source: "..\deploy.ps1"; DestDir: "{app}"
Source: "..\backup_db.bat"; DestDir: "{app}"
Source: "..\README_DEPLOY.md"; DestDir: "{app}"

[Icons]
Name: "{group}\{#AppName}"; Filename: "{sys}\inetmgr.exe"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"

[Run]
; Kurulum tamamlandıktan sonra dağıtım script'ini çalıştır
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\{#DeployScript}"""; WorkingDir: "{app}"; Flags: runhidden

[Code]
// --- Bağımlılık Kontrolü ---
function InitializeSetup(): Boolean;
var
  PythonVersion: string;
  PgVersion: string;
  ErrorCode: Integer;
begin
  Result := True;

  // 1. Python 3.12+ Kontrolü
  if not RegQueryStringValue(HKCU, 'Software\Python\PythonCore\3.12\InstallPath', '', PythonVersion) and 
     not RegQueryStringValue(HKLM, 'Software\Python\PythonCore\3.12\InstallPath', '', PythonVersion) then
  begin
    MsgBox('Python 3.12 veya üstü bulunamadı. Lütfen kurulumdan önce Python 3.12'yi yükleyin ve "Add Python to PATH" seçeneğini işaretleyin.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  // 2. PostgreSQL Kontrolü
  if not RegQueryStringValue(HKLM, 'SOFTWARE\PostgreSQL\Installations\postgresql-x64-16', 'Base Directory', PgVersion) and
     not RegQueryStringValue(HKLM, 'SOFTWARE\PostgreSQL\Installations\postgresql-x64-15', 'Base Directory', PgVersion) then
  begin
    MsgBox('PostgreSQL 15 veya 16 bulunamadı. Lütfen kurulumdan önce PostgreSQL'i yükleyin.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  // 3. IIS ve HttpPlatformHandler Kontrolü
  // Bu kontrol Inno Setup ile karmaşık olduğu için README'ye taşındı.
end;
