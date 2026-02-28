"""
OptiPlan 360 — OCR Router
OCR (Optical Character Recognition) entegrasyonu
Fotoğraf işleme, metin tanıma, siparişe dönüştürme
"""


import io


import logging


import re


from datetime import datetime, timezone


from typing import List, Optional, Dict, Any


from uuid import uuid4





import httpx


from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks


from app.exceptions import BusinessRuleError, NotFoundError, ValidationError


from pydantic import BaseModel, Field


from sqlalchemy.orm import Session





from app.database import get_db


from app.models import Order, Customer, AuditLog, User, OCRJob, OCRLine, OrderPart, DeviceOCRConfig


from app.auth import get_current_user


from app.services.azure_service import AzureService





logger = logging.getLogger(__name__)





try:


    from PIL import Image


except Exception:  # pragma: no cover - optional dependency guard


    Image = None





router = APIRouter(prefix="/api/v1/ocr", tags=["ocr"])








# --- Schemas ---


class OCRJobIn(BaseModel):


    customer_id: Optional[str] = None


    phone: Optional[str] = None


    notes: Optional[str] = None


    auto_create_order: bool = False








class OCRJobOut(BaseModel):


    id: str


    status: str  # PENDING, PROCESSING, COMPLETED, FAILED


    image_url: Optional[str] = None


    extracted_text: Optional[str] = None


    confidence: float = 0.0


    customer_id: Optional[str] = None


    phone: Optional[str] = None


    order_id: Optional[str] = None


    error_message: Optional[str] = None


    created_at: str


    completed_at: Optional[str] = None


    lines: List[Dict] = []








class OCRLineOut(BaseModel):


    id: str


    line_number: int


    text: str


    confidence: float


    is_valid: bool


    validation_error: Optional[str] = None


    parsed_data: Optional[Dict] = None








class OCRProcessResult(BaseModel):


    success: bool


    job_id: str


    extracted_text: str


    confidence: float


    lines: List[OCRLineOut]


    customer_match: Optional[Dict] = None


    suggested_order: Optional[Dict] = None








class OCRConfigOut(BaseModel):


    configured: bool


    engine: str = "tesseract"  # tesseract, google_vision, azure


    languages: List[str] = ["tur", "eng"]


    preprocessing_enabled: bool = True


    confidence_threshold: float = 0.7








class OCRConfigUpdate(BaseModel):


    engine: Optional[str] = None


    languages: Optional[List[str]] = None


    preprocessing_enabled: Optional[bool] = None


    confidence_threshold: Optional[float] = None


    api_key: Optional[str] = None  # For cloud OCR services








class CustomerLookupResult(BaseModel):


    found: bool


    customer_id: Optional[str] = None


    name: Optional[str] = None


    phone: str


    normalized_phone: str


    confidence: float


    suggestions: List[Dict] = []








class OrderCreateFromOCR(BaseModel):


    ocr_job_id: str


    customer_id: str


    lines: List[int] = Field(..., description="Kullanılacak satır numaraları")


    material: Optional[str] = None


    thickness: Optional[str] = None


    plate_size: Optional[str] = "2100x2800"


    grain: Optional[str] = "0-Material"


    notes: Optional[str] = None








# --- OCR Engine Helpers ---


def _normalize_phone(phone: str) -> str:


    """Telefon numarasını normalize et"""


    if not phone:


        return ""


    # Sadece rakamları al


    digits = re.sub(r'\D', '', phone)


    # Türkiye formatı: 5XX XXX XX XX


    if digits.startswith('90'):


        digits = digits[2:]


    if digits.startswith('0'):


        digits = digits[1:]


    return digits








def _match_customer_by_phone(db: Session, phone: str) -> Optional[Customer]:


    """Telefona göre müşteri eşleştir"""


    normalized = _normalize_phone(phone)


    if not normalized:


        return None


    


    # Tam eşleşme


    customer = db.query(Customer).filter(Customer.phone == normalized).first()


    if customer:


        return customer


    


    # Kısmi eşleşme (son 7 hane)


    if len(normalized) >= 7:


        partial = normalized[-7:]


        customers = db.query(Customer).all()


        for c in customers:


            if c.phone and c.phone.endswith(partial):


                return c


    


    return None








