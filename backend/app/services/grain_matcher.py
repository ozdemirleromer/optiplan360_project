"""
Grain Otomatik Eşleştirme Servisi
Malzeme adına göre grain önerisi
"""

import re
from dataclasses import dataclass
from typing import Dict, List


@dataclass
class GrainSuggestion:
    grain: str  # "0-Material", "1-Material", "2-Material", "3-Material"
    confidence: float  # 0.0 - 1.0
    reason: str
    grain_name: str  # Türkçe açıklama


class GrainMatcher:
    """
    Malzeme adına göre grain önerisi
    ✅ Kural #8 uyumlu: Grain değerleri sabit

    Grain Kuralları:
    - 0-Material: Desensiz, boyutlar değiştirilebilir
    - 1-Material: Damar kısa kenar boyunca
    - 2-Material: Damar uzun kenar boyunca
    - 3-Material: Karışık/önemsiz desen
    """

    # Grain pattern'leri ve açıklamaları
    GRAIN_PATTERNS: Dict[str, Dict] = {
        "0-Material": {
            "patterns": [
                r"MDFLAM|MLAM",  # MDF
                r"beyaz\s*(mdf|lake)?",  # Beyaz
                r"antrasit",  # Antrasit
                r"gri\s*(mdf|lake)?",  # Gri
                r"siyah\s*(mdf|lake)?",  # Siyah
                r"parlak\s*beyaz",  # Parlak beyaz
            ],
            "name": "Desensiz (Otomatik)",
            "description": "Damar/desen yok. Parça her iki yönde yerleştirilebilir.",
            "confidence": 0.9,
        },
        "1-Material": {
            "patterns": [
                r"ceviz",  # Ceviz
                r"meşe|mese",  # Meşe
                r"kay\s*sı",  # Kayısı
                r"vişne|visne",  # Vişne
                r"kiraz",  # Kiraz
                r"ahşap\s*desen",  # Ahşap desen
            ],
            "name": "Uzunluk (Damar kısa kenar)",
            "description": "Damar kısa kenar boyunca. Parça genişliği panel genişliğiyle eşleşir.",
            "confidence": 0.85,
        },
        "2-Material": {
            "patterns": [
                r"g\.?meşe|g\.?mese|gumese|gümeşe",  # Gümüş meşe
                r"country",  # Country tarzı
                r"rustik",  # Rustik
                r"retro\s*desen",  # Retro
            ],
            "name": "Genişlik (Damar uzun kenar)",
            "description": "Damar uzun kenar boyunca. Parça uzunluğu panel uzunluğuyla eşleşir.",
            "confidence": 0.8,
        },
        "3-Material": {
            "patterns": [
                r"hafif\s*desen",  # Hafif desen
                r"doku",  # Doku
                r"textured?",  # Textured
                r"kumaş\s*görünüm",  # Kumaş görünüm
            ],
            "name": "Karışık",
            "description": "Desen yönü var ama karışık/önemsiz.",
            "confidence": 0.75,
        },
    }

    def __init__(self):
        self.compiled_patterns = self._compile_patterns()

    def _compile_patterns(self) -> Dict[str, List[re.Pattern]]:
        """Regex pattern'leri derle"""
        compiled = {}
        for grain, config in self.GRAIN_PATTERNS.items():
            compiled[grain] = [re.compile(pattern, re.IGNORECASE) for pattern in config["patterns"]]
        return compiled

    def suggest_grain(self, material_name: str) -> GrainSuggestion:
        """
        Malzeme adına göre grain önerisi

        Args:
            material_name: Örn: "18mm Beyaz MDFLAM", "8mm Ceviz"

        Returns:
            GrainSuggestion: Önerilen grain ve güven skoru
        """
        if not material_name:
            return GrainSuggestion(
                grain="0-Material",
                confidence=0.5,
                reason="Malzeme adı boş, varsayılan desensiz",
                grain_name="Desensiz (Otomatik)",
            )

        material_lower = material_name.lower()

        # Her grain için pattern kontrolü
        for grain, patterns in self.compiled_patterns.items():
            for pattern in patterns:
                if pattern.search(material_lower):
                    config = self.GRAIN_PATTERNS[grain]
                    return GrainSuggestion(
                        grain=grain,
                        confidence=config["confidence"],
                        reason=f"Eşleşen pattern: {pattern.pattern}",
                        grain_name=config["name"],
                    )

        # Eşleşme yoksa varsayılan: 0-Material (desensiz)
        return GrainSuggestion(
            grain="0-Material",
            confidence=0.5,
            reason="Özel desen bulunamadı, varsayılan desensiz",
            grain_name="Desensiz (Otomatik)",
        )

    def suggest_grain_with_explanation(self, material_name: str) -> Dict:
        """Detaylı grain önerisi açıklaması ile"""
        suggestion = self.suggest_grain(material_name)
        config = self.GRAIN_PATTERNS.get(suggestion.grain, {})

        return {
            "grain": suggestion.grain,
            "grain_name": suggestion.grain_name,
            "confidence": suggestion.confidence,
            "reason": suggestion.reason,
            "description": config.get("description", ""),
            "opti_planning_value": self._get_opti_planning_value(suggestion.grain),
            "can_rotate": suggestion.grain == "0-Material",
            "size_editable": suggestion.grain == "0-Material",
        }

    def _get_opti_planning_value(self, grain: str) -> int:
        """OptiPlanning @437 parametre değeri"""
        mapping = {
            "0-Material": 0,  # Otomatik
            "1-Material": 1,  # Uzunluk
            "2-Material": 2,  # Genişlik
            "3-Material": 3,  # Karışık
        }
        return mapping.get(grain, 0)

    def batch_suggest(self, material_names: List[str]) -> List[GrainSuggestion]:
        """Toplu grain önerisi"""
        return [self.suggest_grain(name) for name in material_names]

    def get_grain_info(self, grain: str) -> Dict:
        """Grain detay bilgisi"""
        config = self.GRAIN_PATTERNS.get(grain, {})
        return {
            "grain": grain,
            "name": config.get("name", "Bilinmiyor"),
            "description": config.get("description", ""),
            "opti_planning_value": self._get_opti_planning_value(grain),
            "rules": self._get_grain_rules(grain),
        }

    def _get_grain_rules(self, grain: str) -> List[str]:
        """Grain'e özgü kurallar"""
        rules = {
            "0-Material": [
                "Parça her iki yönde döndürülebilir",
                "Boyutlar değiştirilebilir (drop optimizasyonu uygulanabilir)",
                "Damar/desen yok",
            ],
            "1-Material": [
                "Damar kısa kenar boyunca (uzunluk yönünde)",
                "Parça genişliği panel genişliğiyle eşleşmeli",
                "OptiPlanning +0.1mm uzunluk ekler (@433)",
            ],
            "2-Material": [
                "Damar uzun kenar boyunca (genişlik yönünde)",
                "Parça uzunluğu panel uzunluğuyla eşleşmeli",
                "OptiPlanning +0.1mm uzunluk ekler (@433)",
            ],
            "3-Material": [
                "Desen yönü var ama karışık/önemsiz",
                "OptiPlanning tarafında ayrıca yönetilir",
            ],
        }
        return rules.get(grain, [])


# Singleton instance
matcher = GrainMatcher()


def suggest_grain(material_name: str) -> GrainSuggestion:
    """Kolay kullanım fonksiyonu"""
    return matcher.suggest_grain(material_name)


def get_grain_dropdown_options() -> List[Dict]:
    """UI dropdown için grain seçenekleri"""
    return [
        {
            "value": "0-Material",
            "label": "0 - Desensiz (Otomatik)",
            "description": "Damar yok, boyutlar değiştirilebilir",
            "badge": "Varsayılan",
        },
        {
            "value": "1-Material",
            "label": "1 - Uzunluk (Damar kısa kenar)",
            "description": "Damar kısa kenar boyunca",
            "badge": "Damarlı",
        },
        {
            "value": "2-Material",
            "label": "2 - Genişlik (Damar uzun kenar)",
            "description": "Damar uzun kenar boyunca",
            "badge": "Damarlı",
        },
        {
            "value": "3-Material",
            "label": "3 - Karışık",
            "description": "Desen yönü var ama karışık",
            "badge": "Özel",
        },
    ]
