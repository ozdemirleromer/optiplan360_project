"""
TeklifToSiparisConverter — birim testleri.

Kapsam:
- convert_teklif_to_siparis: başarılı dönüşüm
- _validate_teklif_data: zorunlu alan eksikliği / negatif değerler
- _map_teklif_to_siparis_fields: alan eşleme
- vade → termin mapping
- siparis_no üretimi
- conversion_count sayacı
"""

from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import pytest
from app.services.teklif_to_siparis_service import (
    ConversionStatus,
    TeklifFieldType,
    TeklifToSiparisConverter,
)


@pytest.fixture()
def converter():
    return TeklifToSiparisConverter()


def _valid_teklif(**overrides):
    data = {
        TeklifFieldType.TEKLIF_NO.value: "TKL001",
        TeklifFieldType.MUSTERI_KODU.value: "MSTR001",
        TeklifFieldType.STOK_KODU.value: "STK001",
        TeklifFieldType.MIKTAR.value: 10.0,
        TeklifFieldType.BIRIM_FIYAT.value: 100.0,
        TeklifFieldType.TOPLAM_TUTAR.value: 1000.0,
    }
    data.update(overrides)
    return data


# ─── başarılı dönüşüm ─────────────────────────────────────────────────────────

class TestSuccessfulConversion:
    def test_status_is_success(self, converter):
        result = converter.convert_teklif_to_siparis(_valid_teklif())
        assert result.status == ConversionStatus.SUCCESS

    def test_teklif_no_preserved(self, converter):
        result = converter.convert_teklif_to_siparis(_valid_teklif())
        assert result.teklif_no == "TKL001"

    def test_siparis_no_generated(self, converter):
        result = converter.convert_teklif_to_siparis(_valid_teklif())
        assert result.siparis_no is not None
        assert result.siparis_no.startswith("SPR")

    def test_converted_data_has_siparis_no(self, converter):
        result = converter.convert_teklif_to_siparis(_valid_teklif())
        assert result.converted_data is not None
        assert "siparis_no" in result.converted_data

    def test_musteri_mapped_to_cari_kodu(self, converter):
        result = converter.convert_teklif_to_siparis(_valid_teklif())
        assert result.converted_data["cari_kodu"] == "MSTR001"

    def test_no_errors_on_success(self, converter):
        result = converter.convert_teklif_to_siparis(_valid_teklif())
        assert result.errors == []


# ─── validasyon hataları ─────────────────────────────────────────────────────

class TestValidationErrors:
    def test_missing_teklif_no_fails(self, converter):
        data = _valid_teklif()
        data.pop(TeklifFieldType.TEKLIF_NO.value)
        result = converter.convert_teklif_to_siparis(data)
        assert result.status == ConversionStatus.VALIDATION_ERROR

    def test_missing_musteri_kodu_fails(self, converter):
        data = _valid_teklif()
        data[TeklifFieldType.MUSTERI_KODU.value] = ""
        result = converter.convert_teklif_to_siparis(data)
        assert result.status == ConversionStatus.VALIDATION_ERROR

    def test_zero_miktar_fails(self, converter):
        result = converter.convert_teklif_to_siparis(
            _valid_teklif(**{TeklifFieldType.MIKTAR.value: 0})
        )
        assert result.status == ConversionStatus.VALIDATION_ERROR

    def test_negative_miktar_fails(self, converter):
        result = converter.convert_teklif_to_siparis(
            _valid_teklif(**{TeklifFieldType.MIKTAR.value: -5})
        )
        assert result.status == ConversionStatus.VALIDATION_ERROR

    def test_zero_birim_fiyat_fails(self, converter):
        result = converter.convert_teklif_to_siparis(
            _valid_teklif(**{TeklifFieldType.BIRIM_FIYAT.value: 0})
        )
        assert result.status == ConversionStatus.VALIDATION_ERROR

    def test_non_numeric_miktar_fails(self, converter):
        result = converter.convert_teklif_to_siparis(
            _valid_teklif(**{TeklifFieldType.MIKTAR.value: "abc"})
        )
        assert result.status == ConversionStatus.VALIDATION_ERROR
        assert any("sayısal" in e for e in result.errors)

    def test_errors_list_populated(self, converter):
        data = _valid_teklif()
        data[TeklifFieldType.STOK_KODU.value] = ""
        result = converter.convert_teklif_to_siparis(data)
        assert len(result.errors) > 0


# ─── vade → termin mapping ───────────────────────────────────────────────────

class TestVadeTerminMapping:
    @pytest.mark.parametrize("vade,expected_termin", [
        ("net", "NET"),
        ("havale", "HAVALE"),
        ("kapida", "KAPIDA"),
        ("vade_farkli", "VADE_FARKLI"),
    ])
    def test_vade_mapped_to_termin(self, converter, vade, expected_termin):
        data = _valid_teklif(**{TeklifFieldType.VADE.value: vade})
        result = converter.convert_teklif_to_siparis(data)
        assert result.status == ConversionStatus.SUCCESS
        assert result.converted_data["termin"] == expected_termin

    def test_unknown_vade_defaults_to_net(self, converter):
        data = _valid_teklif(**{TeklifFieldType.VADE.value: "bilinmiyor"})
        result = converter.convert_teklif_to_siparis(data)
        assert result.converted_data["termin"] == "NET"


# ─── conversion_count sayacı ─────────────────────────────────────────────────

class TestConversionCounter:
    def test_counter_starts_at_zero(self, converter):
        assert converter.conversion_count == 0

    def test_counter_increments(self, converter):
        converter.convert_teklif_to_siparis(_valid_teklif())
        assert converter.conversion_count == 1

    def test_counter_increments_on_error_too(self, converter):
        converter.convert_teklif_to_siparis({})  # zorunlu alanlar eksik
        assert converter.conversion_count == 1

    def test_multiple_conversions(self, converter):
        for _ in range(3):
            converter.convert_teklif_to_siparis(
                _valid_teklif(**{TeklifFieldType.TEKLIF_NO.value: f"TKL{_:03d}"})
            )
        assert converter.conversion_count == 3


# ─── siparis_no biçimi ───────────────────────────────────────────────────────

class TestSiparisNoFormat:
    def test_siparis_no_starts_with_spr(self, converter):
        result = converter.convert_teklif_to_siparis(_valid_teklif())
        assert result.siparis_no.startswith("SPR")

    def test_siparis_no_contains_date(self, converter):
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        result = converter.convert_teklif_to_siparis(_valid_teklif())
        assert today in result.siparis_no
