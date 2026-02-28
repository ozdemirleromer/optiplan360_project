"""
Dosya Adı Jeneratör Servisi
MASTER HANDOFF kurallarına göre standart dosya adlandırma
"""

import re
import unicodedata
from datetime import datetime
from typing import Any, Dict, Optional


class FilenameGenerator:
    """
    Standart dosya adı üretici
    ✅ Kural #25-26 uyumlu: CRMISIM_TIMESTAMP_MALZEME_GRUP.xlsx formatı

    Format: {CRM_ISIM}_{TIMESTAMP}_{MALZEME}_{GRUP}.xlsx
    Örnek: ABC_Mobilya_20260214_143052_18mmBeyaz_GOVDE.xlsx
    """

    # Geçersiz karakterler
    INVALID_CHARS = r'[<>:"/\\|?*]'

    # Maksimum uzunluklar
    MAX_CRM_NAME = 30
    MAX_MATERIAL = 20
    MAX_TOTAL = 100

    def __init__(self):
        pass

    def generate(
        self,
        crm_name: str,
        material: str,
        group: str,  # "GOVDE" veya "ARKALIK"
        thickness: str,
        timestamp: Optional[datetime] = None,
    ) -> str:
        """
        Standart dosya adı üret

        Args:
            crm_name: Müşteri/CRM adı (örn: "ABC Mobilya")
            material: Malzeme adı (örn: "Beyaz MDFLAM")
            group: Grup tipi ("GOVDE" veya "ARKALIK")
            thickness: Kalınlık (örn: "18mm")
            timestamp: Zaman damgası (varsayılan: şimdi)

        Returns:
            str: Standart dosya adı
        """
        if timestamp is None:
            timestamp = datetime.now()

        # Normalize ve temizle
        clean_crm = self._normalize_crm_name(crm_name)
        clean_material = self._normalize_material(material, thickness)
        clean_group = self._normalize_group(group)

        # Timestamp format: YYYYMMDD_HHMMSS
        time_str = timestamp.strftime("%Y%m%d_%H%M%S")

        # Birleştir
        filename = f"{clean_crm}_{time_str}_{clean_material}_{clean_group}.xlsx"

        # Uzunluk kontrolü
        if len(filename) > self.MAX_TOTAL:
            # CRM adını kısalt
            excess = len(filename) - self.MAX_TOTAL
            clean_crm = clean_crm[: max(5, len(clean_crm) - excess)]
            filename = f"{clean_crm}_{time_str}_{clean_material}_{clean_group}.xlsx"

        return filename

    def _normalize_crm_name(self, name: str) -> str:
        """CRM adını normalize et"""
        if not name:
            return "UNKNOWN"

        # Unicode normalize (Türkçe karakterler)
        name = unicodedata.normalize("NFKD", name)

        # Boşlukları alt çizgi ile değiştir
        name = name.replace(" ", "_")

        # Geçersiz karakterleri kaldır
        name = re.sub(self.INVALID_CHARS, "", name)

        # Türkçe karakterleri dönüştür (opsiyonel, ama güvenli)
        tr_map = str.maketrans("ğĞıİöÖüÜşŞçÇ", "gGiIoOuUsScC")
        name = name.translate(tr_map)

        # Büyük harf
        name = name.upper()

        # Maksimum uzunluk
        return name[: self.MAX_CRM_NAME]

    def _normalize_material(self, material: str, thickness: str) -> str:
        """Malzeme adını normalize et"""
        if not material:
            return "UNKNOWN"

        # Kalınlığı malzeme adından çıkar (eğer varsa)
        material_clean = material
        if thickness and thickness in material:
            material_clean = material.replace(thickness, "").strip()

        # Boşlukları kaldır
        material_clean = material_clean.replace(" ", "")

        # MLAM/SLAM dönüşümleri (Kural #172-173)
        material_clean = material_clean.replace("MLAM", "MDFLAM")
        material_clean = material_clean.replace("SLAM", "SUNTALAM")

        # Kalınlık ekle (yoksa)
        if thickness and not material_clean.startswith(thickness.replace("mm", "")):
            material_clean = f"{thickness}{material_clean}"

        # Geçersiz karakterleri kaldır
        material_clean = re.sub(self.INVALID_CHARS, "", material_clean)

        # Maksimum uzunluk
        return material_clean[: self.MAX_MATERIAL]

    def _normalize_group(self, group: str) -> str:
        """Grup adını normalize et"""
        group = group.upper().strip()

        if group in ["GOVDE", "BODY", "MAIN"]:
            return "GOVDE"
        elif group in ["ARKALIK", "BACK", "REAR"]:
            return "ARKALIK"
        else:
            return group

    def parse_filename(self, filename: str) -> Optional[Dict[str, Any]]:
        """
        Dosya adını parse et ve bileşenlerini çıkar

        Returns:
            Dict veya None (parse hatası)
        """
        try:
            # Uzantıyı kaldır
            if filename.endswith(".xlsx"):
                filename = filename[:-5]

            # Parçalara ayır (en fazla 4 parça)
            parts = filename.split("_", 3)

            if len(parts) < 4:
                return None

            crm_name = parts[0]
            date_str = parts[1]
            time_str = parts[2]
            material_group = parts[3]

            # Material ve grubu ayır
            if "_" in material_group:
                material, group = material_group.rsplit("_", 1)
            else:
                material = material_group
                group = "UNKNOWN"

            # Tarih parse
            timestamp = datetime.strptime(f"{date_str}_{time_str}", "%Y%m%d_%H%M%S")

            return {
                "crm_name": crm_name,
                "timestamp": timestamp,
                "material": material,
                "group": group,
                "is_valid": True,
            }
        except Exception:
            return None

    def validate_filename(self, filename: str) -> bool:
        """Dosya adının standart formata uygunluğunu kontrol et"""
        parsed = self.parse_filename(filename)
        return parsed is not None and parsed.get("is_valid", False)

    def generate_batch(
        self,
        crm_name: str,
        materials: list,  # [{"material": "Beyaz", "thickness": "18mm", "group": "GOVDE"}]
        base_timestamp: Optional[datetime] = None,
    ) -> list:
        """Toplu dosya adı üret"""
        if base_timestamp is None:
            base_timestamp = datetime.now()

        filenames = []
        for i, mat in enumerate(materials):
            # Her dosyaya 1 saniye farkla timestamp
            ts = (
                base_timestamp
                if i == 0
                else base_timestamp.replace(second=(base_timestamp.second + i) % 60)
            )

            filename = self.generate(
                crm_name=crm_name,
                material=mat["material"],
                group=mat["group"],
                thickness=mat["thickness"],
                timestamp=ts,
            )
            filenames.append(
                {
                    "filename": filename,
                    "material": mat["material"],
                    "group": mat["group"],
                    "thickness": mat["thickness"],
                }
            )

        return filenames


# Singleton instance
generator = FilenameGenerator()


def generate_filename(
    crm_name: str, material: str, group: str, thickness: str, timestamp: Optional[datetime] = None
) -> str:
    """Kolay kullanım fonksiyonu"""
    return generator.generate(crm_name, material, group, thickness, timestamp)


def validate_filename(filename: str) -> bool:
    """Dosya adı validasyonu"""
    return generator.validate_filename(filename)
