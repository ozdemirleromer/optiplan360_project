# OptiPlan360 Orchestrator — İşletim Rehberi (Operations Guide)

> Bu belge orchestrator servisinin Windows ortamında kurulumu, izlemesi ve bakımını kapsar.
> **Platform:** Windows Server / Windows 10+ | **Runtime:** Node.js 20+ | **Port:** 8090

---

## 1. Windows Service Olarak Kurulum

### 1.1 NSSM ile servis oluşturma

[NSSM (Non-Sucking Service Manager)](https://nssm.cc/) kullanarak orchestrator'ı Windows servisi olarak kaydedin:

```powershell
# NSSM indir ve PATH'e ekle
# Servis oluştur
nssm install OptiPlan360Orchestrator "C:\Program Files\nodejs\node.exe"
nssm set OptiPlan360Orchestrator AppParameters "dist\index.js"
nssm set OptiPlan360Orchestrator AppDirectory "C:\PROJE\optiplan360_project\apps\orchestrator"

# Ortam değişkenleri
nssm set OptiPlan360Orchestrator AppEnvironmentExtra "ORCHESTRATOR_PORT=8090"

# Log yönlendirme
nssm set OptiPlan360Orchestrator AppStdout "C:\logs\orchestrator\stdout.log"
nssm set OptiPlan360Orchestrator AppStderr "C:\logs\orchestrator\stderr.log"

# Otomatik yeniden başlama
nssm set OptiPlan360Orchestrator AppRestartDelay 5000
nssm set OptiPlan360Orchestrator AppExit Default Restart

# Servisi başlat
nssm start OptiPlan360Orchestrator
```

### 1.2 Servis yönetimi

```powershell
# Durum kontrolü
nssm status OptiPlan360Orchestrator

# Durdur
nssm stop OptiPlan360Orchestrator

# Yeniden başlat
nssm restart OptiPlan360Orchestrator

# Kaldır
nssm remove OptiPlan360Orchestrator confirm
```

### 1.3 sc.exe ile alternatif

```powershell
sc.exe create OptiPlan360Orchestrator `
  binPath="\"C:\Program Files\nodejs\node.exe\" \"C:\PROJE\optiplan360_project\apps\orchestrator\dist\index.js\"" `
  start=auto `
  DisplayName="OptiPlan360 Orchestrator"
```

> **Not:** `sc.exe` ile oluşturulan servisler doğrudan node.exe çalıştırır; NSSM daha güvenilir restart/log yönetimi sağlar.

---

## 2. Log Yönetimi

### 2.1 Log dosya yapısı

```
C:\logs\orchestrator\
├── stdout.log       # Uygulama çıktısı
├── stderr.log       # Hata çıktısı
└── archive/         # Döndürülmüş loglar
```

### 2.2 Log rotation (PowerShell zamanlanmış görev)

Aşağıdaki script'i `C:\scripts\rotate-orchestrator-logs.ps1` olarak kaydedin:

```powershell
$logDir = "C:\logs\orchestrator"
$archiveDir = "$logDir\archive"
$maxAgeDays = 30
$maxSizeMB = 50

New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null

foreach ($logFile in Get-ChildItem "$logDir\*.log") {
    if ($logFile.Length -gt ($maxSizeMB * 1MB)) {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $archiveName = "$($logFile.BaseName)_$timestamp.log"
        Move-Item $logFile.FullName "$archiveDir\$archiveName"
        New-Item -ItemType File -Path $logFile.FullName -Force | Out-Null
    }
}

# Eski arşivleri sil
Get-ChildItem "$archiveDir\*.log" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$maxAgeDays) } |
    Remove-Item -Force
```

### 2.3 Zamanlanmış görev oluşturma

```powershell
$action = New-ScheduledTaskAction `
    -Execute "PowerShell.exe" `
    -Argument "-NoProfile -File C:\scripts\rotate-orchestrator-logs.ps1"

$trigger = New-ScheduledTaskTrigger -Daily -At "03:00"

Register-ScheduledTask `
    -TaskName "OptiPlan360_LogRotation" `
    -Action $action `
    -Trigger $trigger `
    -RunLevel Highest `
    -Description "Orchestrator log rotation"
```

