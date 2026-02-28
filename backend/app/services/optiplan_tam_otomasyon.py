from __future__ import annotations

from typing import Any

try:
    from .optiplan_csv_otomasyon import optiplan_csv_otomasyon
except ImportError:  # pragma: no cover - direct script execution fallback
    from optiplan_csv_otomasyon import optiplan_csv_otomasyon


def optiplan_tam_otomasyon(
    siparis_no: str,
    parca_listesi: list[dict[str, Any]],
    tetikle_optiplan: bool | None = None,
) -> str:
    """
    Geriye donuk uyum icin korunan tam otomasyon giris noktasi.

    Tum CSV/OPF hazirlama islemleri tek merkezde `optiplan_csv_otomasyon`
    uzerinden yurur.
    """
    return optiplan_csv_otomasyon(
        siparis_no=siparis_no,
        parca_listesi=parca_listesi,
        tetikle_optiplan=tetikle_optiplan,
        baslik_satirlari=True,
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

    optiplan_tam_otomasyon("Siparis_OZ-1045", ornek_siparis_verisi, tetikle_optiplan=False)
