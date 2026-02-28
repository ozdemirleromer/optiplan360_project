from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel


async def trigger_ws_broadcast(payload: dict):
    from ..websockets import manager

    await manager.broadcast(payload)


from typing import List

from sqlalchemy.orm import Session

from .. import crud, schemas
from ..auth import get_current_user, require_admin
from ..database import SessionLocal
from ..exceptions import BusinessRuleError, ConflictError, NotFoundError, StatusTransitionError
from ..models import Station, StatusLog

router = APIRouter(prefix="/api/v1", tags=["stations"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/stations/", response_model=List[schemas.Station])
def read_stations(
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    stations = crud.get_stations(db, skip=skip, limit=limit)
    return stations


@router.get("/stations/{station_id}", response_model=schemas.Station)
def read_station(station_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    db_station = crud.get_station(db, station_id=station_id)
    if db_station is None:
        raise NotFoundError("İstasyon", station_id)
    return db_station


@router.post("/stations/", response_model=schemas.Station, status_code=201)
def create_station(
    station: schemas.StationBase,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    existing = db.query(Station).filter(Station.name == station.name).first()
    if existing:
        raise ConflictError("Bu istasyon adı zaten mevcut")
    return crud.create_station(db=db, station=station)


@router.put("/stations/{station_id}", response_model=schemas.Station)
def update_station(
    station_id: int,
    station: schemas.StationUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    updated = crud.update_station(db=db, station_id=station_id, station=station)
    if updated is None:
        raise NotFoundError("İstasyon", station_id)
    return updated


@router.patch("/stations/{station_id}/toggle", response_model=schemas.Station)
def toggle_station(
    station_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Toggle station active/inactive status"""
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise NotFoundError("İstasyon", station_id)

    station.active = not station.active
    db.commit()
    db.refresh(station)
    return station


@router.delete("/stations/{station_id}")
def delete_station(
    station_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    ok = crud.delete_station(db=db, station_id=station_id)
    if not ok:
        raise NotFoundError("İstasyon", station_id)
    return {"ok": True}


@router.post("/status_logs/", response_model=schemas.StatusLog)
def create_status_log(
    log: schemas.StatusLogCreate, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    return crud.create_status_log(db=db, log=log)


@router.post("/stations/{station_id}/update-status")
@router.post("/{station_id}/update-status")
def update_status(
    station_id: int,
    part_id: int,
    status: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise NotFoundError("İstasyon", station_id)

    status_log = StatusLog(
        part_id=part_id,
        station_id=station_id,
        status=status,
        log_message=f"Status updated to {status} at station {station.name}",
    )
    db.add(status_log)
    db.commit()
    return {"message": "Status updated successfully"}


# Implement station flow enforcement

ALLOWED_TRANSITIONS = {
    "HAZIRLIK": ["EBATLAMA"],
    "EBATLAMA": ["BANTLAMA"],
    "BANTLAMA": ["KONTROL", "TESLIM"],
    "KONTROL": ["TESLIM"],
    "TESLIM": [],
}

# MASTER_HANDOFF 0.6.2: Iki adimli akislarda 2. okutma minimum 30 dakika sonra yapilabilir.
SECOND_SCAN_MINUTES = 30
SECOND_SCAN_REQUIRED_TRANSITIONS = {
    ("HAZIRLIK", "EBATLAMA"),
    ("KONTROL", "TESLIM"),
}


def _normalize_station(name: str) -> str:
    if not name:
        return ""
    return (
        name.upper()
        .replace("İ", "I")
        .replace("Ş", "S")
        .replace("Ç", "C")
        .replace("Ğ", "G")
        .replace("Ü", "U")
        .replace("Ö", "O")
    )


def _can_transition(current_name: str, next_name: str) -> bool:
    current = _normalize_station(current_name)
    nxt = _normalize_station(next_name)
    if not current:
        return True
    return nxt in ALLOWED_TRANSITIONS.get(current, [])


def _ensure_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _requires_second_scan_wait(current_name: str, next_name: str) -> bool:
    current = _normalize_station(current_name)
    nxt = _normalize_station(next_name)
    return (current, nxt) in SECOND_SCAN_REQUIRED_TRANSITIONS


@router.post("/stations/{station_id}/transition")
@router.post("/{station_id}/transition")
def transition_station(
    station_id: int,
    part_id: int,
    next_station: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    current_log = (
        db.query(StatusLog)
        .filter(StatusLog.part_id == part_id)
        .order_by(StatusLog.created_at.desc())
        .first()
    )

    if current_log:
        current_station = db.query(Station).filter(Station.id == current_log.station_id).first()
        current_name = current_station.name if current_station else ""
        if not _can_transition(current_name, next_station):
            allowed = ALLOWED_TRANSITIONS.get(_normalize_station(current_name), [])
            raise StatusTransitionError(current_name, next_station, allowed)

    new_log = StatusLog(
        part_id=part_id,
        station_id=station_id,
        status="IN_PROGRESS",
        log_message=f"Transitioned to {next_station}",
    )
    db.add(new_log)
    db.commit()
    return {"message": "Station transition successful"}


# Implement barcode scanning and station update logic


class ScanBody(BaseModel):
    order_id: str | int
    part_id: str | int | None = None
    station_id: int
    scan_type: str | None = None
    timestamp: str | None = None


@router.post("/stations/scan")
@router.post("/scan")
def scan_barcode(
    body: ScanBody,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    station = db.query(Station).filter(Station.id == body.station_id).first()
    if not station:
        raise NotFoundError("İstasyon", body.station_id)

    # Update station scan statistics
    now = datetime.now(timezone.utc)
    station.last_scan_at = now

    # Reset daily count if it's a new day
    if station.last_scan_at:
        last_scan_date = (
            station.last_scan_at.date()
            if hasattr(station.last_scan_at, "date")
            else station.last_scan_at
        )
        today = now.date()
        if last_scan_date != today:
            station.scan_count_today = 1
        else:
            station.scan_count_today = (station.scan_count_today or 0) + 1
    else:
        station.scan_count_today = 1

    # part_id zorunlu olmayan cihaz akışları için toleranslı davran.
    parsed_part_id = None
    if body.part_id not in (None, ""):
        try:
            parsed_part_id = int(str(body.part_id))
        except Exception:
            parsed_part_id = None

    if parsed_part_id is not None:
        current_log = (
            db.query(StatusLog)
            .filter(StatusLog.part_id == parsed_part_id)
            .order_by(StatusLog.created_at.desc())
            .first()
        )
        if current_log:
            prev_station = db.query(Station).filter(Station.id == current_log.station_id).first()
            prev_name = prev_station.name if prev_station else ""
            if not _can_transition(prev_name, station.name):
                allowed = ALLOWED_TRANSITIONS.get(_normalize_station(prev_name), [])
                raise StatusTransitionError(prev_name, station.name, allowed)

            if _requires_second_scan_wait(prev_name, station.name):
                last_scan_time = _ensure_aware(current_log.created_at)
                if last_scan_time is not None:
                    elapsed_minutes = int(
                        (datetime.now(timezone.utc) - last_scan_time).total_seconds() / 60
                    )
                    if elapsed_minutes < SECOND_SCAN_MINUTES:
                        # MASTER_HANDOFF §0.6.2: 2. okutma reddedildi, log kaydı düşür
                        reject_log = StatusLog(
                            part_id=parsed_part_id,
                            station_id=body.station_id,
                            status="REJECTED",
                            log_message=(
                                f"GEÇERSİZ OKUTMA: {prev_name} → {station.name} geçişi için "
                                f"minimum {SECOND_SCAN_MINUTES} dakika beklenmeli "
                                f"(geçen süre={elapsed_minutes}dk)"
                            ),
                        )
                        db.add(reject_log)
                        db.commit()
                        raise BusinessRuleError(
                            f"Geçersiz 2. okutma: {prev_name} → {station.name} geçişi için "
                            f"en az {SECOND_SCAN_MINUTES} dakika gerekli (geçen={elapsed_minutes}dk)",
                            code="SECOND_SCAN_TOO_EARLY",
                        )

        new_log = StatusLog(
            part_id=parsed_part_id,
            station_id=body.station_id,
            status="IN_PROGRESS",
            log_message=f"Scanned at station {station.name}",
        )
        db.add(new_log)
        db.commit()
        db.refresh(station)  # Refresh station to get updated values

        background_tasks.add_task(
            trigger_ws_broadcast,
            {
                "type": "STATION_SCAN",
                "data": {
                    "order_id": body.order_id,
                    "part_id": parsed_part_id,
                    "station_name": station.name,
                    "timestamp": str(datetime.now(timezone.utc)),
                },
            },
        )

    return {
        "message": "Scan processed",
        "order_info": {
            "orderNumber": str(body.order_id),
            "customerName": "Bilinmiyor",
            "partCount": 1,
            "currentStation": station.name,
            "nextStation": "",
        },
    }