---

## 3. Veritabanı Yedekleme

### 3.1 SQLite yedekleme script'i

`C:\scripts\backup-orchestrator-db.ps1`:

```powershell
$dbPath = "C:\PROJE\optiplan360_project\apps\orchestrator\orchestrator.db"
$backupDir = "C:\backups\orchestrator"
$maxBackups = 14

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir\orchestrator_$timestamp.db"

# WAL mode — .db-wal ve .db-shm dosyalarını da yedekle
Copy-Item "$dbPath" "$backupFile"
if (Test-Path "$dbPath-wal") { Copy-Item "$dbPath-wal" "$backupFile-wal" }
if (Test-Path "$dbPath-shm") { Copy-Item "$dbPath-shm" "$backupFile-shm" }

Write-Host "Yedek olusturuldu: $backupFile"

# Eski yedekleri temizle
Get-ChildItem "$backupDir\orchestrator_*.db" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $maxBackups |
    ForEach-Object {
        Remove-Item $_.FullName -Force
        Remove-Item "$($_.FullName)-wal" -Force -ErrorAction SilentlyContinue
        Remove-Item "$($_.FullName)-shm" -Force -ErrorAction SilentlyContinue
    }
```

### 3.2 Günlük yedek zamanlanmış görevi

```powershell
$action = New-ScheduledTaskAction `
    -Execute "PowerShell.exe" `
    -Argument "-NoProfile -File C:\scripts\backup-orchestrator-db.ps1"

$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"

Register-ScheduledTask `
    -TaskName "OptiPlan360_DbBackup" `
    -Action $action `
    -Trigger $trigger `
    -RunLevel Highest `
    -Description "Orchestrator SQLite daily backup"
```

---

## 4. İzleme (Monitoring)

### 4.1 Health check script'i

`C:\scripts\check-orchestrator-health.ps1`:

```powershell
$url = "http://127.0.0.1:8090/health"
$timeout = 10

