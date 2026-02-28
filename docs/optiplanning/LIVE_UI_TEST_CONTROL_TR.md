# OptiPlanning Canli UI Test Kontrol Rehberi

Bu rehber, OptiPlanning akisini ayni ekranda izleyerek test etmek ve sonucu dosya uzerinden dogrulamak icindir.

## 1. Tek Komut Calistirma

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_optiplan_professional.ps1 `
  -XlsxPath ".\tmp\manual_stage2_contract_test.xlsx" `
  -TimeoutSec 60 `
  -OptimizeTimeoutSec 12
```

Opsiyonel:

1. Optimize adimini kapatmak icin `-SkipOptimize`
2. Preflight atlamak icin `-SkipPreflight`
3. UI map atlamak icin `-SkipUiMap`
4. Parametre import uygulamak icin `-ApplyParamImport -ParamProfile "PROFIL_ADI"`

## 2. Ekranda Beklenen Akis

1. `New + Save + New Worklist`
2. `Parcalar -> Sec -> Yapistir`
3. `Kaydet`
4. `Yurut -> Optimize Et / Devam et` (kapatilmadiysa)
5. UI map snapshot (kapatilmadiysa)

## 3. PASS/FAIL Kontrolleri

1. Konsolda `TAMAM: Professional run tamamlandi.` gorunmeli.
2. Script `exit code 0` ile bitmeli.
3. Rapor klasorunde tek calisma icin 3 dosya olusmali:
   - `professional_run_*.json`
   - `professional_run_*.meta.json`
   - `professional_run_*.log`
4. `professional_run_*.json` icinde her adim `status=PASS` olmali.
5. `professional_run_*.json` icinde `status=PASS` ve `exit_code=0` olmali.

## 4. Rapor Alanlari (Hizli Okuma)

`professional_run_*.json`:

1. `status`: genel sonuc (`PASS` / `FAIL`)
2. `error`: hata mesaji (varsa)
3. `steps[]`: adim bazli durum, sure, komut
4. `options`: calisma secenekleri

`professional_run_*.meta.json`:

1. `duration_sec`: toplam sure
2. `command`: kullanilan komut satiri
3. `report_json`: adim bazli rapor dosya yolu
4. `console_log`: tam konsol cikti kaydi

## 5. Hata Durumunda Triage

1. Ilk bakis: `professional_run_*.json -> steps[] -> status=FAIL olan adim`
2. Komut detay: ayni adimin `command` alani
3. Tam hata metni: `professional_run_*.log`
4. Stage-2 yapistirma sorunu icin XLSX satir-1/2 sozlesmesini kontrol et.
5. Gerekirse tek adim calistir:

```powershell
python scripts/optiplan_stage1_automation.py --xlsx ".\tmp\manual_stage2_contract_test.xlsx" --timeout 60
python scripts/optiplan_stage2_select_paste.py --xlsx ".\tmp\manual_stage2_contract_test.xlsx" --timeout 60
python scripts/optiplan_stage3_optimize.py --timeout 12 --trigger button
```

## 6. Kabul Kriteri

1. En az 3 ardarda calistirmada `exit_code=0`
2. Her calistirmada adim raporu tam olusmali
3. Operatorde gorunen akis ile rapordaki adim sirasi birebir uyusmali
