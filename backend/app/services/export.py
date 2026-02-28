"""
OptiPlan 360 — Sipariş İhracat Servisi (Excel)

Bu servis, veritabanından alınan sipariş verilerini OptiPlanning için
gerekli olan Excel (.xlsx) formatına dönüştürür.
"""

import datetime
import os

import pandas as pd
from openpyxl import Workbook
from sqlalchemy.orm import Session, joinedload

from .. import models

# KURAL 4: Grain (damar yönü) değerlerini metinden sayıya dönüştüren harita
GRAIN_MAP = {
    "0-Material": 0,
    "1-Boyuna": 1,
    "2-Enine": 2,
}

# Excel dosyalarının kaydedileceği dizin
EXPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "exports")
os.makedirs(EXPORT_DIR, exist_ok=True)


def export_order_to_excel(db: Session, order_id: str) -> list[str]:
    """
    Belirtilen siparişi veritabanından alır ve "GÖVDE" ve "ARKALIK"
    parça grupları için ayrı Excel dosyaları oluşturur. (KURAL 2)

    Args:
        db: SQLAlchemy session objesi.
        order_id: İşlenecek siparişin ID'si.

    Returns:
        Oluşturulan Excel dosyalarının tam yollarını içeren bir liste.
    """

    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.parts))
        .filter(models.Order.id == order_id)
        .first()
    )
    if not order:
        raise ValueError(f"Sipariş ID'si {order_id} bulunamadı.")

    if not order.parts:
        return []

    # Parçaları daha güvenli bir şekilde DataFrame'e aktar
    part_data = [
        {
            "part_group": p.part_group,
            "boy_mm": p.boy_mm,
            "en_mm": p.en_mm,
            "adet": p.adet,
            "grain_code": p.grain_code,
            "u1": p.u1,
            "u2": p.u2,
            "k1": p.k1,
            "k2": p.k2,
            "part_desc": p.part_desc,
            "drill_code_1": p.drill_code_1,
            "drill_code_2": p.drill_code_2,
        }
        for p in order.parts
    ]
    df = pd.DataFrame(part_data)

    exported_files = []
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    customer_name = order.crm_name_snapshot.replace(" ", "_")

    # DataFrame'i "part_group"a göre filtrele
    for part_group_name in ["GOVDE", "ARKALIK"]:
        group_df = df[df["part_group"] == part_group_name]

        if not group_df.empty:
            # Sütunları oluştur ve Excel'e yaz
            output_df = pd.DataFrame()
            output_df["Boy"] = group_df["boy_mm"]
            output_df["En"] = group_df["en_mm"]
            output_df["Adet"] = group_df["adet"]
            output_df["Grain"] = group_df["grain_code"].map(GRAIN_MAP).fillna(0).astype(int)
            output_df["U1"] = group_df["u1"].astype(int)
            output_df["U2"] = group_df["u2"].astype(int)
            output_df["K1"] = group_df["k1"].astype(int)
            output_df["K2"] = group_df["k2"].astype(int)
            output_df["Açıklama"] = group_df["part_desc"]
            output_df["Delik1"] = group_df["drill_code_1"]
            output_df["Delik2"] = group_df["drill_code_2"]

            material_name_safe = order.material_name.replace(" ", "_").replace("/", "-")

            # KURAL 3: Dosya isimlendirme
            file_name = f"{customer_name}_{timestamp}_{material_name_safe}_{part_group_name}.xlsx"
            file_path = os.path.join(EXPORT_DIR, file_name)

            output_df.to_excel(file_path, index=False)
            exported_files.append(file_path)

    return exported_files


# Ensure export correctness per manifesto


def export_order_to_excel_openpyxl(order):
    # Group parts by part_group, color, and thickness
    grouped_parts = {}
    for part in order.parts:
        key = (part.part_group, part.color, part.thickness_mm)
        if key not in grouped_parts:
            grouped_parts[key] = []
        grouped_parts[key].append(part)

    # Generate separate Excel files for each group
    export_files = []
    for (part_group, color, thickness), parts in grouped_parts.items():
        filename = f"{order.crm_name_snapshot}_{order.created_at.strftime('%Y%m%d_%H%M%S')}_{thickness}mm_{color}_{part_group}.xlsx"
        filepath = os.path.join(EXPORT_DIR, filename)
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = f"{part_group} Parts"

        # Write header row
        sheet.append(
            [
                "Part ID",
                "Material",
                "Thickness",
                "Length",
                "Width",
                "Quantity",
                "Grain",
                "Edge Banding",
            ]
        )

        # Write part data
        for part in parts:
            sheet.append(
                [
                    part.id,
                    part.material_name,
                    part.thickness_mm,
                    part.length_mm,
                    part.width_mm,
                    part.quantity,
                    part.grain,
                    f"{part.edge_banding_u1}/{part.edge_banding_u2}/{part.edge_banding_k1}/{part.edge_banding_k2}",
                ]
            )

        # Save the file
        workbook.save(filepath)
        export_files.append(filepath)

    return export_files
