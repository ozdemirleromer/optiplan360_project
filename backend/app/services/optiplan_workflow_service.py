from __future__ import annotations

import hashlib
import logging
import os
import re
import json
import shutil
import subprocess
import tempfile
import unicodedata
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.constants.optiplan_workflow import (
    ExportContractRules,
    INTERIM_OPJ_CONTRACT_STATE,
    INTERIM_OPJ_WRITER_PROFILE,
    OPTIPLAN_ALLOWED_EXPORT_FORMATS,
    OPTIPLAN_ALLOWED_GRAIN_VALUES,
    OPTIPLAN_ALLOWED_IMPORT_EXTENSIONS,
    OPTIPLAN_ALLOWED_ROW_SOURCES,
    OPTIPLAN_BAND_EXPORT_MAP,
    OPTIPLAN_EXPORT_COLUMNS,
    OPTIPLAN_PHASE2_FIELDS,
    OPTIPLAN_PHASE2_FIELD_SEQUENCE,
    OPTIPLAN_PHASE2_GATE_FIELDS,
    OPTIPLAN_PHASE2_METADATA_FIELDS,
    OPTIPLAN_PHASE2_ROW_SCORE_KEYS,
    OPTIPLAN_PHASE3_MUTABLE_FIELDS,
    OPTIPLAN_PHASE3_REQUIRED_RECORD_MESSAGES,
    OPTIPLAN_PHASE3_ROW_BOOLEAN_FIELDS,
    OPTIPLAN_PHASE3_ROW_DEFAULT_SOURCE,
    OPTIPLAN_PHASE3_ROW_FIELD_LABELS,
    OPTIPLAN_PHASE3_ROW_HOLE_FIELDS,
    OPTIPLAN_PHASE3_ROW_REQUIRED_FIELDS,
    OPTIPLAN_SOURCE_FOLDERS,
    validate_opj_status,
)
from app.exceptions import BusinessRuleError, NotFoundError, ValidationError
from app.services.gemini_ocr_adapter import run_gemini_ocr, to_workflow_payload as _ocr_to_payload
from app.services.ocr_preprocessing_service import PreprocessConfig, preprocess_image
from app.services.path_config_service import path_config
from app.models.optiplan_workflow import (
    OptiPlanFolderSetting,
    OptiPlanWorkflowAudit,
    OptiPlanWorkflowCikarilanSatir,
    OptiPlanWorkflowExport,
    OptiPlanWorkflowHata,
    OptiPlanWorkflowKayit,
    OptiPlanWorkflowPlaka,
    OptiPlanWorkflowSatir,
)
from app.services.optiplan_export_service import optiplan_export_service

logger = logging.getLogger(__name__)

SOURCE_FOLDER_FIELDS = OPTIPLAN_SOURCE_FOLDERS
WORKFLOW_FOLDER_PATH_MAP = {
    "whatsapp_raw_klasoru": "ocr_input_whatsapp_dir",
    "scanner_raw_klasoru": "ocr_input_scanner_dir",
    "manuel_raw_klasoru": "ocr_input_manual_dir",
    "email_raw_klasoru": "ocr_input_email_dir",
    "islenmis_klasoru": "ocr_output_dir",
    "arsiv_klasoru": "ocr_archive_dir",
    "xml_okuma_klasoru": "xml_read_dir",
    "xlsx_cikti_klasoru": "optiplan_export_dir",
    "opj_cikti_klasoru": "optiplan_opj_export_dir",
    "hatali_klasoru": "ocr_rejected_dir",
}
WORKFLOW_FOLDER_FIELDS = tuple(WORKFLOW_FOLDER_PATH_MAP.keys())
ALLOWED_IMPORT_EXTENSIONS = OPTIPLAN_ALLOWED_IMPORT_EXTENSIONS
ALLOWED_EXPORT_FORMATS = frozenset(OPTIPLAN_ALLOWED_EXPORT_FORMATS)
PHASE_2_FIELDS = OPTIPLAN_PHASE2_FIELDS
PHASE_2_FIELD_SEQUENCE = OPTIPLAN_PHASE2_FIELD_SEQUENCE
PHASE_2_GATE_FIELDS = OPTIPLAN_PHASE2_GATE_FIELDS
PHASE_2_METADATA_FIELDS = OPTIPLAN_PHASE2_METADATA_FIELDS
PHASE_2_ROW_SCORE_KEYS = OPTIPLAN_PHASE2_ROW_SCORE_KEYS
PHASE_3_MUTABLE_FIELDS = OPTIPLAN_PHASE3_MUTABLE_FIELDS
PHASE_3_REQUIRED_RECORD_MESSAGES = OPTIPLAN_PHASE3_REQUIRED_RECORD_MESSAGES
PHASE_3_ROW_BOOLEAN_FIELDS = OPTIPLAN_PHASE3_ROW_BOOLEAN_FIELDS
PHASE_3_ROW_DEFAULT_SOURCE = OPTIPLAN_PHASE3_ROW_DEFAULT_SOURCE
PHASE_3_ROW_REQUIRED_FIELDS = OPTIPLAN_PHASE3_ROW_REQUIRED_FIELDS
PHASE_3_ROW_FIELD_LABELS = OPTIPLAN_PHASE3_ROW_FIELD_LABELS
PHASE_3_ROW_HOLE_FIELDS = OPTIPLAN_PHASE3_ROW_HOLE_FIELDS
EXPORT_COLUMNS = OPTIPLAN_EXPORT_COLUMNS
BANT_EXPORT_MAP = OPTIPLAN_BAND_EXPORT_MAP
ALLOWED_EXPORT_EDGE_VALUES = ExportContractRules.EDGE_CODES_SET
DEFAULT_PLATE_LIBRARY = (
    {"etiket": "18 MM 210*280", "plaka_boy_mm": 2100, "plaka_en_mm": 2800},
)
SIMULATED_WORKFLOW_OCR_TEXT = """ABC Mobilya
Tel: 0532 123 45 67
Ölçü Listesi:
700 x 400 x 2
1200 x 600 x 1
500 x 300 x 4
18mm Beyaz MDFLAM"""
PHONE_PATTERN = re.compile(r"(?:\+?90\s*)?0?\s*(5\d{2})[\s\-]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})")
MEASUREMENT_PATTERNS = (
    re.compile(r"(\d+)\s*[xX*×]\s*(\d+)\s*[xX*×]\s*(\d+)"),
    re.compile(r"(\d+)\s*/\s*(\d+)\s*/\s*(\d+)"),
)
MATERIAL_PATTERN = re.compile(r"(?i)(\d+(?:[.,]\d+)?)\s*mm\s+(.+)")
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
JPEG_SIGNATURE = b"\xff\xd8"
PDF_SIGNATURE = b"%PDF"
LOCAL_TESSERACT_PATHS = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Tesseract-OCR\tesseract.exe"),
)


@dataclass
class EffectiveFolderSettings:
    program_kok_klasoru: str
    whatsapp_raw_klasoru: str
    scanner_raw_klasoru: str
    manuel_raw_klasoru: str
    email_raw_klasoru: str
    islenmis_klasoru: str
    arsiv_klasoru: str
    xml_okuma_klasoru: str
    xlsx_cikti_klasoru: str
    opj_cikti_klasoru: str
    hatali_klasoru: str
    fis_evrak_no_formati: str
    arsiv_zaman_damgasi_formati: str
    xlsx_aktif_mi: bool
    opj_aktif_mi: bool
    watcher_aktif_mi: bool
    yeniden_deneme_sayisi: int


