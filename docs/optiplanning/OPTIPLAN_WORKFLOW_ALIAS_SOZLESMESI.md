# OptiPlan Workflow Alias Sozlesmesi

Bu dokuman, OptiPlan Workflow API request modellerinde desteklenen `snake_case` ve `camelCase` alan eslemelerini tek referansta toplar.

## Amac

- [API] Frontend ve backend ekiplerinin ayni endpointlerde farkli key adlariyla sorunsuz calismasi.
- [API] Manuel key donusumlerini azaltmak.
- [EKLENMESI-GEREKLI] Yeni client gelistirmelerinde tek sozlesme tablosu uzerinden hizli entegrasyon.

## Kapsam

Asagidaki modeller kapsamdadir:

- `FolderSettingsIn`
- `Phase2RowIn`
- `Phase2UpdateIn`
- `Phase3RowIn`
- `Phase3UpdateIn`
- `ExportRequestIn`
- `ErrorRequestIn`

## Alias Tablosu

### FolderSettingsIn

| snake_case | camelCase |
|---|---|
| whatsapp_raw_klasoru | whatsappRawKlasoru |
| scanner_raw_klasoru | scannerRawKlasoru |
| manuel_raw_klasoru | manuelRawKlasoru |
| email_raw_klasoru | emailRawKlasoru |
| islenmis_klasoru | islenmisKlasoru |
| arsiv_klasoru | arsivKlasoru |
| xml_okuma_klasoru | xmlOkumaKlasoru |
| xlsx_cikti_klasoru | xlsxCiktiKlasoru |
| hatali_klasoru | hataliKlasoru |
| fis_evrak_no_formati | fisEvrakNoFormati |
| arsiv_zaman_damgasi_formati | arsivZamanDamgasiFormati |
| xlsx_aktif_mi | xlsxAktifMi |
| watcher_aktif_mi | watcherAktifMi |
| yeniden_deneme_sayisi | yenidenDenemeSayisi |

### Phase2

| Model | snake_case | camelCase |
|---|---|---|
| Phase2RowIn | hucre_guven_skorlari | hucreGuvenSkorlari |
| Phase2RowIn | satir_guven_skor_ozeti | satirGuvenSkorOzeti |
| Phase2UpdateIn | okunan_cari_unvan | okunanCariUnvan |
| Phase2UpdateIn | okunan_cari_telefon | okunanCariTelefon |
| Phase2UpdateIn | ai_guven_skoru_ozeti | aiGuvenSkoruOzeti |
| Phase2UpdateIn | revizyon_adayi_uyarisi | revizyonAdayiUyarisi |

### Phase3

| Model | snake_case | camelCase |
|---|---|---|
| Phase3RowIn | satir_sirasi | satirSirasi |
| Phase3RowIn | delik_1 | delik1 |
| Phase3RowIn | delik_2 | delik2 |
| Phase3RowIn | satir_kaynagi | satirKaynagi |
| Phase3RowIn | plaka_ref | plakaRef |
| Phase3RowIn | bant_kalinligi_override | bantKalinligiOverride |
| Phase3RowIn | hucre_guven_skorlari | hucreGuvenSkorlari |
| Phase3RowIn | satir_guven_skor_ozeti | satirGuvenSkorOzeti |
| Phase3UpdateIn | cari_unvan | cariUnvan |
| Phase3UpdateIn | cari_kodu | cariKodu |
| Phase3UpdateIn | siparis_no | siparisNo |
| Phase3UpdateIn | stok_kodu | stokKodu |
| Phase3UpdateIn | bant_kalinligi | bantKalinligi |
| Phase3UpdateIn | grain_varsayilan | grainVarsayilan |
| Phase3UpdateIn | plaka_boy_mm | plakaBoyMm |
| Phase3UpdateIn | plaka_en_mm | plakaEnMm |
| Phase3UpdateIn | fire_aciklamasi | fireAciklamasi |

### Export ve Error

| Model | snake_case | camelCase |
|---|---|---|
| ExportRequestIn | xlsx_aktif_mi | xlsxAktifMi |
| ErrorRequestIn | hata_fazi | hataFazi |
| ErrorRequestIn | hata_nedeni | hataNedeni |
| ErrorRequestIn | operator_notu | operatorNotu |

## Ornek

### Phase3 payload (camelCase)

```json
{
  "cariUnvan": "Ornek Cari",
  "cariKodu": "CARI001",
  "siparisNo": "SIP-1",
  "stokKodu": "STK001",
  "rows": [
    {
      "satirSirasi": 1,
      "delik1": "12",
      "delik2": "34",
      "satirKaynagi": "MANUEL"
    }
  ]
}
```

### Service katmanina normalize edilmis gorunum (snake_case)

```json
{
  "cari_unvan": "Ornek Cari",
  "cari_kodu": "CARI001",
  "siparis_no": "SIP-1",
  "stok_kodu": "STK001",
  "rows": [
    {
      "satir_sirasi": 1,
      "delik_1": "12",
      "delik_2": "34",
      "satir_kaynagi": "MANUEL"
    }
  ]
}
```

## Notlar

- [API] Alias destegi request parse asamasinda uygulanir.
- [SQL-TEKNIK] Veritabani kolonlari snake_case olarak korunur.
- [VARSAYIM] Yeni modeller eklendikce ayni alias standardi korunur.

## Endpoint Bazli Alias Parity

| Endpoint | Request Model | Snake Example Ref | Camel Example Ref |
|---|---|---|---|
| `/optiplan-workflow/folder-settings` | `FolderSettingsIn` | `WorkflowFolderSettingsSnakeCaseRequest` | `WorkflowFolderSettingsCamelCaseRequest` |
| `/optiplan-workflow/records/{kayit_uuid}/phase2` | `Phase2UpdateIn` | `WorkflowPhase2SnakeCaseRequest` | `WorkflowPhase2CamelCaseRequest` |
| `/optiplan-workflow/records/{kayit_uuid}/phase3` | `Phase3UpdateIn` | `WorkflowPhase3SnakeCaseRequest` | `WorkflowPhase3CamelCaseRequest` |
| `/optiplan-workflow/records/{kayit_uuid}/export/preview` | `ExportRequestIn` | `WorkflowExportSnakeCaseRequest` | `WorkflowExportCamelCaseRequest` |
| `/optiplan-workflow/records/{kayit_uuid}/export` | `ExportRequestIn` | `WorkflowExportSnakeCaseRequest` | `WorkflowExportCamelCaseRequest` |
| `/optiplan-workflow/records/{kayit_uuid}/error` | `ErrorRequestIn` | `WorkflowErrorSnakeCaseRequest` | `WorkflowErrorCamelCaseRequest` |

- [API] Referanslar `docs/openapi.yaml` dosyasi `components/examples` altinda tanimlidir.
- [API] Endpoint parity detay tablosu: `docs/optiplanning/OPTIPLAN_WORKFLOW_ENDPOINT_PARITY_MATRISI.md`
