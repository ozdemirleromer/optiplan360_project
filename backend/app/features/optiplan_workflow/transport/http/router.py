from __future__ import annotations

from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.orm import Session

from app.auth import require_operator
from app.constants.optiplan_workflow import ExportContractRules
from app.database import get_db
from app.models import User
from app.services.optiplan_workflow_service import optiplan_workflow_service

router = APIRouter(prefix="/api/v1/optiplan-workflow", tags=["optiplan-workflow"])


def alias_field(*aliases: str, default: Any = None, **kwargs: Any) -> Any:
    alias = aliases[-1] if aliases else None
    return Field(default=default, alias=alias, **kwargs)


class WorkflowRequestModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class FolderSettingsIn(WorkflowRequestModel):
    program_kok_klasoru: str | None = alias_field("program_kok_klasoru", "programKokKlasoru")
    whatsapp_raw_klasoru: str | None = alias_field("whatsapp_raw_klasoru", "whatsappRawKlasoru")
    scanner_raw_klasoru: str | None = alias_field("scanner_raw_klasoru", "scannerRawKlasoru")
    manuel_raw_klasoru: str | None = alias_field("manuel_raw_klasoru", "manuelRawKlasoru")
    email_raw_klasoru: str | None = alias_field("email_raw_klasoru", "emailRawKlasoru")
    islenmis_klasoru: str | None = alias_field("islenmis_klasoru", "islenmisKlasoru")
    arsiv_klasoru: str | None = alias_field("arsiv_klasoru", "arsivKlasoru")
    xml_okuma_klasoru: str | None = alias_field("xml_okuma_klasoru", "xmlOkumaKlasoru")
    xlsx_cikti_klasoru: str | None = alias_field("xlsx_cikti_klasoru", "xlsxCiktiKlasoru")
    opj_cikti_klasoru: str | None = alias_field("opj_cikti_klasoru", "opjCiktiKlasoru")
    hatali_klasoru: str | None = alias_field("hatali_klasoru", "hataliKlasoru")
    fis_evrak_no_formati: str | None = alias_field("fis_evrak_no_formati", "fisEvrakNoFormati")
    arsiv_zaman_damgasi_formati: str | None = alias_field(
        "arsiv_zaman_damgasi_formati", "arsivZamanDamgasiFormati"
    )
    xlsx_aktif_mi: Annotated[bool | None, Field(alias="xlsxAktifMi")] = None
    opj_aktif_mi: Annotated[bool | None, Field(alias="opjAktifMi")] = None
    watcher_aktif_mi: Annotated[bool | None, Field(alias="watcherAktifMi")] = None
    yeniden_deneme_sayisi: int | None = alias_field(
        "yeniden_deneme_sayisi", "yenidenDenemeSayisi", ge=0
    )


class Phase2RowIn(WorkflowRequestModel):
    id: str
    boy: int | None = None
    en: int | None = None
    adet: int | None = None
    malzeme: str | None = None
    grain: int | None = None
    bilgi: str | None = None
    delik_1: str | None = alias_field("delik_1", "delik1")
    hucre_guven_skorlari: dict[str, Any] | None = alias_field("hucre_guven_skorlari", "hucreGuvenSkorlari")
    satir_guven_skor_ozeti: dict[str, Any] | None = alias_field(
        "satir_guven_skor_ozeti", "satirGuvenSkorOzeti"
    )
    bbox_json: list[dict[str, Any]] | None = alias_field("bbox_json", "bboxJson")


class CellApprovalIn(WorkflowRequestModel):
    """Per-cell BOY/EN/ADET onay veya düzeltme."""
    satir_id: str = alias_field("satir_id", "satirId", default=...)
    alan: Literal["boy", "en", "adet"]
    aksiyon: Literal["ONAYLA", "DUZELT"]
    yeni_deger: int | None = alias_field("yeni_deger", "yeniDeger")


class Phase2CellApprovalBatchIn(WorkflowRequestModel):
    """Toplu hücre onay/düzeltme."""
    approvals: list[CellApprovalIn]


class Phase2UpdateIn(WorkflowRequestModel):
    rows: list[Phase2RowIn]
    okunan_cari_unvan: str | None = alias_field("okunan_cari_unvan", "okunanCariUnvan")
    okunan_cari_telefon: str | None = alias_field("okunan_cari_telefon", "okunanCariTelefon")
    ai_guven_skoru_ozeti: dict[str, Any] | None = alias_field("ai_guven_skoru_ozeti", "aiGuvenSkoruOzeti")
    revizyon_adayi_uyarisi: str | None = alias_field("revizyon_adayi_uyarisi", "revizyonAdayiUyarisi")


