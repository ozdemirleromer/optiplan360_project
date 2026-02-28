"""
OptiPlan 360 — Optimizasyon servisi (Grain + Birleştirme)
Handoff §0.3 Grain Kuralı ve §0.5 Birleştirme Kuralı business logic.
.xlsx export sırasında kullanılır.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional, Protocol

# ─── Handoff §0.3: Grain ↔ OptiPlanning @437 ─────────────────────────────
GRAIN_VALUES = ("0-Material", "1-Material", "2-Material", "3-Material")

# OptiPlanning @437 parametresi: 0=Otomatik, 1=Uzunluk, 2=Genişlik, 3=Karışık
OPTI_437 = {
    "0-Material": 0,  # Damar/desen yok, parça her iki yönde yerleştirilebilir
    "1-Material": 1,  # Damar kısa kenar boyunca, parça genişliği = panel genişliği
    "2-Material": 2,  # Damar uzun kenar boyunca, parça uzunluğu = panel uzunluğu
    "3-Material": 3,  # Desen yönü var ama karışık/önemsiz
}


@dataclass
class GrainExportInfo:
    """Parça grain bilgisi — export ve OptiPlanning metadata için."""

    grain_code: str  # UI/Excel değeri (0-Material, ...)
    opti_437: int  # OptiPlanning @437 parametresi (0-3)
    applies_433: bool  # @433: Damarlı parçalarda OptiPlanning 0,1 mm uzunluk ekler (bizim ölçüyü değiştirmiyoruz)
    supports_2012: bool  # @2012: Grain 0'da "Asgari Değiştirilebilir Boyutlar" aktif edilebilir
    label: str  # Açıklama


class GrainService:
    """
    Handoff §0.3 Grain Kuralı.
    - Makine: 0-Material, 1-Material, 2-Material, 3-Material
    - @437: OptiPlanning parametresi ile birebir eşleşme
    - @433: Grain 1/2'de OptiPlanning yönelimi için 0,1 mm uzunluk ekler (UI ölçüsünü etkilemez)
    - @2012: Grain 0'da asgari değiştirilebilir boyutlar (drop optimizasyonu)
    """

    @staticmethod
    def opti_437(grain_code: str) -> int:
        """Grain kodunu OptiPlanning @437 sayısal değerine çevirir (0-3)."""
        return OPTI_437.get(grain_code, 0)

    @staticmethod
    def applies_433_length_offset(grain_code: str) -> bool:
        """
        @433 Kuralı: Damarlı (grain 1 veya 2) parçalarda OptiPlanning,
        yönelimi yönetmek için otomatik 0,1 mm uzunluk ekler.
        Bu değer UI'dan gönderilen ölçüyü etkilemez; OptiPlanning kendi içinde uygular.
        Export'ta boyutu değiştirmiyoruz, sadece bilgi/metadata için True döner.
        """
        return grain_code in ("1-Material", "2-Material")

    @staticmethod
    def supports_min_changeable_dimensions(grain_code: str) -> bool:
        """
        @2012 Kuralı: Grain 0 (desensiz) malzemelerde
        "Asgari Değiştirilebilir Boyutlar" aktif edilebilir; drop optimizasyonunda boyut serbestliği artar.
        """
        return grain_code == "0-Material"

    @staticmethod
    def normalize_grain(grain_code: Optional[str]) -> str:
        """Geçersiz grain ise 0-Material döner."""
        if grain_code in GRAIN_VALUES:
            return grain_code
        return "0-Material"

    @classmethod
    def get_export_info(cls, grain_code: str) -> GrainExportInfo:
        """Export ve xlsx için grain metadata (OptiPlanning tag'leri için)."""
        code = cls.normalize_grain(grain_code)
        labels = {
            "0-Material": "Otomatik (desensiz)",
            "1-Material": "Uzunluk (damar kısa kenar)",
            "2-Material": "Genişlik (damar uzun kenar)",
            "3-Material": "Karışık",
        }
        return GrainExportInfo(
            grain_code=code,
            opti_437=cls.opti_437(code),
            applies_433=cls.applies_433_length_offset(code),
            supports_2012=cls.supports_min_changeable_dimensions(code),
            label=labels.get(code, "Otomatik"),
        )


# ─── @2012 Drop Optimizasyonu ───────────────────────────────────────────────
class DropOptimizationService:
    """
    @2012 Kuralı: Grain 0 (desensiz) malzemelerde "Asgari Değiştirilebilir Boyutlar"
    Drop optimizasyonunda boyut serbestliği artar.
    """

    @staticmethod
    def can_apply_drop_optimization(grain_code: str) -> bool:
        """Drop optimizasyonu uygulanabilir mi?"""
        return grain_code == "0-Material"

    @staticmethod
    def calculate_min_changeable_dimensions(length_mm: float, width_mm: float) -> dict:
        """
        Asgari değiştirilebilir boyutları hesapla
        Drop optimizasyonu için boyut aralıkları belirler
        """
        # Genellikle %5-10 aralığında boyut değişikliği kabul edilir
        length_tolerance = length_mm * 0.05  # %5 tolerans
        width_tolerance = width_mm * 0.05  # %5 tolerans

        return {
            "original_length": length_mm,
            "original_width": width_mm,
            "min_length": max(length_mm - length_tolerance, 50),  # Minimum 50mm
            "max_length": length_mm + length_tolerance,
            "min_width": max(width_mm - width_tolerance, 50),  # Minimum 50mm
            "max_width": width_mm + width_tolerance,
            "length_tolerance_percent": 5.0,
            "width_tolerance_percent": 5.0,
        }

    @staticmethod
    def optimize_for_drop(parts: List[Any]) -> List[dict]:
        """
        Parça listesini drop optimizasyonu için işle
        Grain 0 olan parçalar için boyut serbestliği uygula
        """
        optimized_parts = []

        for part in parts:
            grain_code = getattr(part, "grain_code", "0-Material")
            length_mm = float(getattr(part, "boy_mm", 0))
            width_mm = float(getattr(part, "en_mm", 0))

            optimized_part = {
                "original_part": part,
                "grain_code": grain_code,
                "can_optimize": DropOptimizationService.can_apply_drop_optimization(grain_code),
            }

            if optimized_part["can_optimize"]:
                # Drop optimizasyonu uygula
                dimensions = DropOptimizationService.calculate_min_changeable_dimensions(
                    length_mm, width_mm
                )
                optimized_part.update(dimensions)
                optimized_part["optimization_applied"] = True
            else:
                # Grain 0 değilse orijinal boyutları koru
                optimized_part.update(
                    {
                        "min_length": length_mm,
                        "max_length": length_mm,
                        "min_width": width_mm,
                        "max_width": width_mm,
                        "optimization_applied": False,
                    }
                )

            optimized_parts.append(optimized_part)

        return optimized_parts

    @staticmethod
    def generate_optimization_report(optimized_parts: List[dict]) -> dict:
        """Optimizasyon raporu oluştur"""
        total_parts = len(optimized_parts)
        optimized_count = sum(1 for p in optimized_parts if p.get("optimization_applied", False))

        # Boyum serbestliği istatistikleri
        total_length_gain = 0
        total_width_gain = 0

        for part in optimized_parts:
            if part.get("optimization_applied", False):
                length_gain = part["max_length"] - part["min_length"]
                width_gain = part["max_width"] - part["min_width"]
                total_length_gain += length_gain
                total_width_gain += width_gain

        return {
            "total_parts": total_parts,
            "optimized_parts": optimized_count,
            "optimization_rate": (optimized_count / total_parts * 100) if total_parts > 0 else 0,
            "total_length_gain_mm": total_length_gain,
            "total_width_gain_mm": total_width_gain,
            "average_length_gain_per_part": (
                total_length_gain / optimized_count if optimized_count > 0 else 0
            ),
            "average_width_gain_per_part": (
                total_width_gain / optimized_count if optimized_count > 0 else 0
            ),
            "optimization_enabled": True,
        }


# ─── PartLike: protocol for DB model or dict ───────────────────────────────
class PartLike(Protocol):
    boy_mm: float
    en_mm: float
    adet: int
    grain_code: str
    u1: bool
    u2: bool
    k1: bool
    k2: bool
    part_desc: Optional[str]
    drill_code_1: Optional[str]
    drill_code_2: Optional[str]

    @property
    def part_group(self) -> str: ...


def _part_key(p: PartLike) -> tuple:
    return (float(p.boy_mm), float(p.en_mm), p.grain_code)


def _has_drill_code(p: PartLike) -> bool:
    return bool((p.drill_code_1 or "").strip() or (p.drill_code_2 or "").strip())


def _band_ticks_match(p1: PartLike, p2: PartLike) -> bool:
    return p1.u1 == p2.u1 and p1.u2 == p2.u2 and p1.k1 == p2.k1 and p1.k2 == p2.k2


# ─── Handoff §0.5: Birleştirme (Merge) ────────────────────────────────────
@dataclass
class MergeSuggestionResult:
    """Birleştirme önerisi — operatör onayı olmadan uygulanmaz."""

    rows: List[int]  # 1-based satır numaraları
    reason: str
    band_match: bool  # Bant tikleri (u1,u2,k1,k2) aynı mı


class MergeService:
    """
    Handoff §0.5 Birleştirme Kuralı.
    - Varsayılan birleştirme YOK.
    - Ölçü aynıysa birleştirme öneri olarak sunulur; operatör onayı olmadan uygulanmaz.
    - Delik kodları mevcutsa satırlar aynı kalır (birleşmez).
    - Birleştirme önerilerinde bant tiklerinin aynı/farklı raporu gösterilir.
    """

    @staticmethod
    def compute_suggestions(
        parts: List[Any],
        part_group_filter: Optional[str] = None,
        row_start: int = 1,
    ) -> List[MergeSuggestionResult]:
        """
        Aynı ölçü (boy, en, grain) ve delik kodu olmayan parçalar için birleştirme önerisi üretir.
        parts: PartLike listesi (örn. order.parts)
        part_group_filter: Sadece bu gruptaki parçalara bak (GOVDE/ARKALIK); None = hepsi
        row_start: Satır numarası başlangıcı (1-based). Dönen row no = orijinal listedeki konum + row_start - 1.
        """
        if part_group_filter is not None and parts and hasattr(parts[0], "part_group"):
            filtered_with_idx = [
                (row_start + i, p)
                for i, p in enumerate(parts)
                if getattr(p, "part_group", None) == part_group_filter
            ]
        else:
            filtered_with_idx = [(row_start + i, p) for i, p in enumerate(parts)]

        suggestions: List[MergeSuggestionResult] = []
        seen: dict = {}  # key -> (row_index, part)

        for row_idx, p in filtered_with_idx:
            if _has_drill_code(p):
                continue
            key = _part_key(p)
            if key in seen:
                prev_row, prev_p = seen[key]
                band_match = _band_ticks_match(p, prev_p)
                suggestions.append(
                    MergeSuggestionResult(
                        rows=[prev_row, row_idx],
                        reason=f"Aynı ölçü ({p.boy_mm}x{p.en_mm}), birleştirilebilir",
                        band_match=band_match,
                    )
                )
            else:
                seen[key] = (row_idx, p)

        return suggestions

    @staticmethod
    def apply_merge_groups(
        parts: List[Any],
        merge_groups: List[List[int]],
        row_start: int = 1,
    ) -> List[dict]:
        """
        Operatör onaylı birleştirme gruplarını uygular.
        merge_groups: 1-based satır numaraları grupları, örn. [[1, 3], [2, 5]]. Gruplar ayrık olmalı (bir parça en fazla bir grupta).
        Dönen liste: birleştirilmiş + birleşmeyen parçalar (export satırı olarak dict).
        Aynı gruptaki parçalar tek satırda toplanır; adet toplanır, bant ilk parçanınkisi kullanılır.
        """
        if not merge_groups:
            return MergeService._parts_to_export_dicts(parts, row_start)

        # Flatten and dedupe group membership
        merged_indices: set = set()
        for group in merge_groups:
            for idx in group:
                merged_indices.add(idx)

        # Build: group_key (row_start-1 based index) -> list of part indices in filtered list
        group_by_first: dict = {}
        for group in merge_groups:
            if not group:
                continue
            # 1-based row -> 0-based index in filtered
            first_row = min(group)
            indices_in_parts = [
                r - row_start for r in group if row_start <= r < row_start + len(parts)
            ]
            if indices_in_parts:
                group_by_first[first_row] = indices_in_parts

        result: List[dict] = []
        used: set = set()

        for row_one in sorted(group_by_first.keys()):
            indices = group_by_first[row_one]
            if not indices or any(i < 0 or i >= len(parts) for i in indices):
                continue
            group_parts = [parts[i] for i in indices]
            used.update(indices)
            # Birleştir: aynı boy, en, grain; adet toplamı; bant ilk parçadan
            p0 = group_parts[0]
            total_adet = sum(int(p.adet) for p in group_parts)
            result.append(
                {
                    "boy_mm": float(p0.boy_mm),
                    "en_mm": float(p0.en_mm),
                    "adet": total_adet,
                    "grain_code": p0.grain_code,
                    "u1": p0.u1,
                    "u2": p0.u2,
                    "k1": p0.k1,
                    "k2": p0.k2,
                    "part_desc": p0.part_desc,
                    "drill_code_1": p0.drill_code_1,
                    "drill_code_2": p0.drill_code_2,
                }
            )

        for i, p in enumerate(parts):
            if i in used:
                continue
            result.append(
                {
                    "boy_mm": float(p.boy_mm),
                    "en_mm": float(p.en_mm),
                    "adet": int(p.adet),
                    "grain_code": p.grain_code,
                    "u1": p.u1,
                    "u2": p.u2,
                    "k1": p.k1,
                    "k2": p.k2,
                    "part_desc": getattr(p, "part_desc", None),
                    "drill_code_1": getattr(p, "drill_code_1", None),
                    "drill_code_2": getattr(p, "drill_code_2", None),
                }
            )

        return result

    @staticmethod
    def _parts_to_export_dicts(parts: List[Any], row_start: int = 1) -> List[dict]:
        """PartLike listesini export satırı dict listesine çevirir (birleştirme yok)."""
        out = []
        for i, p in enumerate(parts):
            out.append(
                {
                    "boy_mm": float(p.boy_mm),
                    "en_mm": float(p.en_mm),
                    "adet": int(p.adet),
                    "grain_code": GrainService.normalize_grain(p.grain_code),
                    "u1": p.u1,
                    "u2": p.u2,
                    "k1": p.k1,
                    "k2": p.k2,
                    "part_desc": getattr(p, "part_desc", None),
                    "drill_code_1": getattr(p, "drill_code_1", None),
                    "drill_code_2": getattr(p, "drill_code_2", None),
                }
            )
        return out


# ─── Export için tek giriş noktası ─────────────────────────────────────────
@dataclass
class ExportRow:
    """Export (.xlsx) satırı — grain bilgisi ve OptiPlanning metadata ile."""

    boy_mm: float
    en_mm: float
    adet: int
    grain_code: str
    grain_info: GrainExportInfo = field(repr=False)
    u1: bool = False
    u2: bool = False
    k1: bool = False
    k2: bool = False
    part_desc: Optional[str] = None
    drill_code_1: Optional[str] = None
    drill_code_2: Optional[str] = None


def get_export_rows(
    parts: List[Any],
    merge_groups: Optional[List[List[int]]] = None,
    part_group: Optional[str] = None,
    row_start: int = 1,
) -> List[ExportRow]:
    """
    .xlsx export için satır listesi üretir.
    - Handoff §0.3: Her satır için grain normalize edilir ve @437/@433/@2012 metadata eklenir.
    - Handoff §0.5: merge_groups verilirse birleştirme uygulanır; yoksa parçalar olduğu gibi döner.

    Args:
        parts: PartLike listesi (örn. order.parts)
        merge_groups: Operatör onaylı birleştirme grupları (1-based satır no); None = birleştirme yok
        part_group: Sadece bu gruptaki parçalar (GOVDE/ARKALIK); None = tümü
        row_start: Satır numarası başlangıcı

    Returns:
        ExportRow listesi — xlsx yazarken kullanılır.
    """
    if part_group is not None and parts and hasattr(parts[0], "part_group"):
        parts = [p for p in parts if getattr(p, "part_group", None) == part_group]

    if merge_groups:
        dict_rows = MergeService.apply_merge_groups(parts, merge_groups, row_start)
    else:
        dict_rows = MergeService._parts_to_export_dicts(parts, row_start)

    return [
        ExportRow(
            boy_mm=r["boy_mm"],
            en_mm=r["en_mm"],
            adet=r["adet"],
            grain_code=r["grain_code"],
            grain_info=GrainService.get_export_info(r["grain_code"]),
            u1=r["u1"],
            u2=r["u2"],
            k1=r["k1"],
            k2=r["k2"],
            part_desc=r.get("part_desc"),
            drill_code_1=r.get("drill_code_1"),
            drill_code_2=r.get("drill_code_2"),
        )
        for r in dict_rows
    ]
