from app.database import get_db
from app.exceptions import NotFoundError, ValidationError
from app.models import Order
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter(prefix="/public/track", tags=["public"])











class PublicTrackingOut(BaseModel):



    ts_code: str



    customer_snapshot: str



    status: str



    thickness_mm: float



    color: str



    material_name: str



    total_parts: int



    created_at: str











@router.get("/{token}", response_model=PublicTrackingOut)
def track_order_public(token: str, db: Session = Depends(get_db)):
    """Müşteriler için token ile sipariş durumunu sorgulama"""
    if not token or len(token) < 10:
        raise ValidationError("Geçersiz token")

    order = db.query(Order).filter(Order.tracking_token == token).first()
    if not order:
        raise NotFoundError("Sipariş")







    return PublicTrackingOut(



        ts_code=order.ts_code,



        customer_snapshot=order.crm_name_snapshot or "Müşteri",



        status=order.status.value if hasattr(order.status, "value") else order.status,



        thickness_mm=float(order.thickness_mm) if order.thickness_mm else 0.0,



        color=order.color or "",



        material_name=order.material_name or "",



        total_parts=len(order.parts),



        created_at=order.created_at.isoformat() if order.created_at else "",



    )



