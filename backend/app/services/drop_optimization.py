"""
@2012 Drop Optimizasyon Servisi
Grain 0 (desensiz) malzemelerde asgari değiştirilebilir boyutlar yönetimi
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional


class GrainCode(Enum):
    """Grain kodları"""

    ZERO = "0-Material"  # Desensiz - @2012 uygulanabilir
    BOYUNA = "1-Boyuna"  # Damarlı
    ENINE = "2-Enine"  # Damarlı
    MIXED = "3-Mixed"  # Karışık


@dataclass
class MinChangeableDimensions:
    """Asgari değiştirilebilir boyutlar"""

    min_boy: float = 50.0  # mm
    min_en: float = 50.0  # mm
    min_alan: float = 2500.0  # mm² (50x50)


@dataclass
class DropOptimizationResult:
    """Drop optimizasyonu sonucu"""

    orijinal_boy: float
    orijinal_en: float
    optimized_boy: Optional[float]
    optimized_en: Optional[float]
    kazanc_mm2: float
    kazanc_yuzde: float
    uygulanabilir: bool


class DropOptimizationService:
    """
    @2012 Drop Optimizasyon Servisi

    Grain 0 (desensiz) malzemelerde OptiPlanning drop optimizasyonu için
    asgari değiştirilebilir boyutları yönetir.
    """

    def __init__(self):
        self.default_limits = MinChangeableDimensions()

    def supports_optimization(self, grain_code: str) -> bool:
        """
        Grain kodunun @2012 optimizasyonunu destekleyip desteklemediğini kontrol et

        Args:
            grain_code: Grain kodu (0-Material, 1-Boyuna, 2-Enine, 3-Mixed)

        Returns:
            bool: True ise drop optimizasyonu uygulanabilir
        """
        return grain_code == GrainCode.ZERO.value

    def set_min_dimensions(
        self, min_boy: float = 50.0, min_en: float = 50.0, min_alan: Optional[float] = None
    ) -> MinChangeableDimensions:
        """
        Asgari değiştirilebilir boyutları ayarla

        Args:
            min_boy: Asgari boy (mm)
            min_en: Asgari en (mm)
            min_alan: Asgari alan (mm², opsiyonel)

        Returns:
            MinChangeableDimensions: Yeni limitler
        """
        if min_alan is None:
            min_alan = min_boy * min_en

        self.default_limits = MinChangeableDimensions(
            min_boy=min_boy, min_en=min_en, min_alan=min_alan
        )

        return self.default_limits

    def calculate_optimization(
        self,
        boy: float,
        en: float,
        mevcut_plaka_boy: float = 2800,
        mevcut_plaka_en: float = 2070,
        grain_code: str = "0-Material",
    ) -> DropOptimizationResult:
        """
        Drop optimizasyonu hesapla

        Args:
            boy: Parça boyu (mm)
            en: Parça eni (mm)
            mevcut_plaka_boy: Mevcut plaka boyu (mm)
            mevcut_plaka_en: Mevcut plaka eni (mm)
            grain_code: Grain kodu

        Returns:
            DropOptimizationResult: Optimizasyon sonucu
        """
        # Grain 0 değilse optimizasyon yapılamaz
        if not self.supports_optimization(grain_code):
            return DropOptimizationResult(
                orijinal_boy=boy,
                orijinal_en=en,
                optimized_boy=None,
                optimized_en=None,
                kazanc_mm2=0.0,
                kazanc_yuzde=0.0,
                uygulanabilir=False,
            )

        orijinal_alan = boy * en

        # Asgari boyutları uygula
        optimized_boy = max(boy, self.default_limits.min_boy)
        optimized_en = max(en, self.default_limits.min_en)

        # Asgari alan kontrolü
        optimized_alan = optimized_boy * optimized_en
        if optimized_alan < self.default_limits.min_alan:
            # Alanı artır
            scale = (self.default_limits.min_alan / optimized_alan) ** 0.5
            optimized_boy *= scale
            optimized_en *= scale

        # Plaka sınırlarını aşma kontrolü
        optimized_boy = min(optimized_boy, mevcut_plaka_boy)
        optimized_en = min(optimized_en, mevcut_plaka_en)

        # Optimizasyon sonucunu hesapla
        yeni_alan = optimized_boy * optimized_en
        kazanc = yeni_alan - orijinal_alan
        kazanc_yuzde = (kazanc / orijinal_alan * 100) if orijinal_alan > 0 else 0

        # Değişiklik var mı?
        uygulanabilir = optimized_boy != boy or optimized_en != en

        return DropOptimizationResult(
            orijinal_boy=boy,
            orijinal_en=en,
            optimized_boy=optimized_boy if uygulanabilir else None,
            optimized_en=optimized_en if uygulanabilir else None,
            kazanc_mm2=kazanc if uygulanabilir else 0.0,
            kazanc_yuzde=kazanc_yuzde if uygulanabilir else 0.0,
            uygulanabilir=uygulanabilir,
        )

    def optimize_order_parts(
        self, parts: List[Dict], grain_code: str = "0-Material"
    ) -> List[DropOptimizationResult]:
        """
        Siparişteki tüm parçaları optimize et

        Args:
            parts: Parça listesi [{'boy': 700, 'en': 400, 'adet': 2}, ...]
            grain_code: Grain kodu

        Returns:
            List[DropOptimizationResult]: Her parça için optimizasyon sonucu
        """
        results = []

        for part in parts:
            result = self.calculate_optimization(
                boy=part.get("boy", 0), en=part.get("en", 0), grain_code=grain_code
            )
            results.append(result)

        return results

    def get_optimization_summary(self, results: List[DropOptimizationResult]) -> Dict:
        """
        Optimizasyon özetini hesapla

        Args:
            results: Optimizasyon sonuçları listesi

        Returns:
            Dict: Özet istatistikler
        """
        toplam_parca = len(results)
        optimize_edilen = sum(1 for r in results if r.uygulanabilir)
        toplam_kazanc = sum(r.kazanc_mm2 for r in results)
        ort_kazanc_yuzde = (
            sum(r.kazanc_yuzde for r in results) / toplam_parca if toplam_parca > 0 else 0
        )

        return {
            "toplam_parca": toplam_parca,
            "optimize_edilen": optimize_edilen,
            "optimize_edilemeyen": toplam_parca - optimize_edilen,
            "toplam_kazanc_mm2": round(toplam_kazanc, 2),
            "ortalama_kazanc_yuzde": round(ort_kazanc_yuzde, 2),
            "optimizasyon_orani": (
                round(optimize_edilen / toplam_parca * 100, 1) if toplam_parca > 0 else 0
            ),
        }

    def apply_to_export(self, part_data: Dict, grain_code: str = "0-Material") -> Dict:
        """
        Export verisine @2012 optimizasyonunu uygula

        Args:
            part_data: Parça verisi
            grain_code: Grain kodu

        Returns:
            Dict: Optimize edilmiş parça verisi
        """
        if not self.supports_optimization(grain_code):
            return part_data

        result = self.calculate_optimization(
            boy=part_data.get("boy", 0), en=part_data.get("en", 0), grain_code=grain_code
        )

        if result.uygulanabilir:
            part_data["boy"] = result.optimized_boy
            part_data["en"] = result.optimized_en
            part_data["@2012_optimized"] = True
            part_data["@2012_original_boy"] = result.orijinal_boy
            part_data["@2012_original_en"] = result.orijinal_en

        return part_data


# Singleton instance
optimization_service = DropOptimizationService()


def calculate_optimal_drop(
    boy: float,
    en: float,
    grain_code: str = "0-Material",
    mevcut_plaka_boy: float = 2800,
    mevcut_plaka_en: float = 2070,
) -> DropOptimizationResult:
    """Servis katmanı dışa aktarım uyumluluğu için tekil hesaplama yardımcı fonksiyonu."""
    return optimization_service.calculate_optimization(
        boy=boy,
        en=en,
        mevcut_plaka_boy=mevcut_plaka_boy,
        mevcut_plaka_en=mevcut_plaka_en,
        grain_code=grain_code,
    )