try {
    $response = Invoke-RestMethod -Uri $url -TimeoutSec $timeout
    if ($response.status -eq "ok") {
        Write-Host "OK — $($response.timestamp)"
    } else {
        Write-Warning "UNHEALTHY — beklenmeyen durum: $($response | ConvertTo-Json)"
        exit 1
    }
} catch {
    Write-Error "UNREACHABLE — $($_.Exception.Message)"
    # Opsiyonel: e-posta veya webhook bildirimi
    exit 2
}
```

### 4.2 İş kuyruğu izleme

```powershell
# HOLD ve FAILED iş sayıları
$jobs = (Invoke-RestMethod http://127.0.0.1:8090/jobs?limit=1000).jobs
$holdCount = ($jobs | Where-Object { $_.state -eq "HOLD" }).Count
$failedCount = ($jobs | Where-Object { $_.state -eq "FAILED" }).Count
$runningCount = ($jobs | Where-Object { $_.state -eq "OPTI_RUNNING" }).Count

Write-Host "HOLD: $holdCount | FAILED: $failedCount | RUNNING: $runningCount"

if ($holdCount -gt 5) {
    Write-Warning "DIKKAT: $holdCount is HOLD bekliyor!"
}
```

### 4.3 Zamanlanmış izleme görevi (5 dakikada bir)

```powershell
$action = New-ScheduledTaskAction `
    -Execute "PowerShell.exe" `
    -Argument "-NoProfile -File C:\scripts\check-orchestrator-health.ps1"

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration ([TimeSpan]::MaxValue)

Register-ScheduledTask `
    -TaskName "OptiPlan360_HealthCheck" `
    -Action $action `
    -Trigger $trigger `
    -Description "Orchestrator health check every 5 min"
```

---

## 5. Disk Alanı Yönetimi

### 5.1 İzlenecek dizinler

| Dizin | İçerik | Temizleme |
|-------|--------|-----------|
| `C:\OptiPlanning\temp\` | Geçici XLSX dosyaları | 24 saat üzeri sil |
| `C:\OptiPlanning\import\` | OptiPlanning import XLSX | İşlendikten sonra sil |
| `C:\OptiPlanning\export\` | OptiPlanning çıktı XML | Teslim edildikten sonra sil |
| `\\MACHINE-SHARE\opti-drop\processed\` | Teslim edilmiş XML dosyaları | 7 gün üzeri sil |
| `C:\logs\orchestrator\` | Log dosyaları | 30 gün üzeri sil |
| `orchestrator.db` | SQLite veritabanı | VACUUM ile sıkıştır |

### 5.2 Temp klasörü temizleme script'i

```powershell
$tempDirs = @(
    "C:\OptiPlanning\temp",
    "C:\OptiPlanning\import",
    "C:\OptiPlanning\export"
)

foreach ($dir in $tempDirs) {
    if (Test-Path $dir) {
        Get-ChildItem $dir -File |
            Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-24) } |
            Remove-Item -Force
    }
}
```

### 5.3 SQLite VACUUM

Veritabanı boyutu büyüdüğünde haftalık VACUUM çalıştırın:

```powershell
$dbPath = "C:\PROJE\optiplan360_project\apps\orchestrator\orchestrator.db"
sqlite3.exe $dbPath "VACUUM;"
```

---

## 6. Güncelleme Prosedürü

### 6.1 Adımlar

1. **Servisi durdur:**
   ```powershell
   nssm stop OptiPlan360Orchestrator
   ```

2. **Veritabanını yedekle:**
   ```powershell
   & C:\scripts\backup-orchestrator-db.ps1
   ```

3. **Kodu güncelle:**
   ```powershell
   cd C:\PROJE\optiplan360_project\apps\orchestrator
   git pull origin main
   npm install
   npm run build
   ```

4. **Servisi başlat:**
   ```powershell
   nssm start OptiPlan360Orchestrator
   ```

5. **Sağlık kontrolü:**
   ```powershell
   & C:\scripts\check-orchestrator-health.ps1
   ```

### 6.2 Rollback

```powershell
nssm stop OptiPlan360Orchestrator
Copy-Item "C:\backups\orchestrator\orchestrator_YYYYMMDD.db" `
          "C:\PROJE\optiplan360_project\apps\orchestrator\orchestrator.db" -Force
git checkout <previous-tag>
npm run build
nssm start OptiPlan360Orchestrator
```

---

## 7. Zamanlanmış Görev Özeti

| Görev | Zamanlama | Script |
|-------|-----------|--------|
| Veritabanı yedekleme | Günlük 02:00 | `backup-orchestrator-db.ps1` |
| Log rotation | Günlük 03:00 | `rotate-orchestrator-logs.ps1` |
| Health check | Her 5 dakika | `check-orchestrator-health.ps1` |
| Temp temizliği | Günlük 04:00 | Temp cleanup script |
| SQLite VACUUM | Haftalık Pazar 05:00 | `sqlite3 VACUUM` |

---

## 8. HOLD Durumundaki İşler

HOLD state'i operatör müdahalesi gerektiğinde atanır. Admin UI'da sarı badge ile görünür.

### 8.1 HOLD Sebepleri

| Hata Kodu | Aksiyon |
|-----------|---------|
| `E_OPERATOR_TRIGGER_REQUIRED` | Mode C: OptiPlanning'i manuel çalıştırın, sonra approve yapın |
| `E_CRM_NO_MATCH` | Müşteriyi CRM'e ekleyin, sonra approve yapın |
| `E_TEMPLATE_INVALID` | `Excel_sablon.xlsx` dosyasını kontrol edin, ŞABLON sayfası ve 12 tag sütununu doğrulayın |
| `E_BACKING_THICKNESS_UNKNOWN` | `rules.json → backingThicknesses` dizisine eksik kalınlığı ekleyin |
| `E_TRIM_RULE_MISSING` | `rules.json → trimByThickness` objesine eksik kalınlık kuralını ekleyin |

### 8.2 HOLD İşi Onaylama

**Admin UI:** İş detayında "Onayla" butonuna tıklayın.

**API:**

```powershell
Invoke-RestMethod -Method POST http://127.0.0.1:8090/jobs/<JOB_ID>/approve
```

