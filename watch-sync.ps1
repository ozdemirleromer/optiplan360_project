<#
.SYNOPSIS
    OptiPlan360 — Dosya degisikliklerini otomatik senkronize eder.
.DESCRIPTION
    ANA klasoru izler, degisiklik olunca YEDEK klasore kopyalar.
    Ctrl+C ile durdurulur.
.USAGE
    .\watch-sync.ps1             # Baslat (varsayilan 5 sn bekleme)
    .\watch-sync.ps1 -Delay 10   # 10 saniye bekleme ile baslat
#>
param(
    [int]$Delay = 5
)

$ANA   = "C:\optiplan360_project"
$YEDEK = Join-Path $env:USERPROFILE "Documents\GitHub\optiplan360_project"

$ExcludeDirs = @(
    ".git", "node_modules", "__pycache__", ".pytest_cache",
    ".mypy_cache", "dist", ".vite", ".tmp", ".tox",
    "htmlcov", ".coverage", "logs"
)
$ExcludeFiles = @("*.pyc", "*.pyo", "*.log", "*.lock", "*.db-journal", "thumbs.db", "desktop.ini")

# Haric tutulan klasor pattern'i (watcher filtresi icin)
$excludePattern = '\\(\.git|node_modules|__pycache__|\.pytest_cache|\.mypy_cache|dist|\.vite|\.tmp|logs)\\'

function Invoke-Sync {
    param([string]$Trigger)

    $ts = Get-Date -Format "HH:mm:ss"
    Write-Host "[$ts] Senkron baslatiliyor... ($Trigger)" -ForegroundColor Yellow

    $roboArgs = @(
        "`"$ANA`""
        "`"$YEDEK`""
        "/E", "/XO", "/R:0", "/W:0", "/MT:8"
        "/NP", "/NDL", "/NS", "/NC"
        "/NFL"  # dosya listesi gosterme (sessiz mod)
    )
    foreach ($d in $ExcludeDirs) { $roboArgs += "/XD"; $roboArgs += $d }
    foreach ($f in $ExcludeFiles) { $roboArgs += "/XF"; $roboArgs += $f }

    $output = Invoke-Expression "robocopy $($roboArgs -join ' ')" 2>&1
    $code = $LASTEXITCODE

    # Ozet satirlarini bul
    $filesLine = $output | Where-Object { $_ -match '^\s+Files\s*:' } | Select-Object -First 1
    $copied = 0
    if ($filesLine -match 'Files\s*:\s*\d+\s+(\d+)') { $copied = [int]$Matches[1] }

    $ts2 = Get-Date -Format "HH:mm:ss"
    if ($copied -gt 0) {
        Write-Host "[$ts2] $copied dosya kopyalandi." -ForegroundColor Green
    } else {
        Write-Host "[$ts2] Degisiklik yok." -ForegroundColor DarkGray
    }
}

# ============ BASLANGIC ============
Clear-Host
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  OptiPlan360 Otomatik Senkronizasyon" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Kaynak  : $ANA" -ForegroundColor White
Write-Host "  Hedef   : $YEDEK" -ForegroundColor White
Write-Host "  Bekleme : ${Delay}sn (degisiklik sonrasi)" -ForegroundColor White
Write-Host "  Durdur  : Ctrl+C" -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Ilk senkronizasyon
Invoke-Sync "ilk calistirma"

# FileSystemWatcher olustur
$watcher = [System.IO.FileSystemWatcher]::new($ANA)
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]::FileName -bor
                        [System.IO.NotifyFilters]::DirectoryName -bor
                        [System.IO.NotifyFilters]::LastWrite -bor
                        [System.IO.NotifyFilters]::Size
$watcher.EnableRaisingEvents = $true

# Debounce: birden fazla degisikligi tek senkrona topla
$lastSync = [DateTime]::MinValue
$pending = $false

Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Izleme basladi... Degisiklik bekleniyor." -ForegroundColor Green
Write-Host ""

try {
    while ($true) {
        # 1 saniye bekle ve degisiklik var mi kontrol et
        $result = $watcher.WaitForChanged(
            [System.IO.WatcherChangeTypes]::All, 1000
        )

        if (-not $result.TimedOut) {
            $changedPath = $result.Name
            # Haric tutulan klasorleri filtrele
            if ($changedPath -notmatch $excludePattern) {
                $pending = $true
                $lastChange = Get-Date
            }
        }

        # Bekleme suresi dolduysa senkronize et
        if ($pending) {
            $elapsed = ((Get-Date) - $lastChange).TotalSeconds
            if ($elapsed -ge $Delay) {
                Invoke-Sync $changedPath
                $pending = $false
                $lastSync = Get-Date
            }
        }
    }
}
finally {
    $watcher.EnableRaisingEvents = $false
    $watcher.Dispose()
    Write-Host ""
    Write-Host "Izleme durduruldu." -ForegroundColor Yellow
}
