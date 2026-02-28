"""
COMPLIANCE TEST SUITE — Sprint 1 (AGENT_ONEFILE §G2)
=====================================================

AI agent gerektirmez. Sadece `pytest tests/test_orchestrator_compliance.py -v` calistir.

Her test sinifi TESPIT -> DUZELT formatinda calisir:
  - TESPIT: Dogrulama assertion'lari ile sorunlari yakalar
  - DUZELT: Test PASS ediyorsa duzeltme dogru uygulanmis demektir

Kapsam:
  [T1] PREPARED state enum tanimi
  [T2] State machine sirasi: NEW -> PREPARED -> OPTI_IMPORTED
  [T3] _transform_parts: cm -> mm donusumu
  [T4] _transform_parts: trim mapping
  [T5] _transform_parts: arkalik edge NULL kurali
  [T6] _transform_parts: govde edge mapping
  [T7] _transform_parts: grain mapping
  [T8] Helper fonksiyonlar: _map_edge, _map_grain
  [T9] Sabitler: TRIM_BY_THICKNESS, BACKING_THICKNESSES
  [T10] PREPARED state audit event
"""

from unittest.mock import Mock

import pytest
from app.models.enums import OptiJobStateEnum
from app.services.orchestrator_service import (
    BACKING_THICKNESSES,
    TRIM_BY_THICKNESS,
    OrchestratorService,
    _map_edge,
    _map_grain,
)
from sqlalchemy.orm import Session

# ============================================================
# YARDIMCI: Mock nesneleri
# ============================================================


def _mock_part(
    part_group="GOVDE",
    boy_mm=0,
    en_mm=0,
    boy=0,
    en=0,
    adet=1,
    u1=False,
    u2=False,
    k1=False,
    k2=False,
    grain_code=None,
    part_desc="",
):
    """Tek satirda mock OrderPart uret."""
    m = Mock()
    m.part_group = part_group
    m.boy_mm = boy_mm
    m.en_mm = en_mm
    m.boy = boy
    m.en = en
    m.adet = adet
    m.u1 = u1
    m.u2 = u2
    m.k1 = k1
    m.k2 = k2
    m.grain_code = grain_code
    m.part_desc = part_desc
    return m


def _mock_order(thickness_mm=18.0):
    """Tek satirda mock Order uret."""
    m = Mock()
    m.thickness_mm = thickness_mm
    return m


def _make_service():
    """DB bagimliligi olmadan OrchestratorService olustur."""
    return OrchestratorService(Mock(spec=Session))


# ============================================================
# [T1] TESPIT: PREPARED state enum'da tanimli mi?
# ============================================================


class TestT1_PreparedStateEnum:
    """
    TESPIT: OptiJobStateEnum icinde PREPARED degeri var mi?
    DUZELT: enums.py'de PREPARED = "PREPARED" satiri ekle.
    """

    def test_prepared_exists(self):
        assert hasattr(
            OptiJobStateEnum, "PREPARED"
        ), "TESPIT: OptiJobStateEnum.PREPARED tanimli degil! enums.py'ye ekle."

    def test_prepared_value(self):
        assert OptiJobStateEnum.PREPARED.value == "PREPARED"


# ============================================================
# [T2] TESPIT: State sirasi dogru mu?
# ============================================================


class TestT2_StateOrder:
    """
    TESPIT: AGENT_ONEFILE §G2 state machine sirasi:
            NEW -> PREPARED -> OPTI_IMPORTED -> ... -> DONE
    DUZELT: enums.py'de PREPARED, NEW'den sonra OPTI_IMPORTED'dan once olmali.
    """

    def test_state_order_new_before_prepared(self):
        states = [s.value for s in OptiJobStateEnum]
        new_idx = states.index("NEW")
        prepared_idx = states.index("PREPARED")
        assert (
            new_idx < prepared_idx
        ), f"TESPIT: NEW (idx={new_idx}) PREPARED'dan (idx={prepared_idx}) once olmali!"

    def test_state_order_prepared_before_opti_imported(self):
        states = [s.value for s in OptiJobStateEnum]
        prepared_idx = states.index("PREPARED")
        imported_idx = states.index("OPTI_IMPORTED")
        assert (
            prepared_idx < imported_idx
        ), f"TESPIT: PREPARED (idx={prepared_idx}) OPTI_IMPORTED'dan (idx={imported_idx}) once olmali!"

    def test_all_canonical_states_exist(self):
        """AGENT_ONEFILE §G2 tum state'ler mevcut olmali."""
        required = [
            "NEW",
            "PREPARED",
            "OPTI_IMPORTED",
            "OPTI_RUNNING",
            "OPTI_DONE",
            "XML_READY",
            "DELIVERED",
            "DONE",
            "HOLD",
            "FAILED",
        ]
        existing = {s.value for s in OptiJobStateEnum}
        missing = [r for r in required if r not in existing]
        assert not missing, f"TESPIT: Eksik state'ler: {missing}"


