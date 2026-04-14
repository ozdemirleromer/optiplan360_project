from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from openpyxl import Workbook

from app.constants.optiplan_workflow import (
    INTERIM_OPJ_CONTRACT_STATE,
    INTERIM_OPJ_WRITER_PROFILE,
    OPTIPLAN_EXPORT_COLUMNS,
    ExportContractRules,
)

EXPORT_COLUMNS = OPTIPLAN_EXPORT_COLUMNS


@dataclass(slots=True)
class ExportFileArtifact:
    file_format: str
    file_name: str
    file_path: str
    download_path: str
    size_bytes: int
    checksum_sha256: str
    contract_state: str | None = None
    writer_profile: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "file_format": self.file_format,
            "file_name": self.file_name,
            "file_path": self.file_path,
            "download_path": self.download_path,
            "size_bytes": self.size_bytes,
            "checksum_sha256": self.checksum_sha256,
            "contract_state": self.contract_state,
            "writer_profile": self.writer_profile,
        }


class OptiPlanExportService:
    def build_manifest(
        self,
        *,
        kayit_uuid: str,
        export_id: str | None,
        dosya_adi: str,
        revizyon_no: int,
        retry_no: int,
        requested_formats: list[str],
        generated_formats: list[str],
        row_count: int,
        created_at: str | None,
        opj_profile: str | None = None,
        opj_contract_state: str | None = None,
    ) -> dict[str, Any]:
        manifest = {
            "manifest_version": ExportContractRules.MANIFEST_VERSION,
            "kayit_uuid": kayit_uuid,
            "export_id": export_id,
            "dosya_adi": dosya_adi,
            "revizyon_no": revizyon_no,
            "retry_no": retry_no,
            "requested_formats": requested_formats,
            "generated_formats": generated_formats,
            "row_count": row_count,
            "created_at": created_at,
        }
        if opj_profile:
            manifest["opj_profile"] = opj_profile
        if opj_contract_state:
            manifest["opj_contract_state"] = opj_contract_state
        return manifest

    def write_xlsx(
        self,
        *,
        file_path: Path,
        rows: list[dict[str, Any]],
        download_path: str,
    ) -> ExportFileArtifact:
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "OPTIPLAN"
        sheet.append(EXPORT_COLUMNS)
        for row in rows:
            sheet.append([row.get(column) for column in EXPORT_COLUMNS])
        # Atomic write: .tmp → rename (kısmi yazma durumunda dosya bozuk kalmaz)
        tmp_path = file_path.with_suffix(".tmp")
        workbook.save(tmp_path)
        tmp_path.rename(file_path)
        return self._artifact_from_file(file_path, "xlsx", download_path)

    def write_interim_opj(
        self,
        *,
        file_path: Path,
        rows: list[dict[str, Any]],
        manifest: dict[str, Any],
        download_path: str,
    ) -> ExportFileArtifact:
        payload = {
            "writer_profile": INTERIM_OPJ_WRITER_PROFILE,
            "contract_state": INTERIM_OPJ_CONTRACT_STATE,
            "created_at": datetime.now(UTC).isoformat(),
            "manifest": manifest,
            "rows": rows,
        }
        # Atomic write: .tmp → rename
        tmp_path = file_path.with_suffix(".tmp")
        tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp_path.rename(file_path)
        return self._artifact_from_file(
            file_path,
            "opj",
            download_path,
            contract_state=INTERIM_OPJ_CONTRACT_STATE,
            writer_profile=INTERIM_OPJ_WRITER_PROFILE,
        )

    def _artifact_from_file(
        self,
        file_path: Path,
        file_format: str,
        download_path: str,
        *,
        contract_state: str | None = None,
        writer_profile: str | None = None,
    ) -> ExportFileArtifact:
        checksum = hashlib.sha256(file_path.read_bytes()).hexdigest()
        return ExportFileArtifact(
            file_format=file_format,
            file_name=file_path.name,
            file_path=str(file_path),
            download_path=download_path,
            size_bytes=file_path.stat().st_size,
            checksum_sha256=checksum,
            contract_state=contract_state,
            writer_profile=writer_profile,
        )


optiplan_export_service = OptiPlanExportService()
