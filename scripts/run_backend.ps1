# PowerShell script to create backend/.venv, install dependencies and run uvicorn.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptRoot "..")
$backendPath = Join-Path $projectRoot "backend"
$venvPath = Join-Path $backendPath ".venv"
$venvPython = Join-Path $venvPath "Scripts\python.exe"

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
& $venvPython -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
Pop-Location
