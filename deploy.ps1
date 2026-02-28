# =============================================================================
# OptiPlan 360 Deployment Script
# =============================================================================
# Bu script, OptiPlan 360 projesini derler, dosyaları dağıtım klasörüne
# kopyalar ve IIS üzerinde gerekli yapılandırmayı yapar.
#
# Yönetici olarak çalıştırılmalıdır.
# =============================================================================

# --- Konfigürasyon ---
$sourceRoot = $PSScriptRoot
$deployRoot = "C:\inetpub\wwwroot\optiplan360"
$websiteName = "OptiPlan360"

# --- 1. Frontend Build ---
Write-Host "Adım 1: Frontend uygulaması derleniyor (npm run build)..." -ForegroundColor Cyan
Push-Location "$sourceRoot\frontend"
npm install
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build işlemi başarısız oldu."
    exit 1
}
Pop-Location
Write-Host "Frontend build tamamlandı." -ForegroundColor Green

# --- 2. Dağıtım Klasörlerini Hazırlama ---
Write-Host "Adım 2: Dağıtım klasörleri hazırlanıyor ($deployRoot)..." -ForegroundColor Cyan
if (Test-Path $deployRoot) {
    Remove-Item -Path $deployRoot -Recurse -Force
}
New-Item -Path $deployRoot -ItemType Directory
New-Item -Path "$deployRoot\frontend" -ItemType Directory
New-Item -Path "$deployRoot\backend" -ItemType Directory

# --- 3. Dosyaları Kopyalama ---
Write-Host "Adım 3: Dosyalar dağıtım klasörüne kopyalanıyor..." -ForegroundColor Cyan

# Frontend build dosyaları
Write-Host "  -> Frontend dosyaları kopyalanıyor..."
Copy-Item -Path "$sourceRoot\frontend\dist\*" -Destination "$deployRoot\frontend" -Recurse

# Backend dosyaları
Write-Host "  -> Backend dosyaları kopyalanıyor..."
Copy-Item -Path "$sourceRoot\backend\app" -Destination "$deployRoot\backend" -Recurse
Copy-Item -Path "$sourceRoot\backend\requirements.txt" -Destination "$deployRoot\backend"
Copy-Item -Path "$sourceRoot\web.config" -Destination "$deployRoot" # Ana web.config

# --- IIS Sitesini Yeniden Başlat ---
Write-Host "Adım 6: IIS sitesi yeniden başlatılıyor..." -ForegroundColor Cyan
Stop-Website -Name $websiteName
Start-Website -Name $websiteName
Write-Host "IIS sitesi başarıyla yeniden başlatıldı." -ForegroundColor Green

# --- 4. Python Bağımlılıklarını Kurma ---
Write-Host "Adım 4: Python bağımlılıkları kuruluyor (pip)..." -ForegroundColor Cyan
Push-Location "$deployRoot\backend"
# Sunucudaki Python path'i burada belirtilmeli veya PATH'de olmalı
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Error "Python bağımlılıkları kurulamadı."
    exit 1
}
Pop-Location
Write-Host "Python bağımlılıkları başarıyla kuruldu." -ForegroundColor Green


# --- 5. IIS Yapılandırması ---
Write-Host "Adım 5: IIS üzerinde web sitesi yapılandırılıyor..." -ForegroundColor Cyan
Import-Module WebAdministration

if (Test-Path "IIS:\Sites\$websiteName") {
    Write-Host "  -> Mevcut site '$websiteName' güncelleniyor."
    Set-ItemProperty "IIS:\Sites\$websiteName" -Name physicalPath -Value $deployRoot
} else {
    Write-Host "  -> Yeni site '$websiteName' oluşturuluyor."
    New-Website -Name $websiteName -PhysicalPath $deployRoot -Port 8080 # Portu istediğiniz gibi değiştirin
}

# Uygulama havuzunun Python'ı çalıştıracak kullanıcı yetkisine sahip olduğundan emin olun.
# Genellikle 'ApplicationPoolIdentity' yeterlidir, ancak dosya sistemi izinleri gerekebilir.

Set-WebConfigurationProperty -pspath "IIS:\Sites\$websiteName" -filter "system.webServer/handlers" -name "." -value (@{name='HttpPlatformHandler';path='*';verb='*';modules='httpPlatformHandler';resourceType='Unspecified'})

Write-Host "IIS yapılandırması tamamlandı." -ForegroundColor Green
Write-Host "OptiPlan 360 başarıyla dağıtıldı! Siteye http://localhost:8080 adresinden erişebilirsiniz." -ForegroundColor Yellow
