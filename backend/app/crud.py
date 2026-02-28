from datetime import datetime

import pytz
from sqlalchemy.orm import Session

from . import models, schemas


# --- Customer CRUD ---
def get_customer(db: Session, customer_id: int):
    return db.query(models.Customer).filter(models.Customer.id == customer_id).first()


def get_customer_by_phone(db: Session, phone: str):
    return db.query(models.Customer).filter(models.Customer.phone == phone).first()


def get_customers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Customer).offset(skip).limit(limit).all()


def create_customer(db: Session, customer: schemas.CustomerCreate):
    db_customer = models.Customer(name=customer.name, phone=customer.phone)
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer


# --- Order CRUD ---
def get_order(db: Session, order_id: int):
    return db.query(models.Order).filter(models.Order.id == order_id).first()


def get_orders(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Order).offset(skip).limit(limit).all()


def create_order(db: Session, order: schemas.OrderCreate):
    istanbul_tz = pytz.timezone("Europe/Istanbul")
    ts_code = datetime.now(istanbul_tz).strftime("%Y%m%d_%H%M%S")

    db_order = models.Order(
        ts_code=ts_code,
        customer_id=order.customer_id,
        crm_name_snapshot=order.crm_name_snapshot,
        status="DRAFT",
    )
    db.add(db_order)
    db.flush()

    for part_data in order.parts:
        db_part = models.Part(**part_data.dict(), order_id=db_order.id)
        db.add(db_part)

    db.commit()
    db.refresh(db_order)
    return db_order


def update_order_status(db: Session, order_id: int, status: schemas.OrderStatusEnum):
    db_order = get_order(db, order_id=order_id)
    if db_order:
        db_order.status = status
        db_order.updated_at = datetime.now(pytz.timezone("Europe/Istanbul"))
        db.commit()
        db.refresh(db_order)
    return db_order


# --- Station CRUD ---
def get_station(db: Session, station_id: int):
    return db.query(models.Station).filter(models.Station.id == station_id).first()


def get_stations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Station).offset(skip).limit(limit).all()


def create_station(db: Session, station: schemas.StationBase):
    db_station = models.Station(name=station.name, description=station.description)
    db.add(db_station)
    db.commit()
    db.refresh(db_station)
    return db_station


def update_station(db: Session, station_id: int, station: schemas.StationUpdate):
    db_station = get_station(db, station_id=station_id)
    if not db_station:
        return None
    update_data = station.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_station, field, value)
    db.commit()
    db.refresh(db_station)
    return db_station


def delete_station(db: Session, station_id: int):
    db_station = get_station(db, station_id=station_id)
    if not db_station:
        return False
    db.delete(db_station)
    db.commit()
    return True


# --- StatusLog CRUD ---
def create_status_log(db: Session, log: schemas.StatusLogCreate):
    db_log = models.StatusLog(**log.dict())
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log
