import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.constants.optiplan_workflow import OPTIPLAN_PHASE2_FIELD_SEQUENCE
from app.features.optiplan_workflow.transport.http.router import (
    ErrorRequestIn,
    ExportPreviewResponseOut,
    ExportPreviewRowOut,
    ExportRecordResponseOut,
    ExportStatusAnomalyResponseOut,
    ExportRequestIn,
    FolderSettingsIn,
    Phase2UpdateIn,
    Phase3UpdateIn,
)


def test_folder_settings_schema_accepts_camel_case_aliases():
    payload = {
        "whatsappRawKlasoru": "C:/in/whatsapp",
        "scannerRawKlasoru": "C:/in/scanner",
        "manuelRawKlasoru": "C:/in/manual",
        "emailRawKlasoru": "C:/in/email",
        "islenmisKlasoru": "C:/out/processed",
        "arsivKlasoru": "C:/out/archive",
        "xmlOkumaKlasoru": "C:/out/xml",
        "xlsxCiktiKlasoru": "C:/out/xlsx",
        "hataliKlasoru": "C:/out/error",
        "fisEvrakNoFormati": "SIP-{seq:06d}",
        "arsivZamanDamgasiFormati": "%Y%m%d_%H%M%S",
        "xlsxAktifMi": True,
        "watcherAktifMi": True,
        "yenidenDenemeSayisi": 3,
    }

    parsed = FolderSettingsIn.model_validate(payload)
    dumped = parsed.model_dump(exclude_none=True)

    assert dumped["whatsapp_raw_klasoru"] == "C:/in/whatsapp"
    assert dumped["xlsx_aktif_mi"] is True
    assert dumped["yeniden_deneme_sayisi"] == 3


def test_folder_settings_schema_accepts_snake_case_fields():
    payload = {
        "whatsapp_raw_klasoru": "C:/in/whatsapp",
        "xlsx_aktif_mi": True,
        "yeniden_deneme_sayisi": 2,
    }

    parsed = FolderSettingsIn.model_validate(payload)
    dumped = parsed.model_dump(exclude_none=True)

    assert dumped["whatsapp_raw_klasoru"] == "C:/in/whatsapp"
    assert dumped["xlsx_aktif_mi"] is True
    assert dumped["yeniden_deneme_sayisi"] == 2


def test_phase2_field_sequence_matches_canonical_7_field_contract():
    assert OPTIPLAN_PHASE2_FIELD_SEQUENCE == (
        "boy",
        "en",
        "adet",
        "malzeme",
        "grain",
        "bilgi",
        "delik_1",
    )
def test_phase2_update_schema_accepts_camel_case_aliases():
    payload = {
        "rows": [
            {
                "id": "row-1",
                "boy": 120,
                "en": 80,
                "adet": 2,
                "malzeme": "18MM Beyaz",
                "grain": 3,
                "bilgi": "Arka yuz",
                "delik1": "D1",
                "hucreGuvenSkorlari": {
                    "boy": 88,
                    "en": 90,
                    "adet": 91,
                    "malzeme": 93,
                    "grain": 94,
                    "bilgi": 95,
                    "delik1": 81,
                },
                "satirGuvenSkorOzeti": {"onaylanan_hucreler": ["boy", "delik_1"]},
            }
        ],
        "okunanCariUnvan": "Ornek Cari",
        "okunanCariTelefon": "555",
        "aiGuvenSkoruOzeti": {"min": 81},
        "revizyonAdayiUyarisi": "Yok",
    }

    parsed = Phase2UpdateIn.model_validate(payload)
    dumped = parsed.model_dump(exclude_none=True)

    assert dumped["okunan_cari_unvan"] == "Ornek Cari"
    assert dumped["rows"][0]["malzeme"] == "18MM Beyaz"
    assert dumped["rows"][0]["grain"] == 3
    assert dumped["rows"][0]["bilgi"] == "Arka yuz"
    assert dumped["rows"][0]["delik_1"] == "D1"
    assert dumped["rows"][0]["hucre_guven_skorlari"]["boy"] == 88
    assert dumped["rows"][0]["hucre_guven_skorlari"]["delik1"] == 81
    assert dumped["rows"][0]["satir_guven_skor_ozeti"]["onaylanan_hucreler"] == ["boy", "delik_1"]
