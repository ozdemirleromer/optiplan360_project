# QUICK START GUIDE — OptiPlan360 Orchestrator

**⏱️ 5 Dakikada Başla | Production Ready**

---

## 1️⃣ SYSTEM GEREKEN (Prerequisites)

### Hardware
- Windows Server 2019+
- 4GB RAM minimum
- 50GB disk space
- SMB 445 port (UNC path)

### Software
- Node.js v20+ (https://nodejs.org)
- NPM 10+
- Git (optional)

### Ağ (Network)
- OptiPlanning export server IP/hostname
- SMB access to drop folder (UNC path)
- HTTPS certificate (self-signed or Let's Encrypt)

---

## 2️⃣ KURULUM (30 Seconds)

### A. Code Klonla
```bash
cd C:\PROJE
git clone <repo-url> optiplan360_project
cd optiplan360_project
```

### B. Backend Kurulumu
```bash
cd apps/orchestrator
npm install --legacy-peer-deps
npm run build
```

### C. Konfigürasyon
```bash
# config/paths.json'ı düzenle
{
  "optiPlanning": "\\\\YOUR-SERVER\\drop\\inbox",
  "output": "D:\\jobs\\output"
}

# config/rules.json'ı düzenle (trim mapping, etc.)
# config/system_config.json'ı düzenle (şirket adı, vb.)
```

### D. Çalıştır
```bash
npm start
# Çıktı: "Server running on https://localhost:8090"
```

---

## 3️⃣ TEST (VERIFY) — 1 Dakika

### Test 1: Health Check
```bash
curl https://localhost:8090/health
# İstenen çıktı: {"status":"ok"}
```

### Test 2: Admin UI
```
Browser → https://localhost:8090 (skip HTTPS warning)
Username: admin
Password: admin (dev mode)
```

### Test 3: Test Job Gönder
```bash
curl -X POST https://localhost:8090/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "crm_id": "TEST001",
    "body_code": "body123",
    "trim_type": "CARVING",
    "plate_width": 2440,
    "plate_height": 1220
  }'
# İstenen çıktı: {"id":"job-xxx","status":"NEW"}
```

### Test 4: Job İzle
```bash
# Admin UI Dashboard → Job List
# veya
curl https://localhost:8090/jobs | jq .
```

✅ **Tamamlandı!** Sistem çalışıyor.

---

## 4️⃣ PRODUCTION DEPLOY (30 Minutes)

### A. HTTPS Sertifikası

#### Development (Self-Signed)
```bash
# Zaten .env'de:
# HTTPS_CERT=apps/orchestrator/certs/certificate.pem
# HTTPS_KEY=apps/orchestrator/certs/private-key.pem
# (Sertifikalar kurulum sırasında generate edildi)
```

#### Production (Let's Encrypt)
```bash
# Bkz: docs/HTTPS_SETUP_GUIDE.md
# Kısaca:
certbot certonly --standalone -d orchestrator.example.com
cp /etc/letsencrypt/live/orchestrator.example.com/* apps/orchestrator/certs/
```

### B. Environment Variables
```bash
# .env dosyası oluştur
NODE_ENV=production
ORCHESTRATOR_PORT=8090
JWT_SECRET=$(openssl rand -base64 32)
HTTPS_ENABLED=true
DATABASE_PATH=apps/orchestrator/data/jobs.db
```

### C. Windows Service Kurulması
```powershell
# PowerShell (Admin) aç
$PSScriptRoot = "C:\PROJE\optiplan360_project"
. "$PSScriptRoot\scripts\orchestrator-service-setup.ps1"

# Service otomatik başlayacak veya:
Start-Service OptiPlan360Orchestrator
```

### D. Doğrulama
```bash
# Service çalışıyor mı?
Get-Service OptiPlan360Orchestrator | Select Status
# İstenen: Running

# Health check
curl https://localhost:8090/health
```

✅ **Production Deploy Tamamlandı!**

---

## 5️⃣ ADMIN UI (Optional)

### Frontend Kurulması
```bash
cd apps/admin-ui
npm install
npm run build
# dist/ folder oluşacak
```

### Nginx/IIS Deployment
```nginx
# nginx.conf
server {
    listen 443 ssl;
    server_name orchestrator-admin.example.com;
    
    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private-key.pem;
    
    root /var/www/admin-ui/dist;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass https://localhost:8090;
    }
}
```

---

## 🚀 OPERASYONEL KOMUTLAR

Günlük operasyon komutları (health check, job sorgulama, retry, approve, service kontrol, log izleme) için bkz. **[docs/OPERATIONS.md](docs/OPERATIONS.md)** — Bölüm 1, 8-10.

### Hızlı Referans

```powershell
# Health check
Invoke-RestMethod http://127.0.0.1:8090/health

# Job listesi
Invoke-RestMethod http://127.0.0.1:8090/jobs

# Service restart
nssm restart OptiPlan360Orchestrator
```

---

## 🆘 HIZLICA SORUN GİDERME

| Problem | Çözüm |
|---------|-------|
| **Port 8090 already in use** | `netstat -ano \| findstr :8090` → `taskkill /PID {pid}` |
| **Database locked** | Restart service |

**Detaylı sorun giderme:** Bkz. [docs/OPERATIONS.md](docs/OPERATIONS.md) — Bölüm 11.

---

## 📚 SONRAKI ADIMLAR

### Hemen Sonra
1. [ ] Health check başarılı
2. [ ] Test job başarılı
3. [ ] Admin UI erişilebilir
4. [ ] Backup scheduled

### Bu Hafta
1. [ ] HTTPS sertifikası kuruldu
2. [ ] Windows Service otomatik start'ta
3. [ ] Monitoring setup
4. [ ] Team training

### Bu Ay
1. [ ] Production traffic gönder
2. [ ] Performance baseline dokümenta et
3. [ ] Incident response training
4. [ ] Monitoring dashboard setup

---

## 📖 FULL DOCUMENTATION

| Doküman | Amaç |
|---------|------|
| [API_CONTRACT.md](docs/API_CONTRACT.md) | Tüm API endpoint specifications |
| [OPERATIONS.md](docs/OPERATIONS.md) | İşletim rehberi + sorun giderme |
| [STATE_MACHINE.md](docs/STATE_MACHINE.md) | State machine tanımları |
| [HTTPS_SETUP_GUIDE.md](docs/HTTPS_SETUP_GUIDE.md) | HTTPS deployment |
| [SECURITY_NOTES.md](docs/SECURITY_NOTES.md) | JWT/role ve audit |
| [A11Y_CHECKLIST.md](docs/A11Y_CHECKLIST.md) | Erişilebilirlik kontrol listesi |

---

## 💡 PRO TIPS

### JWT Token Almak (Testing)
```bash
# Login et
TOKEN=$(curl -s -X POST https://localhost:8090/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin"}' | jq -r .token)

# Her request'te kullan
curl https://localhost:8090/jobs \
  -H "Authorization: Bearer $TOKEN"
```

### Batch Job Gönder (Script)
```bash
#!/bin/bash
for i in {1..10}; do
  curl -X POST https://localhost:8090/jobs \
    -H "Content-Type: application/json" \
    -d "{\"crm_id\":\"TEST-$i\",\"body_code\":\"body_$i\"}"
done
```

### Performance Test
```bash
# 100 concurrent requests
ab -n 100 -c 10 https://localhost:8090/health
# Ab = Apache Bench tool
```

---

## ✅ CHECKLIST: Hazır mısın?

- [ ] Windows Server kuruldu
- [ ] Node.js v20+ kuruldu
- [ ] Repo klonlandı
- [ ] `npm install` başarılı
- [ ] `npm start` çalışıyor
- [ ] Health check: OK
- [ ] Test job başarılı
- [ ] Admin UI erişilebilir
- [ ] .env configured
- [ ] HTTPS sertifikası kopyalandı
- [ ] Windows Service kuruldu ve çalışıyor

**Tümü ✅? Production'a geçmeye hazırsın!**

---

## 🆘 HALA SORUN VAR MI?

1. **Bkz:** [docs/OPERATIONS.md → Sorun Giderme](docs/OPERATIONS.md)
2. **İç Gözlem:** Logs at `apps/orchestrator/logs/`

---

**Ready to ship! 🚀**
