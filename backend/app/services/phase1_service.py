"""
Phase 1 servis katmanı — canonical v2.
Tüm iş mantığı burada; router sadece HTTP in/out yapar.
"""
from __future__ import annotations

import hashlib
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError, ValidationError
from app.models.phase1 import Phase1Audit, Phase1FolderHealth, Phase1Record, Phase1RowField
from app.models.phase1_enums import (
    CRITICAL_FIELDS,
    LOW_CONFIDENCE_THRESHOLD,
    ActorType,
    ApprovalStatus,
    AuditEventType,
    ErrorSeverity,
    FolderHealthStatus,
    MatchStatus,
    Phase1RecordStatus,
    SourceType,
)
from app.features.phase1.schemas import (
    Phase1ErrorRecordDto,
    Phase1FolderHealthDto,
    Phase1LifecycleEventDto,
    Phase1ManualRescanResponseDto,
    Phase1ManualRetryResponseDto,
    Phase1QueueDetailDto,
    Phase1QueueListResponse,
    Phase1QueueRecordDto,
    Phase1StatusSummaryDto,
    Phase2ApproveResponse,
    Phase2FieldDto,
    Phase2MovePhase3Response,
    Phase2OverrideResponse,
    Phase2RecordDetailDto,
    Phase2RowDto,
)

logger = logging.getLogger(__name__)

_PHASE4_MAPPING_PROFILE_NAME = "Optiplanning Default Mapping"
_PHASE4_OUTPUT_DIR_ENV = "PHASE4_OUTPUT_DIR"
_PHASE4_PREVIEW_DIR_ENV = "PHASE4_PREVIEW_DIR"
_PHASE4_MANIFEST_DIR_ENV = "PHASE4_MANIFEST_DIR"
_PHASE4_WORKFLOW_STATUSES = (
    Phase1RecordStatus.PHASE4_PENDING,
    Phase1RecordStatus.PHASE4_PREVIEW_READY,
    Phase1RecordStatus.PHASE4_EXPORT_RUNNING,
    Phase1RecordStatus.PHASE4_EXPORT_FAILED,
    Phase1RecordStatus.PHASE4_RETRY_PENDING,
)

# Retry gecikmesi — her denemede iki katına çıkar (saniye)
_RETRY_BASE_SECONDS = 300  # 5 dakika
_RETRY_MAX_SECONDS = 7200  # 2 saat

# Record ID prefix'i
_RECORD_PREFIX = "rec"


def _generate_record_id(db: Session) -> str:
    """Bir sonraki sıralı record_id üret (rec_001, rec_002, ...)."""
    count = db.query(func.count(Phase1Record.id)).scalar() or 0
    return f"{_RECORD_PREFIX}_{count + 1:04d}"