def _parse_measurement_line(text: str) -> Optional[Dict]:


    """Ölçü satırını parse et"""


    # Pattern: Boy x En x Adet (örn: 700 x 400 x 2)


    pattern = r'(\d+)\s*[xX*×]\s*(\d+)\s*[xX*×]\s*(\d+)'


    match = re.search(pattern, text)


    


    if match:


        return {


            "boy": int(match.group(1)),


            "en": int(match.group(2)),


            "adet": int(match.group(3)),


            "raw": text


        }


    


    # Alternatif pattern: 700/400/2


    alt_pattern = r'(\d+)\s*/\s*(\d+)\s*/\s*(\d+)'


    match = re.search(alt_pattern, text)


    if match:


        return {


            "boy": int(match.group(1)),


            "en": int(match.group(2)),


            "adet": int(match.group(3)),


            "raw": text


        }


    


    return None











def _get_ocr_kv(db: Session, key: str) -> Optional[str]:


    row = db.query(DeviceOCRConfig).filter(DeviceOCRConfig.key == key).first()


    return row.value if row else None








def _set_ocr_kv(db: Session, key: str, value: str) -> None:


    row = db.query(DeviceOCRConfig).filter(DeviceOCRConfig.key == key).first()


    if row:


        row.value = value


        row.updated_at = datetime.now(timezone.utc)


    else:


        db.add(


            DeviceOCRConfig(


                key=key,


                value=value,


                updated_at=datetime.now(timezone.utc),


            )


        )








def _parse_languages(value: Optional[str]) -> List[str]:


    if not value:


        return ["tur", "eng"]


    langs = [item.strip() for item in value.split(",") if item.strip()]


    return langs or ["tur", "eng"]





# -----------------------------------------------------------------------------


# YAPILANDIRMA


# -----------------------------------------------------------------------------


@router.get("/config", response_model=OCRConfigOut)


def get_ocr_config(


    db: Session = Depends(get_db),


    _user: User = Depends(get_current_user),


):


    """OCR yapılandırmasını getir - Azure desteği ile"""


    azure_service = AzureService(db)


    azure_configured = azure_service.is_configured()["ocr"]





    saved_engine = _get_ocr_kv(db, "ocr_engine")


    current_engine = saved_engine or ("azure" if azure_configured else "tesseract")


    languages = _parse_languages(_get_ocr_kv(db, "ocr_languages"))


    preprocessing_enabled = (_get_ocr_kv(db, "ocr_preprocessing_enabled") or "true").lower() == "true"





    confidence_raw = _get_ocr_kv(db, "ocr_confidence_threshold")


    try:


        confidence_threshold = float(confidence_raw) if confidence_raw is not None else 0.7


    except ValueError:


        confidence_threshold = 0.7





    return OCRConfigOut(


        configured=True,


        engine=current_engine,


        languages=languages,


        preprocessing_enabled=preprocessing_enabled,


        confidence_threshold=confidence_threshold,


    )





@router.put("/config", response_model=OCRConfigOut)


def update_ocr_config(


    config: OCRConfigUpdate,


    db: Session = Depends(get_db),


    _user: User = Depends(get_current_user),


):


    """OCR yapılandırmasını güncelle"""


    if config.engine is not None:


        _set_ocr_kv(db, "ocr_engine", config.engine)


    if config.languages is not None:


        _set_ocr_kv(db, "ocr_languages", ",".join(config.languages))


    if config.preprocessing_enabled is not None:


        _set_ocr_kv(db, "ocr_preprocessing_enabled", "true" if config.preprocessing_enabled else "false")


    if config.confidence_threshold is not None:


        _set_ocr_kv(db, "ocr_confidence_threshold", str(config.confidence_threshold))


    if config.api_key:


        _set_ocr_kv(db, "ocr_api_key", config.api_key)





    db.add(


        AuditLog(


            id=str(uuid4()),


            user_id=_user.id,


            action="OCR_CONFIG_UPDATED",


            detail="OCR config updated",


            created_at=datetime.now(timezone.utc),


        )


    )


    db.commit()





    logger.info(f"OCR config updated by {_user.id}")


    return OCRConfigOut(


        configured=True,


        engine=config.engine or (_get_ocr_kv(db, "ocr_engine") or "tesseract"),


        languages=config.languages or _parse_languages(_get_ocr_kv(db, "ocr_languages")),


        preprocessing_enabled=(


            config.preprocessing_enabled


            if config.preprocessing_enabled is not None


            else ((_get_ocr_kv(db, "ocr_preprocessing_enabled") or "true").lower() == "true")


        ),


        confidence_threshold=(


            config.confidence_threshold


            if config.confidence_threshold is not None


            else float(_get_ocr_kv(db, "ocr_confidence_threshold") or 0.7)


        ),


    )


