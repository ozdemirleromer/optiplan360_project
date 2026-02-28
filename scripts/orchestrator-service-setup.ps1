# Windows Service Kurulum Script

**OptiPlan360 Orchestrator — NSSM ile Windows Service Kurulumu**

Aşağıdaki komutları Admin PowerShell'de çalıştırın.

---

## ADIM 1: NSSM İndir ve Kurulum

```powershell
# NSSM (Non-Sucking Service Manager) indir
$nssm_url = "https://nssm.cc/download/nssm-2.24-101-g897c7ad.zip"
$install_dir = "C:\tools\nssm"

# Klasör oluştur
New-Item -ItemType Directory -Path $install_dir -Force | Out-Null

# İndir ve çıkar
$temp_zip = "$env:TEMP\nssm.zip"
Invoke-WebRequest -Uri $nssm_url -OutFile $temp_zip
Expand-Archive -Path $temp_zip -DestinationPath $install_dir -Force

# PATH'a ekle
$env:Path += ";" + "$install_dir\nssm-2.24-101-g897c7ad\win64"
[Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::Machine)

# Doğrulama
nssm.exe --version
```

---

## ADIM 2: Orchestrator Node Modülleri Yükle

```powershell
cd C:\PROJE\optiplan360_project\apps\orchestrator
npm install
npm run build
```

---

## ADIM 3: Windows Service'i Kurulumu

```powershell
$serviceName = "OptiPlan360Orchestrator"
$nodePath = "C:\Program Files\nodejs\node.exe"  # Node.js yolu (nerede olduğunu kontrol et: where node)
$appPath = "C:\PROJE\optiplan360_project\apps\orchestrator"
$mainScript = "$appPath\dist\index.js"

# Kontrol: Node.exe var mı?
if (-not (Test-Path $nodePath)) {
  Write-Host "Hata: Node.exe bulunamadı!" -ForegroundColor Red
  Write-Host "Node.js'i kurun veya $nodePath dosyasını düzenleyin"
  exit 1
}

# Service'i kur
nssm.exe install $serviceName $nodePath $mainScript
if ($LASTEXITCODE -ne 0) {
  Write-Host "Hata: Service kurulumu başarısız" -ForegroundColor Red
  exit 1
}

# Çalışma dizinini set et
nssm.exe set $serviceName AppDirectory $appPath

# Environment variables
nssm.exe set $serviceName AppEnvironmentExtra "NODE_ENV=production"
nssm.exe set $serviceName AppEnvironmentExtra "ORCHESTRATOR_PORT=8090"
nssm.exe set $serviceName AppEnvironmentExtra "JWT_SECRET=$(openssl rand -base64 32)"

# Startup type: Otomatik
nssm.exe set $serviceName Start SERVICE_AUTO_START

# Timeout'u kur (30 saniye)
nssm.exe set $serviceName AppStopMethodSkip 6
nssm.exe set $serviceName AppExit Default

# Log dosyalarını yapılandır
$logDir = "$appPath\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
nssm.exe set $serviceName AppStdout "$logDir\orchestrator.log"
nssm.exe set $serviceName AppStderr "$logDir\orchestrator-error.log"

Write-Host "✅ Service kurulumu tamamlandı!" -ForegroundColor Green
```

---

## ADIM 4: Service'i Başlat

```powershell
# Service'i başlat
Start-Service -Name $serviceName

# Status kontrol
Get-Service -Name $serviceName

# Log dosyasını aç
Get-Content "C:\PROJE\optiplan360_project\apps\orchestrator\logs\orchestrator.log" -Tail 20 -Wait
```

---

## ADIM 5: Verifikasyon

```bash
# Health check
curl https://localhost:8090/health

# Beklenen yanıt:
# {"status":"ok","service":"orchestrator","timestamp":"2026-02-17T..."}
```

---

## İLERİ AYARLAR

### Service Parametrelerini Görüntüle

```powershell
nssm.exe dump OptiPlan360Orchestrator
```

### Service'i Durdurup Başla

```powershell
Stop-Service -Name "OptiPlan360Orchestrator"
Start-Service -Name "OptiPlan360Orchestrator"
```

### Service'i Sil

```powershell
nssm.exe remove OptiPlan360Orchestrator confirm
```

### Log Rotasyonu Konfigürasyonu

```powershell
# PowerShell script: LogRotate.ps1
param([string]$logDir = "C:\PROJE\optiplan360_project\apps\orchestrator\logs")

$maxLogAge = 7  # 7 gün
$maxLogSize = 100MB  # 100 MB

Get-ChildItem $logDir -Filter "*.log" | Where-Object {
  $_.LastWriteTime -lt (Get-Date).AddDays(-$maxLogAge) -or
  $_.Length -gt $maxLogSize
} | Remove-Item

Write-Host "Log rotasyonu tamamlandı"
```

#### Schedule Log Rotation

```powershell
$scriptPath = "C:\PROJE\optiplan360_project\scripts\LogRotate.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -TaskName "OrchestrationLogRotate" -Action $action -Trigger $trigger -RunLevel Highest
```

---

## SORUN GİDERME

### Service başlamıyor

```powershell
# Event Viewer'da hata mesjajına bak
eventvwr.msc

# Veya PowerShell'den
Get-WinEvent -LogName System | Where-Object { $_.ProviderName -like "*nssm*" } | Select-Object -First 10
```

### Node.js modülleri eksik

```powershell
cd C:\PROJE\optiplan360_project\apps\orchestrator
npm install --production
npm run build
```

### Port zaten kullanımda

```powershell
netstat -ano | findstr :8090
# PID'yi bul, kapat
taskkill /PID <PID> /F
```

---

## FIREWALL KURALARI

```powershell
# Orchestrator portuna erişim izni ver
New-NetFirewallRule -DisplayName "Orchestrator" -Direction Inbound -Protocol TCP -LocalPort 8090 -Action Allow

# UNC path erişimi için SMB portunu aç (445)
New-NetFirewallRule -DisplayName "SMB" -Direction Inbound -Protocol TCP -LocalPort 445 -Action Allow
```

---

## AUTO-RESTART KURULUMU

```powershell
# Service yeniden başlamasa bile her 5 dakika başla
nssm.exe set OptiPlan360Orchestrator AppRestartDelay 300000  # 5 minutes in ms
nssm.exe set OptiPlan360Orchestrator AppThrottle 1500  # 1.5 second delay between restart attempts
```

---

## KONTROL LİSTESİ

- [ ] Node.js kurulmuş ve `node --version` çalıştırabiliyor
- [ ] NSSM kurulmuş ve `nssm --version` çalıştırabiliyor
- [ ] npm install başarıyla tamamlandı
- [ ] npm run build çalıştı
- [ ] Service başlatılabilir durumdaolarak
- [ ] Health check endpoint yanıt veriyor
- [ ] Log dosyası yazılıyor
- [ ] Windows Event Viewer'da hata yok
- [ ] Firewall kuralları eklendi

---

**WINDOWS SERVICE SETUP TAMAMLANDI**