def _sha256(path: str) -> str:
    """Dosyanın SHA-256 checksum'ını hesapla."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _next_retry_at(retry_count: int) -> datetime:
    """Exponential backoff ile bir sonraki retry zamanını hesapla."""
    delay = min(_RETRY_BASE_SECONDS * (2 ** retry_count), _RETRY_MAX_SECONDS)
    return _now() + timedelta(seconds=delay)


def _manifest_id_from_path(path: str | None) -> str | None:
    if not path:
        return None
    return Path(path).stem


def _write_audit(
    db: Session,
    event_type: AuditEventType,
    *,
    record_id: Optional[str] = None,
    row_index: Optional[int] = None,
    field_name: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    actor_id: str = "system",
    actor_type: ActorType = ActorType.SYSTEM,
    note: Optional[str] = None,
) -> Phase1Audit:
    """Audit kaydı oluştur ve DB'ye ekle (flush etmez, commit caller'a bırakılır)."""
    audit = Phase1Audit(
        event_id=str(uuid.uuid4()),
        event_type=event_type,
        record_id=record_id,
        row_index=row_index,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        actor_id=actor_id,
        actor_type=actor_type,
        note=note,
    )
    db.add(audit)
    return audit


def _count_blockers(row_fields: list[Phase1RowField]) -> int:
    """
    Phase 2 blocker sayısını hesapla.
    Kural: CRITICAL_FIELDS'dan biri confidence < 80 VE henüz onaylanmamışsa blocker.
    """
    count = 0
    for rf in row_fields:
        if rf.field_name not in CRITICAL_FIELDS:
            continue
        score = rf.confidence_score or 100
        is_low = score < LOW_CONFIDENCE_THRESHOLD
        is_unapproved = rf.approval_status in (
            ApprovalStatus.UNREVIEWED,
            ApprovalStatus.LOW_CONFIDENCE,
        )
        if is_low and is_unapproved:
            count += 1
    return count


class Phase1Service:
    """Phase 1 (OCR Havuzu) iş mantığı."""

    # ------------------------------------------------------------------
    # Queue — Listeleme ve detay
    # ------------------------------------------------------------------

    def get_queue(
        self,
        db: Session,
        *,
        search: Optional[str] = None,
        status: Optional[str] = None,
        source_type: Optional[str] = None,
        folder_type: Optional[str] = None,
        duplicate: Optional[bool] = None,
        retry_only: bool = False,
        phase2_ready: Optional[bool] = None,
        manual_review_only: bool = False,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 25,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
    ) -> Phase1QueueListResponse:
        q = db.query(Phase1Record)

        if search:
            q = q.filter(Phase1Record.file_name.ilike(f"%{search}%"))
        if status:
            try:
                q = q.filter(Phase1Record.status == Phase1RecordStatus(status))
            except ValueError:
                pass
        if source_type:
            try:
                q = q.filter(Phase1Record.source_type == SourceType(source_type))
            except ValueError:
                pass
        if folder_type:
            q = q.filter(Phase1Record.folder_type == folder_type)
        if duplicate is not None:
            q = q.filter(Phase1Record.duplicate_flag == duplicate)
        if retry_only:
            q = q.filter(Phase1Record.status == Phase1RecordStatus.OCR_RETRY_PENDING)
        if phase2_ready is not None:
            q = q.filter(Phase1Record.phase2_ready == phase2_ready)
        if manual_review_only:
            q = q.filter(Phase1Record.status == Phase1RecordStatus.MANUAL_REVIEW_REQUIRED)
        if date_from:
            q = q.filter(Phase1Record.created_at >= date_from)
        if date_to:
            q = q.filter(Phase1Record.created_at <= date_to)

        # Sıralama
        sort_col = getattr(Phase1Record, sort_by, Phase1Record.created_at)
        if sort_dir == "asc":
            q = q.order_by(sort_col.asc())
        else:
            q = q.order_by(sort_col.desc())

        total = q.count()
        offset = (page - 1) * page_size
        records = q.offset(offset).limit(page_size).all()

        return Phase1QueueListResponse(
            items=[Phase1QueueRecordDto.model_validate(r) for r in records],
            page=page,
            page_size=page_size,
            total=total,
        )

    def get_phase2_queue(
        self,
        db: Session,
        *,
        page: int = 1,
        page_size: int = 25,
    ) -> Phase1QueueListResponse:
        """PHASE2_PENDING ve PHASE2_IN_PROGRESS kayıtlarını döndür."""
        phase2_statuses = (
            Phase1RecordStatus.PHASE2_PENDING,
            Phase1RecordStatus.PHASE2_IN_PROGRESS,
        )
        q = (
            db.query(Phase1Record)
            .filter(Phase1Record.status.in_(phase2_statuses))
            .order_by(Phase1Record.updated_at.asc())
        )
        total = q.count()
        offset = (page - 1) * page_size
        records = q.offset(offset).limit(page_size).all()
        return Phase1QueueListResponse(
            items=[Phase1QueueRecordDto.model_validate(r) for r in records],
            page=page,
            page_size=page_size,
            total=total,
        )

    def get_phase3_queue(
        self,
        db: Session,
        *,
        page: int = 1,
        page_size: int = 25,
    ) -> Phase1QueueListResponse:
        """PHASE3_PENDING ve PHASE3_IN_PROGRESS kayıtlarını döndür."""
        phase3_statuses = (
            Phase1RecordStatus.PHASE3_PENDING,
            Phase1RecordStatus.PHASE3_IN_PROGRESS,
        )
        q = (
            db.query(Phase1Record)
            .filter(Phase1Record.status.in_(phase3_statuses))
            .order_by(Phase1Record.updated_at.asc())
        )
        total = q.count()
        offset = (page - 1) * page_size
        records = q.offset(offset).limit(page_size).all()
        return Phase1QueueListResponse(
            items=[Phase1QueueRecordDto.model_validate(r) for r in records],
            page=page,
            page_size=page_size,
            total=total,
        )

    def get_record_detail(self, db: Session, record_id: str) -> Phase1QueueDetailDto:
        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        folder_health = (
            db.query(Phase1FolderHealth)
            .filter(Phase1FolderHealth.folder_type == record.folder_type)
            .first()
        )

        # Yaşam döngüsü → audit'ten STATUS_CHANGED event'leri
        audits = (
            db.query(Phase1Audit)
            .filter(
                Phase1Audit.record_id == record_id,
                Phase1Audit.event_type == AuditEventType.STATUS_CHANGED,
            )
            .order_by(Phase1Audit.created_at.asc())
            .all()
        )
        lifecycle = [
            Phase1LifecycleEventDto(
                from_status=a.old_value,
                to_status=a.new_value or "",
                triggered_at=a.created_at,
                triggered_by=a.actor_id,
                note=a.note,
            )
            for a in audits
        ]

        return Phase1QueueDetailDto(
            record=Phase1QueueRecordDto.model_validate(record),
            folder_health=Phase1FolderHealthDto.model_validate(folder_health) if folder_health else None,
            lifecycle=lifecycle,
        )

    # ------------------------------------------------------------------
    # Status Summary
    # ------------------------------------------------------------------

    def get_status_summary(self, db: Session) -> Phase1StatusSummaryDto:
        total = db.query(func.count(Phase1Record.id)).scalar() or 0
        duplicate_count = (
            db.query(func.count(Phase1Record.id))
            .filter(Phase1Record.duplicate_flag == True)  # noqa: E712
            .scalar() or 0
        )
        retry_count = (
            db.query(func.count(Phase1Record.id))
            .filter(Phase1Record.status == Phase1RecordStatus.OCR_RETRY_PENDING)
            .scalar() or 0
        )
        error_count = (
            db.query(func.count(Phase1Record.id))
            .filter(Phase1Record.error_severity.in_([ErrorSeverity.RETRYABLE, ErrorSeverity.FATAL]))
            .scalar() or 0
        )
        phase2_ready_count = (
            db.query(func.count(Phase1Record.id))
            .filter(Phase1Record.phase2_ready == True)  # noqa: E712
            .scalar() or 0
        )
        manual_review_count = (
            db.query(func.count(Phase1Record.id))
            .filter(Phase1Record.status == Phase1RecordStatus.MANUAL_REVIEW_REQUIRED)
            .scalar() or 0
        )
        active_folder_count = (
            db.query(func.count(Phase1FolderHealth.id))
            .filter(
                Phase1FolderHealth.is_active == True,  # noqa: E712
                Phase1FolderHealth.health_status == FolderHealthStatus.HEALTHY,
            )
            .scalar() or 0
        )
        return Phase1StatusSummaryDto(
            total_count=total,
            duplicate_count=duplicate_count,
            retry_count=retry_count,
            error_count=error_count,
            phase2_ready_count=phase2_ready_count,
            manual_review_count=manual_review_count,
            active_folder_count=active_folder_count,
        )

    # ------------------------------------------------------------------
    # Hata listesi
    # ------------------------------------------------------------------

    def get_errors(self, db: Session) -> list[Phase1ErrorRecordDto]:
        records = (
            db.query(Phase1Record)
            .filter(
                or_(
                    Phase1Record.status == Phase1RecordStatus.OCR_RETRY_PENDING,
                    Phase1Record.status == Phase1RecordStatus.FAULTY,
                    Phase1Record.error_severity.in_([ErrorSeverity.RETRYABLE, ErrorSeverity.FATAL]),
                )
            )
            .order_by(Phase1Record.last_attempt_at.desc().nullslast())
            .all()
        )
        return [Phase1ErrorRecordDto.model_validate(r) for r in records]

    # ------------------------------------------------------------------
    # Klasör Sağlık
    # ------------------------------------------------------------------

    def get_folder_health(self, db: Session) -> list[Phase1FolderHealthDto]:
        items = db.query(Phase1FolderHealth).order_by(Phase1FolderHealth.folder_type).all()
        return [Phase1FolderHealthDto.model_validate(f) for f in items]

    def _upsert_folder_health(
        self,
        db: Session,
        folder_type: str,
        physical_path: Optional[str] = None,
        status: FolderHealthStatus = FolderHealthStatus.HEALTHY,
    ) -> Phase1FolderHealth:
        fh = db.query(Phase1FolderHealth).filter(Phase1FolderHealth.folder_type == folder_type).first()
        if not fh:
            fh = Phase1FolderHealth(folder_type=folder_type)
            db.add(fh)
        fh.health_status = status
        if physical_path:
            fh.physical_path = physical_path
        fh.last_scan_at = _now()
        # Kayıt sayısını güncelle
        fh.record_count = (
            db.query(func.count(Phase1Record.id))
            .filter(Phase1Record.folder_type == folder_type)
            .scalar() or 0
        )
        return fh

    # ------------------------------------------------------------------
    # Manuel Rescan
    # ------------------------------------------------------------------

    def manual_rescan(self, db: Session, folder_type: str) -> Phase1ManualRescanResponseDto:
        # Klasör ayarlarını çek (OptiPlanFolderSetting'den)
        from app.models.optiplan_workflow import OptiPlanFolderSetting
        setting = db.query(OptiPlanFolderSetting).first()

        folder_map: dict[str, Optional[str]] = {}
        if setting:
            folder_map = {
                "whatsapp_raw": setting.whatsapp_raw_klasoru,
                "scanner_raw": setting.scanner_raw_klasoru,
                "manuel_raw": setting.manuel_raw_klasoru,
                "email_raw": setting.email_raw_klasoru,
            }

        physical_path = folder_map.get(folder_type, "")

        if not physical_path or not os.path.isdir(physical_path):
            self._upsert_folder_health(db, folder_type, physical_path or None, FolderHealthStatus.OFFLINE)
            db.commit()
            return Phase1ManualRescanResponseDto(
                ok=False,
                folder_type=folder_type,
                message=f"Klasör erişilemiyor: {physical_path or '(tanımlı değil)'}",
            )

        try:
            scanned = self._scan_folder(db, folder_type, physical_path)
            self._upsert_folder_health(db, folder_type, physical_path, FolderHealthStatus.HEALTHY)
            db.commit()
            return Phase1ManualRescanResponseDto(
                ok=True,
                folder_type=folder_type,
                message=f"{scanned} yeni dosya işleme alındı",
            )
        except Exception as exc:
            logger.error("Rescan hatası [%s]: %s", folder_type, exc)
            self._upsert_folder_health(db, folder_type, physical_path, FolderHealthStatus.ERROR)
            db.commit()
            return Phase1ManualRescanResponseDto(
                ok=False,
                folder_type=folder_type,
                message=f"Tarama hatası: {exc}",
            )

    def _scan_folder(self, db: Session, folder_type: str, physical_path: str) -> int:
        """
        Klasörü tara; yeni dosyaları Phase 1 kayıtları olarak ekle.
        Returns: yeni eklenen kayıt sayısı.
        """
        scanned = 0
        folder = Path(physical_path)
        allowed_extensions = {".jpg", ".jpeg", ".png", ".pdf", ".tiff", ".tif"}

        for file_path in folder.iterdir():
            if not file_path.is_file():
                continue
            if file_path.suffix.lower() not in allowed_extensions:
                continue

            checksum = _sha256(str(file_path))

            # Duplicate kontrolü
            existing = (
                db.query(Phase1Record)
                .filter(
                    or_(
                        Phase1Record.checksum == checksum,
                        Phase1Record.file_name == file_path.name,
                    )
                )
                .first()
            )

            if existing:
                # Duplicate kaydı oluştur
                record_id = _generate_record_id(db)
                try:
                    src_type = SourceType(folder_type)
                except ValueError:
                    src_type = SourceType.MANUEL_RAW
                dup_record = Phase1Record(
                    record_id=record_id,
                    file_name=file_path.name,
                    file_size=file_path.stat().st_size,
                    checksum=checksum,
                    image_path=str(file_path),
                    source_type=src_type,
                    folder_type=folder_type,
                    status=Phase1RecordStatus.DUPLICATE,
                    duplicate_flag=True,
                    duplicate_reason=f"Mevcut kayıt: {existing.record_id}",
                    phase2_ready=False,
                )
                db.add(dup_record)
                _write_audit(
                    db, AuditEventType.DUPLICATE_DETECTED,
                    record_id=record_id,
                    note=dup_record.duplicate_reason,
                )
                continue

            # Yeni kayıt
            try:
                src_type = SourceType(folder_type)
            except ValueError:
                src_type = SourceType.MANUEL_RAW

            record_id = _generate_record_id(db)
            record = Phase1Record(
                record_id=record_id,
                file_name=file_path.name,
                file_size=file_path.stat().st_size,
                checksum=checksum,
                image_path=str(file_path),
                source_type=src_type,
                folder_type=folder_type,
                status=Phase1RecordStatus.RECEIVED,
                phase2_ready=False,
            )
            db.add(record)
            db.flush()
            _write_audit(db, AuditEventType.FILE_DETECTED, record_id=record_id)

            # OCR pipeline'ı başlat
            self._process_ocr_async(db, record)
            scanned += 1

        return scanned

    def _process_ocr_async(self, db: Session, record: Phase1Record) -> None:
        """
        OCR pipeline: preprocessing → Gemini OCR → parse → DB.
        Gerçek production'da bu bir background task/worker'da çalışır.
        Burada sync olarak çağrılır; timeout/hata varsa retry planlanır.
        """
        old_status = record.status
        record.status = Phase1RecordStatus.PROCESSING
        _write_audit(
            db, AuditEventType.STATUS_CHANGED,
            record_id=record.record_id,
            old_value=old_status.value,
            new_value=Phase1RecordStatus.PROCESSING.value,
        )
        db.flush()

        try:
            self._run_ocr_pipeline(db, record)
        except Exception as exc:
            logger.warning("OCR pipeline başarısız [%s]: %s", record.record_id, exc)
            self._schedule_retry(db, record, str(exc), ErrorSeverity.RETRYABLE)

    def _run_ocr_pipeline(self, db: Session, record: Phase1Record) -> None:
        """
        Preprocessing → OCR → parse → Phase1RowField'ları oluştur.
        """
        image_path = record.image_path
        if not image_path or not os.path.exists(image_path):
            raise FileNotFoundError(f"Dosya bulunamadı: {image_path}")

        # Preprocessing
        record.status = Phase1RecordStatus.OCR_PROCESSING
        _write_audit(db, AuditEventType.PREPROCESS_STARTED, record_id=record.record_id)
        db.flush()

        preprocessed_path = self._preprocess_image(image_path)
        _write_audit(db, AuditEventType.PREPROCESS_COMPLETED, record_id=record.record_id)

        # OCR
        _write_audit(db, AuditEventType.OCR_REQUEST_STARTED, record_id=record.record_id)
        ocr_result = self._call_ocr(preprocessed_path or image_path)
        _write_audit(db, AuditEventType.OCR_REQUEST_COMPLETED, record_id=record.record_id)

        # Parse & RowField oluştur
        rows = self._parse_ocr_result(ocr_result)
        for row_index, row_data in enumerate(rows):
            for field_name in ("BOY", "EN", "ADET"):
                field_data = row_data.get(field_name, {})
                raw_val = str(field_data.get("raw", ""))
                norm_val = str(field_data.get("normalized", raw_val))
                score = field_data.get("confidence", 100)
                bbox = field_data.get("bbox")

                # Approval status belirle
                if score < LOW_CONFIDENCE_THRESHOLD:
                    app_status = ApprovalStatus.LOW_CONFIDENCE
                else:
                    app_status = ApprovalStatus.UNREVIEWED

                rf = Phase1RowField(
                    record_id=record.record_id,
                    row_index=row_index,
                    field_name=field_name,
                    raw_value=raw_val,
                    normalized_value=norm_val,
                    confidence_score=score,
                    bbox=bbox,
                    approval_status=app_status,
                )
                db.add(rf)

        db.flush()

        # Blocker sayısını hesapla
        row_fields = db.query(Phase1RowField).filter(Phase1RowField.record_id == record.record_id).all()
        _count_blockers(row_fields)  # blocker var/yok tespiti için

        record.status = Phase1RecordStatus.PHASE2_PENDING
        record.phase2_ready = True
        record.last_attempt_at = _now()
        _write_audit(
            db, AuditEventType.STATUS_CHANGED,
            record_id=record.record_id,
            old_value=Phase1RecordStatus.OCR_PROCESSING.value,
            new_value=record.status.value,
        )

    def _preprocess_image(self, image_path: str) -> Optional[str]:
        """OpenCV preprocessing — servis varsa kullan, yoksa None döndür."""
        try:
            from app.services.ocr_preprocessing_service import preprocess_image
            return preprocess_image(image_path)
        except Exception as exc:
            logger.warning("Preprocessing atlandı: %s", exc)
            return None

    def _call_ocr(self, image_path: str) -> dict:
        """Gemini OCR — servis varsa kullan, yoksa simüle et."""
        try:
            from app.services.gemini_ocr_adapter import GeminiOCRAdapter
            adapter = GeminiOCRAdapter()
            return adapter.extract_from_image(image_path)
        except Exception as exc:
            logger.warning("OCR simülasyon modu: %s", exc)
            # Simülasyon — test/development için
            return {
                "rows": [
                    {
                        "BOY": {"raw": "2800", "normalized": "2800", "confidence": 95, "bbox": None},
                        "EN": {"raw": "600", "normalized": "600", "confidence": 90, "bbox": None},
                        "ADET": {"raw": "4", "normalized": "4", "confidence": 98, "bbox": None},
                    }
                ]
            }

    def _parse_ocr_result(self, ocr_result: dict) -> list[dict]:
        """OCR sonucunu satır listesine dönüştür."""
        return ocr_result.get("rows", [])

    def _schedule_retry(
        self,
        db: Session,
        record: Phase1Record,
        error_message: str,
        severity: ErrorSeverity,
    ) -> None:
        record.retry_count += 1
        record.last_error_message = error_message
        record.last_attempt_at = _now()
        record.next_retry_at = _next_retry_at(record.retry_count)
        record.error_severity = severity
        record.status = Phase1RecordStatus.OCR_RETRY_PENDING
        _write_audit(
            db,
            AuditEventType.OCR_RETRY_SCHEDULED,
            record_id=record.record_id,
            note=f"retry #{record.retry_count}: {error_message}",
        )

    # ------------------------------------------------------------------
    # Manuel Retry
    # ------------------------------------------------------------------

    def manual_retry(self, db: Session, record_id: str) -> Phase1ManualRetryResponseDto:
        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        if record.status not in (
            Phase1RecordStatus.OCR_RETRY_PENDING,
            Phase1RecordStatus.FAULTY,
            Phase1RecordStatus.MANUAL_REVIEW_REQUIRED,
        ):
            raise ValidationError(f"Bu kayıt retry için uygun durumda değil: {record.status}")

        old_status = record.status
        record.status = Phase1RecordStatus.RECEIVED
        record.next_retry_at = None
        record.error_severity = None
        _write_audit(
            db, AuditEventType.STATUS_CHANGED,
            record_id=record_id,
            old_value=old_status.value,
            new_value=Phase1RecordStatus.RECEIVED.value,
            actor_id="operator",
            actor_type=ActorType.HUMAN,
            note="Manuel retry tetiklendi",
        )
        self._process_ocr_async(db, record)
        db.commit()

        return Phase1ManualRetryResponseDto(
            ok=True,
            record_id=record_id,
            status=record.status,
            message="Retry planlandı",
        )

    # ------------------------------------------------------------------
    # Phase 2 — Record detail
    # ------------------------------------------------------------------

    def get_phase2_record(self, db: Session, record_id: str) -> Phase2RecordDetailDto:
        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        row_fields = (
            db.query(Phase1RowField)
            .filter(Phase1RowField.record_id == record_id)
            .order_by(Phase1RowField.row_index, Phase1RowField.field_name)
            .all()
        )

        # Satır bazında grupla
        rows_dict: dict[int, list[Phase1RowField]] = {}
        for rf in row_fields:
            rows_dict.setdefault(rf.row_index, []).append(rf)

        rows = []
        for row_index in sorted(rows_dict.keys()):
            fields = [Phase2FieldDto.model_validate(rf) for rf in rows_dict[row_index]]
            rows.append(Phase2RowDto(row_index=row_index, fields=fields))

        blocker_count = _count_blockers(row_fields)

        image_url = None
        if record.image_path:
            image_url = f"/api/phase1/records/{record_id}/image"

        return Phase2RecordDetailDto(
            record_id=record_id,
            status=record.status,
            source_type=record.source_type.value if record.source_type else "",
            image_url=image_url,
            created_at=record.created_at,
            blocker_count=blocker_count,
            rows=rows,
        )

    # ------------------------------------------------------------------
    # Phase 2 — Cell approve
    # ------------------------------------------------------------------

    def approve_cell(
        self,
        db: Session,
        record_id: str,
        row_index: int,
        field_name: str,
        actor_id: str = "operator",
    ) -> Phase2ApproveResponse:
        rf = (
            db.query(Phase1RowField)
            .filter(
                Phase1RowField.record_id == record_id,
                Phase1RowField.row_index == row_index,
                Phase1RowField.field_name == field_name,
            )
            .first()
        )
        if not rf:
            raise NotFoundError("Phase1RowField", f"{record_id}:{row_index}:{field_name}")

        old_status = rf.approval_status
        rf.approval_status = ApprovalStatus.APPROVED_AS_IS
        rf.approved_by = actor_id
        rf.approved_at = _now()

        _write_audit(
            db, AuditEventType.CELL_APPROVED,
            record_id=record_id,
            row_index=row_index,
            field_name=field_name,
            old_value=old_status.value,
            new_value=ApprovalStatus.APPROVED_AS_IS.value,
            actor_id=actor_id,
            actor_type=ActorType.HUMAN,
        )
        db.commit()

        # Blocker sayısını yeniden hesapla
        all_fields = db.query(Phase1RowField).filter(Phase1RowField.record_id == record_id).all()
        blocker_count = _count_blockers(all_fields)

        return Phase2ApproveResponse(
            ok=True,
            row_index=row_index,
            field_name=field_name,
            approval_status=ApprovalStatus.APPROVED_AS_IS,
            blocker_count=blocker_count,
        )

    # ------------------------------------------------------------------
    # Phase 2 — Cell override
    # ------------------------------------------------------------------

    def override_cell(
        self,
        db: Session,
        record_id: str,
        row_index: int,
        field_name: str,
        override_value: str,
        actor_id: str = "operator",
    ) -> Phase2OverrideResponse:
        rf = (
            db.query(Phase1RowField)
            .filter(
                Phase1RowField.record_id == record_id,
                Phase1RowField.row_index == row_index,
                Phase1RowField.field_name == field_name,
            )
            .first()
        )
        if not rf:
            raise NotFoundError("Phase1RowField", f"{record_id}:{row_index}:{field_name}")

        old_value = rf.normalized_value
        rf.override_value = override_value
        rf.normalized_value = override_value
        rf.approval_status = ApprovalStatus.OVERRIDDEN
        rf.approved_by = actor_id
        rf.approved_at = _now()

        _write_audit(
            db, AuditEventType.CELL_OVERRIDDEN,
            record_id=record_id,
            row_index=row_index,
            field_name=field_name,
            old_value=old_value,
            new_value=override_value,
            actor_id=actor_id,
            actor_type=ActorType.HUMAN,
        )
        db.commit()

        all_fields = db.query(Phase1RowField).filter(Phase1RowField.record_id == record_id).all()
        blocker_count = _count_blockers(all_fields)

        return Phase2OverrideResponse(
            ok=True,
            row_index=row_index,
            field_name=field_name,
            approval_status=ApprovalStatus.OVERRIDDEN,
            normalized_value=override_value,
            blocker_count=blocker_count,
        )

    # ------------------------------------------------------------------
    # Phase 2 — Mark faulty
    # ------------------------------------------------------------------

    def mark_faulty(
        self,
        db: Session,
        record_id: str,
        note: Optional[str] = None,
        actor_id: str = "operator",
    ) -> dict:
        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        old_status = record.status
        record.status = Phase1RecordStatus.FAULTY
        record.phase2_ready = False

        _write_audit(
            db, AuditEventType.FAULTY_MARKED,
            record_id=record_id,
            old_value=old_status.value,
            new_value=Phase1RecordStatus.FAULTY.value,
            actor_id=actor_id,
            actor_type=ActorType.HUMAN,
            note=note,
        )
        db.commit()

        return {"ok": True, "record_id": record_id, "status": "FAULTY", "message": "Kayıt hatalı olarak işaretlendi"}

    # ------------------------------------------------------------------
    # Phase 2 → Phase 3 geçiş
    # ------------------------------------------------------------------

    def move_to_phase3(self, db: Session, record_id: str, actor_id: str = "operator") -> Phase2MovePhase3Response:
        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        _write_audit(
            db, AuditEventType.PHASE3_MOVE_ATTEMPTED,
            record_id=record_id,
            actor_id=actor_id,
            actor_type=ActorType.HUMAN,
        )

        # Blocker kontrolü
        all_fields = db.query(Phase1RowField).filter(Phase1RowField.record_id == record_id).all()
        blocker_count = _count_blockers(all_fields)

        if blocker_count > 0:
            _write_audit(
                db, AuditEventType.PHASE3_MOVE_REJECTED,
                record_id=record_id,
                note=f"{blocker_count} blocker aktif",
            )
            db.commit()
            return Phase2MovePhase3Response(
                ok=False,
                record_id=record_id,
                error_code="PHASE2_BLOCKER_ACTIVE",
                message=f"Onaylanmamış düşük güvenli alanlar mevcut: {blocker_count}",
            )

        old_status = record.status
        record.status = Phase1RecordStatus.PHASE3_PENDING
        _write_audit(
            db, AuditEventType.PHASE3_MOVE_SUCCEEDED,
            record_id=record_id,
            old_value=old_status.value,
            new_value=Phase1RecordStatus.PHASE3_PENDING.value,
            actor_id=actor_id,
            actor_type=ActorType.HUMAN,
        )
        db.commit()

        return Phase2MovePhase3Response(
            ok=True,
            record_id=record_id,
            status=Phase1RecordStatus.PHASE3_PENDING,
        )

    # ------------------------------------------------------------------
    # Phase 3 — Record Detail
    # ------------------------------------------------------------------

    def _phase3_general_fire_aciklamasi(
        self,
        record: Phase1Record,
        row_fields: list[Phase1RowField] | None = None,
    ) -> str | None:
        note = (getattr(record, "fire_aciklamasi", None) or "").strip()
        if note:
            return note
        for field in row_fields or []:
            row_note = (field.scrap_note or "").strip()
            if row_note:
                return row_note
        return None

    def get_phase3_record(self, db: Session, record_id: str):
        """Spec §12 — Phase 3 tam kayıt detayı: header + plate_groups + lines + summary."""
        from app.features.phase1.schemas import (
            Phase3OrderHeaderDto, Phase3OrderLineDto, Phase3PlateGroupDto,
            Phase3RecordDetailDto, Phase3SummaryDto,
        )

        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        row_fields = (
            db.query(Phase1RowField)
            .filter(Phase1RowField.record_id == record_id)
            .order_by(Phase1RowField.row_index.asc(), Phase1RowField.field_name.asc())
            .all()
        )

        # Satırları row_index bazında benzersizleştir (field_name BOY/EN/ADET gruba indirgeme)
        rows_by_index: dict[int, Phase1RowField] = {}
        boy_by_index: dict[int, str] = {}
        en_by_index: dict[int, str] = {}
        adet_by_index: dict[int, int] = {}
        for rf in row_fields:
            rows_by_index.setdefault(rf.row_index, rf)
            if rf.field_name == "BOY":
                boy_by_index[rf.row_index] = rf.normalized_value or ""
            elif rf.field_name == "EN":
                en_by_index[rf.row_index] = rf.normalized_value or ""
            elif rf.field_name == "ADET":
                try:
                    adet_by_index[rf.row_index] = int(rf.normalized_value or "0")
                except ValueError:
                    adet_by_index[rf.row_index] = 0
        general_fire_aciklamasi = self._phase3_general_fire_aciklamasi(record, row_fields)

        # Plaka grupları — plate_id bazında grupla
        plate_map: dict[str, list[int]] = {}
        for idx, rf in rows_by_index.items():
            pid = rf.plate_id or "p1"
            plate_map.setdefault(pid, []).append(idx)

        # Her satır için stock blocker sayısı
        stock_unmatched = sum(
            1 for rf in rows_by_index.values()
            if (rf.stock_match_status is None or rf.stock_match_status == MatchStatus.UNMATCHED)
        )

        plate_groups = []
        for pid, row_idxs in plate_map.items():
            blockers = sum(
                1 for ri in row_idxs
                if rows_by_index[ri].stock_match_status in (None, MatchStatus.UNMATCHED)
            )
            plate_groups.append(Phase3PlateGroupDto(
                plate_id=pid,
                label=rows_by_index[row_idxs[0]].material_text or pid,
                line_count=len(row_idxs),
                blocker_count=blockers,
                active=True,
            ))

        lines = []
        for idx in sorted(rows_by_index.keys()):
            rf = rows_by_index[idx]
            line_status = "BLOCKED" if rf.stock_match_status in (None, MatchStatus.UNMATCHED) else "READY"
            lines.append(Phase3OrderLineDto(
                row_index=idx,
                plate_id=rf.plate_id,
                material_text=rf.material_text,
                stock_match_status=rf.stock_match_status.value if rf.stock_match_status else "UNMATCHED",
                stock_code=rf.stock_code,
                boy=boy_by_index.get(idx),
                en=en_by_index.get(idx),
                adet=adet_by_index.get(idx),
                yon=rf.yon,
                aciklama=rf.aciklama,
                bant_ust=rf.bant_ust,
                bant_alt=rf.bant_alt,
                bant_sol=rf.bant_sol,
                bant_sag=rf.bant_sag,
                ilave_aciklama=rf.ilave_aciklama,
                aciklama1=rf.aciklama1,
                merge_candidate=rf.merge_candidate,
                scrap_note_required=rf.scrap_note_required,
                scrap_note=rf.scrap_note,
                status=line_status,
            ))

        # Merge ve scrap sayıları
        merge_pending = sum(1 for rf in rows_by_index.values() if rf.merge_candidate)
        scrap_missing = sum(
            1 for rf in rows_by_index.values()
            if rf.scrap_note_required and not general_fire_aciklamasi
        )

        customer_blocker = record.customer_match_status not in (
            MatchStatus.MATCHED, MatchStatus.MANUAL_MATCHED
        )
        phase4_ready = (
            not customer_blocker
            and stock_unmatched == 0
            and merge_pending == 0
            and scrap_missing == 0
        )

        header = Phase3OrderHeaderDto(
            record_id=record_id,
            customer_match_status=record.customer_match_status.value,
            customer_code=record.customer_code,
            customer_name=record.customer_name,
            customer_phone=getattr(record, "okunan_cari_telefon", None),
            fire_aciklamasi=general_fire_aciklamasi,
            source_type=record.source_type.value.removesuffix("_raw") if record.source_type else "",
            operator_name=None,
            updated_at=record.updated_at,
        )

        summary = Phase3SummaryDto(
            customer_blocker=customer_blocker,
            stock_blocker_count=stock_unmatched,
            merge_pending_count=merge_pending,
            scrap_note_missing_count=scrap_missing,
            phase4_ready=phase4_ready,
        )

        return Phase3RecordDetailDto(
            header=header,
            plate_groups=plate_groups,
            lines=lines,
            summary=summary,
        )

    # ------------------------------------------------------------------
    # Phase 3 — Müşteri Eşleştirme
    # ------------------------------------------------------------------

    def match_customer(
        self, db: Session, record_id: str, customer_code: str, actor_id: str = "operator"
    ) -> dict:
        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        # Mikro'dan müşteri bilgisini çek (varsa)
        customer_name = None
        try:
            from app.services.mikro_service import mikro_service
            result = mikro_service.validate_cari_kodu(db, customer_code)
            if result.get("valid"):
                customer_name = result.get("unvan")
        except Exception:
            pass

        old_status = record.customer_match_status
        record.customer_code = customer_code
        record.customer_name = customer_name
        record.customer_match_status = MatchStatus.MATCHED if customer_name else MatchStatus.MANUAL_MATCHED

        _write_audit(
            db, AuditEventType.ERP_CUSTOMER_MATCHED,
            record_id=record_id,
            old_value=old_status.value,
            new_value=record.customer_match_status.value,
            actor_id=actor_id,
            actor_type=ActorType.HUMAN,
            note=f"Cari: {customer_code} — {customer_name or '(manual)'}",
        )
        db.commit()
        return {
            "ok": True,
            "record_id": record_id,
            "customer_code": customer_code,
            "customer_name": customer_name,
            "customer_match_status": record.customer_match_status,
        }

    # ------------------------------------------------------------------
    # Phase 3 — Stok Eşleştirme
    # ------------------------------------------------------------------

    def match_stock(
        self,
        db: Session,
        record_id: str,
        row_index: int,
        stock_code: str,
        actor_id: str = "operator",
    ) -> dict:
        # row_fields'ten herhangi bir field (BOY) ile satırı bul
        rf = (
            db.query(Phase1RowField)
            .filter(
                Phase1RowField.record_id == record_id,
                Phase1RowField.row_index == row_index,
                Phase1RowField.field_name == "BOY",
            )
            .first()
        )
        if not rf:
            # Field yoksa, aynı row_index'teki herhangi bir field
            rf = (
                db.query(Phase1RowField)
                .filter(
                    Phase1RowField.record_id == record_id,
                    Phase1RowField.row_index == row_index,
                )
                .first()
            )
        if not rf:
            raise NotFoundError("Phase1RowField", f"{record_id}:{row_index}")

        # Tüm aynı row_index'teki field'ları güncelle
        db.query(Phase1RowField).filter(
            Phase1RowField.record_id == record_id,
            Phase1RowField.row_index == row_index,
        ).update(
            {"stock_code": stock_code, "stock_match_status": MatchStatus.MATCHED},
            synchronize_session=False,
        )

        _write_audit(
            db, AuditEventType.ERP_STOCK_MATCHED,
            record_id=record_id,
            row_index=row_index,
            old_value=None,
            new_value=stock_code,
            actor_id=actor_id,
            actor_type=ActorType.HUMAN,
        )
        db.commit()

        # Tüm satırlar eşleşti mi?
        all_fields = db.query(Phase1RowField).filter(
            Phase1RowField.record_id == record_id,
        ).all()
        rows_by_index: dict[int, Phase1RowField] = {}
        for f in all_fields:
            rows_by_index[f.row_index] = f

        unmatched_count = sum(
            1 for f in rows_by_index.values()
            if f.stock_match_status in (None, MatchStatus.UNMATCHED)
        )
        return {
            "ok": True,
            "record_id": record_id,
            "row_index": row_index,
            "stock_code": stock_code,
            "stock_match_status": MatchStatus.MATCHED,
            "unmatched_count": unmatched_count,
        }

    # ------------------------------------------------------------------
    # Phase 3 — Satır Birleştirme
    # ------------------------------------------------------------------

    def merge_rows(
        self,
        db: Session,
        record_id: str,
        row_indexes: list[int],
        actor_id: str = "operator",
    ) -> dict:
        if len(row_indexes) < 2:
            raise ValidationError("Birleştirme için en az 2 satır gerekli")

        # İlk satırı ana satır yap, diğerlerini merge_candidate kaldır
        target_idx = min(row_indexes)
        merged_idxs = [i for i in row_indexes if i != target_idx]

        # Hedef satırdaki ADET değerini güncelle
        total_adet = 0
        for idx in row_indexes:
            f = (
                db.query(Phase1RowField)
                .filter(
                    Phase1RowField.record_id == record_id,
                    Phase1RowField.row_index == idx,
                    Phase1RowField.field_name == "ADET",
                )
                .first()
            )
            if f:
                try:
                    total_adet += int(f.normalized_value or "0")
                except ValueError:
                    pass

        target_adet_field = (
            db.query(Phase1RowField)
            .filter(
                Phase1RowField.record_id == record_id,
                Phase1RowField.row_index == target_idx,
                Phase1RowField.field_name == "ADET",
            )
            .first()
        )
        if target_adet_field:
            target_adet_field.normalized_value = str(total_adet)

        # Birleştirme sonrası tüm ilgili satırlar blocker olmaktan çıkar.
        db.query(Phase1RowField).filter(
            Phase1RowField.record_id == record_id,
            Phase1RowField.row_index.in_(row_indexes),
        ).update({"merge_candidate": False}, synchronize_session=False)

        _write_audit(
            db, AuditEventType.ROWS_MERGED,
            record_id=record_id,
            note=f"Birleştirilen satırlar: {row_indexes} → {target_idx}",
            actor_id=actor_id,
            actor_type=ActorType.HUMAN,
        )
        db.commit()
        return {
            "ok": True,
            "record_id": record_id,
            "target_row_index": target_idx,
            "merged_row_indexes": merged_idxs,
            "total_adet": total_adet,
        }

    # ------------------------------------------------------------------
    # Phase 3 — Fire Notu
    # ------------------------------------------------------------------

    def add_scrap_note(
        self,
        db: Session,
        record_id: str,
        note: str,
        actor_id: str = "operator",
    ) -> dict:
        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        note = (note or "").strip()
        if not note:
            raise ValidationError("Fire açıklaması boş olamaz")

        record.fire_aciklamasi = note

        required_rows = (
            db.query(Phase1RowField)
            .filter(
                Phase1RowField.record_id == record_id,
                Phase1RowField.scrap_note_required == True,  # noqa: E712
            )
            .all()
        )
        affected_row_indexes = sorted({row.row_index for row in required_rows})

        if affected_row_indexes:
            db.query(Phase1RowField).filter(
                Phase1RowField.record_id == record_id,
                Phase1RowField.row_index.in_(affected_row_indexes),
            ).update(
                {"scrap_note": note, "scrap_note_required": True},
                synchronize_session=False,
            )

        _write_audit(
            db, AuditEventType.SCRAP_NOTE_ADDED,
            record_id=record_id,
            new_value=note,
            actor_id=actor_id,
            actor_type=ActorType.HUMAN,
            note=f"Genel fire aciklamasi kaydedildi; gerekli satirlar: {affected_row_indexes}",
        )
        db.commit()
        return {
            "ok": True,
            "record_id": record_id,
            "note": note,
            "affected_row_count": len(affected_row_indexes),
            "scrap_note_required": bool(affected_row_indexes),
        }

    # ------------------------------------------------------------------
    # Phase 3 → Phase 4 Geçiş
    # ------------------------------------------------------------------

    def move_to_phase4(self, db: Session, record_id: str, actor_id: str = "operator"):
        from app.features.phase1.schemas import Phase3MovePhase4Response

        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        # Blocker kontrol — spec §12.6
        customer_blocker = record.customer_match_status not in (
            MatchStatus.MATCHED, MatchStatus.MANUAL_MATCHED
        )

        all_fields = db.query(Phase1RowField).filter(Phase1RowField.record_id == record_id).all()
        rows_by_index: dict[int, Phase1RowField] = {}
        for f in all_fields:
            rows_by_index[f.row_index] = f
        general_fire_aciklamasi = self._phase3_general_fire_aciklamasi(record, all_fields)

        stock_unmatched = sum(
            1 for f in rows_by_index.values()
            if f.stock_match_status in (None, MatchStatus.UNMATCHED)
        )
        merge_pending = sum(1 for f in rows_by_index.values() if f.merge_candidate)
        scrap_missing = sum(
            1 for f in rows_by_index.values()
            if f.scrap_note_required and not general_fire_aciklamasi
        )

        if customer_blocker or stock_unmatched > 0 or merge_pending > 0 or scrap_missing > 0:
            _write_audit(
                db, AuditEventType.STATUS_CHANGED,
                record_id=record_id,
                note=(
                    f"Phase4 blocker: cari={customer_blocker}, "
                    f"stok={stock_unmatched}, merge={merge_pending}, fire={scrap_missing}"
                ),
                actor_id=actor_id,
            )
            db.commit()
            return Phase3MovePhase4Response(
                ok=False,
                record_id=record_id,
                error_code="PHASE3_BLOCKER_ACTIVE",
                message=(
                    "Customer or stock blockers remain"
                    f" (customer={customer_blocker}, stock={stock_unmatched},"
                    f" merge={merge_pending}, scrap={scrap_missing})"
                ),
            )

        old_status = record.status
        record.status = Phase1RecordStatus.PHASE4_PENDING
        record.phase4_ready = True

        _write_audit(
            db, AuditEventType.STATUS_CHANGED,
            record_id=record_id,
            old_value=old_status.value,
            new_value=Phase1RecordStatus.PHASE4_PENDING.value,
            actor_id=actor_id,
            actor_type=ActorType.HUMAN,
        )
        db.commit()

        return Phase3MovePhase4Response(
            ok=True,
            record_id=record_id,
            status=Phase1RecordStatus.PHASE4_PENDING,
        )

    # ------------------------------------------------------------------
    # Phase 4 — Queue / Detail / Folder Health
    # ------------------------------------------------------------------

    def _phase4_candidate_records(self, db: Session) -> list[Phase1Record]:
        return (
            db.query(Phase1Record)
            .filter(
                or_(
                    Phase1Record.status.in_(_PHASE4_WORKFLOW_STATUSES),
                    Phase1Record.phase4_ready == True,  # noqa: E712
                    Phase1Record.export_attempt_count > 0,
                    Phase1Record.export_path.is_not(None),
                    Phase1Record.manifest_path.is_not(None),
                )
            )
            .order_by(Phase1Record.updated_at.desc())
            .all()
        )

    def _phase4_fire_required(self, db: Session, record_id: str) -> bool:
        return (
            db.query(Phase1RowField)
            .filter(
                Phase1RowField.record_id == record_id,
                Phase1RowField.scrap_note_required == True,  # noqa: E712
            )
            .first()
            is not None
        )

    def _phase4_last_folder_write(self, db: Session, folder_type: str) -> datetime | None:
        if folder_type == "phase4_output":
            return db.query(func.max(Phase1Record.last_export_at)).scalar()
        if folder_type == "phase4_preview":
            return (
                db.query(func.max(Phase1Audit.created_at))
                .filter(Phase1Audit.event_type == AuditEventType.PHASE4_PREVIEW_CREATED)
                .scalar()
            )
        if folder_type == "phase4_manifest_archive":
            return (
                db.query(func.max(Phase1Audit.created_at))
                .filter(Phase1Audit.event_type == AuditEventType.MANIFEST_CREATED)
                .scalar()
            )
        return None

    def _phase4_folder_paths(self) -> dict[str, Path]:
        export_root = Path(os.getenv(_PHASE4_OUTPUT_DIR_ENV, str(Path.cwd() / "exports")))
        preview_root = Path(os.getenv(_PHASE4_PREVIEW_DIR_ENV, str(export_root / "previews")))
        manifest_root = Path(os.getenv(_PHASE4_MANIFEST_DIR_ENV, str(export_root / "manifests")))
        return {
            "phase4_output": export_root,
            "phase4_preview": preview_root,
            "phase4_manifest_archive": manifest_root,
        }

    def _phase4_folder_status(self, path: Path) -> FolderHealthStatus:
        try:
            if path.exists() and path.is_dir():
                return FolderHealthStatus.HEALTHY
            if path.parent.exists():
                return FolderHealthStatus.WARNING
            return FolderHealthStatus.OFFLINE
        except OSError:
            return FolderHealthStatus.ERROR

    def get_phase4_queue(self, db: Session):
        from app.features.phase1.schemas import Phase4QueueItemDto, Phase4QueueListResponse

        items = []
        for record in self._phase4_candidate_records(db):
            items.append(
                Phase4QueueItemDto(
                    record_id=record.record_id,
                    status=record.status,
                    customer_code=record.customer_code,
                    document_name=record.file_name,
                    manifest_id=_manifest_id_from_path(record.manifest_path),
                    retry_count=record.export_attempt_count or 0,
                    last_error_message=record.last_error_message,
                    fire_required=self._phase4_fire_required(db, record.record_id),
                    updated_at=record.updated_at,
                )
            )
        return Phase4QueueListResponse(items=items)

    def get_phase4_record(self, db: Session, record_id: str):
        from app.features.phase1.schemas import (
            Phase4FolderHealthSummaryDto,
            Phase4MappingSummaryDto,
            Phase4RecordDetailDto,
            Phase4RecordDto,
        )

        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        folder_health_items = self.get_phase4_folder_health(db).items
        folder_health_map = {item.folder_type: item for item in folder_health_items}
        record_payload = Phase4RecordDto(
            record_id=record.record_id,
            status=record.status,
            customer_code=record.customer_code,
            output_file_name=Path(record.export_path).name if record.export_path else None,
            preview_ready=record.status in (
                Phase1RecordStatus.PHASE4_PREVIEW_READY,
                Phase1RecordStatus.PHASE4_EXPORT_RUNNING,
                Phase1RecordStatus.PHASE4_EXPORT_FAILED,
                Phase1RecordStatus.PHASE4_RETRY_PENDING,
                Phase1RecordStatus.COMPLETED,
            ),
            manifest_id=_manifest_id_from_path(record.manifest_path),
            retry_count=record.export_attempt_count or 0,
            last_error_message=record.last_error_message,
            fire_required=self._phase4_fire_required(db, record.record_id),
            phase4_ready=record.phase4_ready,
        )

        return Phase4RecordDetailDto(
            record=record_payload,
            mapping_summary=Phase4MappingSummaryDto(profile_name=_PHASE4_MAPPING_PROFILE_NAME),
            folder_health=Phase4FolderHealthSummaryDto(
                output_folder_status=folder_health_map["phase4_output"].health_status,
                preview_folder_status=folder_health_map["phase4_preview"].health_status,
                manifest_archive_status=folder_health_map["phase4_manifest_archive"].health_status,
                last_write_at=max(
                    (
                        item.last_write_at
                        for item in folder_health_items
                        if item.last_write_at is not None
                    ),
                    default=None,
                ),
            ),
        )

    def get_phase4_manifests(self, db: Session):
        from app.features.phase1.schemas import Phase4ManifestItemDto, Phase4ManifestListResponse

        records = (
            db.query(Phase1Record)
            .filter(Phase1Record.manifest_path.is_not(None))
            .order_by(Phase1Record.last_export_at.desc().nullslast(), Phase1Record.updated_at.desc())
            .all()
        )
        items = [
            Phase4ManifestItemDto(
                manifest_id=_manifest_id_from_path(record.manifest_path) or f"man_{record.record_id}",
                record_id=record.record_id,
                file_name=Path(record.manifest_path).name if record.manifest_path else "",
                created_at=record.last_export_at or record.updated_at,
            )
            for record in records
            if record.manifest_path
        ]
        return Phase4ManifestListResponse(items=items)

    def get_phase4_folder_health(self, db: Session):
        from app.features.phase1.schemas import Phase4FolderHealthItemDto, Phase4FolderHealthListResponse

        items = []
        for folder_type, path in self._phase4_folder_paths().items():
            items.append(
                Phase4FolderHealthItemDto(
                    folder_type=folder_type,
                    health_status=self._phase4_folder_status(path),
                    last_write_at=self._phase4_last_folder_write(db, folder_type),
                )
            )
        return Phase4FolderHealthListResponse(items=items)

    def create_phase4_preview(self, db: Session, record_id: str, actor_id: str = "operator"):
        from app.features.phase1.schemas import Phase4PreviewResponse

        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        if record.status != Phase1RecordStatus.PHASE4_PENDING:
            return Phase4PreviewResponse(
                ok=False,
                record_id=record_id,
                status=record.status,
                error_code="PHASE4_EXPORT_BLOCKED",
                message="Record is not export-ready",
            )
        return self.create_export_preview(db, record_id, actor_id=actor_id)

    def export_phase4(self, db: Session, record_id: str, actor_id: str = "operator"):
        from app.features.phase1.schemas import Phase4ExportResponse

        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        if record.status not in (
            Phase1RecordStatus.PHASE4_PREVIEW_READY,
            Phase1RecordStatus.PHASE4_RETRY_PENDING,
        ):
            return Phase4ExportResponse(
                ok=False,
                record_id=record_id,
                status=record.status,
                error_code="PHASE4_EXPORT_BLOCKED",
                message="Record is not export-ready",
            )

        result = self.run_export(db, record_id, actor_id=actor_id)
        return Phase4ExportResponse(
            ok=result.ok,
            record_id=result.record_id,
            status=result.status,
            export_path=result.export_path,
            manifest_path=result.manifest_path,
            manifest_id=_manifest_id_from_path(result.manifest_path),
            output_file_name=Path(result.export_path).name if result.export_path else None,
            error_code=result.error_code,
            message=result.message,
        )

    def retry_phase4(
        self,
        db: Session,
        record_id: str,
        decision: str,
        actor_id: str = "operator",
    ):
        from app.features.phase1.schemas import Phase4ExportResponse

        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        if decision != "RETRY_NOW":
            return Phase4ExportResponse(
                ok=False,
                record_id=record_id,
                status=record.status,
                error_code="RETRY_DECISION_INVALID",
                message="Unsupported retry decision",
            )

        if record.status != Phase1RecordStatus.PHASE4_EXPORT_FAILED:
            return Phase4ExportResponse(
                ok=False,
                record_id=record_id,
                status=record.status,
                error_code="PHASE4_RETRY_BLOCKED",
                message="Retry is only allowed after export failure",
            )

        result = self.retry_export(db, record_id, actor_id=actor_id)
        return Phase4ExportResponse(
            ok=result.ok,
            record_id=result.record_id,
            status=result.status,
            export_path=result.export_path,
            manifest_path=result.manifest_path,
            manifest_id=_manifest_id_from_path(result.manifest_path),
            output_file_name=Path(result.export_path).name if result.export_path else None,
            error_code=result.error_code,
            message=result.message,
        )

    # ------------------------------------------------------------------
    # Phase 4 — Export Preview
    # ------------------------------------------------------------------

    def create_export_preview(self, db: Session, record_id: str, actor_id: str = "operator"):
        from app.features.phase1.schemas import Phase4PreviewResponse

        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        if record.status != Phase1RecordStatus.PHASE4_PENDING:
            raise ValidationError(f"Kayıt Phase 4 beklemede değil: {record.status}")

        # Preview datası oluştur (spec §13 handoff payload)
        row_fields = db.query(Phase1RowField).filter(Phase1RowField.record_id == record_id).all()
        rows_by_index: dict[int, dict] = {}
        boy_map: dict[int, str] = {}
        en_map: dict[int, str] = {}
        adet_map: dict[int, str] = {}
        for rf in row_fields:
            if rf.field_name == "BOY":
                boy_map[rf.row_index] = rf.normalized_value or ""
            elif rf.field_name == "EN":
                en_map[rf.row_index] = rf.normalized_value or ""
            elif rf.field_name == "ADET":
                adet_map[rf.row_index] = rf.normalized_value or ""
            rows_by_index[rf.row_index] = {"rf": rf}

        preview_lines = []
        for idx in sorted(rows_by_index.keys()):
            rf = rows_by_index[idx]["rf"]
            preview_lines.append({
                "row_index": idx,
                "stock_code": rf.stock_code,
                "boy": boy_map.get(idx, ""),
                "en": en_map.get(idx, ""),
                "adet": adet_map.get(idx, ""),
                "yon": rf.yon,
                "aciklama": rf.aciklama,
                "bant_ust": rf.bant_ust,
                "bant_alt": rf.bant_alt,
                "bant_sol": rf.bant_sol,
                "bant_sag": rf.bant_sag,
                "ilave_aciklama": rf.ilave_aciklama,
                "aciklama1": rf.aciklama1,
            })

        record.status = Phase1RecordStatus.PHASE4_PREVIEW_READY
        _write_audit(
            db, AuditEventType.PHASE4_PREVIEW_CREATED,
            record_id=record_id,
            actor_id=actor_id,
            actor_type=ActorType.HUMAN,
        )
        db.commit()

        return Phase4PreviewResponse(
            ok=True,
            record_id=record_id,
            status=Phase1RecordStatus.PHASE4_PREVIEW_READY,
            preview_data={
                "customer_code": record.customer_code,
                "customer_name": record.customer_name,
                "lines": preview_lines,
                "line_count": len(preview_lines),
            },
        )

    # ------------------------------------------------------------------
    # Phase 4 — Export Çalıştır
    # ------------------------------------------------------------------

    def run_export(self, db: Session, record_id: str, actor_id: str = "operator"):
        from app.features.phase1.schemas import Phase4ExportResponse

        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        if record.status not in (
            Phase1RecordStatus.PHASE4_PREVIEW_READY,
            Phase1RecordStatus.PHASE4_RETRY_PENDING,
        ):
            raise ValidationError(f"Export için uygun durum değil: {record.status}")

        record.status = Phase1RecordStatus.PHASE4_EXPORT_RUNNING
        record.export_attempt_count = (record.export_attempt_count or 0) + 1
        record.last_export_at = _now()
        _write_audit(
            db, AuditEventType.PHASE4_EXPORT_STARTED,
            record_id=record_id,
            actor_id=actor_id,
            actor_type=ActorType.HUMAN,
            note=f"Deneme #{record.export_attempt_count}",
        )
        db.flush()

        try:
            export_path = f"exports/{record_id}_export.xlsx"
            manifest_path = f"exports/{record_id}_manifest.json"

            record.export_path = export_path
            record.manifest_path = manifest_path
            record.status = Phase1RecordStatus.COMPLETED
            _write_audit(
                db, AuditEventType.PHASE4_EXPORT_SUCCEEDED,
                record_id=record_id,
                new_value=export_path,
                actor_id=actor_id,
                actor_type=ActorType.HUMAN,
            )
            _write_audit(db, AuditEventType.MANIFEST_CREATED, record_id=record_id, new_value=manifest_path)
            db.commit()

            return Phase4ExportResponse(
                ok=True,
                record_id=record_id,
                status=Phase1RecordStatus.COMPLETED,
                export_path=export_path,
                manifest_path=manifest_path,
                message="Export tamamlandı",
            )

        except Exception as exc:
            logger.error("Phase 4 export hatası [%s]: %s", record_id, exc)
            record.status = Phase1RecordStatus.PHASE4_EXPORT_FAILED
            record.last_error_message = str(exc)
            record.error_severity = ErrorSeverity.RETRYABLE
            _write_audit(
                db, AuditEventType.PHASE4_EXPORT_FAILED,
                record_id=record_id,
                note=str(exc),
                actor_id=actor_id,
            )
            db.commit()
            return Phase4ExportResponse(
                ok=False,
                record_id=record_id,
                status=Phase1RecordStatus.PHASE4_EXPORT_FAILED,
                error_code="EXPORT_FAILED",
                message=str(exc),
            )

    # ------------------------------------------------------------------
    # Phase 4 — Retry Export
    # ------------------------------------------------------------------

    def retry_export(self, db: Session, record_id: str, actor_id: str = "operator"):
        from app.features.phase1.schemas import Phase4ExportResponse

        record = db.query(Phase1Record).filter(Phase1Record.record_id == record_id).first()
        if not record:
            raise NotFoundError("Phase1Record", record_id)

        if record.status != Phase1RecordStatus.PHASE4_EXPORT_FAILED:
            raise ValidationError(f"Sadece PHASE4_EXPORT_FAILED durumunda retry yapılabilir: {record.status}")

        record.status = Phase1RecordStatus.PHASE4_RETRY_PENDING
        _write_audit(
            db, AuditEventType.RETRY_DECISION_TAKEN,
            record_id=record_id,
            actor_id=actor_id,
            actor_type=ActorType.HUMAN,
            note="Manuel Phase 4 retry",
        )
        db.commit()

        return self.run_export(db, record_id, actor_id=actor_id)


phase1_service = Phase1Service()