class Phase3RowIn(WorkflowRequestModel):
    id: str | None = None
    satir_sirasi: int | None = alias_field("satir_sirasi", "satirSirasi")
    malzeme: str | None = None
    boy: int | None = None
    en: int | None = None
    adet: int | None = None
    grain: int | None = None
    bilgi: str | None = None
    u1: bool | None = None
    u2: bool | None = None
    k1: bool | None = None
    k2: bool | None = None
    delik_1: str | None = alias_field("delik_1", "delik1")
    delik_2: str | None = alias_field("delik_2", "delik2")
    satir_kaynagi: str | None = alias_field("satir_kaynagi", "satirKaynagi")
    plaka_ref: str | None = alias_field("plaka_ref", "plakaRef")
    bant_kalinligi_override: str | None = alias_field("bant_kalinligi_override", "bantKalinligiOverride")
    hucre_guven_skorlari: dict[str, Any] | None = alias_field("hucre_guven_skorlari", "hucreGuvenSkorlari")
    satir_guven_skor_ozeti: dict[str, Any] | None = alias_field(
        "satir_guven_skor_ozeti", "satirGuvenSkorOzeti"
    )


class Phase3UpdateIn(WorkflowRequestModel):
    cari_unvan: str | None = alias_field("cari_unvan", "cariUnvan")
    cari_kodu: str | None = alias_field("cari_kodu", "cariKodu")
    siparis_no: str | None = alias_field("siparis_no", "siparisNo")
    termin: str | None = None
    teslim_tarihi: str | None = alias_field("teslim_tarihi", "teslimTarihi")
    teslimat_adresi: str | None = alias_field("teslimat_adresi", "teslimatAdresi")
    odeme_sekli: str | None = alias_field("odeme_sekli", "odemeSekli")
    malzeme: str | None = None
    stok_kodu: str | None = alias_field("stok_kodu", "stokKodu")
    bant_kalinligi: str | None = alias_field("bant_kalinligi", "bantKalinligi")
    grain_varsayilan: int | None = alias_field("grain_varsayilan", "grainVarsayilan")
    plaka_boy_mm: int | None = alias_field("plaka_boy_mm", "plakaBoyMm")
    plaka_en_mm: int | None = alias_field("plaka_en_mm", "plakaEnMm")
    fire_aciklamasi: str | None = alias_field("fire_aciklamasi", "fireAciklamasi")
    rows: list[Phase3RowIn] | None = None
    plates: list[dict[str, Any]] | None = None


class ExportRequestIn(WorkflowRequestModel):
    xlsx_aktif_mi: bool | None = None
    opj_aktif_mi: bool | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        normalized = dict(value)
        if "xlsxAktifMi" in normalized and "xlsx_aktif_mi" not in normalized:
            normalized["xlsx_aktif_mi"] = normalized.pop("xlsxAktifMi")
        if "opjAktifMi" in normalized and "opj_aktif_mi" not in normalized:
            normalized["opj_aktif_mi"] = normalized.pop("opjAktifMi")
        return normalized


class ErrorRequestIn(WorkflowRequestModel):
    hata_fazi: str = alias_field("hata_fazi", "hataFazi", default=...)
    hata_nedeni: str = alias_field("hata_nedeni", "hataNedeni", default=...)
    operator_notu: str | None = alias_field("operator_notu", "operatorNotu")


class ExportPreviewRowOut(BaseModel):
    """Export row output model with contract constraints from ExportContractRules."""

    model_config = ConfigDict(populate_by_name=True)

    p_code_mat: str = Field(alias="[P_CODE_MAT]")
    p_length: int = Field(alias="[P_LENGTH]", ge=1)
    p_width: int = Field(alias="[P_WIDTH]", ge=1)
    p_minq: int = Field(alias="[P_MINQ]", ge=1)
    p_grain: Literal[ExportContractRules.GRAIN_VALUES] = Field(alias="[P_GRAIN]")
    p_idesc: str = Field(alias="[P_IDESC]")
    p_edge_mat_up: Literal[ExportContractRules.EDGE_CODES] = Field(alias="[P_EDGE_MAT_UP]")
    p_egde_mat_lo: Literal[ExportContractRules.EDGE_CODES] = Field(alias="[P_EGDE_MAT_LO]")
    p_edge_mat_sx: Literal[ExportContractRules.EDGE_CODES] = Field(alias="[P_EDGE_MAT_SX]")
    p_edge_mat_dx: Literal[ExportContractRules.EDGE_CODES] = Field(alias="[P_EDGE_MAT_DX]")
    p_iidesc: str = Field(alias="[P_IIDESC]", pattern=r"^\d*$")
    p_desc1: str = Field(alias="[P_DESC1]", pattern=r"^\d*$")


