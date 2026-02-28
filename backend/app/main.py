from fastapi import FastAPI, Depends, Response, Request
from dotenv import load_dotenv
load_dotenv()
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from . import models
from .database import SessionLocal, engine
from .security import add_security_middleware
from .routers.v1 import v1_router
from .tasks.reminders import start_scheduler
from .exceptions import AppError
from .rate_limit import limiter
from .middleware.cache_middleware import CacheMiddleware
from .logging_config import setup_logging
import os
import time

# Setup logging with rotation
logger = setup_logging()

# NOT: Tablo oluÅŸturma Alembic migration'larÄ±na bÄ±rakÄ±ldÄ±.
# models.Base.metadata.create_all kaldÄ±rÄ±ldÄ± â€” migration geÃ§miÅŸini eziyordu.

def _get_cors_origins() -> list[str]:
    """
    CORS origin listesini env'den al.
    CORS_ORIGINS doluysa onu kullan, yoksa gÃ¼venli local/prod default'lara dÃ¶n.
    """
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    return [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
        "http://localhost:3005",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
        "http://127.0.0.1:3004",
        "http://127.0.0.1:3005",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://optiplan360.com",
        "https://www.optiplan360.com",
    ]

app = FastAPI(
    title="OPTIPLAN360",
    description="OptiPlan 360 - Ãœretim YÃ¶netim Sistemi",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add security middleware
add_security_middleware(app)

# Rate limiting middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Performance middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Cache middleware - GET isteklerini cache'le
app.add_middleware(CacheMiddleware, ttl=60)

# CORS middleware with security headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
    expose_headers=["X-Total-Count", "X-Response-Time"],
)

# GÃ¼venlik header'larÄ± security.py'deki middleware tarafÄ±ndan ekleniyor.
# Burada tekrar eklenmiyordu â€” Ã§ift kayÄ±t kaldÄ±rÄ±ldÄ±.

# Performance monitoring middleware
@app.middleware("http")
async def add_performance_monitoring(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.3f}s"
    
    if process_time > 1.0:  # Slow request warning
        logger.warning(f"Slow request: {request.method} {request.url} took {process_time:.3f}s")
    
    return response

# â”€â”€ Global exception handler: AppError â†’ standart JSON yanÄ±t â”€â”€
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": [d.model_dump() for d in exc.details],
            }
        },
    )

# Include routers
app.include_router(v1_router)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
async def root():
    return {
        "message": "OptiPlan 360 API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/auth")
async def auth_root():
    return {
        "message": "OptiPlan 360 Auth API",
        "login": "/api/v1/auth/login",
        "refresh": "/api/v1/auth/refresh",
        "me": "/api/v1/auth/me",
    }

@app.get("/orchestrator")
async def orchestrator_root():
    return {
        "message": "OptiPlan 360 Orchestrator API",
        "base": "/api/v1/orchestrator",
        "jobs": "/api/v1/orchestrator/jobs",
    }

def _seed_canonical_stations(db: Session) -> None:
    """
    MASTER_HANDOFF Â§0.6 â€” 5 kanonik Ã¼retim istasyonunu oluÅŸturur.
    Ä°dempotent: mevcut ise atlar.
    """
    from .models import Station

    canonical = [
        {
            "name": "HazÄ±rlÄ±k",
            "description": "Malzeme hazÄ±rlama ve kesim hazÄ±rlÄ±ÄŸÄ± (Ä°ki okutmalÄ±: 1. okutma baÅŸlangÄ±Ã§)",
            "istasyon_durumu": "HazÄ±r",
        },
        {
            "name": "Ebatlama",
            "description": "ParÃ§alarÄ±n boyutlandÄ±rÄ±lmasÄ± (Ä°ki okutmalÄ±: 2. okutma tamamlandÄ±)",
            "istasyon_durumu": "HazÄ±r",
        },
        {
            "name": "Bantlama",
            "description": "Kenar bantÄ± uygulanmasÄ±",
            "istasyon_durumu": "HazÄ±r",
        },
        {
            "name": "Kontrol",
            "description": "Kalite kontrolÃ¼ (Ä°ki okutmalÄ±: 1. okutma teslimata hazÄ±r)",
            "istasyon_durumu": "HazÄ±r",
        },
        {
            "name": "Teslim",
            "description": "Teslimat ve paketleme (Ä°ki okutmalÄ±: 2. okutma teslimat yapÄ±ldÄ±)",
            "istasyon_durumu": "HazÄ±r",
        },
    ]
    created = 0
    for s in canonical:
        exists = db.query(Station).filter(Station.name == s["name"]).first()
        if not exists:
            db.add(Station(
                name=s["name"],
                description=s["description"],
                active=True,
                istasyon_durumu=s["istasyon_durumu"],
            ))
            created += 1
    if created:
        db.commit()
        logger.info("Kanonik istasyonlar oluÅŸturuldu: %d adet", created)


def _seed_admin_user(db: Session) -> None:
    """
    VarsayÄ±lan admin kullanÄ±cÄ±sÄ±nÄ± oluÅŸturur.
    Ä°dempotent: admin zaten varsa atlar.
    """
    from .auth import hash_password

    existing = db.query(models.User).filter(models.User.username == "admin").first()
    if existing:
        # Åifre hash'i yoksa veya boÅŸsa yeniden oluÅŸtur
        if not existing.password_hash:
            existing.password_hash = hash_password("admin")
            db.commit()
            logger.info("Admin kullanÄ±cÄ±sÄ±nÄ±n ÅŸifresi gÃ¼ncellendi.")
        return

    admin_user = models.User(
        username="admin",
        email="admin@optiplan360.local",
        display_name="Admin",
        password_hash=hash_password("admin"),
        role="ADMIN",
        is_active=True,
    )
    db.add(admin_user)
    db.commit()
    logger.info("VarsayÄ±lan admin kullanÄ±cÄ±sÄ± oluÅŸturuldu (admin/admin).")


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    dialect = conn.dialect.name
    if dialect == "sqlite":
        rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
        return any(str(row[1]) == column_name for row in rows)

    row = conn.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = :table_name
              AND column_name = :column_name
            LIMIT 1
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    ).first()
    return row is not None


