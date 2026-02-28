# build_backend.ps1
# Python backend -> tek exe (PyInstaller). Bu bir şablondur.

param(
  [string]$BackendPath = ".\backend",
  [string]$OutDir = ".\dist\backend"
)

$ErrorActionPreference = "Stop"

Write-Host ">> Backend build starting..."
Push-Location $BackendPath
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -U pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip install pyinstaller
# pyinstaller main.py --onefile --name optiplan360_backend
Pop-Location

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Write-Host ">> Üretilen exe'yi $OutDir altına taşıyın."