class ExportFileArtifactOut(BaseModel):
    file_format: Literal["xlsx", "opj"]
    file_name: str
    file_path: str
    download_path: str
    size_bytes: int = Field(ge=0)
    checksum_sha256: str = Field(min_length=64, max_length=64)
    contract_state: str | None = None
    writer_profile: str | None = None


class ExportManifestOut(BaseModel):
    manifest_version: str
    kayit_uuid: str
    export_id: str | None = None
    dosya_adi: str
    revizyon_no: int = Field(ge=0)
    retry_no: int = Field(ge=0)
    requested_formats: list[Literal["xlsx", "opj"]] = Field(default_factory=list)
    generated_formats: list[Literal["xlsx", "opj"]] = Field(default_factory=list)
    row_count: int = Field(ge=0)
    created_at: str | None = None
    opj_profile: str | None = None
    opj_contract_state: str | None = None


class ExportPreviewResponseOut(BaseModel):
    kayit_uuid: str
    dosya_adi: str
    xlsx_aktif_mi: bool
    opj_aktif_mi: bool
    opj_status: str
    opj_message: str | None = None
    revizyon_no: int = Field(ge=0)
    satirlar: list[ExportPreviewRowOut]
    export_manifest: ExportManifestOut


class ExportRecordResponseOut(ExportPreviewResponseOut):
    """Export record output with durum status from ExportContractRules."""

    generated_files: list[str]
    generated_file_details: list[ExportFileArtifactOut] = Field(default_factory=list)
    durum: Literal[ExportContractRules.EXPORT_STATUS_VALUES]


class ExportStatusAnomalySummaryOut(BaseModel):
    total_records: int = Field(ge=0)
    distinct_records: int = Field(ge=0)
    last_created_at: str | None = None
    status_breakdown: dict[str, int] = Field(default_factory=dict)


class ExportStatusAnomalyFiltersOut(BaseModel):
    kayit_uuid: str | None = None
    from_ts: str | None = Field(default=None, alias="from")
    to_ts: str | None = Field(default=None, alias="to")


class ExportStatusAnomalyItemOut(BaseModel):
    id: int
    kayit_uuid: str
    alan_adi: str
    eski_deger: str | None = None
    yeni_deger: str | None = None
    created_at: str | None = None


class ExportStatusAnomalyResponseOut(BaseModel):
    limit: int = Field(ge=1, le=200)
    offset: int = Field(ge=0)
    filters: ExportStatusAnomalyFiltersOut
    summary: ExportStatusAnomalySummaryOut
    items: list[ExportStatusAnomalyItemOut]


@router.get("/folder-settings")
def get_folder_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    return optiplan_workflow_service.serialize_folder_settings(
        optiplan_workflow_service.get_folder_settings(db)
    )


