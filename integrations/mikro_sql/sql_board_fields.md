# Mikro SQL Board (Admin) — Bağlantı Alanları

Bu ekranı sadece **Admin/Yönetici** görür. Amaç: Sistem ekibinin gerekli parametreleri girip entegrasyonu tamamlamasıdır.
Bu ekranda **asla iş verisi** gösterilmez; yalnızca bağlantı ve test.

## Alanlar
- SQL Server Host/IP
- Port (varsayılan 1433)
- Instance Name (opsiyonel)
- Database Name
- Username
- Password (maskeli)
- Encrypt Connection (bool)
- Trust Server Certificate (bool)
- Connection Timeout (sn)
- Read-only Mode (kilitli: true)
- Test Connection (buton)
- Last Test Result (timestamp)
- Last Error (UI maskeli; detay audit log'da)

## Güvenlik Notları
- Şifreler: OS credential store veya şifreli vault (DPAPI) ile saklanmalı.
- Test sorgusu: `SELECT 1` veya okuma amaçlı en küçük sorgu.
- Audit: Kim, ne zaman parametre değiştirdi (user_id, ip, cihaz).
