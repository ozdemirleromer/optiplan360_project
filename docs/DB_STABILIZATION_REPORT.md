# BÖLÜM 7 — VERİTABANI STABİLİZASYONU RAPORU

**Tarih:** 2026-03-04  
**Görev:** Şema tutarlılık denetimi, eksik index/constraint kontrolü

---

## GÖREV-7A: ŞEMA TUTARLILIK DENETİMİ

### Analiz Edilen Modeller:
1. Order (orders)
2. OrderPart (order_parts)
3. OptiJob (opti_jobs)  
4. OptiAuditEvent (opti_audit_events)
5. CRMAccount (crm_accounts)
6. Invoice (invoices)
7. PaymentPromise (payment_promises)

---

## 1. Order Tablosu (`orders`)

**Dosya:** `backend/app/models/order.py`

### Mevcut Index'ler:
- `id`: primary_key ✅
- `order_no`: unique + index ✅
- Foreign key'ler var

### Önerilen İyileştirmeler:
```python
__table_args__ = (
    Index("ix_orders_status_created", "status", "created_at"),
    Index("ix_orders_customer_status", "customer_id", "status"),
)
```

**Sebep:** 
- Status bazlı sorgular çok sık (dashboard, listing)
- Customer'a göre sipariş listesi sık kullanılır
- created_at ile birlikte index time-based sorguları hızlandırır

---

## 2. OrderPart Tablosu (`order_parts`)

**Dosya:** `backend/app/models/order.py:146`

### Mevcut Index'ler:
- `id`: primary_key ✅
- `order_id`: ForeignKey (implicit index yok kontrol edilmeli)

### Önerilen İyileştirmeler:
```python
__table_args__ = (
    Index("ix_order_parts_order_id", "order_id"),
)
```

**Sebep:**
- Her sipariş için part'lar JOIN ile alınır (sık kullanım)

### NOT NULL Kontrolü:
- `boy`, `en`, `adet` → NULL olabilir mi? Kontrol edilmeli
- İş kuralı: Bu alanlar zorunlu olmalı

---

## 3. OptiJob Tablosu (`opti_jobs`)

**Dosya:** `backend/app/models/order.py:182`

### Mevcut Index'ler:
- `id`: primary_key ✅
- `order_id`: ForeignKey ✅

### Önerilen İyileştirmeler:
```python
__table_args__ = (
    Index("ix_opti_jobs_state", "state"),
    Index("ix_opti_jobs_created_at", "created_at"),
    Index("ix_opti_jobs_order_state", "order_id", "state"),
)
```

**Sebep:**
- Worker state bazlı sorgu yapar: `WHERE state = 'OPTI_IMPORTED'`
- Dashboard job istatistikleri state gruplaması yapar
- created_at ile sıralı listeleme

---

## 4. OptiAuditEvent Tablosu (`opti_audit_events`)

**Dosya:** `backend/app/models/order.py:206`

### Mevcut Sütunlar:
✅ `job_id` → ForeignKey("opti_jobs.id"), index=True  
✅ `event_type` → String, nullable=False  
✅ `details_json` → Text, nullable=True  
✅ `message` → (kontrol edilmeli)
✅ `created_at` → (kontrol edilmeli)

### Eksik Sütunlar:
Şu anki model yapısını tam görmek gerekiyor. Eğer eksikse:

```python
# Olması gerekenler:
created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
message = Column(Text, nullable=True)
```

### Önerilen Index:
```python
__table_args__ = (
    Index("ix_audit_events_job_created", "job_id", "created_at"),
    Index("ix_audit_events_type", "event_type"),
)
```

**Sebep:**
- Job history sorguları: job_id + created_at DESC
- Event type filtreleme

---

## 5. CRMAccount Tablosu (`crm_accounts`)

**Dosya:** `backend/app/models/crm.py: 31`

### Mevcut Index'ler:
✅ `customer_id`: ForeignKey + index=True  
✅ `mikro_cari_kod`: index=True