# ============================================================
# [T3] TESPIT: cm -> mm donusumu dogru mu?
# ============================================================


class TestT3_CmToMmConversion:
    """
    TESPIT: _transform_parts boy/en (cm) alanlarini boy_mm/en_mm (mm) olarak x10 donusturmeli.
    DUZELT: boy_mm == 0 ise boy * 10 kullan.
    """

    def test_cm_fields_converted_to_mm(self):
        """boy_mm=0, boy=100 -> boy_mm=1000 (100cm * 10)"""
        svc = _make_service()
        part = _mock_part(boy_mm=0, en_mm=0, boy=100.0, en=50.0)
        result = svc._transform_parts([part], _mock_order())
        assert (
            result[0]["boy_mm"] == 1000.0
        ), f"TESPIT: cm->mm donusumu yanlis! boy=100 -> boy_mm={result[0]['boy_mm']} (beklenen: 1000)"
        assert (
            result[0]["en_mm"] == 500.0
        ), f"TESPIT: cm->mm donusumu yanlis! en=50 -> en_mm={result[0]['en_mm']} (beklenen: 500)"

    def test_mm_fields_used_directly(self):
        """boy_mm=1000 -> boy_mm=1000 (zaten mm, donusum yok)"""
        svc = _make_service()
        part = _mock_part(boy_mm=1000.0, en_mm=500.0)
        result = svc._transform_parts([part], _mock_order())
        assert result[0]["boy_mm"] == 1000.0
        assert result[0]["en_mm"] == 500.0

    def test_zero_dimensions_stay_zero(self):
        """boy_mm=0, boy=0 -> boy_mm=0"""
        svc = _make_service()
        part = _mock_part(boy_mm=0, en_mm=0, boy=0, en=0)
        result = svc._transform_parts([part], _mock_order())
        assert result[0]["boy_mm"] == 0.0
        assert result[0]["en_mm"] == 0.0

    def test_adet_passthrough(self):
        svc = _make_service()
        part = _mock_part(boy_mm=100, en_mm=50, adet=7)
        result = svc._transform_parts([part], _mock_order())
        assert result[0]["adet"] == 7


# ============================================================
# [T4] TESPIT: Trim mapping dogru mu?
# ============================================================


class TestT4_TrimMapping:
    """
    TESPIT: TRIM_BY_THICKNESS sabiti ile trim degerleri eslesmeli.
    DUZELT: TRIM_BY_THICKNESS dict'ini AGENT_ONEFILE §G4'e gore guncelle.
    """

    def test_18mm_trim_is_10(self):
        svc = _make_service()
        part = _mock_part(boy_mm=1000, en_mm=500)
        result = svc._transform_parts([part], _mock_order(thickness_mm=18.0))
        assert (
            result[0]["trim"] == 10.0
        ), f"TESPIT: 18mm govde trim={result[0]['trim']} (beklenen: 10.0)"

    def test_8mm_arkalik_trim_is_5(self):
        svc = _make_service()
        part = _mock_part(part_group="ARKALIK", boy_mm=500, en_mm=300)
        result = svc._transform_parts([part], _mock_order(thickness_mm=18.0))
        # Arkalik default 8mm -> trim 5.0
        assert (
            result[0]["trim"] == 5.0
        ), f"TESPIT: 8mm arkalik trim={result[0]['trim']} (beklenen: 5.0)"

    def test_5mm_trim_is_5(self):
        svc = _make_service()
        part = _mock_part(boy_mm=1000, en_mm=500)
        result = svc._transform_parts([part], _mock_order(thickness_mm=5.0))
        assert result[0]["trim"] == 5.0

    def test_unknown_thickness_default_trim(self):
        """Bilinmeyen kalinlik -> default 10.0"""
        svc = _make_service()
        part = _mock_part(boy_mm=1000, en_mm=500)
        result = svc._transform_parts([part], _mock_order(thickness_mm=99.0))
        assert (
            result[0]["trim"] == 10.0
        ), "TESPIT: Bilinmeyen kalinlik icin default trim 10.0 olmali"


# ============================================================
# [T5] TESPIT: Arkalik edge'leri NULL mi?
# ============================================================


