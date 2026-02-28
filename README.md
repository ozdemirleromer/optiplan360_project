# OPTIPLAN 360

**Mobilya Üretim Optimizasyon ve Planlama Sistemi**

Modern mobilya üretim tesisleri için geliştirilmiş, OCR destekli sipariş yönetimi, OptiPlanning entegrasyonu ve WhatsApp otomasyonlu akıllı üretim takip sistemi.

---

## 📋 Sistem Özeti

- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: Python (FastAPI)
- **Veritabanı**: PostgreSQL
- **Entegrasyonlar**: 
  - OptiPlanning (kesim optimizasyonu)
  - Mikro SQL (ERP entegrasyonu)
  - WhatsApp Business API (müşteri bildirimleri)
  - OCR (sipariş dijitalleştirme)

---

## 🚀 Hızlı Başlangıç

### Gereksinimler
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- **OCR Gereksinimleri:**
  - Tesseract OCR (`apt-get install tesseract-ocr` veya Windows installer)
  - Poppler (`apt-get install poppler-utils` veya Windows binary)

### Kurulum

```bash
# Backend
cd backend
pip install -r requirements.txt
python -m alembic upgrade head
# Windows'ta Encoding Hatası Almamak İçin:
set PYTHONIOENCODING=utf-8
python main.py

# Frontend
cd frontend
npm install
npm run dev
```

### Yapılandırma
Sistem yapılandırması için `config/` klasöründeki JSON dosyalarını düzenleyin:
- `system_config.json`: Genel sistem ayarları
- `shift_hours.json`: Mesai saatleri
- `export.json`: Export formatları

---

## 📚 Dokümantasyon

- **[OPTIPLAN360_MASTER_HANDOFF.md](./OPTIPLAN360_MASTER_HANDOFF.md)**: Ana sistem dokümantasyonu, iş kuralları, API referansı
- **[OPTIPLAN360_UI_UX_MIMARI_RAPORU_BIRLESTIRILMIS.md](./OPTIPLAN360_UI_UX_MIMARI_RAPORU_BIRLESTIRILMIS.md)**: UI/UX mimarisi, tasarım sistemi, bileşen kataloğu
- **[README_DEPLOY.md](./README_DEPLOY.md)**: Deployment talimatları
- **[docs/ui_flow.mmd](./docs/ui_flow.mmd)**: UI akış diyagramları (Mermaid)

---

## 🔄 Son Güncellemeler

### [2026-02-15] UI İyileştirmeleri
- ✅ Sidebar menü yapısı yeniden düzenlendi (4→2 ana grup)
- ✅ Kanban kartlarına tıklama özelliği eklendi
- ✅ İstasyon ve kullanıcı sayfası hata düzeltmeleri
- ✅ Frontend modüler refactor: `Kanban`, `Orders`, `OrderEditor`, `Reports`, `Dashboard` bileşenlere ayrıldı
- ✅ Ortak bileşen/altyapı eklendi: `Badge`, `Modal`, `ToastContext`
- 📄 Detaylar: [CHANGELOG](./OPTIPLAN360_MASTER_HANDOFF.md#12-güncellemeler-ve-değişiklikler)
- 📄 Refactor özeti: [FRONTEND_REFACTOR_CHANGELOG.md](./FRONTEND_REFACTOR_CHANGELOG.md)

---

## 🏗️ Proje Yapısı

```
optiplan360_project/
├── backend/           # Python API
│   ├── app/          # Uygulama kodu
│   │   ├── routers/  # API endpoints
│   │   ├── services/ # İş mantığı
│   │   └── compliance/ # Kural motorları
│   └── tests/
├── frontend/          # React UI
│   └── src/
├── database/          # SQL şemaları
├── config/            # Yapılandırma dosyaları
├── docs/              # Dokümantasyon
└── integrations/      # Dış sistem entegrasyonları
```

---

## 🔐 Güvenlik

- JWT bazlı kimlik doğrulama
- RBAC (Rol Tabanlı Erişim Kontrolü)
- SQL injection koruması
- XSS/CSRF önlemleri
- Audit logging

---

## 📞 Destek

Teknik sorular için proje dokümantasyonunu inceleyin veya geliştirme ekibi ile iletişime geçin.

**Versiyon**: 1.0.0  
**Son Güncelleme**: 2026-02-15  
**Durum**: ✅ Üretime Hazır
---

## Dokumantasyon Yonetimi (Tek Kaynak)

Karmasa olusmamasi icin dokumantasyon kaynak onceligi:
1. `AGENT_ONEFILE_INSTRUCTIONS.md`
2. `docs/RESMI_KARAR_DOKUMANI_V1.md`
3. `docs/RUN_PROMPT_V1.md`
4. `DOCUMENTATION_INDEX.md`

Hizli erisim:
- `DOCUMENTATION_INDEX.md`
- `docs/RUN_PROMPT_V1.md`
- `OPTIPLAN360_TAM_PAKET_SATIS_OPTIPLANNING_MIKRO.md`
