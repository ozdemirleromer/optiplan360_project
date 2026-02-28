# HTTPS SETUP GUİDU — OptiPlan360 Orchestrator

**Üretim Ortamında HTTPS Kurulumu (Self-Signed veya Let's Encrypt)**

---

## 1. SELF-SIGNED SERTİFİKA (Development/Testing)

### 1.1 OpenSSL ile Sertifika Oluştur

```bash
# Windows PowerShell'de
# OpenSSL kurulu olmalı (scoop install openssl veya manual indir)

openssl req -x509 -newkey rsa:4096 -keyout private-key.pem -out certificate.pem -days 365 -nodes \
  -subj "/C=TR/ST=Istanbul/L=Istanbul/O=OptiPlan/CN=orchestrator.local"

# Çıktı:
# ✓ private-key.pem (private key)
# ✓ certificate.pem (public certificate)
```

### 1.2 Sertifikaları Klasöre Taşı

```bash
mkdir -p apps/orchestrator/certs
mv private-key.pem certificate.pem apps/orchestrator/certs/
```

### 1.3 Express HTTPS Setup

**Dosya: `apps/orchestrator/src/index.ts`**

```typescript
import https from "https";
import fs from "fs";
import path from "path";

// ... existing imports ...

const paths = loadPathsConfig();
const rules = loadRulesConfig();
const { db } = createDatabase();

// ... existing setup ...

const app = createApiServer(orchestratorService, paths, rules);
const port = Number(process.env.ORCHESTRATOR_PORT ?? 8090);

// HTTPS Setup
const isProduction = process.env.NODE_ENV === "production";

if (isProduction || process.env.USE_HTTPS === "true") {
  const certPath = path.join(__dirname, "../certs/certificate.pem");
  const keyPath = path.join(__dirname, "../certs/private-key.pem");

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.error("❌ HTTPS sertifikası bulunamadı!");
    console.error(`   Beklenen: ${certPath}`);
    console.error(`           ${keyPath}`);
    process.exit(1);
  }

  const httpsOptions = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };

  https.createServer(httpsOptions, app).listen(port, () => {
    console.log(`✅ [orchestrator] HTTPS server started on https://localhost:${port}`);
    runner.start();
  });
} else {
  app.listen(port, () => {
    console.log(`✅ [orchestrator] HTTP server started on http://localhost:${port}`);
    runner.start();
  });
}

process.on("SIGINT", () => {
  runner.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  runner.stop();
  process.exit(0);
});
```

---

## 2. LET'S ENCRYPT SERTIFIKA (Production)

### 2.1 Certbot Kurulumu

```bash
# Windows: Manual yöntem (snap desteği yok)
# 1. https://certbot.eff.org adresine git
# 2. "Other" → "Windows" seç
# 3. Installer indir ve çalıştır

# Veya Chocolatey ile:
choco install certbot -y
```

### 2.2 Sertifika İsteği

```bash
# Domain name'in DNS zone'da kayıtlı olmalı
certbot certonly --standalone -d orchestrator.example.com -d *.example.com

# Çıktı:
# Successfully received certificate.
# Certificate is saved at: C:\Certbot\live\orchestrator.example.com\
```

### 2.3 Sertifikaları Uygulamaya Bağla

```bash
# Staging klasörüne kopyala
cp C:\Certbot\live\orchestrator.example.com\fullchain.pem apps/orchestrator/certs/certificate.pem
cp C:\Certbot\live\orchestrator.example.com\privkey.pem apps/orchestrator/certs/private-key.pem
```

### 2.4 Otomatik Renewal Kurulumu

**Windows Task Scheduler:**

```powershell
# Admin PowerShell'de

$taskName = "CertbotRenewal"
$taskPath = "\Certbot\"
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
$action = New-ScheduledTaskAction -Execute "certbot.exe" -Argument "renew --quiet --deploy-hook=_restart_orchestrator.bat"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable

Register-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Trigger $trigger -Action $action -Settings $settings -RunLevel Highest
```

**Deploy Hook Script: `apps/orchestrator/_restart_orchestrator.bat`**

```batch
@echo off
REM Orchestrator Windows Service'i yeniden başlat
net stop OrchestratorService
timeout /t 2
net start OrchestratorService
```

---

## 3. BROWSER GÜVENLIK AYARLARI

### 3.1 Self-Signed Sertifika (Test)

Browser'da uyarı alacaksın:
```
"Bu bağlantı güvenli değil" warning
```

**Geçici çözüm (SADECE DEV):** "Advanced" → "Accept risk and continue"

**Kalıcı çözüm:** Windows Certificate Store'a ekle

```powershell
# Admin PowerShell'de
Import-Certificate -FilePath "apps/orchestrator/certs/certificate.pem" `
  -CertStoreLocation "Cert:\LocalMachine\Root"
```

### 3.2 Let's Encrypt Sertifikası (Production)

Auto-trusted (modern browserler zaten kabul ediyor)

---

## 4. ADMIN UI HTTPS BAĞLANTISI

**Dosya: `apps/admin-ui/src/services/api.ts` (veya setup)**

```typescript
// Dev mode (HTTP)
const API_BASE_DEV = "http://localhost:8090";

// Production (HTTPS)
const API_BASE_PROD = "https://orchestrator.example.com:8090";

const API_BASE = process.env.NODE_ENV === "production" 
  ? API_BASE_PROD 
  : API_BASE_DEV;

// Axios/Fetch setup
const apiClient = axios.create({
  baseURL: API_BASE,
  https: {
    rejectUnauthorized: process.env.NODE_ENV === "production", // Self-signed tolerate dev'de
  },
});
```

---

## 5. CERTIFICATE PINNING (Advanced)

Üretim'de man-in-the-middle atağından korumak için:

```typescript
// apps/orchestrator/src/middleware/https-config.ts
import { createSecureContext } from "tls";

export function configureHTTPS() {
  return {
    // Public key pinning (optional)
    pinnedPubKeyHashes: [
      // Let's Encrypt certificate hash
      "...",
    ],
  };
}
```

---

## 6. KONTROL LISTESI

- [ ] Sertifika dosyaları `apps/orchestrator/certs/` altında
- [ ] HTTPS server init `apps/orchestrator/src/index.ts`'de yapılmış
- [ ] Admin UI API base URL'si güncellendi
- [ ] Self-signed sertifika Windows Cert Store'a eklendi (local testing)
- [ ] Let's Encrypt düzenlenmiş (production)
- [ ] Certbot renewal task scheduled
- [ ] Environment variables set:
  ```
  NODE_ENV=production
  USE_HTTPS=true
  ```

---

**HTTPS SETUP TAMAMLANDI**
