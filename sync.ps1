<#
.SYNOPSIS
    OptiPlan360 — Ana klasorden yedek klasore tek yonlu senkronizasyon.
.DESCRIPTION
    ANA   : C:\optiplan360_project
    YEDEK : C:\Users\Omer OZDEMIR\Documents\GitHub\optiplan360_project
    .git, node_modules, __pycache__ vb. haric tutulur.
.USAGE
    .\sync.ps1              # Normal senkron (ANA -> YEDEK)
    .\sync.ps1 -WhatIf      # Sadece goster, kopyalama yapma
    .\sync.ps1 -Reverse     # Yedekten ana klasore (dikkatli kullan)
#>
param(
    [switch]$WhatIf,
    [switch]$Reverse
)

$ANA   = "C:\optiplan360_project"
$YEDEK = Join-Path $env:USERPROFILE "Documents\GitHub\optiplan360_project"

# Haric tutulan klasorler
$ExcludeDirs = @(
    ".git", "node_modules", "__pycache__", ".pytest_cache",
    ".mypy_cache", "dist", ".vite", ".tmp", ".tox",
    "htmlcov", ".coverage", "logs"
)

# Haric tutulan dosyalar
$ExcludeFiles = @("*.pyc", "*.pyo", "*.log", "*.lock", "*.db-journal", "thumbs.db", "desktop.ini")

if ($Reverse) {
    $Source = $YEDEK
    $Dest   = $ANA
    $Direction = "YEDEK -> ANA"
} else {
    $Source = $ANA
    $Dest   = $YEDEK
    $Direction = "ANA -> YEDEK"
}

if (-not (Test-Path $Source)) {
    Write-Host "HATA: Kaynak bulunamadi: $Source" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $Dest)) {
    Write-Host "HATA: Hedef bulunamadi: $Dest" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  OptiPlan360 Senkronizasyon" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Yon      : $Direction" -ForegroundColor Yellow
Write-Host "  Kaynak   : $Source" -ForegroundColor White
Write-Host "  Hedef    : $Dest" -ForegroundColor White
if ($WhatIf) {
    Write-Host "  Mod      : ONIZLEME (kopyalama yapilmayacak)" -ForegroundColor Magenta
}
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# robocopy parametreleri
$roboArgs = @(
    "`"$Source`""
    "`"$Dest`""
    "/E"           # Alt klasorler dahil
    "/XO"          # Sadece yeni/guncellenmis dosyalari kopyala
    "/R:0"         # Hata durumunda tekrar etme
    "/W:0"         # Bekleme yok
    "/MT:8"        # 8 paralel thread
    "/NP"          # Ilerleme yuzdesi gosterme
)

foreach ($d in $ExcludeDirs) { $roboArgs += "/XD"; $roboArgs += $d }
foreach ($f in $ExcludeFiles) { $roboArgs += "/XF"; $roboArgs += $f }

if ($WhatIf) { $roboArgs += "/L" }

$startTime = Get-Date
$roboCmd = "robocopy $($roboArgs -join ' ')"

# Calistir ve ciktiyi yakala
$output = Invoke-Expression $roboCmd 2>&1
$exitCode = $LASTEXITCODE
$elapsed = (Get-Date) - $startTime

# Kopyalanan dosyalari listele
$copiedFiles = $output | Where-Object { $_ -match '^\s+(New|Newer|Older)\s+File' -or ($_ -match '^\s+\S+' -and $_ -notmatch '(EXTRA|Dirs|Files|Bytes|Times|Speed|Ended|Options|Source|Dest|-----|\*\.\*|Total|Exc )') }

# Ozet satirlarini bul
$summaryLines = $output | Where-Object { $_ -match '^\s+(Dirs|Files|Bytes)\s*:' }

Write-Host "===== OZET =====" -ForegroundColor Cyan
foreach ($line in $summaryLines) {
    Write-Host "  $line" -ForegroundColor White
}
Write-Host ""
Write-Host "  Sure: $([math]::Round($elapsed.TotalSeconds, 1)) saniye" -ForegroundColor Yellow

# robocopy exit codes (bitmask): 0=no change, 1=copied, 2=extras, 4=mismatch, 8=fail
# 0-7 arasi basari sayilir (dosya kopyalandi, extra var, vs.)
$realFail = $exitCode -band 8  # bit 8 = copy failure
if (-not $realFail) {
    if ($exitCode -eq 0) {
        Write-Host "  Sonuc: Zaten guncel, degisiklik yok." -ForegroundColor Green
    } else {
        Write-Host "  Sonuc: Senkronizasyon basarili (kod: $exitCode)." -ForegroundColor Green
    }
    Write-Host "=====================================================" -ForegroundColor Cyan
    exit 0
} else {
    # Bit 8 set ama geri kalan bitler de kopyalama olabilir
    Write-Host "  Sonuc: Kopyalama tamamlandi, bazi dosyalar atlandi (kilitli/erisim) (kod: $exitCode)" -ForegroundColor Yellow
    Write-Host "=====================================================" -ForegroundColor Cyan
    exit 0
}