# -----------------------------------------------------------------------------


# FOTOĞRAF YÜKLEME VE İŞLEME


# -----------------------------------------------------------------------------


@router.post("/upload", response_model=OCRJobOut, status_code=201)


async def upload_image(


    background_tasks: BackgroundTasks,


    file: UploadFile = File(...),


    customer_id: Optional[str] = Form(None),


    phone: Optional[str] = Form(None),


    notes: Optional[str] = Form(None),


    auto_process: bool = Form(True),


    db: Session = Depends(get_db),


    current_user: User = Depends(get_current_user),


):


    """


    OCR için fotoğraf yükle


    Fotoğraf otomatik olarak işlenir (auto_process=True)


    """


    # Dosya kontrolü


    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]


    if file.content_type not in allowed_types:


        raise BusinessRuleError(f"Geçersiz dosya tipi: {file.content_type}. İzin verilen: {', '.join(allowed_types)}")


    


    # Dosya boyutu kontrolü (max 10MB)


    contents = await file.read()


    if len(contents) > 10 * 1024 * 1024:


        raise ValidationError("Dosya boyutu 10MB'dan büyük olamaz")


    


    # Job oluştur


    job = OCRJob(


        id=str(uuid4()),


        status="PENDING",


        original_filename=file.filename,


        content_type=file.content_type,


        file_size=len(contents),


        customer_id=customer_id,


        phone=_normalize_phone(phone) if phone else None,


        notes=notes,


        uploaded_by_id=current_user.id,


        created_at=datetime.now(timezone.utc)


    )


    


    # Görüntüyü kaydet


    job.image_data = contents


    


    db.add(job)


    db.commit()


    db.refresh(job)


    


    # Otomatik işleme


    if auto_process:


        background_tasks.add_task(_process_ocr_job, job.id, db)


        job.status = "PROCESSING"


        db.commit()


    


    # Audit log


    log = AuditLog(


        id=str(uuid4()),


        user_id=current_user.id,


        action="OCR_UPLOAD",


        detail=f"OCR job {job.id} created | Auto-process: {auto_process}",


        created_at=datetime.now(timezone.utc)


    )


    db.add(log)


    db.commit()


    


    return _job_to_out(job)








