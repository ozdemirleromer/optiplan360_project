# PowerShell script to create backend/.venv, install dependencies and run uvicorn.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptRoot "..")
$backendPath = Join-Path $projectRoot "backend"
$venvPath = Join-Path $backendPath ".venv"
$venvPython = Join-Path $venvPath "Scripts\python.exe"
$runtimeExportPath = Join-Path $backendPath "runtime_exports"

if (-Not (Test-Path -Path $venvPython)) {
    Write-Host "Creating backend virtual environment at $venvPath ..."
    Push-Location $backendPath
    python -m venv .venv
    Pop-Location
}

# Upgrade pip and install requirements
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r (Join-Path $backendPath "requirements.txt")
& $venvPython -m pip install -r (Join-Path $backendPath "requirements-dev.txt")

# Run uvicorn using the backend venv python
Push-Location $backendPath
if (-Not (Test-Path -Path $runtimeExportPath)) {
    New-Item -ItemType Directory -Path $runtimeExportPath | Out-Null
}
$env:OPTIPLAN_EXPORT_DIR = $runtimeExportPath
& $venvPython -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
Pop-Location
