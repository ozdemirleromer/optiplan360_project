@echo off
echo OptiPlan 360 sunuculari baslatiliyor...

echo Backend Sunucusu baslatiliyor...
start "Backend Server" cmd /c "cd /d %~dp0backend && set PYTHONIOENCODING=utf-8 && .venv\Scripts\python.exe main.py"

REM echo B2B Musteri Portali baslatiliyor...
REM start "Customer Portal" cmd /c "cd /d %~dp0customer_portal && npm run dev"

echo Ana Frontend halihazirda npm dev olarak arka planda calisiyor gorunuyor.
echo.
echo Islem tamamlandi. Yeni acilan pencerelerde sunuculari takip edebilirsiniz.
pause
