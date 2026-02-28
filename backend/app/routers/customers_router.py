from typing import List, Optional

from app.exceptions import BusinessRuleError, NotFoundError, ValidationError
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..auth import get_current_user, get_current_user_or_internal
from ..database import SessionLocal

router = APIRouter(prefix="/api/v1", tags=["customers"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/customers/", response_model=schemas.Customer)
def create_customer(
    customer: schemas.CustomerCreate, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    db_customer = crud.get_customer_by_phone(db, phone=customer.phone)
    if db_customer:
        raise BusinessRuleError("Phone already registered")
    return crud.create_customer(db=db, customer=customer)


@router.get("/customers/", response_model=List[schemas.Customer])
def read_customers(
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    customers = crud.get_customers(db, skip=skip, limit=limit)
    return customers


@router.get("/customers/lookup", response_model=Optional[schemas.Customer])
def lookup_customer_by_phone(
    phone: str = Query(..., description="Müşteri telefon numarası"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user_or_internal),
):
    """
    Telefon numarasına göre müşteri arama
    OCR'dan normalize edilmiş telefon formatı beklenir (ör: 532...)
    """
    # Telefon numarasını normalize et
    normalized_phone = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    if not normalized_phone.startswith("5") or len(normalized_phone) != 10:
        raise ValidationError("Geçersiz telefon formatı. Beklenen format: 532xxxxxxx")

    db_customer = crud.get_customer_by_phone(db, phone=normalized_phone)
    if db_customer is None:
        raise NotFoundError("Müşteri")

    return db_customer


@router.get("/customers/{customer_id}", response_model=schemas.Customer)
def read_customer(customer_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    db_customer = crud.get_customer(db, customer_id=customer_id)
    if db_customer is None:
        raise NotFoundError("Customer")
    return db_customer
