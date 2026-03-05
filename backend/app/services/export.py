from __future__ import annotations

import os
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
from sqlalchemy.orm import Session, joinedload

from .. import models
from ..constants.excel_schema import LEGACY_GRAIN_MAP, PART_GROUPS, REQUIRED_COLUMNS, VALID_GRAIN_VALUES
from ..exceptions import NotFoundError, ValidationError
from ..models import OptiJob, Order, OrderPart
from .export_validator import ExportValidator
from .filename_generator import FilenameGenerator

EXPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "exports")
os.makedirs(EXPORT_DIR, exist_ok=True)


def generate_xlsx_for_job(job: OptiJob, parts: list[OrderPart], output_dir: str) -> list[str]:
    """GOVDE ve ARKALIK gruplari icin XLSX uretir."""
    if not parts:
        return []

    order = getattr(job, "order", None)
    crm_name = (
        getattr(job, "customer_snapshot_name", None)
        or getattr(order, "crm_name_snapshot", None)
        or "UNKNOWN"
    )
    color = getattr(order, "color", None) or getattr(order, "material_name", None) or "UNKNOWN"

    generator = FilenameGenerator()
    validator = ExportValidator()

    export_root = Path(output_dir)
    export_root.mkdir(parents=True, exist_ok=True)

    generated_files: list[str] = []
    for part_group in PART_GROUPS:
        group_parts = [
            part for part in parts if str(getattr(part, "part_group", "GOVDE")).upper() == part_group
        ]
        if not group_parts:
            continue

        thickness = _resolve_group_thickness(order, part_group, group_parts)
        frame = _build_export_dataframe(group_parts, part_group)
        validation = validator.validate(frame, group=part_group)
        if not validation.is_valid:
            raise ValidationError(f"Export kural ihlali: {validation.errors}")

        filename = generator.generate(
            crm_name=crm_name,
            thickness=f"{int(thickness)}mm",
            color=color,
            group=part_group,
        )
        final_path = export_root / filename
        tmp_path = final_path.with_name(f"{final_path.stem}.tmp{final_path.suffix}")
        try:
            frame.to_excel(tmp_path, index=False)
            os.replace(tmp_path, final_path)
        finally:
            if tmp_path.exists():
                tmp_path.unlink(missing_ok=True)
        generated_files.append(str(final_path))

    return generated_files


def export_order_to_excel(db: Session, order_id: str) -> list[str]:
    """Legacy helper that delegates to the canonical job export pipeline."""
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.parts))
        .filter(models.Order.id == order_id)
        .first()
    )
    if not order:
        raise NotFoundError("Sipariş", order_id)
    if not order.parts:
        return []

    job = (
        db.query(models.OptiJob)
        .filter(models.OptiJob.order_id == order.id)
        .order_by(models.OptiJob.created_at.desc())
        .first()
    )
    export_job = job or SimpleNamespace(
        id=f"order-{order.id}",
        order_id=order.id,
        order=order,
        customer_snapshot_name=order.crm_name_snapshot,
    )
    if getattr(export_job, "order", None) is None:
        export_job.order = order
    return generate_xlsx_for_job(export_job, list(order.parts), EXPORT_DIR)


def export_order_to_excel_openpyxl(order):
    """Backward-compatible alias for the canonical export path."""
    export_job = SimpleNamespace(
        id=f"order-{order.id}",
        order_id=order.id,
        order=order,
        customer_snapshot_name=order.crm_name_snapshot,
    )
    return generate_xlsx_for_job(export_job, list(order.parts), EXPORT_DIR)


def _build_export_dataframe(parts: list[OrderPart], group: str) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    is_arkalik = group == "ARKALIK"

    for index, part in enumerate(parts, start=1):
        rows.append(
            {
                "NO": index,
                "CODE": str(getattr(part, "id", index)),
                "LENGTH": _coerce_dimension(getattr(part, "boy_mm", None), getattr(part, "boy", None)),
                "WIDTH": _coerce_dimension(getattr(part, "en_mm", None), getattr(part, "en", None)),
                "QUANTITY": int(getattr(part, "adet", None) or getattr(part, "quantity", None) or 1),
                "GRAIN": _normalize_grain(
                    getattr(part, "grain_code", None) or getattr(part, "grain", None)
                ),
                "TOP_EDGE": "" if is_arkalik else _edge_cell(getattr(part, "u1", None)),
                "BOTTOM_EDGE": "" if is_arkalik else _edge_cell(getattr(part, "u2", None)),
                "LEFT_EDGE": "" if is_arkalik else _edge_cell(getattr(part, "k1", None)),
                "RIGHT_EDGE": "" if is_arkalik else _edge_cell(getattr(part, "k2", None)),
            }
        )

    return pd.DataFrame(rows, columns=REQUIRED_COLUMNS)


def _coerce_dimension(primary: object, fallback: object) -> float:
    value = primary if primary not in (None, "", 0) else fallback
    if value in (None, ""):
        return 0.0
    return float(value)


def _edge_cell(value: object) -> str:
    if value in (None, "", False, 0, "0", "0.0"):
        return ""
    return "1"


def _normalize_grain(value: object) -> str:
    if value in (None, ""):
        return "0-Material"

    text = LEGACY_GRAIN_MAP.get(str(value).strip(), str(value).strip())
    if text in VALID_GRAIN_VALUES:
        return text

    if text.isdigit():
        index = int(text)
        if 0 <= index < len(VALID_GRAIN_VALUES):
            return VALID_GRAIN_VALUES[index]

    return "0-Material"


def _resolve_group_thickness(order: Order | None, group: str, parts: list[OrderPart]) -> float:
    if group == "ARKALIK":
        for part in parts:
            part_thickness = getattr(part, "thickness_mm", None)
            if part_thickness not in (None, ""):
                return float(part_thickness)
        return 8.0

    if order is not None and getattr(order, "thickness_mm", None) not in (None, ""):
        return float(order.thickness_mm)
    return 18.0