Onay sonrası iş `NEW` state'ine döner ve kuyrukta yeniden işlenir.

---

## 9. FAILED Durumundaki İşler

### 9.1 FAILED Sebepleri

| Hata Kodu | Kalıcı? | Aksiyon |
|-----------|---------|---------|
| `E_XML_INVALID` | Evet | OptiPlanning çıktısını kontrol edin — retry anlamsız |
| `E_PLATE_SIZE_MISSING` | Evet | Payload'a veya `rules.json` → `defaultPlateSize`'a boyut ekleyin |
| `E_OPTI_XML_TIMEOUT` | Hayır | OptiPlanning'in çalıştığını doğrulayın, retry yapın |
| `E_OSI_ACK_TIMEOUT` | Hayır | Makine ağ erişimini kontrol edin, retry yapın |
| `E_OSI_ACK_FAILED` | Hayır | Makine failed klasöründeki dosyayı inceleyin |
| `E_RETRY_LIMIT_REACHED` | Evet | Kök sebebi giderin, yeni iş oluşturun |

### 9.2 Retry Yapma

**Admin UI:** İş detayında "Yeniden Dene" butonuna tıklayın.

**API:**

```powershell
Invoke-RestMethod -Method POST http://127.0.0.1:8090/jobs/<JOB_ID>/retry
```

Backoff süresi: `[1, 3, 9]` dakika (konfigüre edilebilir). Maks. 3 deneme.

---

## 10. Log Kontrolü ve Audit Trail

### 10.1 Önemli log satırları

| Mesaj | Anlam |
|-------|-------|
| `[orchestrator] server started on 8090` | Servis başarıyla başladı |
| `STATE_PREPARED` | Job dönüşümü tamamlandı |
| `STATE_OPTI_RUNNING` | OptiPlanning tetiklendi |
| `STATE_DONE` | Job başarıyla tamamlandı |
| `STATE_HOLD` | Operatör müdahalesi gerekiyor |
| `STATE_FAILED` | Job kalıcı olarak başarısız |

### 10.2 Audit Trail sorgusu (SQLite — local/test ortamı)

```sql
-- Belirli bir job'un geçmişi
SELECT event_type, message, details_json, created_at
FROM audit_events
WHERE job_id = '<JOB_ID>'
ORDER BY id ASC;

-- Son 1 saatte başarısız olan işler
SELECT j.id, j.order_id, j.error_code, j.error_message, j.updated_at
FROM jobs j
WHERE j.state = 'FAILED'
  AND datetime(j.updated_at) > datetime('now', '-1 hour');

-- HOLD bekleyen işler
SELECT id, order_id, error_code, created_at
FROM jobs
WHERE state = 'HOLD'
ORDER BY created_at ASC;
```

---

## 11. Sorun Giderme

### 11.1 "E_TEMPLATE_INVALID" hatası

1. `templates/Excel_sablon.xlsx` dosyasının var olduğunu kontrol edin
2. Dosyayı açın → "ŞABLON" sayfasının mevcut olduğunu doğrulayın
3. İlk satırdaki 12 tag sütununun sırasını ve yazımını kontrol edin:
   `[P_CODE_MAT]`, `[P_LENGTH]`, `[P_WIDTH]`, `[P_MINQ]`, `[P_GRAIN]`, `[P_IDESC]`,
   `[P_EDGE_MAT_UP]`, `[P_EGDE_MAT_LO]`, `[P_EDGE_MAT_SX]`, `[P_EDGE_MAT_DX]`,
   `[P_IIDESC]`, `[P_DESC1]`

### 11.2 "E_OSI_ACK_TIMEOUT" — makine yanıt vermiyor

1. UNC yolunu kontrol edin: `\\MACHINE-SHARE\opti-drop`
2. Ağ paylaşım erişimini test edin: `Test-Path "\\MACHINE-SHARE\opti-drop\inbox"`
3. inbox klasöründe dosyanın olup olmadığını kontrol edin
4. Makinenin dosyayı processed veya failed'e taşıyıp taşımadığını izleyin

### 11.3 "E_OPTI_XML_TIMEOUT" — OptiPlanning çıktı üretmiyor