class TestT5_ArkalikEdgesNull:
    """
    TESPIT: AGENT_ONEFILE §0.4 — Arkalikta bant (edge) degerleri NULL olmali.
    DUZELT: _transform_parts icinde part_group=="ARKALIK" kontrolu ekle.
    """

    def test_arkalik_all_edges_none(self):
        """Arkalik part_group'unda u1/u2/k1/k2 hep None."""
        svc = _make_service()
        part = _mock_part(
            part_group="ARKALIK",
            boy_mm=500,
            en_mm=300,
            u1=True,
            u2=True,
            k1=True,
            k2=True,  # True verilse bile None donmeli
        )
        result = svc._transform_parts([part], _mock_order())
        for edge in ["u1", "u2", "k1", "k2"]:
            assert (
                result[0][edge] is None
            ), f"TESPIT: Arkalik {edge}={result[0][edge]} (beklenen: None)"

    def test_arkalik_with_false_edges_still_none(self):
        svc = _make_service()
        part = _mock_part(
            part_group="ARKALIK",
            boy_mm=500,
            en_mm=300,
            u1=False,
            u2=False,
            k1=False,
            k2=False,
        )
        result = svc._transform_parts([part], _mock_order())
        for edge in ["u1", "u2", "k1", "k2"]:
            assert result[0][edge] is None


# ============================================================
# [T6] TESPIT: Govde edge mapping dogru mu?
# ============================================================


class TestT6_GovdeEdgeMapping:
    """
    TESPIT: GOVDE parcalarinda edge True -> 1, False -> None.
    DUZELT: _map_edge fonksiyonu + _transform_parts icerisinde edge mapping.
    """

    def test_govde_true_edges_map_to_1(self):
        svc = _make_service()
        part = _mock_part(
            part_group="GOVDE",
            boy_mm=1000,
            en_mm=500,
            u1=True,
            u2=True,
            k1=True,
            k2=True,
        )
        result = svc._transform_parts([part], _mock_order())
        for edge in ["u1", "u2", "k1", "k2"]:
            assert result[0][edge] == 1, f"TESPIT: Govde {edge}={result[0][edge]} (beklenen: 1)"

    def test_govde_false_edges_map_to_none(self):
        svc = _make_service()
        part = _mock_part(
            part_group="GOVDE",
            boy_mm=1000,
            en_mm=500,
            u1=False,
            u2=False,
            k1=False,
            k2=False,
        )
        result = svc._transform_parts([part], _mock_order())
        for edge in ["u1", "u2", "k1", "k2"]:
            assert result[0][edge] is None

    def test_govde_mixed_edges(self):
        svc = _make_service()
        part = _mock_part(
            part_group="GOVDE",
            boy_mm=1000,
            en_mm=500,
            u1=True,
            u2=False,
            k1=True,
            k2=False,
        )
        result = svc._transform_parts([part], _mock_order())
        assert result[0]["u1"] == 1
        assert result[0]["u2"] is None
        assert result[0]["k1"] == 1
        assert result[0]["k2"] is None


# ============================================================
# [T7] TESPIT: Grain mapping dogru mu?
# ============================================================


class TestT7_GrainMapping:
    """
    TESPIT: grain_code -> grain_id donusumu:
      "1-Boyuna" -> 1, "2-Enine" -> 2, "0-Material" -> None, None -> None
    DUZELT: _map_grain fonksiyonunu kontrol et.
    """

    def test_grain_boyuna(self):
        svc = _make_service()
        part = _mock_part(boy_mm=1000, en_mm=500, grain_code="1-Boyuna")
        result = svc._transform_parts([part], _mock_order())
        assert (
            result[0]["grain"] == 1
        ), f"TESPIT: grain_code='1-Boyuna' -> grain={result[0]['grain']} (beklenen: 1)"

    def test_grain_enine(self):
        svc = _make_service()
        part = _mock_part(boy_mm=1000, en_mm=500, grain_code="2-Enine")
        result = svc._transform_parts([part], _mock_order())
        assert result[0]["grain"] == 2

    def test_grain_material_returns_none(self):
        svc = _make_service()
        part = _mock_part(boy_mm=1000, en_mm=500, grain_code="0-Material")
        result = svc._transform_parts([part], _mock_order())
        assert result[0]["grain"] is None

    def test_grain_none_returns_none(self):
        svc = _make_service()
        part = _mock_part(boy_mm=1000, en_mm=500, grain_code=None)
        result = svc._transform_parts([part], _mock_order())
        assert result[0]["grain"] is None


# ============================================================
# [T8] TESPIT: Helper fonksiyonlar
# ============================================================