def _add_column_if_missing(conn, table_name: str, column_name: str, column_sql: str) -> bool:
    if _column_exists(conn, table_name, column_name):
        return False
    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_sql}"))
    return True


def _run_startup_schema_fixes() -> None:
    added_columns: list[str] = []

    with engine.begin() as conn:
        column_specs: list[tuple[str, str, str]] = [
            ("orders", "tracking_token", "VARCHAR(36)"),
            ("stations", "device_type", "VARCHAR"),
            ("stations", "device_model", "VARCHAR"),
            ("stations", "device_serial_number", "VARCHAR"),
            ("stations", "ip_address", "VARCHAR"),
            ("stations", "connection_type", "VARCHAR"),
            ("stations", "installation_date", "TIMESTAMP"),
            ("stations", "last_maintenance_date", "TIMESTAMP"),
            ("crm_accounts", "plaka_birim_fiyat", "DOUBLE PRECISION"),
            ("crm_accounts", "bant_metre_fiyat", "DOUBLE PRECISION"),
            ("opti_jobs", "claim_token", "VARCHAR"),
            ("opti_jobs", "xml_file_path", "VARCHAR"),
            ("opti_jobs", "result_json", "TEXT"),
            ("orders", "order_no", "INTEGER"),
            ("orders", "reminder_count", "INTEGER DEFAULT 0"),
            ("orders", "last_reminder_at", "TIMESTAMP"),
        ]

        for table_name, column_name, column_sql in column_specs:
            try:
                if _add_column_if_missing(conn, table_name, column_name, column_sql):
                    added_columns.append(f"{table_name}.{column_name}")
            except Exception as exc:
                logger.warning("Schema fix atlandi (%s.%s): %s", table_name, column_name, exc)

        try:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_orders_tracking_token ON orders(tracking_token)"))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_single_opti_running "
                "ON opti_jobs(state) WHERE state = 'OPTI_RUNNING'"
            ))
        except Exception as exc:
            logger.warning("Schema index fix atlandi: %s", exc)

    if added_columns:
        logger.info("Schema self-heal: %d kolon eklendi.", len(added_columns))
    else:
        logger.info("Schema self-heal: eksik kolon bulunmadi.")


@app.on_event("startup")
def startup_event():
    # Eksik tablolari otomatik olustur (migrate edilmemislerse)
    try:
        models.Base.metadata.create_all(bind=engine, checkfirst=True)
        _run_startup_schema_fixes()
        logger.info("DB tablolari kontrol edildi / olusturuldu.")

        # Runtime UUID + order_no doldurma
        db = SessionLocal()
        try:
            from app.models import Order
            import uuid
            null_orders = db.query(Order).filter(Order.tracking_token == None).all()
            if null_orders:
                for o in null_orders:
                    o.tracking_token = str(uuid.uuid4())
                db.commit()
                logger.info(f"{len(null_orders)} eski siparise tracking_token atandi.")

            # Mevcut siparişlere sıralı order_no ata
            null_no_orders = db.query(Order).filter(Order.order_no == None).order_by(Order.created_at.asc()).all()
            if null_no_orders:
                from sqlalchemy import func as sa_func
                max_no = db.query(sa_func.max(Order.order_no)).scalar() or 0
                for o in null_no_orders:
                    max_no += 1
                    o.order_no = max_no
                db.commit()
                logger.info(f"{len(null_no_orders)} eski siparise order_no atandi.")
        except Exception:
            pass
        finally:
            db.close()

    except Exception as exc:
        logger.warning("Tablo olusturma hatasi (atlaniyor): %s", exc)
    start_scheduler()
    db = SessionLocal()
    try:
        _seed_canonical_stations(db)
        _seed_admin_user(db)
    except Exception as exc:
        logger.warning("Seed hatasÄ± (atlanÄ±yor): %s", exc)
    finally:
        db.close()

from fastapi import WebSocket, WebSocketDisconnect
from .websockets import manager

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Sadece baÄŸlantÄ±yÄ± aÃ§Ä±k tutmak ve ping-pong iÃ§in
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/health")
def health_check(db: Session = Depends(get_db), response: Response = None):
    """
    API saÄŸlÄ±k kontrolÃ¼ endpoint'i.
    - DB saÄŸlÄ±klÄ±ysa HTTP 200 + status: healthy
    - DB eriÅŸilemezse HTTP 503 + status: degraded
    Monitoring araÃ§larÄ± (Prometheus, k8s probe, Uptime Robot) HTTP kodu okur.
    """
    db_healthy = False
    try:
        db.execute(text("SELECT 1"))
        db_healthy = True
    except Exception as e:
        logger.error(f"Health check DB hatasÄ±: {e}")

    overall = "healthy" if db_healthy else "degraded"

    if not db_healthy and response is not None:
        response.status_code = 503

    return {
        "status": overall,
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "database": "healthy" if db_healthy else "unhealthy",
        "service": "OPTIPLAN360 API",
    }

# GET /api/v1/config/permissions endpoint'i
# config_router.py'e taÅŸÄ±ndÄ± â€” app/routers/config_router.py

