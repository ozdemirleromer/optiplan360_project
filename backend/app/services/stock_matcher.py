"""
Fuzzy Stok Arama Servisi
Mikro SQL stok adı benzerlik araması
"""

import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Tuple


@dataclass
class StockMatch:
    stock_code: str
    stock_name: str
    thickness: str
    color: str
    similarity: float  # 0.0 - 1.0
    match_type: str  # "exact", "partial", "fuzzy"
    normalized_name: str


class StockMatcher:
    """
    Malzeme adına göre fuzzy stok eşleştirme
    ✅ Kural #172-174 uyumlu: MLAM/SLAM normalize, stok adı yeterli

    Özellikler:
    - Tam eşleşme
    - Kısmi eşleşme
    - Fuzzy (benzerlik) eşleşme
    - Kalınlık ve renk filtreleme
    """

    # Normalize kuralları (Kural #172-173)
    NORMALIZE_RULES = {
        "MLAM": "MDFLAM",
        "LAM": "LAM",
        "SLAM": "SUNTALAM",
        "SUNTA": "SUNTALAM",
    }

    # Kalınlık pattern'leri
    THICKNESS_PATTERNS = [
        r"(\d+)\s*mm",  # 18mm, 18 mm
        r"(\d+)\s*mt",  # 18mt (metre ton? yerine mm kabul)
        r"\b(\d{1,2})\b",  # Sadece sayı (bağlamda kalınlık)
    ]

    # Renk pattern'leri
    COLOR_PATTERNS = {
        r"beyaz|beyaz\s*mdf|beyaz\s*lake": "Beyaz",
        r"antrasit|gri": "Gri",
        r"siyah": "Siyah",
        r"ceviz|koyu\s*ceviz": "Ceviz",
        r"meşe|mese|beyaz\s*meşe": "Meşe",
        r"kay\s*sı": "Kayısı",
        r"vişne|visne": "Vişne",
        r"kiraz": "Kiraz",
        r"gümüş\s*meşe|g\.?meşe": "Gümüş Meşe",
        r"country": "Country",
    }

    def __init__(self, stock_list: Optional[List[Dict]] = None):
        """
        Args:
            stock_list: Mikro SQL'den çekilen stok listesi
                [{"stock_code": "STK001", "stock_name": "18mm Beyaz MDFLAM"}]
        """
        self.stock_list = stock_list or []
        self.normalized_stocks = self._normalize_stock_list()

    def _normalize_stock_list(self) -> List[Dict]:
        """Stok listesini normalize et"""
        normalized = []
        for stock in self.stock_list:
            name = stock.get("stock_name", "")
            normalized_name = self._normalize_name(name)
            thickness = self._extract_thickness(name)
            color = self._extract_color(name)

            normalized.append(
                {
                    "stock_code": stock.get("stock_code", ""),
                    "stock_name": name,
                    "normalized_name": normalized_name,
                    "thickness": thickness,
                    "color": color,
                    "keywords": self._extract_keywords(normalized_name),
                }
            )
        return normalized

    def _normalize_name(self, name: str) -> str:
        """Stok adını normalize et (Kural #172-173)"""
        if not name:
            return ""

        name = name.upper()

        # MLAM/SLAM dönüşümleri
        for old, new in self.NORMALIZE_RULES.items():
            name = name.replace(old, new)

        # Fazla boşlukları temizle
        name = " ".join(name.split())

        return name

    def _extract_thickness(self, name: str) -> str:
        """Kalınlık bilgisi çıkar"""
        for pattern in self.THICKNESS_PATTERNS:
            match = re.search(pattern, name, re.IGNORECASE)
            if match:
                value = match.group(1)
                return f"{value}mm"
        return ""

    def _extract_color(self, name: str) -> str:
        """Renk bilgisi çıkar"""
        name_lower = name.lower()
        for pattern, color_name in self.COLOR_PATTERNS.items():
            if re.search(pattern, name_lower):
                return color_name
        return ""

    def _extract_keywords(self, name: str) -> List[str]:
        """Anahtar kelimeler çıkar"""
        # Kalınlık ve genel kelimeleri ayır
        words = name.split()
        keywords = []

        for word in words:
            # Kalınlık kontrolü
            if re.match(r"^\d+MM$", word):
                keywords.append(f"THICKNESS:{word}")
            # Malzeme tipi
            elif word in ["MDFLAM", "SUNTALAM", "LAM"]:
                keywords.append(f"TYPE:{word}")
            # Renk
            else:
                keywords.append(f"COLOR:{word}")

        return keywords

    def search(
        self,
        query: str,
        thickness_filter: Optional[str] = None,
        limit: int = 10,
        min_similarity: float = 0.3,
    ) -> List[StockMatch]:
        """
        Fuzzy stok arama

        Args:
            query: Arama sorgusu (örn: "18mm Beyaz")
            thickness_filter: Kalınlık filtresi (örn: "18mm")
            limit: Maksimum sonuç sayısı
            min_similarity: Minimum benzerlik skoru

        Returns:
            StockMatch listesi (benzerliğe göre sıralı)
        """
        if not query or not self.normalized_stocks:
            return []

        query_normalized = self._normalize_name(query)
        query_thickness = thickness_filter or self._extract_thickness(query)
        query_color = self._extract_color(query)

        matches = []

        for stock in self.normalized_stocks:
            # Kalınlık filtresi
            if query_thickness and stock["thickness"] != query_thickness:
                continue

            # Benzerlik hesapla
            similarity, match_type = self._calculate_similarity(
                query_normalized, stock["normalized_name"], query_color, stock["color"]
            )

            if similarity >= min_similarity:
                matches.append(
                    StockMatch(
                        stock_code=stock["stock_code"],
                        stock_name=stock["stock_name"],
                        thickness=stock["thickness"],
                        color=stock["color"],
                        similarity=similarity,
                        match_type=match_type,
                        normalized_name=stock["normalized_name"],
                    )
                )

        # Benzerliğe göre sırala
        matches.sort(key=lambda x: x.similarity, reverse=True)

        return matches[:limit]

    def _calculate_similarity(
        self, query: str, stock_name: str, query_color: str, stock_color: str
    ) -> Tuple[float, str]:
        """
        İki metin arasındaki benzerliği hesapla

        Returns:
            (similarity_score, match_type)
        """
        # Tam eşleşme
        if query == stock_name:
            return 1.0, "exact"

        # İçerme kontrolü
        if query in stock_name or stock_name in query:
            return 0.9, "partial"

        # Fuzzy benzerlik
        base_similarity = SequenceMatcher(None, query, stock_name).ratio()

        # Renk eşleşmesi bonusu
        color_bonus = 0.0
        if query_color and stock_color and query_color == stock_color:
            color_bonus = 0.15
        elif query_color and stock_color and query_color in stock_color:
            color_bonus = 0.1

        final_similarity = min(1.0, base_similarity + color_bonus)

        return final_similarity, "fuzzy"

    def find_best_match(self, query: str, thickness: Optional[str] = None) -> Optional[StockMatch]:
        """En iyi eşleşmeyi bul"""
        matches = self.search(query, thickness, limit=1, min_similarity=0.5)
        return matches[0] if matches else None

    def suggest_alternatives(self, query: str, thickness: Optional[str] = None) -> Dict:
        """
        Alternatif öneriler sun

        Returns:
            {
                "exact_match": StockMatch veya None,
                "similar_matches": [StockMatch],
                "thickness_alternatives": [str],
                "color_alternatives": [str]
            }
        """
        matches = self.search(query, thickness, limit=5)

        exact_match = None
        similar_matches = []

        for match in matches:
            if match.match_type == "exact":
                exact_match = match
            else:
                similar_matches.append(match)

        # Alternatif kalınlıklar
        thickness_alternatives = list(
            set(m.thickness for m in matches if m.thickness and m.thickness != thickness)
        )

        # Alternatif renkler
        color_alternatives = list(set(m.color for m in matches if m.color))

        return {
            "exact_match": exact_match,
            "similar_matches": similar_matches,
            "thickness_alternatives": thickness_alternatives,
            "color_alternatives": color_alternatives,
            "search_query": query,
            "applied_filter": thickness,
        }


# Yardımcı fonksiyonlar
def create_matcher(stock_list: List[Dict]) -> StockMatcher:
    """Stok matcher oluştur"""
    return StockMatcher(stock_list)


def quick_search(
    stock_list: List[Dict], query: str, thickness: Optional[str] = None
) -> List[StockMatch]:
    """Hızlı arama fonksiyonu"""
    matcher = StockMatcher(stock_list)
    return matcher.search(query, thickness)
