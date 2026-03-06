#!/usr/bin/env pwsh
<#
.SYNOPSIS
  OptiPlan360 tum sistem baslatma yardimci script'i

.DESCRIPTION
  Docker backend ve PostgreSQL servisini baslatmayi dener.
  Docker hazir degilse local backend fallback kullanir.
  Frontend tarafinda Vite spawn EPERM durumunda static dist fallback kullanilir.
#>

Write-Host "OptiPlan360 tum sistem baslatiliyor..." -ForegroundColor Cyan

$projectRoot = $PSScriptRoot
$frontendRunner = Join-Path $projectRoot "scripts\run_frontend.ps1"
$backendProcess = $null
$backendUrl = "http://127.0.0.1:8000"

Write-Host "`nDocker backend ve database baslatiliyor..." -ForegroundColor Yellow
docker compose up -d
$dockerStarted = ($LASTEXITCODE -eq 0)

if ($dockerStarted) {
    Write-Host "Docker calisiyor (backend: 8000, database: 5432)" -ForegroundColor Green
} else {
    Write-Warning "Docker baslatilamadi. Local backend fallback kullanilacak."

    $backendDir = Join-Path $projectRoot "backend"
    $exportDir = Join-Path $backendDir "runtime_exports"
    $logsDir = Join-Path $projectRoot "logs"
    $backendOut = Join-Path $logsDir "backend-local.out.log"
    $backendErr = Join-Path $logsDir "backend-local.err.log"

    if (-not (Test-Path $logsDir)) {
        New-Item -ItemType Directory -Path $logsDir | Out-Null
    }
    if (-not (Test-Path $exportDir)) {
        New-Item -ItemType Directory -Path $exportDir | Out-Null
    }

    Write-Host "Local backend baslatiliyor (127.0.0.1:8080)..." -ForegroundColor Yellow
    $localBackendCommand = @(
        "`$env:OPTIPLAN_EXPORT_DIR='$exportDir'"
        "`$env:UVICORN_RELOAD='0'"
        "python main.py"
    ) -join "; "
    $backendProcess = Start-Process `
        -FilePath powershell `
        -ArgumentList "-NoProfile", "-Command", $localBackendCommand `
        -WorkingDirectory $backendDir `
        -PassThru `
        -WindowStyle Hidden `
        -RedirectStandardOutput $backendOut `
        -RedirectStandardError $backendErr

    $backendUrl = "http://127.0.0.1:8080"
    $healthy = $false
    for ($i = 0; $i -lt 45; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $resp = Invoke-WebRequest -Uri "$backendUrl/health" -UseBasicParsing -TimeoutSec 2
            if ($resp.StatusCode -eq 200) {
                $healthy = $true
                break
            }
        } catch {
            # startup bekleniyor
        }
    }
    if (-not $healthy) {
        Write-Host "Local backend baslatilamadi. Log: $backendErr" -ForegroundColor Red
        if ($backendProcess) {
            Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
        }
        exit 1
    }
    Write-Host "Local backend hazir: $backendUrl" -ForegroundColor Green
}

if (-not (Test-Path $frontendRunner)) {
    Write-Host "Frontend baslatma scripti bulunamadi: $frontendRunner" -ForegroundColor Red
    if ($backendProcess) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    exit 1
}

Write-Host "`nFrontend: varsayilan http://127.0.0.1:3001 (doluysa alternatif port secilir)" -ForegroundColor Green
Write-Host "Backend: $backendUrl" -ForegroundColor Green
if ($dockerStarted) {
    Write-Host "Database: localhost:5432" -ForegroundColor Green
}
Write-Host "`nCikmak icin CTRL+C tusla..." -ForegroundColor Cyan

try {
    & $frontendRunner
} finally {
    if ($backendProcess) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
}

