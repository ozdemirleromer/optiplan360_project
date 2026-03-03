# Dosya degisikliklerini izleyip otomatik commit+push yapan script
# Kullanim: .\watch-and-push.ps1

param(
    [int]$interval = 60
)

Write-Host "Dosya degisikligi izleme baslatiyor..." -ForegroundColor Cyan
Write-Host "Kontrol araligi: $interval saniye" -ForegroundColor Gray
Write-Host "Durdurmak icin: Ctrl+C" -ForegroundColor Gray
Write-Host ""

while ($true) {
    Start-Sleep -Seconds $interval
    
    $status = git status --short
    if (-not [string]::IsNullOrWhiteSpace($status)) {
        Write-Host "Degisiklik algilandi! $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Yellow
        Write-Host ""
        
        & "$PSScriptRoot\auto-push.ps1" -message "chore: auto-commit $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        
        Write-Host ""
        Write-Host "$interval saniye bekleniyor..." -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "Degisiklik yok $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor DarkGray
    }
}