def _process_ocr_job(job_id: str, db: Session, engine: str = "auto"):


    """Background task: OCR işleme - Azure ve Tesseract desteği ile"""


    # Yeni session oluştur (background task için)


    from app.database import SessionLocal


    db = SessionLocal()


    


    try:


        job = db.query(OCRJob).filter(OCRJob.id == job_id).first()


        if not job:


            logger.error(f"OCR job bulunamadı: {job_id}")


            return


        


        job.status = "PROCESSING"


        db.commit()


        


        # Engine seçimi


        azure_service = AzureService(db)


        azure_configured = azure_service.is_configured()["ocr"]


        


        if engine == "auto":


            # Azure varsa kullan, yoksa tesseract


            engine = "azure" if azure_configured else "tesseract"


        


        try:


            if engine == "azure" and azure_configured:


                # Azure OCR ile işle


                import asyncio


                ocr_result = asyncio.run(azure_service.process_ocr(job.image_data))


                


                if ocr_result.success:


                    job.extracted_text = ocr_result.text


                    job.confidence = ocr_result.confidence / 100


                    


                    # Satırları parse et


                    for idx, line_data in enumerate(ocr_result.lines, 1):


                        line_text = line_data.get("text", "").strip()


                        if line_text:


                            parsed = _parse_measurement_line(line_text)


                            


                            # Azure'dan confidence al


                            words = line_data.get("words", [])


                            avg_confidence = sum(w.get("confidence", 0.8) for w in words) / len(words) if words else 0.8


                            


                            ocr_line = OCRLine(


                                id=str(uuid4()),


                                ocr_job_id=job.id,


                                line_number=idx,


                                text=line_text,


                                confidence=avg_confidence,


                                is_valid=parsed is not None,


                                validation_error=None if parsed else "Geçersiz ölçü formatı",


                                parsed_data=parsed


                            )


                            db.add(ocr_line)


                else:


                    raise Exception(f"Azure OCR hatası: {ocr_result.error}")


                    


            else:


                # Tesseract/Simülasyon OCR


                if Image is None:


                    raise RuntimeError("Pillow (PIL) kurulu değil")


                image = Image.open(io.BytesIO(job.image_data))


                extracted_text = _simulate_ocr(image)


                


                job.extracted_text = extracted_text


                job.confidence = 0.85


                


                # Satırları parse et


                lines = extracted_text.split('\n')


                for idx, line_text in enumerate(lines, 1):


                    if line_text.strip():


                        parsed = _parse_measurement_line(line_text)


                        


                        ocr_line = OCRLine(


                            id=str(uuid4()),


                            ocr_job_id=job.id,


                            line_number=idx,


                            text=line_text.strip(),


                            confidence=0.85,


                            is_valid=parsed is not None,


                            validation_error=None if parsed else "Geçersiz ölçü formatı",


                            parsed_data=parsed


                        )


                        db.add(ocr_line)


            


            # Telefon numarası ara (her iki engine için)


            if not job.phone:


                extracted_phone = _extract_phone_from_text(job.extracted_text)


                if extracted_phone:


                    job.phone = extracted_phone


                    


                    # Müşteri eşleştir


                    customer = _match_customer_by_phone(db, extracted_phone)


                    if customer:


                        job.customer_id = customer.id


                        job.customer_match_confidence = 1.0


            


            job.status = "COMPLETED"


            job.completed_at = datetime.now(timezone.utc)


            


        except Exception as e:


            logger.error(f"OCR işleme hatası: {e}")


            job.status = "FAILED"


            job.error_message = str(e)


        


        db.commit()


        


    except Exception as e:


        logger.error(f"OCR job işleme hatası: {e}")


    finally:


        db.close()








def _simulate_ocr(image: Any) -> str:


    """OCR simülasyonu (gerçek implementasyonda Tesseract/cloud OCR)"""


    # Gerçek implementasyonda:


    # import pytesseract


    # return pytesseract.image_to_string(image, lang='tur')


    


    # Simülasyon


    return """ABC Mobilya


Tel: 0532 123 45 67





Ölçü Listesi:


700 x 400 x 2


1200 x 600 x 1


500 x 300 x 4





18mm Beyaz MDFLAM"""








def _job_to_out(job: OCRJob) -> OCRJobOut:


    """OCRJob'ı OCRJobOut'a dönüştür"""


    lines_out = []


    for line in job.lines:


        lines_out.append({


            "id": line.id,


            "line_number": line.line_number,


            "text": line.text,


            "confidence": line.confidence,


            "is_valid": line.is_valid,


            "validation_error": line.validation_error,


            "parsed_data": line.parsed_data


        })


    


    return OCRJobOut(


        id=job.id,


        status=job.status,


        extracted_text=job.extracted_text,


        confidence=job.confidence,


        customer_id=job.customer_id,


        phone=job.phone,


        order_id=job.order_id,


        error_message=job.error_message,


        created_at=job.created_at.isoformat() if job.created_at else "",


        completed_at=job.completed_at.isoformat() if job.completed_at else None,


        lines=lines_out


    )








# -----------------------------------------------------------------------------


# OCR JOB YÖNETİMİ


# -----------------------------------------------------------------------------


@router.get("/jobs", response_model=List[OCRJobOut])


