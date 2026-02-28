@echo off
REM OptiPlan360 Tüm sistem başlat (Backend + Frontend + Database)

setlocal enabledelayedexpansion

echo.
echo ======================================
echo   OptiPlan360 Tum Sistem Baslatiliyor
echo ======================================
echo.

REM 1. Docker stack başlat
echo [*] Docker backend ve database baslatiliyor...
docker compose up -d

if errorlevel 1 (
    echo [!] Docker baslatılamadı
    exit /b 1
)

echo [OK] Docker calistirildi (backend: 8000, database: 5432)
echo.

REM 2. Frontend başlat
echo [*] React dev server baslatiliyor...

REM npm dependencies kontrol et
if not exist "frontend\node_modules" (
    echo [*] npm paketleri yukleniyor...
    call npm --prefix frontend install
)

REM Dev server başlat
echo.
echo ======================================
echo [OK] Frontend calistiyor: http://localhost:3001
echo [OK] Backend calistiyor: http://localhost:8000
echo [OK] Database calistiyor: localhost:5432
echo.
echo Cikis icin CTRL+C'ye basin...
echo ======================================
echo.

call npm run dev

pause
