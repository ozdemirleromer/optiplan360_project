# OptiPlan360 - Anlik Gelistirme Modu
# Bu script ile degisiklikler tarayicida aninda gorulur
# Port 3001 uzerinde calismaktadir

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " OptiPlan360 - ANLIK IZLEME MODU" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " Uygulama: http://localhost:3001" -ForegroundColor Green
Write-Host " API Proxy: http://127.0.0.1:8080/api" -ForegroundColor Yellow
Write-Host ""
Write-Host " Bir dosyayi degistirince tarayici" -ForegroundColor White
Write-Host " OTOMATIK yenilenir (Hot Reload)." -ForegroundColor White
Write-Host ""
Write-Host " Durdurmak icin: Ctrl+C" -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "c:\optiplan360_project\frontend"
npm run dev