def list_ocr_jobs(


    status: Optional[str] = None,


    limit: int = 50,


    db: Session = Depends(get_db),


    _user: User = Depends(get_current_user),


):


    """OCR job'larını listele"""


    query = db.query(OCRJob).order_by(OCRJob.created_at.desc())


    


    if status:


        query = query.filter(OCRJob.status == status)


    


    jobs = query.limit(limit).all()


    return [_job_to_out(job) for job in jobs]








@router.get("/jobs/{job_id}", response_model=OCRJobOut)


def get_ocr_job(


    job_id: str,


    db: Session = Depends(get_db),


    _user: User = Depends(get_current_user),


):


    """Tek bir OCR job'ı getir"""


    job = db.query(OCRJob).filter(OCRJob.id == job_id).first()


    if not job:


        raise NotFoundError("OCR job")


    return _job_to_out(job)








@router.post("/jobs/{job_id}/retry", response_model=OCRJobOut)


async def retry_ocr_job(


    job_id: str,


    background_tasks: BackgroundTasks,


    db: Session = Depends(get_db),


    _user: User = Depends(get_current_user),


):


    """Başarısız OCR job'ını tekrar dene"""


    job = db.query(OCRJob).filter(OCRJob.id == job_id).first()


    if not job:


        raise NotFoundError("OCR job")


    


    if job.status not in ["FAILED", "PENDING"]:


        raise BusinessRuleError(f"Job durumu retry için uygun değil: {job.status}")


    


    job.status = "PROCESSING"


    job.error_message = None


    db.commit()


    


    background_tasks.add_task(_process_ocr_job, job.id, db)


    


    return _job_to_out(job)








@router.delete("/jobs/{job_id}", status_code=204)


def delete_ocr_job(


    job_id: str,


    db: Session = Depends(get_db),


    _user: User = Depends(get_current_user),


):


    """OCR job'ını sil"""


    job = db.query(OCRJob).filter(OCRJob.id == job_id).first()


    if not job:


        raise NotFoundError("OCR job")


    


    db.delete(job)


    db.commit()


    


    return None








# -----------------------------------------------------------------------------


# TELEFON EŞLEŞTİRME


# -----------------------------------------------------------------------------


@router.get("/lookup-phone/{phone}", response_model=CustomerLookupResult)


def lookup_customer_by_phone(


    phone: str,


    db: Session = Depends(get_db),


    _user: User = Depends(get_current_user),


):


    """


    Telefon numarasına göre müşteri ara


    OCR'dan gelen telefon normalize edilir


    """


    normalized = _normalize_phone(phone)


    if not normalized:


        raise BusinessRuleError("Geçersiz telefon numarası")


    


    customer = _match_customer_by_phone(db, phone)


    


    if customer:


        return CustomerLookupResult(


            found=True,


            customer_id=customer.id,


            name=customer.name,


            phone=phone,


            normalized_phone=normalized,


            confidence=1.0,


            suggestions=[]


        )


    


    # Eşleşme yoksa öneriler sun


    suggestions = []


    if len(normalized) >= 7:


        partial = normalized[-7:]


        similar_customers = db.query(Customer).filter(


            Customer.phone.like(f"%{partial}%")


        ).limit(5).all()


        


        for c in similar_customers:


            suggestions.append({


                "customer_id": c.id,


                "name": c.name,


                "phone": c.phone,


                "similarity": "high" if c.phone.endswith(partial) else "medium"


            })


    


    return CustomerLookupResult(


        found=False,


        phone=phone,


        normalized_phone=normalized,


        confidence=0.0,


        suggestions=suggestions


    )








# -----------------------------------------------------------------------------


# SİPARİŞ OLUŞTURMA


# -----------------------------------------------------------------------------


@router.post("/create-order", response_model=Dict)


