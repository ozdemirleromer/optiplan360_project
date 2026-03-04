import re
from typing import Any

from app.constants.excel_schema import LEGACY_GRAIN_MAP, REQUIRED_COLUMNS, VALID_GRAIN_VALUES
from app.exceptions import ValidationError
from app.schemas import OrderCreate, OrderPartCreate
from app.utils.text_normalize import normalize_phone


DEFAULT_PLATE_W_MM = 2100.0
DEFAULT_PLATE_H_MM = 2800.0
DEFAULT_THICKNESS_MM = 18.0


class OcrOrderMapper:
    """OCR çıktısını kanonik OrderCreate şemasına dönüştürür."""

    def map(self, ocr_result: dict[str, Any]) -> OrderCreate:
        customer_id = ocr_result.get("customer_id")
        if customer_id is None:
            raise ValidationError("OCR sipariş eşlemesi için customer_id zorunludur")

        customer_phone = normalize_phone(
            str(
                ocr_result.get("customer_phone")
                or ocr_result.get("phone_norm")
                or ocr_result.get("phone")
                or ""
            )
        )
        if not customer_phone:
            raise ValidationError("OCR sipariş eşlemesi için geçerli telefon zorunludur")

        thickness_mm = self._parse_thickness(
            ocr_result.get("thickness_mm") or ocr_result.get("thickness") or DEFAULT_THICKNESS_MM
        )
        plate_w_mm, plate_h_mm = self._parse_plate_size(
            ocr_result.get("plate_size")
            or ocr_result.get("plate")
            or {"width_mm": DEFAULT_PLATE_W_MM, "height_mm": DEFAULT_PLATE_H_MM}
        )

        material_name = self._pick_text(
            ocr_result.get("material_name"),
            ocr_result.get("material"),
            ocr_result.get("color"),
            default="Bilinmiyor",
        )
        grain_default = self._normalize_grain(
            ocr_result.get("grain_default") or ocr_result.get("grain")
        )

        raw_parts = ocr_result.get("parts") or []
        if not raw_parts:
            raise ValidationError("OCR sipariş eşlemesi için en az bir parça gerekir")

        default_part_group = str(ocr_result.get("part_group") or "GOVDE").upper()
        parts = [self._map_part(part, default_part_group, grain_default) for part in raw_parts]

        return OrderCreate(
            customer_id=int(customer_id),
            phone_norm=customer_phone,
            thickness_mm=thickness_mm,
            plate_w_mm=plate_w_mm,
            plate_h_mm=plate_h_mm,
            color=self._pick_text(ocr_result.get("color"), material_name, default=material_name),
            material_name=material_name,
            band_mm=self._parse_optional_float(ocr_result.get("band_mm")),
            grain_default=grain_default,
            parts=parts,
        )

    def _map_part(
        self,
        raw_part: dict[str, Any],
        default_part_group: str,
        default_grain: str,
    ) -> OrderPartCreate:
        boy_mm = self._parse_dimension(
            raw_part.get("boy_mm") or raw_part.get("boy") or raw_part.get("length")
        )
        en_mm = self._parse_dimension(
            raw_part.get("en_mm") or raw_part.get("en") or raw_part.get("width")
        )
        adet = int(raw_part.get("adet") or raw_part.get("quantity") or raw_part.get("qty") or 1)

        return OrderPartCreate(
            part_group=str(raw_part.get("part_group") or default_part_group).upper(),
            boy_mm=boy_mm,
            en_mm=en_mm,
            adet=adet,
            grain_code=self._normalize_grain(raw_part.get("grain_code") or raw_part.get("grain"), default_grain),
            u1=self._parse_bool(raw_part.get("u1") or raw_part.get("top_edge")),
            u2=self._parse_bool(raw_part.get("u2") or raw_part.get("bottom_edge")),
            k1=self._parse_bool(raw_part.get("k1") or raw_part.get("left_edge")),
            k2=self._parse_bool(raw_part.get("k2") or raw_part.get("right_edge")),
            part_desc=self._pick_text(raw_part.get("part_desc"), raw_part.get("description")),
            drill_code_1=self._pick_text(raw_part.get("drill_code_1"), raw_part.get("drill1")),
            drill_code_2=self._pick_text(raw_part.get("drill_code_2"), raw_part.get("drill2")),
        )

    def _parse_plate_size(self, value: Any) -> tuple[float, float]:
        if isinstance(value, dict):
            width = value.get("width_mm") or value.get("width") or DEFAULT_PLATE_W_MM
            height = value.get("height_mm") or value.get("height") or DEFAULT_PLATE_H_MM
            return float(width), float(height)

        text = str(value or "").strip()
        match = re.search(r"(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)", text)
        if not match:
            return DEFAULT_PLATE_W_MM, DEFAULT_PLATE_H_MM
        return float(match.group(1).replace(",", ".")), float(match.group(2).replace(",", "."))

    def _parse_thickness(self, value: Any) -> float:
        text = str(value).strip()
        match = re.search(r"(\d+(?:[.,]\d+)?)", text)
        if not match:
            raise ValidationError("OCR sipariş eşlemesi için kalınlık çözümlenemedi")
        return float(match.group(1).replace(",", "."))

    def _parse_dimension(self, value: Any) -> float:
        if value is None:
            raise ValidationError("OCR sipariş eşlemesinde boy/en alanı eksik")
        return float(str(value).replace(",", "."))

    def _parse_optional_float(self, value: Any) -> float | None:
        if value in (None, ""):
            return None
        return float(str(value).replace(",", "."))

    def _normalize_grain(self, value: Any, default: str = "0-Material") -> str:
        if value in (None, ""):
            return default

        text = str(value).strip()
        legacy_map = {**LEGACY_GRAIN_MAP}
        if text in legacy_map:
            return legacy_map[text]

        if text.isdigit():
            index = int(text)
            mapping = {
                0: "0-Material",
                1: "1-Boyuna",
                2: "2-Enine",
                3: "3-Material",
            }
            return mapping.get(index, default)

        return text

    def _parse_bool(self, value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if value in (None, "", 0, "0", "false", "False", "hayir", "yok"):
            return False
        return True

    def _pick_text(self, *values: Any, default: str | None = None) -> str | None:
        for value in values:
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
        return default
