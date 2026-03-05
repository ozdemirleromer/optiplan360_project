from dataclasses import dataclass, field
from typing import Any

from ..constants.excel_schema import (
    ARKALIK_FORBIDDEN_COLUMNS,
    PART_GROUPS,
    REQUIRED_COLUMNS,
    VALID_GRAIN_VALUES,
)


@dataclass
class ValidationResult:
    is_valid: bool
    details: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return self.is_valid


class ExportValidator:
    """Canonical export validation entry point."""

    def validate(self, data: Any, group: str) -> ValidationResult:
        errors: list[str] = []
        warnings: list[str] = []
        normalized_group = (group or "").upper()

        if normalized_group not in PART_GROUPS:
            errors.append(f"Gecersiz part group: {group}")
            return ValidationResult(is_valid=False, errors=errors, warnings=warnings)

        frame = self._coerce_dataframe(data)
        columns = list(frame.columns)
        missing_columns = [column for column in REQUIRED_COLUMNS if column not in columns]
        if missing_columns:
            errors.append(f"Eksik zorunlu kolonlar: {missing_columns}")

        if "GRAIN" in frame.columns:
            invalid_grains = sorted(
                {
                    str(value)
                    for value in frame["GRAIN"].dropna().tolist()
                    if str(value) not in VALID_GRAIN_VALUES
                }
            )
            if invalid_grains:
                errors.append(f"Gecersiz grain degerleri: {invalid_grains}")

        if normalized_group == "ARKALIK":
            band_violations = self._find_arkalik_band_violations(frame)
            if band_violations:
                errors.append(
                    "Kural #9 ihlali: ARKALIK satirlarinda bant kolonlari bos olmali "
                    f"(satirlar: {band_violations})"
                )

        details = {
            "group": normalized_group,
            "row_count": len(frame.index),
            "columns": columns,
            "missing_columns": missing_columns,
        }
        return ValidationResult(
            is_valid=len(errors) == 0,
            details=details,
            errors=errors,
            warnings=warnings,
        )

    def validate_export_format(self, data: dict[str, Any]) -> ValidationResult:
        """
        Backward-compatible wrapper for older dict payload validation.
        Expected keys:
        - format
        - columns
        - measures
        - groups
        """

        errors: list[str] = []
        warnings: list[str] = []
        format_type = str(data.get("format", "")).lower()
        if format_type and format_type != "xlsx":
            errors.append(f"Format hatasi: {format_type} yerine xlsx olmali")

        columns = [str(column) for column in data.get("columns", [])]
        missing_columns = [column for column in REQUIRED_COLUMNS if column not in columns]
        if missing_columns:
            errors.append(f"Eksik zorunlu kolonlar: {missing_columns}")

        measures = data.get("measures", [])
        invalid_grains = sorted(
            {
                str(measure.get("grain"))
                for measure in measures
                if measure.get("grain") and str(measure.get("grain")) not in VALID_GRAIN_VALUES
            }
        )
        if invalid_grains:
            errors.append(f"Gecersiz grain degerleri: {invalid_grains}")

        for group in data.get("groups", []):
            if str(group.get("type", "")).upper() == "ARKALIK":
                for index, measure in enumerate(group.get("measures", []), start=1):
                    if any(self._has_value(measure.get(column.lower())) for column in ARKALIK_FORBIDDEN_COLUMNS):
                        errors.append(f"Kural #9 ihlali: ARKALIK measure#{index} bant iceriyor")
                        break

        return ValidationResult(
            is_valid=len(errors) == 0,
            details={
                "format": format_type or "unknown",
                "columns": columns,
                "missing_columns": missing_columns,
            },
            errors=errors,
            warnings=warnings,
        )

    def _coerce_dataframe(self, data: Any):
        import pandas as pd

        if isinstance(data, pd.DataFrame):
            return data.copy()
        if isinstance(data, list):
            return pd.DataFrame(data)
        if isinstance(data, dict):
            if "rows" in data:
                return pd.DataFrame(data["rows"])
            if "measures" in data:
                return pd.DataFrame(data["measures"])
        return pd.DataFrame()

    def _find_arkalik_band_violations(self, frame) -> list[int]:
        violating_rows: list[int] = []
        for row_index, (_, row) in enumerate(frame.iterrows(), start=1):
            if any(self._has_value(row.get(column)) for column in ARKALIK_FORBIDDEN_COLUMNS):
                violating_rows.append(row_index)
        return violating_rows

    def _has_value(self, value: Any) -> bool:
        if value is None:
            return False
        if isinstance(value, str):
            return value.strip() not in {"", "0", "0.0", "false", "False"}
        return bool(value)