def test_phase2_update_schema_accepts_snake_case_fields():
    payload = {
        "rows": [
            {
                "id": "row-1",
                "boy": 120,
                "en": 80,
                "adet": 2,
                "malzeme": "18MM Beyaz",
                "grain": 3,
                "bilgi": "Arka yuz",
                "delik_1": "D1",
                "hucre_guven_skorlari": {
                    "boy": 88,
                    "en": 90,
                    "adet": 91,
                    "malzeme": 93,
                    "grain": 94,
                    "bilgi": 95,
                    "delik_1": 81,
                },
                "satir_guven_skor_ozeti": {"onaylanan_hucreler": ["boy", "delik_1"]},
            }
        ],
        "okunan_cari_unvan": "Ornek Cari",
        "okunan_cari_telefon": "555",
        "ai_guven_skoru_ozeti": {"min": 81},
        "revizyon_adayi_uyarisi": "Yok",
    }

    parsed = Phase2UpdateIn.model_validate(payload)
    dumped = parsed.model_dump(exclude_none=True)

    assert dumped["okunan_cari_unvan"] == "Ornek Cari"
    assert dumped["rows"][0]["malzeme"] == "18MM Beyaz"
    assert dumped["rows"][0]["grain"] == 3
    assert dumped["rows"][0]["bilgi"] == "Arka yuz"
    assert dumped["rows"][0]["delik_1"] == "D1"
    assert dumped["rows"][0]["hucre_guven_skorlari"]["boy"] == 88
    assert dumped["rows"][0]["hucre_guven_skorlari"]["delik_1"] == 81
    assert dumped["rows"][0]["satir_guven_skor_ozeti"]["onaylanan_hucreler"] == ["boy", "delik_1"]
def test_phase3_update_schema_accepts_camel_case_aliases():
    payload = {
        "cariUnvan": "Ornek Cari",
        "cariKodu": "CARI001",
        "siparisNo": "SIP-1",
        "stokKodu": "STK001",
        "bantKalinligi": "1 MM",
        "grainVarsayilan": 3,
        "plakaBoyMm": 2100,
        "plakaEnMm": 2800,
        "fireAciklamasi": "Test",
        "rows": [
            {
                "satirSirasi": 1,
                "boy": 500,
                "en": 300,
                "adet": 1,
                "delik1": "12",
                "delik2": "34",
                "satirKaynagi": "MANUEL",
                "plakaRef": "PLAKA-1",
                "bantKalinligiOverride": "1 MM",
                "hucreGuvenSkorlari": {"boy": 90},
                "satirGuvenSkorOzeti": {"onaylanan_hucreler": ["boy"]},
            }
        ],
    }

    parsed = Phase3UpdateIn.model_validate(payload)
    dumped = parsed.model_dump(exclude_none=True)

    assert dumped["cari_unvan"] == "Ornek Cari"
    assert dumped["cari_kodu"] == "CARI001"
    assert dumped["rows"][0]["satir_sirasi"] == 1
    assert dumped["rows"][0]["delik_1"] == "12"
    assert dumped["rows"][0]["delik_2"] == "34"
    assert dumped["rows"][0]["satir_kaynagi"] == "MANUEL"
    assert dumped["rows"][0]["plaka_ref"] == "PLAKA-1"