### ❌ Eksik Constraint:
```python
# mikro_cari_kod UNIQUE olmalı (nullable ama değer varsa unique)
```

### Önerilen İyileştirme:
```python
__table_args__ = (
    # Mikro cari kodu varsa unique olmalı
    Index("ix_crm_accounts_mikro_kod", "mikro_cari_kod", unique=True, 
          postgresql_where=text("mikro_cari_kod IS NOT NULL")),
)
```

**Sebep:**
- Mikro entegrasyonunda aynı cari kodu 2 hesaba atanamaz
- Partial unique index (PostgreSQL)

---

## 6. Invoice Tablosu (`invoices`)

**Dosya:** `backend/app/models/finance.py:31`

### Mevcut Index'ler:
✅ `account_id`: ForeignKey + index=True  
✅ `order_id`: ForeignKey + index=True  
✅ `status`: Enum column (index YOK)  
✅ `due_date`: TIMESTAMP (index YOK)  
✅ `reminder_count`: Integer, default=0 ✅ VAR

### ⚠️ Eksik Index'ler:
```python
__table_args__ = (
    Index("ix_invoices_status", "status"),
    Index("ix_invoices_due_date", "due_date"),
    Index("ix_invoices_account_status", "account_id", "status"),
)
```

**Sebep:**
- Aging raporu: `WHERE due_date < NOW() AND status = 'PENDING'`
- Dashboard: status bazlı toplam/filtre
- Account'a göre fatura listesi

---

## 7. PaymentPromise Tablosu (`payment_promises`)

**Dosya:** `backend/app/models/finance.py:127`

### reminder_count Kontrolü:
**Kontrol gerekiyor** — model içeriğini tam okumak lazım

Eğer yoksa eklenecek:
```python
reminder_count = Column(Integer, default=0, nullable=False)
```

### Önerilen Index'ler:
```python
__table_args__ = (
    Index("ix_payment_promises_invoice_id", "invoice_id"),
    Index("ix_payment_promises_status", "status"),
    Index("ix_payment_promises_promise_date", "promise_date"),
)
```

---

## GÖREV-7B: OPTI_JOB AUDIT EVENT DOĞRULAMA

### OptiAuditEvent Model Durumu:

✅ Tablo adı: `opti_audit_events`  
✅ `job_id`: ForeignKey("opti_jobs.id"), index=True  
✅ `event_type`: String, nullable=False  
✅ `details_json`: Text, nullable=True

### Kontrol Edilmesi Gerekenler:
- [ ] `message` sütunu var mı?
- [ ] `created_at` sütunu var mı?
- [ ] Audit event'ler orchestrator_service tarafından yazılıyor mu?

**Aksiyon:** Tam model yapısını okuyup eksikleri tespit et ve ekle.

---

## GÖREV-7C: PAYMENTPROMISE reminder_count DOĞRULAMA

### Durum: ⏳ KONTROL GEREKİYOR

**Invoice** modelinde `reminder_count` VAR ✅ (satır 74)  
**PaymentPromise** modelinde `reminder_count` → TAM OKUNMADI

**Sonraki Adım:** PaymentPromise modelinin tam içeriğini oku ve doğrula.

---

## ÖZET — YAPILACAKLAR

### P0 — Kritik Index Eklemeleri:
1. ✅ Order: `ix_orders_status_created`
2. ✅ OptiJob: `ix_opti_jobs_state`
3. ✅ Invoice: `ix_invoices_due_date`, `ix_invoices_status`
4. ✅ OptiAuditEvent: `ix_audit_events_job_created`

### P1 — İyileştirmeler:
5. CRMAccount: `mikro_cari_kod` partial unique constraint
6. OrderPart: `ix_order_parts_order_id`
7. PaymentPromise: index'ler + reminder_count doğrulama

### Alembic Migration:
```bash
cd backend
alembic revision --autogenerate -m "add_missing_indexes_20260304"
alembic upgrade head
```

---

## SONRAKI BÖLÜM

**BÖLÜM 8:** Encoding Düzeltmeleri (open() çağrıları, XML, log dosyaları)