async def create_order_from_ocr(


    data: OrderCreateFromOCR,


    db: Session = Depends(get_db),


    current_user: User = Depends(get_current_user),


):


    """


    OCR sonuçlarından sipariş oluştur


    """


    # Job kontrolü


    job = db.query(OCRJob).filter(OCRJob.id == data.ocr_job_id).first()


    if not job:


        raise NotFoundError("OCR job")


    


    if job.status != "COMPLETED":


        raise BusinessRuleError(f"OCR job tamamlanmamış: {job.status}")


    


    # Müşteri kontrolü


    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()


    if not customer:


        raise NotFoundError("Müşteri")


    


    # Satırları al


    selected_lines = db.query(OCRLine).filter(


        OCRLine.ocr_job_id == job.id,


        OCRLine.line_number.in_(data.lines),


        OCRLine.is_valid == True


    ).all()


    


    if not selected_lines:


        raise BusinessRuleError("Geçerli ölçü satırı bulunamadı")


    


    # Sipariş oluştur


    ts_code = f"OP-{datetime.now().year}-{str(uuid4().hex[:4]).upper()}"


    


    order = Order(


        id=str(uuid4()),


        ts_code=ts_code,


        customer_id=customer.id,


        customer_name=customer.name,


        customer_phone=customer.phone,


        material=data.material or "Bilinmiyor",


        thickness=data.thickness or "18",


        plate_size=data.plate_size or "2100x2800",


        grain=data.grain or "0-Material",


        status="NEW",


        source="OCR",


        ocr_job_id=job.id,


        notes=data.notes or job.notes,


        created_by_id=current_user.id,


        created_at=datetime.now(timezone.utc)


    )


    


    db.add(order)


    db.flush()  # order.id almak için


    


    # Parçaları oluştur


    total_parts = 0


    for line in selected_lines:


        parsed = line.parsed_data or {}


        adet = parsed.get("adet", 1)


        total_parts += adet


        


        part = OrderPart(


            id=str(uuid4()),


            order_id=order.id,


            line_number=line.line_number,


            boy=parsed.get("boy", 0),


            en=parsed.get("en", 0),


            adet=adet,


            grain=data.grain or "0-Material",


            info=line.text,


            created_at=datetime.now(timezone.utc)


        )


        db.add(part)


    


    order.total_parts = total_parts


    


    # Job'ı güncelle


    job.order_id = order.id


    job.status = "ORDER_CREATED"


    


    # Audit log


    log = AuditLog(


        id=str(uuid4()),


        user_id=current_user.id,


        order_id=order.id,


        action="ORDER_CREATE_FROM_OCR",


        detail=f"OCR {job.id} -> Sipariş {order.id} | {total_parts} parça",


        created_at=datetime.now(timezone.utc)


    )


    db.add(log)


    db.commit()


    


    return {


        "success": True,


        "order_id": order.id,


        "ts_code": ts_code,


        "customer_name": customer.name,


        "total_parts": total_parts,


        "message": "Sipariş başarıyla oluşturuldu"


    }








# -----------------------------------------------------------------------------


# ÖZET VE İSTATİSTİKLER


# -----------------------------------------------------------------------------


@router.get("/summary")


def get_ocr_summary(


    db: Session = Depends(get_db),


    _user: User = Depends(get_current_user),


):


    """OCR istatistiklerini getir"""


    from sqlalchemy import func


    


    total_jobs = db.query(func.count(OCRJob.id)).scalar() or 0


    completed = db.query(func.count(OCRJob.id)).filter(OCRJob.status == "COMPLETED").scalar() or 0


    failed = db.query(func.count(OCRJob.id)).filter(OCRJob.status == "FAILED").scalar() or 0


    orders_created = db.query(func.count(OCRJob.id)).filter(OCRJob.order_id != None).scalar() or 0


    


    # Son 7 gün


    week_ago = datetime.now(timezone.utc) - __import__('datetime').timedelta(days=7)


    recent_jobs = db.query(OCRJob).filter(


        OCRJob.created_at >= week_ago


    ).order_by(OCRJob.created_at.desc()).limit(10).all()


    


    return {


        "total_jobs": total_jobs,


        "completed": completed,


        "failed": failed,


        "success_rate": round((completed / total_jobs * 100), 2) if total_jobs > 0 else 0,


        "orders_created": orders_created,


        "conversion_rate": round((orders_created / completed * 100), 2) if completed > 0 else 0,


        "recent_jobs": [_job_to_out(job) for job in recent_jobs]


    }