@router.put("/folder-settings")
def update_folder_settings(
    body: FolderSettingsIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    return optiplan_workflow_service.update_folder_settings(
        db,
        body.model_dump(exclude_none=True),
    )


@router.post("/records/manual-import")
async def manual_import(
    file: UploadFile = File(...),
    kaynak_klasor: str = Form(...),
    force_duplicate: bool = Form(False),
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    return optiplan_workflow_service.manual_import(
        db,
        file_name=file.filename or "manual-import",
        content=await file.read(),
        kaynak_klasor=kaynak_klasor,
        force_duplicate=force_duplicate,
    )


@router.post("/records/scan")
def scan_watch_folders(
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    return {"records": optiplan_workflow_service.scan_watch_folders(db)}


@router.get("/records")
def list_records(
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    return {"records": optiplan_workflow_service.list_records(db)}


@router.get("/records/{kayit_uuid}")
def get_record(
    kayit_uuid: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    return optiplan_workflow_service.get_record(db, kayit_uuid)


@router.get("/records/{kayit_uuid}/image")
def get_record_image(
    kayit_uuid: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    record = optiplan_workflow_service.get_record(db, kayit_uuid)
    path = record.get("orijinal_dosya_yolu")
    if not path or not Path(path).exists():
        return {"detail": "Kayit gorseli bulunamadi"}
    return FileResponse(path)


@router.put("/records/{kayit_uuid}/phase2")
def update_phase2(
    kayit_uuid: str,
    body: Phase2UpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    metadata = {
        "okunan_cari_unvan": body.okunan_cari_unvan,
        "okunan_cari_telefon": body.okunan_cari_telefon,
        "ai_guven_skoru_ozeti": body.ai_guven_skoru_ozeti,
        "revizyon_adayi_uyarisi": body.revizyon_adayi_uyarisi,
    }
    return optiplan_workflow_service.update_phase2(
        db,
        kayit_uuid,
        rows=[row.model_dump(exclude_none=True) for row in body.rows],
        metadata=metadata,
        user_id=user.id,
    )


@router.post("/records/{kayit_uuid}/phase2/approve")
def approve_phase2(
    kayit_uuid: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    return optiplan_workflow_service.approve_phase2(db, kayit_uuid, user_id=user.id)


@router.post("/records/{kayit_uuid}/phase2/cell-approve")
def approve_phase2_cells(
    kayit_uuid: str,
    body: Phase2CellApprovalBatchIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    return optiplan_workflow_service.approve_phase2_cells(
        db,
        kayit_uuid,
        approvals=[a.model_dump() for a in body.approvals],
        user_id=user.id,
    )


@router.post("/records/{kayit_uuid}/rows/{row_id}/remove")
def remove_phase2_row(
    kayit_uuid: str,
    row_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    return optiplan_workflow_service.remove_phase2_row(db, kayit_uuid, row_id)


@router.post("/records/{kayit_uuid}/removed-rows/{removed_row_id}/restore")
def restore_phase2_row(
    kayit_uuid: str,
    removed_row_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    return optiplan_workflow_service.restore_phase2_row(db, kayit_uuid, removed_row_id)


@router.put("/records/{kayit_uuid}/phase3")
def update_phase3(
    kayit_uuid: str,
    body: Phase3UpdateIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    return optiplan_workflow_service.update_phase3(
        db,
        kayit_uuid,
        body.model_dump(exclude_none=True),
    )


@router.post("/records/{kayit_uuid}/export/preview")
def export_preview(
    kayit_uuid: str,
    body: ExportRequestIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> ExportPreviewResponseOut:
    return optiplan_workflow_service.export_preview(
        db,
        kayit_uuid,
        xlsx_aktif_mi=body.xlsx_aktif_mi,
        opj_aktif_mi=body.opj_aktif_mi,
    )


@router.post("/records/{kayit_uuid}/export")
def export_record(
    kayit_uuid: str,
    body: ExportRequestIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> ExportRecordResponseOut:
    return optiplan_workflow_service.export_record(
        db,
        kayit_uuid,
        xlsx_aktif_mi=body.xlsx_aktif_mi,
        opj_aktif_mi=body.opj_aktif_mi,
    )


@router.get("/records/{kayit_uuid}/exports/{export_id}/files/{file_format}")
def download_export_file(
    kayit_uuid: str,
    export_id: str,
    file_format: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    path = optiplan_workflow_service.get_export_file(db, kayit_uuid, export_id, file_format)
    return FileResponse(path, filename=Path(path).name)


@router.post("/records/{kayit_uuid}/error")
def mark_error(
    kayit_uuid: str,
    body: ErrorRequestIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    return optiplan_workflow_service.mark_error(
        db,
        kayit_uuid,
        hata_fazi=body.hata_fazi,
        hata_nedeni=body.hata_nedeni,
        operator_notu=body.operator_notu,
    )


@router.post("/records/{kayit_uuid}/retry")
def retry_record(
    kayit_uuid: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    return optiplan_workflow_service.retry_record(db, kayit_uuid)


@router.get("/lookup/customers")
def lookup_customers(
    q: str = Query("", min_length=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    _ = db
    return {"items": optiplan_workflow_service.search_customers(q)}


@router.get("/lookup/stocks")
def lookup_stocks(
    q: str = Query("", min_length=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
):
    _ = db
    return {"items": optiplan_workflow_service.search_stocks(q)}


@router.get("/telemetry/export-status-anomalies")
def get_export_status_anomalies(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    kayit_uuid: str | None = Query(default=None),
    from_ts: str | None = Query(default=None, alias="from"),
    to_ts: str | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> ExportStatusAnomalyResponseOut:
    return optiplan_workflow_service.get_export_status_anomalies(
        db,
        limit=limit,
        offset=offset,
        kayit_uuid=kayit_uuid,
        from_ts=from_ts,
        to_ts=to_ts,
    )

