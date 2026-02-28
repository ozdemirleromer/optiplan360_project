# Ordered Inbox Kurali (EXCEL_TEST)

Bu kural, asagidaki referans dosya yolunu baz alir:

`C:\Optiplan360_Entegrasyon\OPTİPLAN\1_GELEN_SIPARISLER\EXCEL_TEST_1.xlsx`

Kuraldan tureyen davranis:

1. Kaynak klasor: `...\1_GELEN_SIPARISLER`
2. Desen: `EXCEL_TEST_*.xlsx`
3. Isleme sirasi:
   - Once numerik sira (`EXCEL_TEST_1`, `EXCEL_TEST_2`, ...)
   - Sonra dosya zamani ve ad
4. Dosya islenmeden once stabilite kontrolu yapilir (varsayilan 2 sn).
5. Islenen dosya once `0_ISLENIYOR` klasorune alinarak kilitlenir.
6. Her dosya tek tek `optiplan_professional_run.py` ile calisir.
7. Basarili dosya: `...\2_ISLENEN_SIPARISLER`
8. Hatali dosya: `...\3_HATALI_VERILER`

## Calistirma

Tek tur (mevcut dosyalari bir kez isle):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_optiplan_ordered_inbox.ps1 -Once
```

Hizli mod (onerilen):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_optiplan_ordered_inbox.ps1 -Once -Quick
```

`-Quick` su ayarlari uygular:

1. `--skip-preflight`
2. `--skip-ui-map`
3. Stabilite bekleme varsayilani `0.5 sn` (ozel `-StableSeconds` verilmediyse)

Surekli dinleme:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_optiplan_ordered_inbox.ps1 -PollSec 5
```

Dry-run (siralamayi gor, islem yapma):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_optiplan_ordered_inbox.ps1 -Once -DryRun
```

Ince ayar:

1. Preflight'i sadece bir kez calistirma (varsayilan acik):
   - `-NoPreflightOnce` verirsen her dosyada preflight devreye girer.
2. Stabilite suresi:
   - `-StableSeconds 3` ile dosya bekleme suresini degistir.
3. Islem klasoru:
   - `-ProcessingDir "...\0_ISLENIYOR"` ile ozellestir.

## Raporlar

Varsayilan cikti klasoru: `logs/optiplan_queue`

1. `ordered_inbox_summary_*.json` -> queue genel ozet
2. `<DOSYA_ADI>_*.json` -> professional run adim raporu
3. `<DOSYA_ADI>_*.log` -> konsol/hata kaydi