def _stringify(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, (dict, list, tuple)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


def _parse_iso_date(raw_value: str | None) -> date | None:
    if not raw_value:
        return None
    return datetime.fromisoformat(raw_value).date()


def _normalize_export_name(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text or "")
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return "_".join(part for part in ascii_text.replace("-", " ").split() if part).upper()


def _ensure_numeric_hole(value: str | None, field_name: str) -> None:
    if value and not value.isdigit():
        raise ValidationError(f"{field_name} sadece rakam olabilir")


def _normalize_row_source(value: str | None) -> str:
    source = (value or "").strip().upper()
    if not source:
        return "MANUEL"
    if source not in OPTIPLAN_ALLOWED_ROW_SOURCES:
        allowed = ", ".join(sorted(OPTIPLAN_ALLOWED_ROW_SOURCES))
        raise ValidationError(f"Satir_kaynagi yalnizca su degerleri alabilir: {allowed}")
    return source


def _parse_iso_datetime_filter(value: str | None, param_name: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError(f"{param_name} parametresi ISO datetime formatinda olmalidir") from exc
    if parsed.tzinfo is None:
        raise ValidationError(f"{param_name} parametresi timezone icermelidir")
    return parsed


def _to_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_phone_from_text(text: str) -> str | None:
    if not text:
        return None
    match = PHONE_PATTERN.search(text)
    if not match:
        return None
    return "".join(match.groups())


def _parse_measurement_line(text: str) -> dict[str, Any] | None:
    normalized = (text or "").strip()
    if not normalized:
        return None
    lowered = normalized.lower()
    if "tel" in lowered or "telefon" in lowered or "gsm" in lowered:
        return None
    for pattern in MEASUREMENT_PATTERNS:
        match = pattern.search(normalized)
        if match:
            return {
                "boy": int(match.group(1)),
                "en": int(match.group(2)),
                "adet": int(match.group(3)),
                "raw": normalized,
            }
    numeric_groups = re.findall(r"\d+", normalized)
    if 3 <= len(numeric_groups) <= 4:
        candidate_groups = numeric_groups[-3:] if len(numeric_groups[0]) <= 2 and len(numeric_groups) == 4 else numeric_groups[:3]
        boy, en, adet = (int(value) for value in candidate_groups)
        if boy >= 50 and en >= 50 and adet > 0:
            return {
                "boy": boy,
                "en": en,
                "adet": adet,
                "raw": normalized,
            }
    return None


def _extract_material_name(lines: list[str]) -> str | None:
    for line in lines:
        match = MATERIAL_PATTERN.search(line)
        if match:
            return match.group(2).strip()
    return None


def _detect_ocr_document_kind(file_name: str, content: bytes) -> str | None:
    suffix = Path(file_name).suffix.lower()
    if content.startswith(PNG_SIGNATURE) or content.startswith(JPEG_SIGNATURE):
        return "image"
    if len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image"
    if content.startswith(PDF_SIGNATURE):
        return "pdf"
    if suffix == ".pdf":
        return None
    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return None
    return None


def _resolve_tesseract_binary() -> str | None:
    configured_path = os.environ.get("TESSERACT_CMD", "").strip()
    if configured_path and Path(configured_path).is_file():
        return configured_path
    for candidate in LOCAL_TESSERACT_PATHS:
        if candidate and Path(candidate).is_file():
            return candidate
    return shutil.which("tesseract")


def _run_local_tesseract_ocr(
    content: bytes,
    *,
    source_ext: str,
    document_kind: str | None,
) -> str | None:
    if document_kind not in {"image", "pdf"}:
        return None
    binary = _resolve_tesseract_binary()
    if not binary:
        return None

    suffix = source_ext if source_ext in {".png", ".jpg", ".jpeg", ".webp", ".pdf"} else ".png"
    temp_path: Path | None = None
    env = os.environ.copy()
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(content)
            temp_path = Path(temp_file.name)
        for language in ("tur+eng", "eng"):
            result = subprocess.run(
                [binary, str(temp_path), "stdout", "-l", language, "--psm", "6"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="ignore",
                timeout=45,
                check=False,
                env=env,
            )
            if result.returncode == 0:
                text = (result.stdout or "").strip()
                if text:
                    return text
            else:
                logger.warning(
                    "Yerel Tesseract OCR başarısız: %s (lang=%s, rc=%s, stderr=%s)",
                    temp_path.name if temp_path else source_ext,
                    language,
                    result.returncode,
                    (result.stderr or "").strip()[:300],
                )
        return None
    except Exception as exc:
        logger.warning("Yerel Tesseract OCR çalıştırılamadı: %s", exc)
        return None
    finally:
        if temp_path is not None:
            try:
                temp_path.unlink(missing_ok=True)
            except TypeError:
                if temp_path.exists():
                    temp_path.unlink()


def _build_confidence_summary(scores: dict[str, float]) -> dict[str, Any]:
    values = [float(value) for value in scores.values()]
    if not values:
        return {"min": 0.0, "avg": 0.0, "review_required": True}
    min_value = round(min(values), 2)
    avg_value = round(sum(values) / len(values), 2)
    return {
        "min": min_value,
        "avg": avg_value,
        "review_required": min_value < 80,
    }


def _normalize_phase3_row_payload(
    row_payload: dict[str, Any],
    *,
    index: int,
    default_grain: int,
    current_source: str | None,
    current_scores: dict[str, Any] | None,
    current_summary: dict[str, Any] | None,
) -> dict[str, Any]:
    normalized: dict[str, Any] = {
        "satir_sirasi": row_payload.get("satir_sirasi", row_payload.get("satirSirasi", index)),
        "malzeme": row_payload.get("malzeme"),
        "boy": row_payload.get("boy"),
        "en": row_payload.get("en"),
        "adet": row_payload.get("adet", 1),
        "grain": row_payload.get("grain", default_grain),
        "bilgi": row_payload.get("bilgi"),
        "plaka_ref": row_payload.get("plaka_ref", row_payload.get("plakaRef")),
        "bant_kalinligi_override": row_payload.get(
            "bant_kalinligi_override",
            row_payload.get("bantKalinligiOverride"),
        ),
        "hucre_guven_skorlari": row_payload.get(
            "hucre_guven_skorlari",
            row_payload.get("hucreGuvenSkorlari", current_scores),
        ),
        "satir_guven_skor_ozeti": row_payload.get(
            "satir_guven_skor_ozeti",
            row_payload.get("satirGuvenSkorOzeti", current_summary),
        ),
    }
    for field_name in PHASE_3_ROW_BOOLEAN_FIELDS:
        normalized[field_name] = bool(row_payload.get(field_name, False))
    for field_name, _ in PHASE_3_ROW_HOLE_FIELDS:
        camel_alias = field_name.replace("_", "")
        normalized[field_name] = row_payload.get(field_name, row_payload.get(camel_alias))
    normalized["satir_kaynagi"] = _normalize_row_source(
        row_payload.get(
            "satir_kaynagi",
            row_payload.get("satirKaynagi", current_source or PHASE_3_ROW_DEFAULT_SOURCE),
        )
    )
    return normalized


def _normalize_phase2_row_payload(row_payload: dict[str, Any]) -> dict[str, Any]:
    normalized = {
        "id": row_payload.get("id"),
    }
    for field_name in PHASE_2_FIELD_SEQUENCE:
        candidate_keys = [field_name]
        if field_name == "delik_1":
            candidate_keys.append("delik1")
        for candidate_key in candidate_keys:
            if candidate_key in row_payload:
                normalized[field_name] = row_payload.get(candidate_key)
                break
    if "hucre_guven_skorlari" in row_payload or "hucreGuvenSkorlari" in row_payload:
        normalized["hucre_guven_skorlari"] = row_payload.get(
            "hucre_guven_skorlari",
            row_payload.get("hucreGuvenSkorlari"),
        )
    if "satir_guven_skor_ozeti" in row_payload or "satirGuvenSkorOzeti" in row_payload:
        normalized["satir_guven_skor_ozeti"] = row_payload.get(
            "satir_guven_skor_ozeti",
            row_payload.get("satirGuvenSkorOzeti"),
        )
    if "bbox_json" in row_payload or "bboxJson" in row_payload:
        normalized["bbox_json"] = row_payload.get("bbox_json", row_payload.get("bboxJson"))
    return normalized

def _normalize_phase3_plate_payload(plate_payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": plate_payload.get("id"),
        "plaka_ref": plate_payload.get("plaka_ref", plate_payload.get("plakaRef")),
        "etiket": plate_payload.get("etiket"),
        "plaka_boy_mm": plate_payload.get("plaka_boy_mm", plate_payload.get("plakaBoyMm")),
        "plaka_en_mm": plate_payload.get("plaka_en_mm", plate_payload.get("plakaEnMm")),
        "genel_listede_mi": plate_payload.get("genel_listede_mi", plate_payload.get("genelListedeMi")),
    }


def _safe_mkdir(path_value: str) -> Path:
    if not path_value:
        raise ValidationError("Klasor yolu bos olamaz")
    path = Path(path_value)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _resolve_unique_path(directory: Path, file_name: str) -> Path:
    candidate = directory / file_name
    if not candidate.exists():
        return candidate
    stem = candidate.stem
    suffix = candidate.suffix
    counter = 1
    while True:
        candidate = directory / f"{stem}_{counter:02d}{suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def _file_hash(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _read_mikro_rows(query: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
    try:
        from app.services.mikro_service import _get_db_connection

        connection = _get_db_connection()
        cursor = connection.cursor()
        cursor.execute(query, params)
        columns = [column[0] for column in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        cursor.close()
        connection.close()
        return rows
    except Exception:
        return []


class OptiPlanWorkflowService:
    def __init__(self) -> None:
        self._folder_setting_overrides: dict[str, Any] = {}
        self._export_meta_overrides: dict[str, dict[str, Any]] = {}

    def get_folder_settings(self, db: Session) -> OptiPlanFolderSetting:
        row = db.query(OptiPlanFolderSetting).order_by(OptiPlanFolderSetting.id.asc()).first()
        if row:
            return row
        row = OptiPlanFolderSetting(
            id=1,
            whatsapp_raw_klasoru="",
            scanner_raw_klasoru="",
            manuel_raw_klasoru="",
            email_raw_klasoru="",
            islenmis_klasoru="",
            arsiv_klasoru="",
            xml_okuma_klasoru="",
            xlsx_cikti_klasoru="",
            opj_cikti_klasoru="",
            hatali_klasoru="",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    def update_folder_settings(self, db: Session, payload: dict[str, Any]) -> dict[str, Any]:
        row = self.get_folder_settings(db)
        path_updates: dict[str, str] = {}
        if "program_kok_klasoru" in payload and payload["program_kok_klasoru"] is not None:
            path_updates["program_root_dir"] = str(payload["program_kok_klasoru"])
        for field_name, config_key in WORKFLOW_FOLDER_PATH_MAP.items():
            if field_name in payload and payload[field_name] is not None:
                path_updates[config_key] = str(payload[field_name])
                if hasattr(row, field_name):
                    setattr(row, field_name, str(payload[field_name]))
        if path_updates:
            path_config.update_values(path_updates)
        for key, value in payload.items():
            if value is None:
                continue
            if key in WORKFLOW_FOLDER_FIELDS:
                continue
            if hasattr(row, key):
                setattr(row, key, value)
        db.commit()
        db.refresh(row)
        return self.serialize_folder_settings(row)

    def get_effective_folder_settings(self, db: Session) -> EffectiveFolderSettings:
        row = self.get_folder_settings(db)
        return self._build_effective_folder_settings(row)

    def _build_effective_folder_settings(self, row: OptiPlanFolderSetting) -> EffectiveFolderSettings:
        resolved_paths: dict[str, str] = {}
        program_root = path_config.get("program_root_dir", "")
        for field_name, config_key in WORKFLOW_FOLDER_PATH_MAP.items():
            row_value = str(getattr(row, field_name, "") or "").strip()
            if row_value:
                resolved_paths[field_name] = row_value
                continue
            resolved_paths[field_name] = path_config.get(config_key, row_value)
        return EffectiveFolderSettings(
            program_kok_klasoru=program_root,
            whatsapp_raw_klasoru=resolved_paths["whatsapp_raw_klasoru"],
            scanner_raw_klasoru=resolved_paths["scanner_raw_klasoru"],
            manuel_raw_klasoru=resolved_paths["manuel_raw_klasoru"],
            email_raw_klasoru=resolved_paths["email_raw_klasoru"],
            islenmis_klasoru=resolved_paths["islenmis_klasoru"],
            arsiv_klasoru=resolved_paths["arsiv_klasoru"],
            xml_okuma_klasoru=resolved_paths["xml_okuma_klasoru"],
            xlsx_cikti_klasoru=resolved_paths["xlsx_cikti_klasoru"],
            opj_cikti_klasoru=resolved_paths["opj_cikti_klasoru"],
            hatali_klasoru=resolved_paths["hatali_klasoru"],
            fis_evrak_no_formati=row.fis_evrak_no_formati,
            arsiv_zaman_damgasi_formati=row.arsiv_zaman_damgasi_formati,
            xlsx_aktif_mi=row.xlsx_aktif_mi,
            opj_aktif_mi=bool(getattr(row, "opj_aktif_mi", False)),
            watcher_aktif_mi=row.watcher_aktif_mi,
            yeniden_deneme_sayisi=row.yeniden_deneme_sayisi,
        )

    def manual_import(
        self,
        db: Session,
        *,
        file_name: str,
        content: bytes,
        kaynak_klasor: str,
        force_duplicate: bool = False,
    ) -> dict[str, Any]:
        if kaynak_klasor not in SOURCE_FOLDER_FIELDS:
            raise ValidationError("Gecersiz kaynak klasor")
        if Path(file_name).suffix.lower() not in ALLOWED_IMPORT_EXTENSIONS:
            raise ValidationError("Yalnizca .jpg, .jpeg, .png, .pdf dosyalari kabul edilir")

        settings = self.get_effective_folder_settings(db)
        source_dir = _safe_mkdir(getattr(settings, SOURCE_FOLDER_FIELDS[kaynak_klasor]))
        raw_target = _resolve_unique_path(source_dir, Path(file_name).name)
        raw_target.write_bytes(content)
        return self._ingest_source_file(
            db,
            source_file=raw_target,
            kaynak_klasor=kaynak_klasor,
            force_duplicate=force_duplicate,
        )

    def scan_watch_folders(self, db: Session) -> list[dict[str, Any]]:
        settings = self.get_effective_folder_settings(db)
        if not settings.watcher_aktif_mi:
            return []

        records: list[dict[str, Any]] = []
        for kaynak_klasor, field_name in SOURCE_FOLDER_FIELDS.items():
            folder_path = getattr(settings, field_name)
            if not folder_path:
                continue
            for source_file in sorted(_safe_mkdir(folder_path).iterdir()):
                if source_file.is_dir() or source_file.suffix.lower() not in ALLOWED_IMPORT_EXTENSIONS:
                    continue
                records.append(
                    self._ingest_source_file(
                        db,
                        source_file=source_file,
                        kaynak_klasor=kaynak_klasor,
                        force_duplicate=False,
                    )
                )
        return records

    def list_records(self, db: Session) -> list[dict[str, Any]]:
        rows = (
            db.query(OptiPlanWorkflowKayit)
            .order_by(OptiPlanWorkflowKayit.gelis_tarihi.desc(), OptiPlanWorkflowKayit.kayit_uuid.desc())
            .all()
        )
        return [self.serialize_record(row, include_details=False) for row in rows]

    def get_export_status_anomalies(
        self,
        db: Session,
        *,
        limit: int = 50,
        offset: int = 0,
        kayit_uuid: str | None = None,
        from_ts: str | None = None,
        to_ts: str | None = None,
    ) -> dict[str, Any]:
        normalized_limit = max(1, min(limit, 200))
        normalized_offset = max(0, offset)
        anomaly_field = "export_durum_anomali"

        from_dt = _parse_iso_datetime_filter(from_ts, "from")
        to_dt = _parse_iso_datetime_filter(to_ts, "to")
        if from_dt and to_dt and from_dt > to_dt:
            raise ValidationError("from parametresi to parametresinden buyuk olamaz")

        base_query = db.query(OptiPlanWorkflowAudit).filter(OptiPlanWorkflowAudit.alan_adi == anomaly_field)
        if kayit_uuid:
            base_query = base_query.filter(OptiPlanWorkflowAudit.kayit_uuid == kayit_uuid)
        if from_dt:
            base_query = base_query.filter(OptiPlanWorkflowAudit.created_at >= from_dt)
        if to_dt:
            base_query = base_query.filter(OptiPlanWorkflowAudit.created_at <= to_dt)

        total_records = base_query.count()
        distinct_records = (
            base_query.with_entities(func.count(func.distinct(OptiPlanWorkflowAudit.kayit_uuid))).scalar() or 0
        )
        status_breakdown_rows = (
            base_query.with_entities(OptiPlanWorkflowAudit.eski_deger, func.count(OptiPlanWorkflowAudit.id))
            .group_by(OptiPlanWorkflowAudit.eski_deger)
            .all()
        )
        status_breakdown = {str(status or "None"): int(count) for status, count in status_breakdown_rows}

        rows = (
            base_query.order_by(OptiPlanWorkflowAudit.created_at.desc(), OptiPlanWorkflowAudit.id.desc())
            .offset(normalized_offset)
            .limit(normalized_limit)
            .all()
        )

        return {
            "limit": normalized_limit,
            "offset": normalized_offset,
            "filters": {
                "kayit_uuid": kayit_uuid,
                "from": from_ts,
                "to": to_ts,
            },
            "summary": {
                "total_records": total_records,
                "distinct_records": int(distinct_records),
                "last_created_at": rows[0].created_at.isoformat() if rows else None,
                "status_breakdown": status_breakdown,
            },
            "items": [
                {
                    "id": row.id,
                    "kayit_uuid": row.kayit_uuid,
                    "alan_adi": row.alan_adi,
                    "eski_deger": row.eski_deger,
                    "yeni_deger": row.yeni_deger,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
                for row in rows
            ],
        }

    def get_record(self, db: Session, kayit_uuid: str) -> dict[str, Any]:
        return self.serialize_record(self._get_record_row(db, kayit_uuid), include_details=True)

    def get_export_file(self, db: Session, kayit_uuid: str, export_id: str, file_format: str) -> Path:
        normalized_format = (file_format or "").strip().lower()
        if normalized_format not in ALLOWED_EXPORT_FORMATS:
            allowed = ", ".join(sorted(ALLOWED_EXPORT_FORMATS))
            raise ValidationError(f"Export format yalnizca su degerleri alabilir: {allowed}")

        export_row = (
            db.query(OptiPlanWorkflowExport)
            .filter(
                OptiPlanWorkflowExport.id == export_id,
                OptiPlanWorkflowExport.kayit_uuid == kayit_uuid,
            )
            .first()
        )
        if not export_row:
            raise NotFoundError("OptiPlan export kaydi")

        generated_files = export_row.generated_dosyalar or []
        match = next(
            (
                item
                for item in generated_files
                if isinstance(item, dict) and (item.get("file_format") or "").strip().lower() == normalized_format
            ),
            None,
        )
        if not match:
            raise NotFoundError("OptiPlan export dosyasi")

        raw_path = str(match.get("file_path") or "").strip()
        if not raw_path:
            raise NotFoundError("OptiPlan export dosyasi")
        file_path = Path(raw_path)
        if not file_path.exists():
            raise NotFoundError("OptiPlan export dosyasi")
        return file_path

    def update_phase2(
        self,
        db: Session,
        kayit_uuid: str,
        *,
        rows: list[dict[str, Any]],
        metadata: dict[str, Any] | None = None,
        user_id: int | None = None,
    ) -> dict[str, Any]:
        record = self._get_record_row(db, kayit_uuid)
        metadata = metadata or {}
        for key in PHASE_2_METADATA_FIELDS:
            if key in metadata:
                setattr(record, key, metadata[key])

        rows_by_id = {row.id: row for row in record.satirlar}
        for payload in rows:
            normalized_payload = _normalize_phase2_row_payload(payload)
            row = rows_by_id.get(normalized_payload.get("id"))
            if not row:
                raise NotFoundError("OptiPlan satiri")
            for field_name in PHASE_2_FIELDS:
                if field_name in normalized_payload and getattr(row, field_name) != normalized_payload[field_name]:
                    db.add(
                        OptiPlanWorkflowAudit(
                            kayit_uuid=record.kayit_uuid,
                            satir_id=row.id,
                            alan_adi=field_name,
                            eski_deger=_stringify(getattr(row, field_name)),
                            yeni_deger=_stringify(normalized_payload[field_name]),
                            user_id=user_id,
                            islem_tipi="UPDATE",
                        )
                    )
                    setattr(row, field_name, normalized_payload[field_name])
            for score_field in PHASE_2_ROW_SCORE_KEYS:
                if normalized_payload.get(score_field) is not None:
                    setattr(row, score_field, normalized_payload[score_field])
            if normalized_payload.get("bbox_json") is not None:
                row.bbox_json = normalized_payload["bbox_json"]

        record.aktif_faz = 2
        record.dosya_durumu = "PHASE_2_OCR_KONTROL"
        db.commit()
        return self.serialize_record(record, include_details=True)

    def approve_phase2(self, db: Session, kayit_uuid: str, *, user_id: int | None = None) -> dict[str, Any]:
        record = self._get_record_row(db, kayit_uuid)
        if not record.satirlar:
            raise ValidationError("Phase 2 onayi icin en az bir satir gerekir")
        for row in record.satirlar:
            if any(getattr(row, field_name) in (None, "") for field_name in PHASE_2_FIELD_SEQUENCE):
                raise ValidationError("Phase 2 onayi icin 7 alanin tamami zorunludur")
            confidence = row.hucre_guven_skorlari or {}
            approved_fields = set((row.satir_guven_skor_ozeti or {}).get("onaylanan_hucreler") or [])
            for field_name in PHASE_2_GATE_FIELDS:
                score = _to_float(confidence.get(field_name))
                if score is None and field_name == "delik_1":
                    score = _to_float(confidence.get("delik"))
                if score is None:
                    continue
                if field_name in {"boy", "en", "adet"}:
                    onay_field = f"{field_name}_onay"
                    cell_approved = getattr(row, onay_field, "BEKLEMEDE") != "BEKLEMEDE"
                else:
                    cell_approved = field_name in approved_fields
                if score < 80 and not cell_approved:
                    raise ValidationError(
                        f"%80 alti hucreler operatör onayi olmadan bir sonraki faza gecemez "
                        f"(satir={row.satir_sirasi}, alan={field_name}, skor={score})"
                    )
        self._add_record_audit(
            db, record,
            alan_adi="phase_transition",
            eski_deger="PHASE_2_OCR_KONTROL",
            yeni_deger="PHASE_3_SIPARIS_DUZENLEME",
            user_id=user_id,
            islem_tipi="PHASE_TRANSITION",
        )
        record.aktif_faz = 3
        record.dosya_durumu = "PHASE_3_SIPARIS_DUZENLEME"
        db.commit()
        return self.serialize_record(record, include_details=True)

    def approve_phase2_cells(
        self,
        db: Session,
        kayit_uuid: str,
        *,
        approvals: list[dict[str, Any]],
        user_id: int | None = None,
    ) -> dict[str, Any]:
        record = self._get_record_row(db, kayit_uuid)
        rows_by_id = {row.id: row for row in record.satirlar}
        now = datetime.now(UTC)

        for item in approvals:
            satir_id = item["satir_id"]
            alan = item["alan"]
            aksiyon = item["aksiyon"]
            yeni_deger = item.get("yeni_deger")

            row = rows_by_id.get(satir_id)
            if not row:
                raise NotFoundError("OptiPlan satiri")

            onay_field = f"{alan}_onay"
            override_field = f"{alan}_operator_degeri"
            old_status = getattr(row, onay_field)

            if aksiyon == "ONAYLA":
                setattr(row, onay_field, "ONAYLANDI")
            elif aksiyon == "DUZELT":
                if yeni_deger is None:
                    raise ValidationError(f"Duzeltme icin yeni_deger zorunludur (alan={alan})")
                old_value = getattr(row, alan)
                setattr(row, alan, yeni_deger)
                setattr(row, override_field, yeni_deger)
                setattr(row, onay_field, "DUZELTILDI")
                self._add_record_audit(
                    db, record,
                    alan_adi=alan,
                    eski_deger=_stringify(old_value),
                    yeni_deger=_stringify(yeni_deger),
                    satir_id=satir_id,
                    user_id=user_id,
                    islem_tipi="APPROVE",
                )

            row.onaylayan_id = user_id
            row.onay_zamani = now

            if old_status != getattr(row, onay_field):
                self._add_record_audit(
                    db, record,
                    alan_adi=onay_field,
                    eski_deger=_stringify(old_status),
                    yeni_deger=_stringify(getattr(row, onay_field)),
                    satir_id=satir_id,
                    user_id=user_id,
                    islem_tipi="APPROVE",
                )

        db.commit()
        return self.serialize_record(record, include_details=True)

    def remove_phase2_row(self, db: Session, kayit_uuid: str, row_id: str) -> dict[str, Any]:
        record = self._get_record_row(db, kayit_uuid)
        row = next((item for item in record.satirlar if item.id == row_id), None)
        if not row:
            raise NotFoundError("OptiPlan satiri")
        removed_row_id = str(uuid4())
        db.add(
            OptiPlanWorkflowCikarilanSatir(
                id=removed_row_id,
                aktif_satir_id=row.id,
                kayit_uuid=record.kayit_uuid,
                satir_sirasi=row.satir_sirasi,
                malzeme=row.malzeme,
                boy=row.boy,
                en=row.en,
                adet=row.adet,
                grain=row.grain,
                bilgi=row.bilgi,
                u1=row.u1,
                u2=row.u2,
                k1=row.k1,
                k2=row.k2,
                delik_1=row.delik_1,
                delik_2=row.delik_2,
                satir_kaynagi=row.satir_kaynagi,
                plaka_ref=row.plaka_ref,
                bant_kalinligi_override=row.bant_kalinligi_override,
                hucre_guven_skorlari=row.hucre_guven_skorlari,
                satir_guven_skor_ozeti=row.satir_guven_skor_ozeti,
                boy_onay=row.boy_onay,
                en_onay=row.en_onay,
                adet_onay=row.adet_onay,
                boy_operator_degeri=row.boy_operator_degeri,
                en_operator_degeri=row.en_operator_degeri,
                adet_operator_degeri=row.adet_operator_degeri,
                onaylayan_id=row.onaylayan_id,
                onay_zamani=row.onay_zamani,
                bbox_json=row.bbox_json,
            )
        )
        self._add_record_audit(
            db,
            record,
            alan_adi="phase2_row_removed",
            eski_deger=_stringify(
                {
                    "row_id": row.id,
                    "satir_sirasi": row.satir_sirasi,
                    "malzeme": row.malzeme,
                }
            ),
            yeni_deger=_stringify({"removed_row_id": removed_row_id}),
            satir_id=row.id,
        )
        db.delete(row)
        db.commit()
        return self.serialize_record(record, include_details=True)

    def restore_phase2_row(self, db: Session, kayit_uuid: str, removed_row_id: str) -> dict[str, Any]:
        record = self._get_record_row(db, kayit_uuid)
        row = next((item for item in record.cikarilan_satirlar if item.id == removed_row_id), None)
        if not row:
            raise NotFoundError("Cikarilan OptiPlan satiri")
        restored_row_id = row.aktif_satir_id or str(uuid4())
        db.add(
            OptiPlanWorkflowSatir(
                id=restored_row_id,
                kayit_uuid=record.kayit_uuid,
                satir_sirasi=row.satir_sirasi,
                malzeme=row.malzeme,
                boy=row.boy,
                en=row.en,
                adet=row.adet,
                grain=row.grain,
                bilgi=row.bilgi,
                u1=row.u1,
                u2=row.u2,
                k1=row.k1,
                k2=row.k2,
                delik_1=row.delik_1,
                delik_2=row.delik_2,
                satir_kaynagi=row.satir_kaynagi,
                plaka_ref=row.plaka_ref,
                bant_kalinligi_override=row.bant_kalinligi_override,
                hucre_guven_skorlari=row.hucre_guven_skorlari,
                satir_guven_skor_ozeti=row.satir_guven_skor_ozeti,
                boy_onay=row.boy_onay,
                en_onay=row.en_onay,
                adet_onay=row.adet_onay,
                boy_operator_degeri=row.boy_operator_degeri,
                en_operator_degeri=row.en_operator_degeri,
                adet_operator_degeri=row.adet_operator_degeri,
                onaylayan_id=row.onaylayan_id,
                onay_zamani=row.onay_zamani,
                bbox_json=row.bbox_json,
            )
        )
        self._add_record_audit(
            db,
            record,
            alan_adi="phase2_row_restored",
            eski_deger=_stringify({"removed_row_id": row.id}),
            yeni_deger=_stringify({"row_id": restored_row_id, "satir_sirasi": row.satir_sirasi}),
            satir_id=restored_row_id,
        )
        db.delete(row)
        db.commit()
        return self.serialize_record(record, include_details=True)

    def update_phase3(self, db: Session, kayit_uuid: str, payload: dict[str, Any]) -> dict[str, Any]:
        record = self._get_record_row(db, kayit_uuid)
        for field_name in PHASE_3_MUTABLE_FIELDS:
            if field_name in payload:
                self._audit_if_changed(
                    db,
                    record,
                    alan_adi=field_name,
                    current_value=getattr(record, field_name),
                    new_value=payload[field_name],
                )
                setattr(record, field_name, payload[field_name])
        if "grain_varsayilan" in payload and payload["grain_varsayilan"] is not None:
            self._audit_if_changed(
                db,
                record,
                alan_adi="grain_varsayilan",
                current_value=record.grain_varsayilan,
                new_value=payload["grain_varsayilan"],
            )
            record.grain_varsayilan = payload["grain_varsayilan"]
        if "termin" in payload:
            parsed_termin = _parse_iso_date(payload["termin"])
            self._audit_if_changed(
                db,
                record,
                alan_adi="termin",
                current_value=record.termin,
                new_value=parsed_termin,
            )
            record.termin = parsed_termin
        if "teslim_tarihi" in payload:
            parsed_delivery_date = _parse_iso_date(payload["teslim_tarihi"])
            self._audit_if_changed(
                db,
                record,
                alan_adi="teslim_tarihi",
                current_value=record.teslim_tarihi,
                new_value=parsed_delivery_date,
            )
            record.teslim_tarihi = parsed_delivery_date
        if payload.get("plates") is not None:
            self._sync_record_plates(db, record, payload["plates"])

        if payload.get("rows") is not None:
            existing_rows = {row.id: row for row in record.satirlar}
            for index, row_payload in enumerate(payload["rows"], start=1):
                row = existing_rows.get(row_payload.get("id"))
                row_created = row is None
                if row is None:
                    row = OptiPlanWorkflowSatir(id=str(uuid4()), kayit_uuid=record.kayit_uuid)
                    db.add(row)
                normalized_row = _normalize_phase3_row_payload(
                    row_payload,
                    index=index,
                    default_grain=record.grain_varsayilan or 3,
                    current_source=row.satir_kaynagi,
                    current_scores=row.hucre_guven_skorlari,
                    current_summary=row.satir_guven_skor_ozeti,
                )
                if row_created:
                    self._add_record_audit(
                        db,
                        record,
                        alan_adi="phase3_row_created",
                        eski_deger=None,
                        yeni_deger=_stringify(
                            {
                                "row_id": row.id,
                                "satir_sirasi": normalized_row["satir_sirasi"],
                                "malzeme": normalized_row["malzeme"],
                            }
                        ),
                        satir_id=row.id,
                    )
                else:
                    for field_name in (
                        "satir_sirasi",
                        "malzeme",
                        "boy",
                        "en",
                        "adet",
                        "grain",
                        "bilgi",
                        *PHASE_3_ROW_BOOLEAN_FIELDS,
                        *(field_name for field_name, _ in PHASE_3_ROW_HOLE_FIELDS),
                        "satir_kaynagi",
                        "plaka_ref",
                        "bant_kalinligi_override",
                        "hucre_guven_skorlari",
                        "satir_guven_skor_ozeti",
                    ):
                        self._audit_if_changed(
                            db,
                            record,
                            alan_adi=f"phase3_row.{field_name}",
                            current_value=getattr(row, field_name),
                            new_value=normalized_row[field_name],
                            satir_id=row.id,
                        )
                row.satir_sirasi = normalized_row["satir_sirasi"]
                row.malzeme = normalized_row["malzeme"]
                row.boy = normalized_row["boy"]
                row.en = normalized_row["en"]
                row.adet = normalized_row["adet"]
                row.grain = normalized_row["grain"]
                row.bilgi = normalized_row["bilgi"]
                for field_name in PHASE_3_ROW_BOOLEAN_FIELDS:
                    setattr(row, field_name, normalized_row[field_name])
                for field_name, hole_label in PHASE_3_ROW_HOLE_FIELDS:
                    setattr(row, field_name, normalized_row[field_name])
                    _ensure_numeric_hole(getattr(row, field_name), hole_label)
                row.satir_kaynagi = normalized_row["satir_kaynagi"]
                row.plaka_ref = normalized_row["plaka_ref"]
                row.bant_kalinligi_override = normalized_row["bant_kalinligi_override"]
                row.hucre_guven_skorlari = normalized_row["hucre_guven_skorlari"]
                row.satir_guven_skor_ozeti = normalized_row["satir_guven_skor_ozeti"]
            db.flush()

        self._ensure_record_plate(db, record)
        self._validate_phase3_blockers(db, record)
        record.aktif_faz = 3
        record.dosya_durumu = "PHASE_3_SIPARIS_DUZENLEME"
        db.commit()
        return self.serialize_record(record, include_details=True)

    def export_preview(
        self,
        db: Session,
        kayit_uuid: str,
        *,
        xlsx_aktif_mi: bool | None = None,
        opj_aktif_mi: bool | None = None,
    ) -> dict[str, Any]:
        record = self._get_record_row(db, kayit_uuid)
        self._validate_phase3_blockers(db, record)
        settings = self.get_effective_folder_settings(db)
        xlsx_enabled = settings.xlsx_aktif_mi if xlsx_aktif_mi is None else xlsx_aktif_mi
        opj_enabled = settings.opj_aktif_mi if opj_aktif_mi is None else opj_aktif_mi
        requested_formats = self._resolve_requested_formats(
            xlsx_enabled,
            opj_enabled,
            require_selection=False,
        )
        dosya_adi, revizyon_no = self._resolve_export_filename(db, self._build_export_base_name(record))
        export_rows = [
            self._build_export_preview_row_payload(row)
            for row in self._build_merged_rows(record)
        ]
        self._validate_export_preview_rows_contract(export_rows)
        created_at = datetime.now(UTC).isoformat()
        opj_status, opj_message = self._build_preview_opj_state(opj_enabled)
        export_manifest = optiplan_export_service.build_manifest(
            kayit_uuid=record.kayit_uuid,
            export_id=None,
            dosya_adi=dosya_adi,
            revizyon_no=revizyon_no,
            retry_no=record.retry_no,
            requested_formats=requested_formats,
            generated_formats=[],
            row_count=len(export_rows),
            created_at=created_at,
            opj_profile=INTERIM_OPJ_WRITER_PROFILE if opj_enabled else None,
            opj_contract_state=INTERIM_OPJ_CONTRACT_STATE if opj_enabled else None,
        )
        return {
            "kayit_uuid": record.kayit_uuid,
            "dosya_adi": dosya_adi,
            "xlsx_aktif_mi": xlsx_enabled,
            "opj_aktif_mi": opj_enabled,
            "opj_status": opj_status,
            "opj_message": opj_message,
            "revizyon_no": revizyon_no,
            "satirlar": export_rows,
            "export_manifest": export_manifest,
        }

    def export_record(
        self,
        db: Session,
        kayit_uuid: str,
        *,
        xlsx_aktif_mi: bool | None = None,
        opj_aktif_mi: bool | None = None,
    ) -> dict[str, Any]:
        preview = self.export_preview(
            db,
            kayit_uuid,
            xlsx_aktif_mi=xlsx_aktif_mi,
            opj_aktif_mi=opj_aktif_mi,
        )
        record = self._get_record_row(db, kayit_uuid)
        self._validate_phase3_blockers(db, record)
        settings = self.get_effective_folder_settings(db)
        export_id = str(uuid4())
        created_at = datetime.now(UTC).isoformat()
        requested_formats = list(preview["export_manifest"]["requested_formats"])
        if not requested_formats:
            raise ValidationError("En az bir export formati secilmelidir")
        generated_files: list[str] = []
        generated_file_details: list[dict[str, Any]] = []
        generated_formats: list[str] = []
        format_errors: list[str] = []
        if preview["xlsx_aktif_mi"]:
            try:
                file_path = _safe_mkdir(settings.xlsx_cikti_klasoru) / f"{preview['dosya_adi']}.xlsx"
                artifact = optiplan_export_service.write_xlsx(
                    file_path=file_path,
                    rows=preview["satirlar"],
                    download_path=(
                        f"/api/v1/optiplan-workflow/records/{record.kayit_uuid}/exports/{export_id}/files/xlsx"
                    ),
                )
                generated_formats.append(artifact.file_format)
                generated_files.append(artifact.file_path)
                generated_file_details.append(artifact.to_dict())
            except Exception as exc:
                format_errors.append(f"xlsx:{exc}")

        if preview["opj_aktif_mi"]:
            try:
                opj_folder = str(settings.opj_cikti_klasoru)
                file_path = _safe_mkdir(opj_folder) / f"{preview['dosya_adi']}.opj"
                artifact = optiplan_export_service.write_interim_opj(
                    file_path=file_path,
                    rows=preview["satirlar"],
                    manifest=preview["export_manifest"],
                    download_path=(
                        f"/api/v1/optiplan-workflow/records/{record.kayit_uuid}/exports/{export_id}/files/opj"
                    ),
                )
                generated_formats.append(artifact.file_format)
                generated_files.append(artifact.file_path)
                generated_file_details.append(artifact.to_dict())
                opj_status = "URETILDI_GECICI_V1"
                opj_message = (
                    "Interim OPJ export uretildi. Canli kapsam Phase 4'te interim_opj_v1 profiliyle ilerler."
                )
            except Exception as exc:
                format_errors.append(f"opj:{exc}")
                opj_status = "HATA"
                opj_message = f"Interim OPJ export yazimi basarisiz oldu: {exc}"
        else:
            opj_status = preview["opj_status"]
            opj_message = preview.get("opj_message")

        if not validate_opj_status(opj_status):
            opj_status = "HATA"
            if not opj_message:
                opj_message = "OPJ durum degeri gecersiz oldugu icin hata durumuna cekildi"

        requested_format_count = len(requested_formats)
        generated_format_count = len(generated_formats)
        if requested_format_count > 0 and requested_format_count == generated_format_count:
            raw_durum = "BASARILI"
        elif requested_format_count > 0 and generated_format_count == 0:
            raw_durum = "HATALI"
        else:
            raw_durum = "KISMI_BASARILI"

        durum = raw_durum
        if not ExportContractRules.validate_export_status(raw_durum):
            self._add_record_audit(
                db,
                record,
                alan_adi="export_durum_anomali",
                eski_deger=raw_durum,
                yeni_deger=(
                    "fallback=HATALI"
                    f";requested_formats={requested_format_count}"
                    f";generated_formats={generated_format_count}"
                    f";xlsx_aktif_mi={preview['xlsx_aktif_mi']}"
                    f";opj_aktif_mi={preview['opj_aktif_mi']}"
                    f";opj_status={opj_status}"
                ),
            )
            durum = "HATALI"

        export_manifest = optiplan_export_service.build_manifest(
            kayit_uuid=record.kayit_uuid,
            export_id=export_id,
            dosya_adi=preview["dosya_adi"],
            revizyon_no=preview["revizyon_no"],
            retry_no=record.retry_no,
            requested_formats=requested_formats,
            generated_formats=generated_formats,
            row_count=len(preview["satirlar"]),
            created_at=created_at,
            opj_profile=INTERIM_OPJ_WRITER_PROFILE if preview["opj_aktif_mi"] else None,
            opj_contract_state=INTERIM_OPJ_CONTRACT_STATE if preview["opj_aktif_mi"] else None,
        )
        self._add_record_audit(
            db,
            record,
            alan_adi="export_durum",
            eski_deger=None,
            yeni_deger=(
                f"durum={durum}"
                f";requested_formats={requested_format_count}"
                f";generated_formats={generated_format_count}"
                f";xlsx_aktif_mi={preview['xlsx_aktif_mi']}"
                f";opj_aktif_mi={preview['opj_aktif_mi']}"
                f";opj_status={opj_status}"
                + (f";errors={'|'.join(format_errors)}" if format_errors else "")
            ),
        )

        export_row = OptiPlanWorkflowExport(
            id=export_id,
            kayit_uuid=record.kayit_uuid,
            dosya_adi=preview["dosya_adi"],
            xlsx_aktif_mi=preview["xlsx_aktif_mi"],
            requested_formats=requested_formats,
            generated_formats=generated_formats,
            generated_dosyalar=generated_file_details,
            durum=durum,
            export_manifest=export_manifest,
            manifest_version=ExportContractRules.MANIFEST_VERSION,
            retry_no=record.retry_no,
            revizyon_no=preview["revizyon_no"],
        )
        export_row.opj_aktif_mi = preview["opj_aktif_mi"]
        export_row.opj_status = opj_status
        export_row.opj_message = opj_message
        self._export_meta_overrides[export_id] = {
            "opj_aktif_mi": preview["opj_aktif_mi"],
            "opj_status": opj_status,
            "opj_message": opj_message,
        }
        db.add(export_row)
        record.revizyon_no = preview["revizyon_no"]
        record.aktif_faz = 4
        record.dosya_durumu = "PHASE_4_EXPORT_HAZIR"
        db.commit()
        db.refresh(export_row)
        return {
            **preview,
            "generated_files": generated_files,
            "generated_file_details": generated_file_details,
            "durum": durum,
            "opj_status": opj_status,
            "opj_message": opj_message,
            "export_manifest": export_manifest,
        }

    def _add_record_audit(
        self,
        db: Session,
        record: OptiPlanWorkflowKayit,
        *,
        alan_adi: str,
        eski_deger: str | None,
        yeni_deger: str | None,
        satir_id: str | None = None,
        user_id: int | None = None,
        islem_tipi: str | None = None,
    ) -> None:
        db.add(
            OptiPlanWorkflowAudit(
                kayit_uuid=record.kayit_uuid,
                satir_id=satir_id,
                alan_adi=alan_adi,
                eski_deger=eski_deger,
                yeni_deger=yeni_deger,
                user_id=user_id,
                islem_tipi=islem_tipi,
            )
        )

    def _audit_if_changed(
        self,
        db: Session,
        record: OptiPlanWorkflowKayit,
        *,
        alan_adi: str,
        current_value: Any,
        new_value: Any,
        satir_id: str | None = None,
        user_id: int | None = None,
        islem_tipi: str | None = None,
    ) -> None:
        if current_value == new_value:
            return
        self._add_record_audit(
            db,
            record,
            alan_adi=alan_adi,
            eski_deger=_stringify(current_value),
            yeni_deger=_stringify(new_value),
            satir_id=satir_id,
            user_id=user_id,
            islem_tipi=islem_tipi,
        )

    def mark_error(
        self,
        db: Session,
        kayit_uuid: str,
        *,
        hata_fazi: str,
        hata_nedeni: str,
        operator_notu: str | None = None,
    ) -> dict[str, Any]:
        record = self._get_record_row(db, kayit_uuid)
        settings = self.get_effective_folder_settings(db)
        if hata_nedeni == "Diger" and not operator_notu:
            raise ValidationError("Diger hata nedeni icin operator_notu zorunludur")
        if settings.hatali_klasoru and record.orijinal_dosya_yolu:
            current_path = Path(record.orijinal_dosya_yolu)
            if current_path.exists():
                error_target = _resolve_unique_path(_safe_mkdir(settings.hatali_klasoru), current_path.name)
                shutil.copy2(current_path, error_target)
                record.orijinal_dosya_yolu = str(error_target)
        db.add(
            OptiPlanWorkflowHata(
                id=str(uuid4()),
                kayit_uuid=record.kayit_uuid,
                cari_unvan=record.cari_unvan,
                siparis_no=record.siparis_no,
                ham_dosya_adi=record.ham_dosya_adi,
                kaynak_klasor=record.kaynak_klasor,
                hata_fazi=hata_fazi,
                hata_nedeni=hata_nedeni,
                operator_notu=operator_notu,
            )
        )
        record.dosya_durumu = "HATALI"
        db.commit()
        return self.serialize_record(record, include_details=True)

    def retry_record(self, db: Session, kayit_uuid: str) -> dict[str, Any]:
        record = self._get_record_row(db, kayit_uuid)
        settings = self.get_effective_folder_settings(db)
        if record.retry_no >= settings.yeniden_deneme_sayisi:
            raise BusinessRuleError("Maksimum yeniden deneme sayisina ulasildi")
        clone = OptiPlanWorkflowKayit(
            kayit_uuid=str(uuid4()),
            ham_dosya_adi=record.ham_dosya_adi,
            kaynak_klasor=record.kaynak_klasor,
            dosya_durumu="PHASE_1_OCR_HAVUZU",
            orijinal_dosya_yolu=record.orijinal_dosya_yolu,
            dosya_hash=record.dosya_hash,
            ocr_ham_json=record.ocr_ham_json,
            ayristirilmis_ocr_alanlari=record.ayristirilmis_ocr_alanlari,
            okunan_cari_unvan=record.okunan_cari_unvan,
            okunan_cari_telefon=record.okunan_cari_telefon,
            ai_guven_skoru_ozeti=record.ai_guven_skoru_ozeti,
            revizyon_adayi_uyarisi=record.revizyon_adayi_uyarisi,
            cari_unvan=record.cari_unvan,
            cari_kodu=record.cari_kodu,
            siparis_no=record.siparis_no,
            termin=record.termin,
            teslim_tarihi=record.teslim_tarihi,
            teslimat_adresi=record.teslimat_adresi,
            odeme_sekli=record.odeme_sekli,
            malzeme=record.malzeme,
            stok_kodu=record.stok_kodu,
            bant_kalinligi=record.bant_kalinligi,
            grain_varsayilan=record.grain_varsayilan,
            plaka_boy_mm=record.plaka_boy_mm,
            plaka_en_mm=record.plaka_en_mm,
            fire_aciklamasi=record.fire_aciklamasi,
            retry_no=record.retry_no + 1,
            revizyon_no=record.revizyon_no,
            aktif_faz=1,
        )
        db.add(clone)
        db.flush()
        for row in record.satirlar:
            db.add(
                OptiPlanWorkflowSatir(
                    id=str(uuid4()),
                    kayit_uuid=clone.kayit_uuid,
                    satir_sirasi=row.satir_sirasi,
                    malzeme=row.malzeme,
                    boy=row.boy,
                    en=row.en,
                    adet=row.adet,
                    grain=row.grain,
                    bilgi=row.bilgi,
                    u1=row.u1,
                    u2=row.u2,
                    k1=row.k1,
                    k2=row.k2,
                    delik_1=row.delik_1,
                    delik_2=row.delik_2,
                    satir_kaynagi=row.satir_kaynagi,
                    plaka_ref=row.plaka_ref,
                    bant_kalinligi_override=row.bant_kalinligi_override,
                    hucre_guven_skorlari=row.hucre_guven_skorlari,
                    satir_guven_skor_ozeti=row.satir_guven_skor_ozeti,
                )
            )
        for plate in record.plakalar:
            db.add(
                OptiPlanWorkflowPlaka(
                    id=str(uuid4()),
                    kayit_uuid=clone.kayit_uuid,
                    plaka_ref=plate.plaka_ref,
                    etiket=plate.etiket,
                    plaka_boy_mm=plate.plaka_boy_mm,
                    plaka_en_mm=plate.plaka_en_mm,
                    genel_listede_mi=plate.genel_listede_mi,
                )
            )
        db.commit()
        return self.serialize_record(clone, include_details=True)

    def search_customers(self, query: str) -> list[dict[str, Any]]:
        if not query.strip():
            return []
        rows = _read_mikro_rows(
            """
            SELECT TOP 20 CARI_KOD AS Cari_Kodu, CARI_UNVAN AS Cari_Unvan, TELEFON1 AS Telefon
            FROM CARI_HESAPLAR
            WHERE CARI_KOD LIKE ? OR CARI_UNVAN LIKE ? OR TELEFON1 LIKE ?
            ORDER BY CARI_UNVAN
            """,
            (f"%{query}%", f"%{query}%", f"%{query}%"),
        )
        return [
            {
                "Cari_Kodu": row.get("Cari_Kodu") or row.get("CARI_KOD"),
                "Cari_Unvan": row.get("Cari_Unvan") or row.get("CARI_UNVAN"),
                "Telefon": row.get("Telefon") or row.get("TELEFON1"),
            }
            for row in rows
        ]

    def search_stocks(self, query: str) -> list[dict[str, Any]]:
        if not query.strip():
            return []
        rows = _read_mikro_rows(
            """
            SELECT TOP 20 STOK_KOD AS Stok_Kodu, STOK_ISIM AS Stok_Adi
            FROM STOKLAR
            WHERE STOK_KOD LIKE ? OR STOK_ISIM LIKE ?
            ORDER BY STOK_ISIM
            """,
            (f"%{query}%", f"%{query}%"),
        )
        return [
            {
                "Stok_Kodu": row.get("Stok_Kodu") or row.get("STOK_KOD"),
                "Stok_Adi": row.get("Stok_Adi") or row.get("STOK_ISIM"),
            }
            for row in rows
        ]

    def serialize_folder_settings(self, row: OptiPlanFolderSetting) -> dict[str, Any]:
        settings = self._build_effective_folder_settings(row)
        return {
            "program_kok_klasoru": settings.program_kok_klasoru,
            "whatsapp_raw_klasoru": settings.whatsapp_raw_klasoru,
            "scanner_raw_klasoru": settings.scanner_raw_klasoru,
            "manuel_raw_klasoru": settings.manuel_raw_klasoru,
            "email_raw_klasoru": settings.email_raw_klasoru,
            "islenmis_klasoru": settings.islenmis_klasoru,
            "arsiv_klasoru": settings.arsiv_klasoru,
            "xml_okuma_klasoru": settings.xml_okuma_klasoru,
            "xlsx_cikti_klasoru": settings.xlsx_cikti_klasoru,
            "opj_cikti_klasoru": settings.opj_cikti_klasoru,
            "hatali_klasoru": settings.hatali_klasoru,
            "fis_evrak_no_formati": settings.fis_evrak_no_formati,
            "arsiv_zaman_damgasi_formati": settings.arsiv_zaman_damgasi_formati,
            "xlsx_aktif_mi": settings.xlsx_aktif_mi,
            "opj_aktif_mi": settings.opj_aktif_mi,
            "watcher_aktif_mi": settings.watcher_aktif_mi,
            "yeniden_deneme_sayisi": settings.yeniden_deneme_sayisi,
        }

    def serialize_record(self, row: OptiPlanWorkflowKayit, *, include_details: bool) -> dict[str, Any]:
        payload = {
            "kayit_uuid": row.kayit_uuid,
            "ham_dosya_adi": row.ham_dosya_adi,
            "kaynak_klasor": row.kaynak_klasor,
            "gelis_tarihi": row.gelis_tarihi.isoformat() if row.gelis_tarihi else None,
            "dosya_durumu": row.dosya_durumu,
            "orijinal_dosya_yolu": row.orijinal_dosya_yolu,
            "dosya_hash": row.dosya_hash,
            "ocr_ham_json": row.ocr_ham_json,
            "ayristirilmis_ocr_alanlari": row.ayristirilmis_ocr_alanlari,
            "okunan_cari_unvan": row.okunan_cari_unvan,
            "okunan_cari_telefon": row.okunan_cari_telefon,
            "ai_guven_skoru_ozeti": row.ai_guven_skoru_ozeti,
            "revizyon_adayi_uyarisi": row.revizyon_adayi_uyarisi,
            "cari_unvan": row.cari_unvan,
            "cari_kodu": row.cari_kodu,
            "siparis_no": row.siparis_no,
            "termin": row.termin.isoformat() if row.termin else None,
            "teslim_tarihi": (
                getattr(row, "teslim_tarihi", None).isoformat()
                if getattr(row, "teslim_tarihi", None)
                else None
            ),
            "teslimat_adresi": getattr(row, "teslimat_adresi", None),
            "odeme_sekli": getattr(row, "odeme_sekli", None),
            "malzeme": row.malzeme,
            "stok_kodu": row.stok_kodu,
            "bant_kalinligi": row.bant_kalinligi,
            "grain_varsayilan": row.grain_varsayilan,
            "plaka_boy_mm": row.plaka_boy_mm,
            "plaka_en_mm": row.plaka_en_mm,
            "fire_aciklamasi": row.fire_aciklamasi,
            "retry_no": row.retry_no,
            "revizyon_no": row.revizyon_no,
            "aktif_faz": row.aktif_faz,
            "dosya_boyutu": getattr(row, "dosya_boyutu", None),
            "isleme_kilidi": getattr(row, "isleme_kilidi", None),
            "kilid_zamani": (
                getattr(row, "kilid_zamani", None).isoformat()
                if getattr(row, "kilid_zamani", None)
                else None
            ),
            "son_deneme_zamani": (
                getattr(row, "son_deneme_zamani", None).isoformat()
                if getattr(row, "son_deneme_zamani", None)
                else None
            ),
            "sonraki_deneme_zamani": (
                getattr(row, "sonraki_deneme_zamani", None).isoformat()
                if getattr(row, "sonraki_deneme_zamani", None)
                else None
            ),
            "son_hata_mesaji": getattr(row, "son_hata_mesaji", None),
            "ocr_saglayici": getattr(row, "ocr_saglayici", None),
            "ocr_islem_suresi_ms": getattr(row, "ocr_islem_suresi_ms", None),
        }
        if not include_details:
            return payload
        payload["satirlar"] = [self._serialize_row(item) for item in row.satirlar]
        payload["cikarilan_satirlar"] = [self._serialize_removed_row(item) for item in row.cikarilan_satirlar]
        payload["audit_kayitlari"] = [self._serialize_audit(item) for item in row.audit_kayitlari]
        payload["plakalar"] = [self._serialize_plate(item) for item in row.plakalar]
        payload["export_kayitlari"] = [self._serialize_export(item) for item in row.export_kayitlari]
        payload["hata_kayitlari"] = [self._serialize_error(item) for item in row.hata_kayitlari]
        return payload

    def _serialize_row(self, row: OptiPlanWorkflowSatir) -> dict[str, Any]:
        return {
            "id": row.id,
            "satir_sirasi": row.satir_sirasi,
            "malzeme": row.malzeme,
            "boy": row.boy,
            "en": row.en,
            "adet": row.adet,
            "grain": row.grain,
            "bilgi": row.bilgi,
            "u1": row.u1,
            "u2": row.u2,
            "k1": row.k1,
            "k2": row.k2,
            "delik_1": row.delik_1,
            "delik_2": row.delik_2,
            "satir_kaynagi": row.satir_kaynagi,
            "plaka_ref": row.plaka_ref,
            "bant_kalinligi_override": row.bant_kalinligi_override,
            "hucre_guven_skorlari": row.hucre_guven_skorlari,
            "satir_guven_skor_ozeti": row.satir_guven_skor_ozeti,
            "dislandi_mi": row.dislandi_mi,
            "boy_onay": getattr(row, "boy_onay", None),
            "en_onay": getattr(row, "en_onay", None),
            "adet_onay": getattr(row, "adet_onay", None),
            "boy_operator_degeri": getattr(row, "boy_operator_degeri", None),
            "en_operator_degeri": getattr(row, "en_operator_degeri", None),
            "adet_operator_degeri": getattr(row, "adet_operator_degeri", None),
            "onaylayan_id": getattr(row, "onaylayan_id", None),
            "onay_zamani": (
                getattr(row, "onay_zamani", None).isoformat()
                if getattr(row, "onay_zamani", None)
                else None
            ),
            "bbox_json": getattr(row, "bbox_json", None),
        }

    def _serialize_removed_row(self, row: OptiPlanWorkflowCikarilanSatir) -> dict[str, Any]:
        return {
            "id": row.id,
            "aktif_satir_id": row.aktif_satir_id,
            "satir_sirasi": row.satir_sirasi,
            "malzeme": row.malzeme,
            "boy": row.boy,
            "en": row.en,
            "adet": row.adet,
            "grain": row.grain,
            "bilgi": row.bilgi,
            "u1": row.u1,
            "u2": row.u2,
            "k1": row.k1,
            "k2": row.k2,
            "delik_1": row.delik_1,
            "delik_2": row.delik_2,
            "satir_kaynagi": row.satir_kaynagi,
            "plaka_ref": row.plaka_ref,
            "bant_kalinligi_override": row.bant_kalinligi_override,
            "hucre_guven_skorlari": row.hucre_guven_skorlari,
            "satir_guven_skor_ozeti": row.satir_guven_skor_ozeti,
            "boy_onay": getattr(row, "boy_onay", None),
            "en_onay": getattr(row, "en_onay", None),
            "adet_onay": getattr(row, "adet_onay", None),
            "boy_operator_degeri": getattr(row, "boy_operator_degeri", None),
            "en_operator_degeri": getattr(row, "en_operator_degeri", None),
            "adet_operator_degeri": getattr(row, "adet_operator_degeri", None),
            "onaylayan_id": getattr(row, "onaylayan_id", None),
            "onay_zamani": (
                getattr(row, "onay_zamani", None).isoformat()
                if getattr(row, "onay_zamani", None)
                else None
            ),
            "bbox_json": getattr(row, "bbox_json", None),
        }

    def _serialize_audit(self, row: OptiPlanWorkflowAudit) -> dict[str, Any]:
        return {
            "id": row.id,
            "satir_id": row.satir_id,
            "alan_adi": row.alan_adi,
            "eski_deger": row.eski_deger,
            "yeni_deger": row.yeni_deger,
            "user_id": getattr(row, "user_id", None),
            "islem_tipi": getattr(row, "islem_tipi", None),
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }

    def _serialize_plate(self, row: OptiPlanWorkflowPlaka) -> dict[str, Any]:
        return {
            "id": row.id,
            "plaka_ref": row.plaka_ref,
            "etiket": row.etiket,
            "plaka_boy_mm": row.plaka_boy_mm,
            "plaka_en_mm": row.plaka_en_mm,
            "genel_listede_mi": row.genel_listede_mi,
        }

    def _serialize_export(self, row: OptiPlanWorkflowExport) -> dict[str, Any]:
        generated_dosyalar = row.generated_dosyalar or []
        opj_meta = self._export_meta_overrides.get(row.id, {})
        return {
            "id": row.id,
            "dosya_adi": row.dosya_adi,
            "xlsx_aktif_mi": row.xlsx_aktif_mi,
            "opj_aktif_mi": bool(getattr(row, "opj_aktif_mi", opj_meta.get("opj_aktif_mi", False))),
            "opj_status": getattr(row, "opj_status", opj_meta.get("opj_status", "PASIF")),
            "opj_message": getattr(row, "opj_message", opj_meta.get("opj_message")),
            "requested_formats": row.requested_formats or [],
            "generated_formats": row.generated_formats or [],
            "generated_dosyalar": generated_dosyalar,
            "generated_files": [
                item.get("file_path")
                for item in generated_dosyalar
                if isinstance(item, dict) and item.get("file_path")
            ],
            "durum": row.durum,
            "export_manifest": row.export_manifest,
            "manifest_version": row.manifest_version,
            "retry_no": row.retry_no,
            "revizyon_no": row.revizyon_no,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }

    def _serialize_error(self, row: OptiPlanWorkflowHata) -> dict[str, Any]:
        return {
            "id": row.id,
            "cari_unvan": row.cari_unvan,
            "siparis_no": row.siparis_no,
            "ham_dosya_adi": row.ham_dosya_adi,
            "kaynak_klasor": row.kaynak_klasor,
            "hata_fazi": row.hata_fazi,
            "hata_nedeni": row.hata_nedeni,
            "deneme_no": getattr(row, "deneme_no", None),
            "saglayici": getattr(row, "saglayici", None),
            "tarih_saat": row.tarih_saat.isoformat() if row.tarih_saat else None,
            "operator_notu": row.operator_notu,
        }

    def _get_record_row(self, db: Session, kayit_uuid: str) -> OptiPlanWorkflowKayit:
        row = db.query(OptiPlanWorkflowKayit).filter(OptiPlanWorkflowKayit.kayit_uuid == kayit_uuid).first()
        if not row:
            raise NotFoundError("OptiPlan workflow kaydi")
        return row

    def _validate_phase3_blockers(self, db: Session, record: OptiPlanWorkflowKayit) -> None:
        for field_name, error_message in PHASE_3_REQUIRED_RECORD_MESSAGES.items():
            value = getattr(record, field_name, None)
            if field_name in {"termin", "teslim_tarihi"}:
                if value is None:
                    raise ValidationError(error_message)
                continue
            if not (value or "").strip():
                raise ValidationError(error_message)
        rows = (
            db.query(OptiPlanWorkflowSatir)
            .filter(OptiPlanWorkflowSatir.kayit_uuid == record.kayit_uuid)
            .order_by(OptiPlanWorkflowSatir.satir_sirasi.asc())
            .all()
        )
        if not rows:
            raise ValidationError("En az bir aktif satir gereklidir")
        for index, row in enumerate(rows, start=1):
            for field_name in PHASE_3_ROW_REQUIRED_FIELDS:
                numeric_value = _to_float(getattr(row, field_name))
                if numeric_value is None or numeric_value <= 0:
                    label = PHASE_3_ROW_FIELD_LABELS[field_name]
                    raise ValidationError(f"Satir {index}: {label} zorunludur")
            _ensure_numeric_hole(row.delik_1, f"Satir {index} DELIK-1")
            _ensure_numeric_hole(row.delik_2, f"Satir {index} DELIK-2")

    def _extract_workflow_ocr_payload(
        self,
        *,
        file_name: str,
        content: bytes,
        kaynak_klasor: str,
    ) -> dict[str, Any]:
        """
        Görüntü/PDF bytes'inden OCR sonucu üretir.

        Pipeline:
          1. OpenCV preprocessing (kurulu ise, yoksa orijinal bytes)
          2. Gemini OCR (API key varsa)
          3. Gemini başarısızsa yerel simülasyon (geliştirme/fallback)
        """
        source_ext = Path(file_name).suffix.lower()
        document_kind = _detect_ocr_document_kind(file_name, content)

        # Adım 1: OpenCV preprocessing
        prep_result = preprocess_image(
            content,
            config=PreprocessConfig(
                grayscale=True,
                clahe_contrast=True,
                denoise=True,
                deskew=True,
                threshold=False,
            ),
            source_ext=source_ext,
        )
        enhanced_bytes = prep_result.enhanced_bytes

        # Adım 2: Gemini OCR
        if document_kind in {"image", "pdf"}:
            gemini_result = run_gemini_ocr(enhanced_bytes, source_ext=source_ext)
            if gemini_result is not None:
                payload = _ocr_to_payload(gemini_result)
                # preprocessing metadata'yı ham JSON'a ekle
                payload["ocr_ham_json"]["preprocessing"] = prep_result.to_metadata()
                payload["ocr_ham_json"]["ham_dosya_adi"] = file_name
                payload["ocr_ham_json"]["kaynak_klasor"] = kaynak_klasor
                payload["ocr_ham_json"]["document_kind"] = document_kind
                if payload["satirlar"]:
                    logger.info(
                        "Gemini OCR tamamlandı: %s — %d satır, latency=%dms",
                        file_name,
                        len(payload["satirlar"]),
                        gemini_result.latency_ms,
                    )
                    return payload
                logger.warning(
                    "Gemini OCR satır üretemedi, fallback devreye alınıyor: %s (parse_error=%s)",
                    file_name,
                    gemini_result.parse_error,
                )

        # Adım 3: Fallback — yerel simülasyon (Gemini yok veya başarısız)
        return self._simulated_ocr_payload(
            file_name=file_name,
            content=content,
            kaynak_klasor=kaynak_klasor,
            document_kind=document_kind,
            source_ext=source_ext,
            prep_metadata=prep_result.to_metadata(),
        )

    def _simulated_ocr_payload(
        self,
        *,
        file_name: str,
        content: bytes,
        kaynak_klasor: str,
        document_kind: str | None,
        source_ext: str,
        prep_metadata: dict[str, Any],
    ) -> dict[str, Any]:
        """Gemini kullanılamadığında yerel metin analizi ile OCR simüle eder."""
        ocr_text = None
        error_message = None
        engine_name = "simulated_local_ocr"
        fallback_reason = None
        local_ocr_text = None
        if document_kind in {"image", "pdf"}:
            local_ocr_text = _run_local_tesseract_ocr(
                content,
                source_ext=source_ext,
                document_kind=document_kind,
            )
            if local_ocr_text:
                ocr_text = local_ocr_text
                engine_name = "tesseract_cli"
            else:
                ocr_text = SIMULATED_WORKFLOW_OCR_TEXT
        else:
            error_message = "Dosya bytes'i desteklenen OCR girdisi olarak dogrulanamadi"

        lines = [line.strip() for line in (ocr_text or "").splitlines() if line.strip()]
        parsed_rows: list[dict[str, Any]] = []
        for index, line in enumerate(lines, start=1):
            parsed = _parse_measurement_line(line)
            if not parsed:
                continue
            confidence_scores = {
                "boy": 85.0,
                "en": 85.0,
                "adet": 85.0,
                "malzeme": 100.0,
                "grain": 100.0,
                "bilgi": 100.0,
                "delik_1": 100.0,
                "delik": 100.0,
            }
            parsed_rows.append(
                {
                    "satir_sirasi": len(parsed_rows) + 1,
                    "malzeme": None,
                    "boy": parsed["boy"],
                    "en": parsed["en"],
                    "adet": parsed["adet"],
                    "grain": 3,
                    "bilgi": None,
                    "u1": False,
                    "u2": False,
                    "k1": False,
                    "k2": False,
                    "delik_1": None,
                    "delik_2": None,
                    "satir_kaynagi": "OCR",
                    "hucre_guven_skorlari": confidence_scores,
                    "satir_guven_skor_ozeti": {
                        **_build_confidence_summary(confidence_scores),
                        "source_line": line,
                        "source_line_number": index,
                    },
                }
            )

        if engine_name == "tesseract_cli" and not parsed_rows:
            logger.warning(
                "Yerel Tesseract OCR satir uretmedi, simülasyon fallback devreye alınıyor: %s",
                file_name,
            )
            fallback_reason = "LOCAL_OCR_NO_STRUCTURED_ROWS"
            engine_name = "simulated_local_ocr"
            ocr_text = SIMULATED_WORKFLOW_OCR_TEXT
            lines = [line.strip() for line in ocr_text.splitlines() if line.strip()]
            parsed_rows = []
            for index, line in enumerate(lines, start=1):
                parsed = _parse_measurement_line(line)
                if not parsed:
                    continue
                confidence_scores = {
                    "boy": 85.0,
                    "en": 85.0,
                    "adet": 85.0,
                    "malzeme": 100.0,
                    "grain": 100.0,
                    "bilgi": 100.0,
                    "delik_1": 100.0,
                    "delik": 100.0,
                }
                parsed_rows.append(
                    {
                        "satir_sirasi": len(parsed_rows) + 1,
                        "malzeme": None,
                        "boy": parsed["boy"],
                        "en": parsed["en"],
                        "adet": parsed["adet"],
                        "grain": 3,
                        "bilgi": None,
                        "u1": False,
                        "u2": False,
                        "k1": False,
                        "k2": False,
                        "delik_1": None,
                        "delik_2": None,
                        "satir_kaynagi": "OCR",
                        "hucre_guven_skorlari": confidence_scores,
                        "satir_guven_skor_ozeti": {
                            **_build_confidence_summary(confidence_scores),
                            "source_line": line,
                            "source_line_number": index,
                        },
                    }
                )

        customer_name = None
        for line in lines:
            if line.upper().startswith("TEL:") or "ÖLÇÜ" in line.upper():
                continue
            if _parse_measurement_line(line):
                continue
            if MATERIAL_PATTERN.search(line):
                continue
            customer_name = line
            break

        material_name = _extract_material_name(lines)
        row_confidence_values = [
            float(row["satir_guven_skor_ozeti"]["min"])
            for row in parsed_rows
            if isinstance(row.get("satir_guven_skor_ozeti"), dict)
            and row["satir_guven_skor_ozeti"].get("min") is not None
        ]
        ai_summary = {
            "source": engine_name,
            "engine": engine_name,
            "line_count": len(parsed_rows),
            "avg_confidence": round(sum(row_confidence_values) / len(row_confidence_values), 2) if row_confidence_values else 0.0,
            "min_confidence": round(min(row_confidence_values), 2) if row_confidence_values else 0.0,
            "review_required": any(value < 80 for value in row_confidence_values),
        }
        return {
            "ocr_ham_json": {
                "status": "COMPLETED" if parsed_rows else "NO_ROWS",
                "engine": engine_name,
                "ham_dosya_adi": file_name,
                "kaynak_klasor": kaynak_klasor,
                "document_kind": document_kind,
                "extracted_text": ocr_text,
                "local_ocr_text": local_ocr_text,
                "fallback_reason": fallback_reason,
                "lines": lines,
                "error": error_message,
                "preprocessing": prep_metadata,
            },
            "ayristirilmis_ocr_alanlari": {
                "satirlar": parsed_rows,
                "okunan_cari_unvan": customer_name,
                "okunan_cari_telefon": _extract_phone_from_text(ocr_text or ""),
                "malzeme": material_name,
            },
            "okunan_cari_unvan": customer_name,
            "okunan_cari_telefon": _extract_phone_from_text(ocr_text or ""),
            "ai_guven_skoru_ozeti": ai_summary,
            "malzeme": material_name,
            "satirlar": parsed_rows,
        }

    def _ingest_source_file(
        self,
        db: Session,
        *,
        source_file: Path,
        kaynak_klasor: str,
        force_duplicate: bool,
    ) -> dict[str, Any]:
        settings = self.get_effective_folder_settings(db)
        source_hash = _file_hash(source_file)
        duplicate = db.query(OptiPlanWorkflowKayit).filter(OptiPlanWorkflowKayit.dosya_hash == source_hash).first()
        if duplicate and not force_duplicate:
            raise BusinessRuleError("Ayni dosya daha once islenmis")
        processing_target = _resolve_unique_path(_safe_mkdir(settings.islenmis_klasoru), source_file.name)
        shutil.move(str(source_file), processing_target)
        archive_target = _resolve_unique_path(_safe_mkdir(settings.arsiv_klasoru), processing_target.name)
        shutil.copy2(processing_target, archive_target)
        record = OptiPlanWorkflowKayit(
            kayit_uuid=str(uuid4()),
            ham_dosya_adi=processing_target.name,
            kaynak_klasor=kaynak_klasor,
            dosya_durumu="PHASE_1_OCR_HAVUZU",
            orijinal_dosya_yolu=str(archive_target),
            dosya_hash=source_hash,
            ocr_ham_json={"ham_dosya_adi": processing_target.name, "kaynak_klasor": kaynak_klasor},
            ayristirilmis_ocr_alanlari={"satirlar": []},
            aktif_faz=1,
        )
        db.add(record)
        db.flush()
        ocr_payload = self._extract_workflow_ocr_payload(
            file_name=processing_target.name,
            content=archive_target.read_bytes(),
            kaynak_klasor=kaynak_klasor,
        )
        record.ocr_ham_json = ocr_payload["ocr_ham_json"]
        record.ayristirilmis_ocr_alanlari = ocr_payload["ayristirilmis_ocr_alanlari"]
        record.okunan_cari_unvan = ocr_payload["okunan_cari_unvan"]
        record.okunan_cari_telefon = ocr_payload["okunan_cari_telefon"]
        record.ai_guven_skoru_ozeti = ocr_payload["ai_guven_skoru_ozeti"]
        if ocr_payload["malzeme"]:
            record.malzeme = ocr_payload["malzeme"]
        for row_payload in ocr_payload["satirlar"]:
            db.add(
                OptiPlanWorkflowSatir(
                    id=str(uuid4()),
                    kayit_uuid=record.kayit_uuid,
                    satir_sirasi=row_payload["satir_sirasi"],
                    malzeme=row_payload["malzeme"],
                    boy=row_payload["boy"],
                    en=row_payload["en"],
                    adet=row_payload["adet"],
                    grain=row_payload["grain"],
                    bilgi=row_payload["bilgi"],
                    u1=row_payload["u1"],
                    u2=row_payload["u2"],
                    k1=row_payload["k1"],
                    k2=row_payload["k2"],
                    delik_1=row_payload["delik_1"],
                    delik_2=row_payload["delik_2"],
                    satir_kaynagi=row_payload["satir_kaynagi"],
                    hucre_guven_skorlari=row_payload["hucre_guven_skorlari"],
                    satir_guven_skor_ozeti=row_payload["satir_guven_skor_ozeti"],
                )
            )
        self._ensure_record_plate(db, record)
        if ocr_payload["satirlar"]:
            record.aktif_faz = 2
            record.dosya_durumu = "PHASE_2_OCR_KONTROL"
            self._add_record_audit(
                db,
                record,
                alan_adi="ocr_ingest_completed",
                eski_deger=None,
                yeni_deger=_stringify(
                    {
                        "rows_created": len(ocr_payload["satirlar"]),
                        "engine": ocr_payload["ocr_ham_json"].get("engine"),
                    }
                ),
            )
        db.commit()
        db.refresh(record)
        try:
            processing_target.unlink(missing_ok=True)
        except TypeError:
            if processing_target.exists():
                processing_target.unlink()
        return self.serialize_record(record, include_details=True)

    def _ensure_record_plate(self, db: Session, record: OptiPlanWorkflowKayit) -> None:
        active_plate = next((plate for plate in record.plakalar if plate.kayit_uuid == record.kayit_uuid), None)
        if active_plate is None:
            plate_boy = record.plaka_boy_mm or DEFAULT_PLATE_LIBRARY[0]["plaka_boy_mm"]
            plate_en = record.plaka_en_mm or DEFAULT_PLATE_LIBRARY[0]["plaka_en_mm"]
            active_plate = OptiPlanWorkflowPlaka(
                id=str(uuid4()),
                kayit_uuid=record.kayit_uuid,
                plaka_ref="PLAKA-1",
                etiket=f"PLAKA-1 ({plate_boy}x{plate_en})",
                plaka_boy_mm=plate_boy,
                plaka_en_mm=plate_en,
                genel_listede_mi=False,
            )
            db.add(active_plate)
            db.flush()
        elif record.plaka_boy_mm and record.plaka_en_mm:
            active_plate.plaka_boy_mm = record.plaka_boy_mm
            active_plate.plaka_en_mm = record.plaka_en_mm
            active_plate.etiket = f"{active_plate.plaka_ref} ({record.plaka_boy_mm}x{record.plaka_en_mm})"
        if record.plaka_boy_mm is None:
            record.plaka_boy_mm = active_plate.plaka_boy_mm
        if record.plaka_en_mm is None:
            record.plaka_en_mm = active_plate.plaka_en_mm
        for row in record.satirlar:
            if not row.plaka_ref:
                row.plaka_ref = active_plate.plaka_ref

    def _sync_record_plates(
        self,
        db: Session,
        record: OptiPlanWorkflowKayit,
        plates: list[dict[str, Any]],
    ) -> None:
        existing_by_id = {plate.id: plate for plate in record.plakalar}
        existing_by_ref = {plate.plaka_ref: plate for plate in record.plakalar}
        retained_ids: set[str] = set()

        for index, payload in enumerate(plates, start=1):
            normalized_payload = _normalize_phase3_plate_payload(payload)
            plate = None
            payload_id = normalized_payload.get("id")
            if payload_id:
                plate = existing_by_id.get(payload_id)
            if plate is None and normalized_payload.get("plaka_ref"):
                plate = existing_by_ref.get(normalized_payload["plaka_ref"])
            if plate is None:
                plate = OptiPlanWorkflowPlaka(
                    id=str(uuid4()),
                    kayit_uuid=record.kayit_uuid,
                    plaka_ref=normalized_payload.get("plaka_ref") or f"PLAKA-{index}",
                    etiket="",
                    plaka_boy_mm=normalized_payload.get("plaka_boy_mm")
                    or record.plaka_boy_mm
                    or DEFAULT_PLATE_LIBRARY[0]["plaka_boy_mm"],
                    plaka_en_mm=normalized_payload.get("plaka_en_mm")
                    or record.plaka_en_mm
                    or DEFAULT_PLATE_LIBRARY[0]["plaka_en_mm"],
                    genel_listede_mi=bool(normalized_payload.get("genel_listede_mi")),
                )
                db.add(plate)
                db.flush()
            plate.plaka_ref = normalized_payload.get("plaka_ref") or plate.plaka_ref or f"PLAKA-{index}"
            plate.plaka_boy_mm = normalized_payload.get("plaka_boy_mm") or plate.plaka_boy_mm
            plate.plaka_en_mm = normalized_payload.get("plaka_en_mm") or plate.plaka_en_mm
            plate.genel_listede_mi = bool(normalized_payload.get("genel_listede_mi", plate.genel_listede_mi))
            plate.etiket = normalized_payload.get("etiket") or f"{plate.plaka_ref} ({plate.plaka_boy_mm}x{plate.plaka_en_mm})"
            retained_ids.add(plate.id)

        row_plate_refs = {row.plaka_ref for row in record.satirlar if row.plaka_ref}
        for plate in list(record.plakalar):
            if plate.id in retained_ids:
                continue
            if plate.plaka_ref in row_plate_refs:
                raise ValidationError("Plaka silinmeden once bagli satirlar tasinmali veya dislanmalidir")
            db.delete(plate)

    def _build_export_base_name(self, record: OptiPlanWorkflowKayit) -> str:
        musteri = _normalize_export_name(record.cari_unvan or "")
        malzeme = _normalize_export_name(record.malzeme or "")
        tarih = datetime.now(UTC).strftime("%d%m%Y")
        return "_".join(part for part in (musteri, malzeme, tarih) if part)

    def _resolve_export_filename(self, db: Session, base_name: str) -> tuple[str, int]:
        normalized_base = base_name or datetime.now(UTC).strftime("%d%m%Y")
        like_prefix = normalized_base.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        existing_names = [
            row[0]
            for row in db.query(OptiPlanWorkflowExport.dosya_adi)
            .filter(OptiPlanWorkflowExport.dosya_adi.like(f"{like_prefix}%", escape="\\"))
            .all()
        ]
        if not existing_names:
            return normalized_base, 1

        # Deterministik fallback: operator tarafindan "yeni ayri is" sinyali yoksa
        # ayni literal stem'i paylasan her export'u revizyon sayip _vN ekleriz.
        max_revision = 1
        for name in existing_names:
            if name == normalized_base:
                max_revision = max(max_revision, 1)
                continue
            suffix = name[len(normalized_base) :]
            if suffix.startswith("_v"):
                revision_text = suffix[2:].split("_", 1)[0]
                if revision_text.isdigit():
                    max_revision = max(max_revision, int(revision_text))
        next_revision = max_revision + 1
        return f"{normalized_base}_v{next_revision}", next_revision

    def _build_merged_rows(self, record: OptiPlanWorkflowKayit) -> list[dict[str, Any]]:
        if not record.cari_kodu:
            raise ValidationError("Cari_Kodu olmadan export hazirlanamaz")
        if not record.stok_kodu:
            raise ValidationError("Stok_Kodu olmadan export hazirlanamaz")
        if not record.satirlar:
            raise ValidationError("Export icin en az bir aktif satir gerekir")

        merged: dict[tuple[Any, ...], dict[str, Any]] = {}
        for row in sorted(record.satirlar, key=lambda item: (item.satir_sirasi, item.id)):
            self._validate_export_row(record, row)
            edge_source = row.bant_kalinligi_override or record.bant_kalinligi
            payload = {
                "plaka_ref": row.plaka_ref,
                "malzeme": row.malzeme or record.malzeme,
                "boy": row.boy,
                "en": row.en,
                "adet": row.adet,
                "grain": row.grain if row.grain is not None else (record.grain_varsayilan or 3),
                "bilgi": row.bilgi,
                "u1": self._edge_value(row.u1, edge_source),
                "u2": self._edge_value(row.u2, edge_source),
                "k1": self._edge_value(row.k1, edge_source),
                "k2": self._edge_value(row.k2, edge_source),
                "delik_1": row.delik_1,
                "delik_2": row.delik_2,
                "bant_kalinligi_override": row.bant_kalinligi_override,
            }
            merge_key = (
                payload["plaka_ref"],
                payload["boy"],
                payload["en"],
                payload["u1"],
                payload["u2"],
                payload["k1"],
                payload["k2"],
                payload["bant_kalinligi_override"],
                payload["bilgi"],
                payload["delik_1"],
                payload["delik_2"],
            )
            existing = merged.get(merge_key)
            if existing is None:
                merged[merge_key] = payload
                continue
            if existing["malzeme"] != payload["malzeme"] or existing["grain"] != payload["grain"]:
                raise ValidationError("Satir birlestirme sonucu Malzeme veya GRAIN degeri belirsiz kaldi")
            existing["adet"] += payload["adet"] or 0
        return list(merged.values())

    def _validate_export_row(self, record: OptiPlanWorkflowKayit, row: OptiPlanWorkflowSatir) -> None:
        if not (row.malzeme or record.malzeme):
            raise ValidationError("Export icin Malzeme zorunludur")
        if row.boy is None or row.en is None or row.adet is None:
            raise ValidationError("Export icin BOY, EN ve ADET zorunludur")
        grain_value = row.grain if row.grain is not None else record.grain_varsayilan
        if grain_value not in OPTIPLAN_ALLOWED_GRAIN_VALUES:
            raise ValidationError("GRAIN degeri 0, 1, 2 veya 3 olmalidir")
        _ensure_numeric_hole(row.delik_1, "DELIK-1")
        _ensure_numeric_hole(row.delik_2, "DELIK-2")
        if row.u1 or row.u2 or row.k1 or row.k2:
            edge_source = row.bant_kalinligi_override or record.bant_kalinligi
            if edge_source not in BANT_EXPORT_MAP:
                raise ValidationError("Bant_Kalinligi export icin zorunludur")

    def _build_export_preview_row_payload(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "[P_CODE_MAT]": row["malzeme"],
            "[P_LENGTH]": row["boy"],
            "[P_WIDTH]": row["en"],
            "[P_MINQ]": row["adet"],
            "[P_GRAIN]": row["grain"],
            "[P_IDESC]": row["bilgi"] or "",
            "[P_EDGE_MAT_UP]": row["u1"],
            "[P_EGDE_MAT_LO]": row["u2"],
            "[P_EDGE_MAT_SX]": row["k1"],
            "[P_EDGE_MAT_DX]": row["k2"],
            "[P_IIDESC]": row["delik_1"] or "",
            "[P_DESC1]": row["delik_2"] or "",
        }

    def _validate_export_preview_rows_contract(self, rows: list[dict[str, Any]]) -> None:
        """Validates export rows against unified contract rules."""
        for index, row in enumerate(rows, start=1):
            # Verify column order matches contract
            if list(row.keys()) != EXPORT_COLUMNS:
                raise ValidationError(f"Export satir {index} kolon sozlesmesine uymuyor")

            # Verify P_CODE_MAT is non-empty string
            if not isinstance(row["[P_CODE_MAT]"], str) or not row["[P_CODE_MAT]"].strip():
                raise ValidationError(f"Export satir {index} [P_CODE_MAT] zorunludur")

            # Verify P_IDESC is string type
            if not isinstance(row["[P_IDESC]"], str):
                raise ValidationError(f"Export satir {index} [P_IDESC] metin olmalidir")

            # Verify numeric-bounded fields
            for field_name in ExportContractRules.NUMERIC_BOUNDED_FIELDS:
                value = row[field_name]
                if not ExportContractRules.validate_numeric_bounded(value, field_name):
                    raise ValidationError(
                        f"Export satir {index} {field_name} en az 1 olmalidir"
                    )

            # Verify grain is in allowed set
            grain_value = row["[P_GRAIN]"]
            if not ExportContractRules.validate_grain(grain_value):
                raise ValidationError(f"Export satir {index} [P_GRAIN] degeri gecersiz")

            # Verify edge codes are all valid
            for edge_field in ExportContractRules.EDGE_FIELDS:
                edge_value = row[edge_field]
                if not ExportContractRules.validate_edge_code(edge_value):
                    raise ValidationError(
                        f"Export satir {index} {edge_field} degeri gecersiz: {edge_value}"
                    )

            # Verify hole fields contain only digits or are empty
            for hole_field in ExportContractRules.HOLE_FIELDS:
                hole_value = row[hole_field]
                if not ExportContractRules.validate_hole_field(hole_value, hole_field):
                    raise ValidationError(
                        f"Export satir {index} {hole_field} yalnizca rakam olmalidir"
                    )

    def _edge_value(self, enabled: bool, bant_value: str | None) -> str:
        if not enabled:
            return ""
        if bant_value not in BANT_EXPORT_MAP:
            raise ValidationError("Bant_Kalinligi export sozlugunde bulunamadi")
        return BANT_EXPORT_MAP[bant_value]

    def _resolve_requested_formats(
        self,
        xlsx_enabled: bool,
        opj_enabled: bool = False,
        *,
        require_selection: bool = True,
    ) -> list[str]:
        requested_formats: list[str] = []
        if xlsx_enabled:
            requested_formats.append("xlsx")
        if opj_enabled:
            requested_formats.append("opj")
        if require_selection and not requested_formats:
            raise ValidationError("En az bir export formati secilmelidir")
        return requested_formats

    def _build_preview_opj_state(self, opj_enabled: bool) -> tuple[str, str | None]:
        if not opj_enabled:
            return "PASIF", None
        return (
            "HAZIR_GECICI_V1",
            "Export onizlemesi interim_opj_v1 OPJ profiline hazir. Canli kapsam Phase 4'te bu profilin uretimini esas alir.",
        )


optiplan_workflow_service = OptiPlanWorkflowService()







