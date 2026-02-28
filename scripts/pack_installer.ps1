# pack_installer.ps1
# Inno Setup ile setup üretimi (ISCC). Bu bir şablondur.

param(
  [string]$IssPath = ".\installer\optiplan360.iss"
)

$ErrorActionPreference = "Stop"

$ISCC = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
if (!(Test-Path $ISCC)) { throw "ISCC not found: $ISCC" }

& $ISCC $IssPath
Write-Host ">> Installer created."
