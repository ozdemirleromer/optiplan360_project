# Recovered Database Snapshots

Bu klasor recovery taramasinda projeye aitligi kesinlesen veritabani snapshotlarini tutar.

Icerik:
- `optiplan.db`
- `orchestrator_1.db`
- `orchestrator_1.db-wal`
- `orchestrator_1.db-shm`
- `orchestrator_2.db`
- `orchestrator_2.db-wal`
- `orchestrator_2.db-shm`

Kurallar:
- Bu dosyalar migration veya schema kaynagi degildir.
- Uygulamanin aktif veritabani yerine gecmezler.
- Sadece inceleme, kurtarma ve veri dogrulama amaciyla tutulurlar.