def test_phase3_update_schema_accepts_snake_case_fields():
    payload = {
        "cari_unvan": "Ornek Cari",
        "cari_kodu": "CARI001",
        "siparis_no": "SIP-1",
        "stok_kodu": "STK001",
        "bant_kalinligi": "1 MM",
        "grain_varsayilan": 3,
        "plaka_boy_mm": 2100,
        "plaka_en_mm": 2800,
        "fire_aciklamasi": "Test",
        "rows": [
            {
                "satir_sirasi": 1,
                "boy": 500,
                "en": 300,
                "adet": 1,
                "delik_1": "12",
                "delik_2": "34",
                "satir_kaynagi": "MANUEL",
                "plaka_ref": "PLAKA-1",
                "bant_kalinligi_override": "1 MM",
                "hucre_guven_skorlari": {"boy": 90},
                "satir_guven_skor_ozeti": {"onaylanan_hucreler": ["boy"]},
            }
        ],
    }

    parsed = Phase3UpdateIn.model_validate(payload)
    dumped = parsed.model_dump(exclude_none=True)

    assert dumped["cari_unvan"] == "Ornek Cari"
    assert dumped["cari_kodu"] == "CARI001"
    assert dumped["rows"][0]["satir_sirasi"] == 1
    assert dumped["rows"][0]["delik_1"] == "12"
    assert dumped["rows"][0]["delik_2"] == "34"
    assert dumped["rows"][0]["satir_kaynagi"] == "MANUEL"
    assert dumped["rows"][0]["plaka_ref"] == "PLAKA-1"


def test_export_request_schema_accepts_camel_case_aliases():
    payload = {"xlsxAktifMi": True}
    parsed = ExportRequestIn.model_validate(payload)
    dumped = parsed.model_dump(exclude_none=True)

    assert dumped["xlsx_aktif_mi"] is True


def test_export_request_schema_accepts_snake_case_fields():
    payload = {"xlsx_aktif_mi": True}
    parsed = ExportRequestIn.model_validate(payload)
    dumped = parsed.model_dump(exclude_none=True)

    assert dumped["xlsx_aktif_mi"] is True


def test_error_request_schema_accepts_camel_case_aliases():
    payload = {
        "hataFazi": "PHASE_3",
        "hataNedeni": "Diger",
        "operatorNotu": "Alias test",
    }
    parsed = ErrorRequestIn.model_validate(payload)
    dumped = parsed.model_dump(exclude_none=True)

    assert dumped["hata_fazi"] == "PHASE_3"
    assert dumped["hata_nedeni"] == "Diger"
    assert dumped["operator_notu"] == "Alias test"


def test_error_request_schema_accepts_snake_case_fields():
    payload = {
        "hata_fazi": "PHASE_3",
        "hata_nedeni": "Diger",
        "operator_notu": "Alias test",
    }
    parsed = ErrorRequestIn.model_validate(payload)
    dumped = parsed.model_dump(exclude_none=True)

    assert dumped["hata_fazi"] == "PHASE_3"
    assert dumped["hata_nedeni"] == "Diger"
    assert dumped["operator_notu"] == "Alias test"


@pytest.mark.parametrize(
    "payload",
    [
        {"hataFazi": "PHASE_3"},
        {"hataNedeni": "Diger"},
    ],
)
def test_error_request_schema_requires_mandatory_fields(payload):
    with pytest.raises(ValidationError):
        ErrorRequestIn.model_validate(payload)


