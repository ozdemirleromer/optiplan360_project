# Breaking Changes

## 1. Veritabanı migration gerekli
**Etkilenen dosyalar:** `backend/app/models/order.py`, `backend/app/models/finance.py`, `backend/app/models/crm.py`

Bu kontrol geçişinde şu şema değişiklikleri uygulandı:
- `orders` tablosuna `ix_order_status_created`
- `order_parts` tablosuna `ix_order_part_order_id`
- `opti_jobs` tablosuna `ix_opti_job_order_created`
- `invoices` tablosuna `ix_invoice_account_status`, `ix_invoice_due_date`
- `crm_accounts` tablosuna `ux_crm_account_mikro_cari_kod` unique index
- `payment_promises.reminder_count` yeni alanı

## 2. OrderPart nullability sıkılaştı
`order_parts.boy`, `order_parts.en`, `order_parts.adet` artık ORM seviyesinde null kabul etmiyor.

Not:
- `boy` ve `en` için `default=0` kullanıldı.
- Sebep, Bölüm 3 alan birleştirmesi tamamlanmadan null kayıt üretimini durdurmak.
- Yine de mevcut veritabanına migration uygulanması gerekir.

## 3. Uygulama etkisi
API path veya response alan adı değişikliği yapılmadı.

Yine de aşağıdaki operasyonlar migration olmadan uyumlu değildir:
- Alembic autogenerate
- `alembic upgrade head`
- Eski veritabanı üzerinde unique `mikro_cari_kod` ihlali olan kayıtlar
