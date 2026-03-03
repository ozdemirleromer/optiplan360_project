# Auto-commit ve push yapan PowerShell scripti
# Kullanim: .\auto-push.ps1
# Kullanim (mesaj ile): .\auto-push.ps1 "fix: bug duzeltmesi"

param(
    [string]$message = "chore: auto-commit $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

Write-Host "Otomatik commit + push baslaniyor..." -ForegroundColor Cyan
Write-Host ""

# Degisiklikleri kontrol et
$status = git status --short
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Commit yapilacak degisiklik yok" -ForegroundColor Green
    exit 0
}

Write-Host "Degisiklikler algilandi:" -ForegroundColor Yellow
$status | ForEach-Object { Write-Host "  $_" }
Write-Host ""

# Stage ve commit
Write-Host "Tum dosyalar stage ediliyor..." -ForegroundColor Cyan
git add .

Write-Host "Commit yapiliyor: $message" -ForegroundColor Cyan
git commit -m $message

if ($LASTEXITCODE -eq 0) {
    Write-Host "Commit basarili!" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "GitHub'a push yapiliyor..." -ForegroundColor Cyan
    
    # SSH test et
    ssh -T git@github.com 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 1) {
        Write-Host "SSH baglantisi kurulamadi. HTTPS kullaniliyor..." -ForegroundColor Yellow
    }
    
    git push origin main 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Push basarili!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Son commit:" -ForegroundColor Cyan
        git log --oneline -1
        Write-Host ""
        Write-Host "GitHub: https://github.com/ozdemirleromer/optiplan360_project" -ForegroundColor Blue
    } else {
        Write-Host "Push basarisiz!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Cozum onerileri:" -ForegroundColor Yellow
        Write-Host "  1. SSH key GitHub eklendigini kontrol et" -ForegroundColor Gray
        Write-Host "  2. Internet baglantisini kontrol et" -ForegroundColor Gray
        Write-Host "  3. Manuel push: git push origin main" -ForegroundColor Gray
    }
} else {
    Write-Host "Commit basarisiz" -ForegroundColor Red
}