def test_export_preview_response_schema_parses_service_payload():
    payload = {
        "kayit_uuid": "kayit-1",
        "dosya_adi": "SIP-000001",
        "xlsx_aktif_mi": True,
        "opj_aktif_mi": False,
        "opj_status": "PASIF",
        "revizyon_no": 0,
        "satirlar": [
            {
                "[P_CODE_MAT]": "MDF",
                "[P_LENGTH]": 500,
                "[P_WIDTH]": 300,
                "[P_MINQ]": 2,
                "[P_GRAIN]": 3,
                "[P_IDESC]": "RAF",
                "[P_EDGE_MAT_UP]": "04",
                "[P_EGDE_MAT_LO]": "",
                "[P_EDGE_MAT_SX]": "1",
                "[P_EDGE_MAT_DX]": "2",
                "[P_IIDESC]": "12",
                "[P_DESC1]": "",
            }
        ],
        "export_manifest": {
            "manifest_version": "workflow_export_manifest_v1",
            "kayit_uuid": "kayit-1",
            "export_id": None,
            "dosya_adi": "SIP-000001",
            "revizyon_no": 0,
            "retry_no": 0,
            "requested_formats": ["xlsx"],
            "generated_formats": [],
            "row_count": 1,
            "created_at": "2026-03-12T12:00:00+00:00",
        },
    }

    parsed = ExportPreviewResponseOut.model_validate(payload)
    dumped = parsed.model_dump(by_alias=True)

    assert dumped["kayit_uuid"] == "kayit-1"
    assert dumped["xlsx_aktif_mi"] is True
    assert dumped["opj_aktif_mi"] is False
    assert dumped["satirlar"][0]["[P_CODE_MAT]"] == "MDF"
    assert dumped["satirlar"][0]["[P_GRAIN]"] == 3


def test_export_preview_row_schema_rejects_invalid_constraints():
    payload = {
        "[P_CODE_MAT]": "MDF",
        "[P_LENGTH]": 0,
        "[P_WIDTH]": 300,
        "[P_MINQ]": 1,
        "[P_GRAIN]": 9,
        "[P_IDESC]": "RAF",
        "[P_EDGE_MAT_UP]": "INVALID",
        "[P_EGDE_MAT_LO]": "",
        "[P_EDGE_MAT_SX]": "",
        "[P_EDGE_MAT_DX]": "",
        "[P_IIDESC]": "12A",
        "[P_DESC1]": "",
    }

    with pytest.raises(ValidationError):
        ExportPreviewRowOut.model_validate(payload)


def test_export_record_response_schema_rejects_invalid_durum():
    payload = {
        "kayit_uuid": "kayit-1",
        "dosya_adi": "SIP-000001",
        "xlsx_aktif_mi": True,
        "revizyon_no": 0,
        "satirlar": [],
        "export_manifest": {
            "manifest_version": "workflow_export_manifest_v1",
            "kayit_uuid": "kayit-1",
            "export_id": "exp-1",
            "dosya_adi": "SIP-000001",
            "revizyon_no": 0,
            "retry_no": 0,
            "requested_formats": ["xlsx"],
            "generated_formats": ["xlsx"],
            "row_count": 0,
            "created_at": "2026-03-12T12:00:00+00:00",
        },
        "generated_files": ["C:/tmp/SIP-000001.xlsx"],
        "generated_file_details": [],
        "durum": "BILINMEYEN",
    }

    with pytest.raises(ValidationError):
        ExportRecordResponseOut.model_validate(payload)


def test_export_status_anomaly_response_schema_parses_payload():
    payload = {
        "limit": 20,
        "offset": 0,
        "filters": {
            "kayit_uuid": "kayit-1",
            "from": "2026-03-12T13:00:00+00:00",
            "to": "2026-03-12T14:00:00+00:00",
        },
        "summary": {
            "total_records": 3,
            "distinct_records": 2,
            "last_created_at": "2026-03-12T13:45:00+00:00",
            "status_breakdown": {
                "BASARILI": 3,
            },
        },
        "items": [
            {
                "id": 11,
                "kayit_uuid": "kayit-1",
                "alan_adi": "export_durum_anomali",
                "eski_deger": "BASARILI",
                "yeni_deger": "fallback=HATALI;requested_formats=1;generated_formats=1",
                "created_at": "2026-03-12T13:45:00+00:00",
            }
        ],
    }

    parsed = ExportStatusAnomalyResponseOut.model_validate(payload)
    dumped = parsed.model_dump()

    assert dumped["limit"] == 20
    assert dumped["offset"] == 0
    assert dumped["filters"]["kayit_uuid"] == "kayit-1"
    assert dumped["summary"]["total_records"] == 3
    assert dumped["summary"]["status_breakdown"]["BASARILI"] == 3
    assert dumped["items"][0]["alan_adi"] == "export_durum_anomali"


