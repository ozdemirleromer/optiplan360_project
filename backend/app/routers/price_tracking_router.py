"""
Fiyat Takip Router — Dosya yükleme, job yönetimi, Excel export.
İş mantığı PriceTrackingService'de; burada sadece HTTP in/out.
"""
import logging
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth import require_permissions
from app.database import get_db
from app.models import User
from app.permissions import Permission
from app.schemas import PriceExportRequest, PriceJobDetailOut, PriceUploadJobOut
from app.services.price_tracking_service import PriceTrackingService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/price-tracking",
    tags=["price-tracking"],
)


@router.post("/upload", response_model=PriceUploadJobOut, status_code=201)
async def upload_price_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    supplier: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permissions(Permission.PRICE_TRACKING_UPLOAD)
    ),
):
    """Fiyat listesi dosyası yükle ve işle."""
    contents = await file.read()
    job = PriceTrackingService.upload_and_process(
        db=db,
        file_data=contents,
        filename=file.filename or "unknown",
        content_type=file.content_type or "application/octet-stream",
        supplier=supplier,
        user=current_user,
        background_tasks=background_tasks,
    )
    return job


@router.get("/jobs", response_model=list[PriceUploadJobOut])
async def list_price_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permissions(Permission.PRICE_TRACKING_VIEW)
    ),
):
    """Fiyat yükleme işlerini listele."""
    return PriceTrackingService.list_jobs(db, current_user)


@router.get("/jobs/{job_id}", response_model=PriceJobDetailOut)
async def get_price_job_detail(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permissions(Permission.PRICE_TRACKING_VIEW)
    ),
):
    """Fiyat yükleme işi detayı (ürünlerle birlikte)."""
    return PriceTrackingService.get_job_detail(db, job_id, current_user)


@router.post("/export")
async def export_price_jobs(
    request: PriceExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permissions(Permission.PRICE_TRACKING_EXPORT)
    ),
):
    """Seçili işleri birleştirilmiş Excel dosyası olarak dışa aktar."""
    excel_bytes = PriceTrackingService.export_to_excel(
        db, request.job_ids, current_user
    )
    filename = f"Fiyat_Listesi_{datetime.now().strftime('%Y-%m-%d')}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_price_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permissions(Permission.PRICE_TRACKING_DELETE)
    ),
):
    """Fiyat yükleme işini sil."""
    PriceTrackingService.delete_job(db, job_id, current_user)
