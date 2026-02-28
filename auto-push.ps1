# Auto-commit ve push yapan PowerShell scripti
# Kullanım: .\auto-push.ps1

param(
    [string]$message = "chore: auto-commit"
)

Write-Host "🔄 Otomatik commit + push başlanıyor..." -ForegroundColor Cyan
Write-Host ""

# Değişiklikleri kontrol et
$status = git status --short
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "✅ Commit yapılacak değişiklik yok" -ForegroundColor Green
    exit 0
}

Write-Host "📝 Değişiklikler algılandı:" -ForegroundColor Yellow
$status | ForEach-Object { Write-Host "  $_" }
Write-Host ""

# Stage ve commit
Write-Host "➕ Tüm dosyalar stage ediliyor..." -ForegroundColor Cyan
git add .

Write-Host "💾 Commit yapılıyor: $message" -ForegroundColor Cyan
git commit -m $message

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit başarılı!" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "📤 GitHub'a push yapılıyor..." -ForegroundColor Cyan
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Push başarılı!" -ForegroundColor Green
        git log --oneline -1
    } else {
        Write-Host "❌ Push başarısız - network veya auth kontrol et" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Commit başarısız" -ForegroundColor Red
}