class TestT8_HelperFunctions:
    """
    TESPIT: _map_edge ve _map_grain modul seviyesinde dogru calisiyorlar mi?
    DUZELT: orchestrator_service.py icinde fonksiyon tanimlarini kontrol et.
    """

    def test_map_edge_true(self):
        assert _map_edge(True) == 1

    def test_map_edge_false(self):
        assert _map_edge(False) is None

    def test_map_grain_boyuna(self):
        assert _map_grain("1-Boyuna") == 1

    def test_map_grain_enine(self):
        assert _map_grain("2-Enine") == 2

    def test_map_grain_material(self):
        assert _map_grain("0-Material") is None

    def test_map_grain_none(self):
        assert _map_grain(None) is None

    def test_map_grain_unknown(self):
        assert _map_grain("X-Unknown") is None


# ============================================================
# [T9] TESPIT: Sabitler dogru mu?
# ============================================================


class TestT9_Constants:
    """
    TESPIT: TRIM_BY_THICKNESS ve BACKING_THICKNESSES sabitleri
            AGENT_ONEFILE §G4 + §THICKNESS POLICY ile uyumlu mu?
    DUZELT: orchestrator_service.py ust kisimda sabitleri guncelle.
    """

    def test_trim_by_thickness_has_18(self):
        assert "18" in TRIM_BY_THICKNESS, "TESPIT: TRIM_BY_THICKNESS '18' anahtari eksik!"
        assert TRIM_BY_THICKNESS["18"] == 10.0

    def test_trim_by_thickness_has_5(self):
        assert "5" in TRIM_BY_THICKNESS
        assert TRIM_BY_THICKNESS["5"] == 5.0

    def test_trim_by_thickness_has_8(self):
        assert "8" in TRIM_BY_THICKNESS
        assert TRIM_BY_THICKNESS["8"] == 5.0

    def test_backing_thicknesses_contains_8(self):
        assert 8 in BACKING_THICKNESSES, "TESPIT: BACKING_THICKNESSES 8mm icermiyor!"

    def test_backing_thicknesses_is_set_or_frozenset(self):
        assert isinstance(BACKING_THICKNESSES, (set, frozenset))

    def test_trim_no_duplicates(self):
        """TRIM_BY_THICKNESS yalnizca bir kez tanimlanmis olmali (import seviyesinde)."""
        import inspect

        source = inspect.getsource(OrchestratorService)
        # _transform_parts icinde TRIM_BY_THICKNESS tanimlanmamali
        assert (
            "TRIM_BY_THICKNESS =" not in source
        ), "TESPIT: TRIM_BY_THICKNESS class icinde yeniden tanimlanmis!"


# ============================================================
# [T10] TESPIT: Coklu parca donusumu
# ============================================================


class TestT10_MultiPartTransform:
    """
    TESPIT: Birden fazla parcayi ayni anda donustur.
    Karisik part_group, karisik edge/grain kombinasyonlari.
    """

    def test_mixed_govde_arkalik(self):
        svc = _make_service()
        govde = _mock_part(
            part_group="GOVDE",
            boy_mm=1000,
            en_mm=500,
            u1=True,
            u2=False,
            k1=True,
            k2=False,
            grain_code="1-Boyuna",
            adet=3,
        )
        arkalik = _mock_part(
            part_group="ARKALIK",
            boy_mm=0,
            boy=50,
            en_mm=0,
            en=30,
            u1=True,
            u2=True,
            k1=True,
            k2=True,
            grain_code="0-Material",
            adet=2,
        )
        result = svc._transform_parts([govde, arkalik], _mock_order(thickness_mm=18))

        assert len(result) == 2, "TESPIT: 2 parca girildi ama sonuc farkli!"

        # Govde kontrolleri
        g = result[0]
        assert g["boy_mm"] == 1000.0
        assert g["u1"] == 1
        assert g["u2"] is None
        assert g["grain"] == 1
        assert g["adet"] == 3
        assert g["trim"] == 10.0

        # Arkalik kontrolleri
        a = result[1]
        assert (
            a["boy_mm"] == 500.0
        ), f"TESPIT: Arkalik cm->mm: boy=50 -> {a['boy_mm']} (beklenen: 500)"
        assert a["en_mm"] == 300.0
        assert a["u1"] is None  # Arkalik edge NULL
        assert a["grain"] is None
        assert a["adet"] == 2
        assert a["trim"] == 5.0  # 8mm arkalik default

    def test_empty_parts_list(self):
        svc = _make_service()
        result = svc._transform_parts([], _mock_order())
        assert result == []


# ============================================================
# Pytest entry point
# ============================================================
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
