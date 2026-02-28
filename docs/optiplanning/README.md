# OptiPlanning Tek Cozum Dokumani

Bu klasorde tek resmi akıs vardir:

1. `1_GELEN_SIPARISLER` altindaki `EXCEL_TEST_*.xlsx` dosyalarini sira ile al.
2. Her dosya icin `professional run` calistir:
   - Stage-1: New + Save + New Worklist
   - Stage-2: Parcalar -> Sec -> Yapistir
   - Save
   - Optimize (opsiyonel)
3. Sonucu tasima:
   - basarili -> `2_ISLENEN_SIPARISLER`
   - hatali -> `3_HATALI_VERILER`

## Kullanilan Scriptler

1. `scripts/run_optiplan_ordered_inbox.ps1`
2. `scripts/optiplan_ordered_inbox_runner.py`
3. `scripts/run_optiplan_professional.ps1`
4. `scripts/optiplan_professional_run.py`
5. `scripts/optiplan_stage1_automation.py`
6. `scripts/optiplan_stage2_select_paste.py`
7. `scripts/optiplan_stage3_optimize.py`
8. `scripts/optiplan_preflight_check.py`
9. `scripts/optiplan_template_contract.py`

## Baslangic Komutlari

Hizli tek tur:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_optiplan_ordered_inbox.ps1 -Once -Quick
```

Surekli dinleme:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_optiplan_ordered_inbox.ps1 -PollSec 5 -Quick
```

Tek dosya manuel kosu:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_optiplan_professional.ps1 -XlsxPath "C:\...\EXCEL_TEST_1.xlsx" -SkipPreflight -SkipUiMap
```

## Kural Referansi

Ana referans dosya:

`C:\Optiplan360_Entegrasyon\OPTİPLAN\1_GELEN_SIPARISLER\EXCEL_TEST_1.xlsx`

Detayli kural ve islem adimlari:

1. `docs/optiplanning/ORDERED_INBOX_RULE_TR.md`
2. `docs/optiplanning/LIVE_UI_TEST_CONTROL_TR.md`
