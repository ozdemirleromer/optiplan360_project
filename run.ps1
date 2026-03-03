#!/usr/bin/env pwsh
<#
.SYNOPSIS
  OptiPlan360 tum sistem baslatma yardimci script'i

.DESCRIPTION
  Docker backend ve PostgreSQL servisini baslatir.
  Ardindan ana frontend dev server'i 3001 portunda calistirir.
#>

Write-Host "OptiPlan360 tum sistem baslatiliyor..." -ForegroundColor Cyan

Write-Host "`nDocker backend ve database baslatiliyor..." -ForegroundColor Yellow
docker compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker baslatilamadi" -ForegroundColor Red
    exit 1
}

Write-Host "Docker calisiyor (backend: 8080, database: 5432)" -ForegroundColor Green

Write-Host "`nReact dev server baslatiliyor..." -ForegroundColor Yellow

if (-not (Test-Path 'frontend\node_modules')) {
    Write-Host "npm paketleri yukleniyor..." -ForegroundColor Yellow
    npm --prefix frontend install
}

Write-Host "`nFrontend: http://localhost:3001" -ForegroundColor Green
Write-Host "Backend: http://localhost:8080" -ForegroundColor Green
Write-Host "Database: localhost:5432" -ForegroundColor Green
Write-Host "`nCikmak icin CTRL+C tusla..." -ForegroundColor Cyan

npm run dev