1. OptiPlanning.exe'nin çalıştığını doğrulayın
2. Import klasöründe XLSX dosyalarının olduğunu kontrol edin
3. Export klasöründe XML dosyası oluşmayı bekleyin
4. OptiPlanning loglarını inceleyin
5. Timeout süresini artırın: `rules.json → timeouts.optiXmlMinutes`

### 11.4 Port 8090 zaten kullanılıyor

```powershell
Get-NetTCPConnection -LocalPort 8090 -State Listen |
  Select-Object OwningProcess |
  ForEach-Object { Get-Process -Id $_.OwningProcess }
```

### 11.5 SQLite veritabanı kilitli ("database is locked")

WAL mode aktif olmasına rağmen uzun süren yazma işlemleri kilit oluşturabilir:

1. Birden fazla orchestrator instance çalışmadığından emin olun
2. `PRAGMA busy_timeout = 5000;` ile bekleme süresi artırılabilir

---

## 12. Konfigürasyon Dosyaları Referansı

### 12.1 config/paths.json

```json
{
  "optiplanningExePath": "C:/OptiPlanning/OptiPlanning.exe",
  "optiplanningImportFolder": "C:/OptiPlanning/import",
  "optiplanningExportFolder": "C:/OptiPlanning/export",
  "optiplanningRulesFolder": "C:/OptiPlanning/rules",
  "machineDropFolder": "\\\\MACHINE-SHARE\\opti-drop",
  "tempFolder": "C:/OptiPlanning/temp",
  "xlsxTemplatePath": "./templates/Excel_sablon.xlsx"
}
```

### 12.2 config/rules.json — kritik parametreler

| Alan | Varsayılan | Açıklama |
|------|------------|----------|
| `cm_to_mm_multiplier` | 10 | cm → mm çevirme çarpanı |
| `retry_count_max` | 3 | Maks. retry sayısı |
| `retry_backoff_minutes` | [1, 3, 9] | Backoff dakikaları |
| `optiModeDefault` | "C" | Varsayılan OptiPlanning tetikleme modu |
| `timeouts.optiXmlMinutes` | 20 | XML bekleme zaman aşımı (dk.) |
| `timeouts.osiAckMinutes` | 5 | OSI ACK bekleme zaman aşımı (dk.) |
| `ackMode` | "file_move" | ACK yöntemi (inbox → processed) |

---

## 0.1 Ortam Ayrımı Notu (2026-02-17)

Resmi karar standardına göre:
- Production veri katmanı: PostgreSQL
- Local/Test ve edge operasyon: SQLite

Bu dokümanda geçen SQLite backup/VACUUM adımları local/test veya geçici edge kurulumları içindir.
Production planlamada PostgreSQL backup/maintenance prosedürleri esas alınmalıdır.

---

## 0.2 Mikro P1 Read-Only Entegrasyon Notu (2026-02-18)

- Mikro SQL Board yalnizca **read-only** calisir (P1 fazi).
- Mikro SQL kullanicisi **SELECT-only** yetkili olmalidir; write-back kesinlikle yoktur.
- Baglanti testleri sadece `SELECT 1` gibi okuma sorgulari ile yapilir.
- Konfig: `config/sql_config.template.json` varsayilan olarak `read_only: true` tutar.
- Admin panelde read-only alan kilitli olmalidir; UI uzerinden kapatilamaz.
- Prod ortami: PostgreSQL; Mikro entegrasyon yalnizca read (P1) ve audit log ile izlenir.

## 0.3 Mikro P1 Kod-Seviyesi Kilit Notu (2026-02-24)

- `backend/app/integrations/mikro_sql_client.py` icinde write metotlari
  (`create_*`, `update_*`, `delete_*`) read-only modda kod seviyesinde engellenir.
- Varsayilan davranis: `read_only_mode = true`.
- `MIKRO_READ_ONLY_MODE` env var'i ile acikca override edilmedikce write acilmaz.
- `backend/app/services/mikro_sync_service.py` PUSH akislarinda read-only mod aktifse:
  - islem durdurulur,
  - `E_MIKRO_READ_ONLY` kodu doner,
  - entegrasyon hata kaydi olusturulur.
