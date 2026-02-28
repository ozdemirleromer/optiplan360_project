from __future__ import annotations

from typing import Any

try:
    from .optiplan_csv_otomasyon import optiplan_csv_otomasyon
except ImportError:  # pragma: no cover - direct script execution fallback
    from optiplan_csv_otomasyon import optiplan_csv_otomasyon


def optiplan_entegrasyon_baslat(
    siparis_no: str,
    parca_listesi: list[dict[str, Any]],
    baslik_satirlari: bool = False,
    tetikle_optiplan: bool | None = None,
) -> str:
    """
    Geriye donuk uyum icin korunan hafif export giris noktasi.

    Eski davranisa yakin olacak sekilde varsayilan olarak baslik satiri yazmaz.
    """
    return optiplan_csv_otomasyon(
        siparis_no=siparis_no,
        parca_listesi=parca_listesi,
        tetikle_optiplan=tetikle_optiplan,
        baslik_satirlari=baslik_satirlari,
    )


if __name__ == "__main__":
    ornek_siparis_verisi = [
        {
            "kod": "KAPAK_01",
            "boy": 720,
            "en": 400,
            "adet": 4,
            "malzeme": "MDF_18_BYZ",
            "ust_bant": "PVC_1MM",
            "alt_bant": "PVC_1MM",
            "sol_bant": "PVC_1MM",
            "sag_bant": "PVC_1MM",
            "aciklama": "Mutfak Ust Dolap",
        },
        {
            "kod": "GOVDE_01",
            "boy": 720,
            "en": 560,
            "adet": 2,
            "malzeme": "SUNTALAM_18_BYZ",
            "ust_bant": "",
            "alt_bant": "",
            "sol_bant": "PVC_04MM",
            "sag_bant": "",
            "aciklama": "Mutfak Yan Dikme",
        },
    ]

    optiplan_entegrasyon_baslat(
        "Siparis_OZ-1046",
        ornek_siparis_verisi,
        baslik_satirlari=False,
        tetikle_optiplan=False,
    )
