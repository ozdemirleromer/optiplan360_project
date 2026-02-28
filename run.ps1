#!/usr/bin/env pwsh
<#
.SYNOPSIS
  OptiPlan360 Tüm Sistem Başlat (Backend + Frontend + Database)

.DESCRIPTION
  Docker backend ve postgresql database'i başlatır,
  ardından npm ile React dev server'ını çalıştırır.

.EXAMPLE
  .\run.ps1
#>

Write-Host "🚀 OptiPlan360 Tüm Sistem Başlatılıyor..." -ForegroundColor Cyan

# 1. Docker stack başlat
Write-Host "`n📦 Docker backend ve database başlatılıyor..." -ForegroundColor Yellow
docker compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker başlatılamadı" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker çalışıyor (backend: 8000, database: 5432)" -ForegroundColor Green

# 2. Frontend başlat
Write-Host "`n⚛️  React dev server başlatılıyor..." -ForegroundColor Yellow

# npm dependencies kontrol et
if (-not (Test-Path 'frontend\node_modules')) {
    Write-Host "📚 npm paketleri yükleniyor..." -ForegroundColor Yellow
    npm --prefix frontend install
}

# Dev server başlat
Write-Host "`n✅ Frontend çalışıyor: http://localhost:3001" -ForegroundColor Green
Write-Host "✅ Backend çalışıyor: http://localhost:8000" -ForegroundColor Green
Write-Host "✅ Database çalışıyor: localhost:5432" -ForegroundColor Green
Write-Host "`n📝 Çıkmak için CTRL+C tuşla..." -ForegroundColor Cyan

npm run dev
