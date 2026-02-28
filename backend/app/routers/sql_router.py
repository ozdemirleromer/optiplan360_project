"""
OptiPlan 360 — SQL Board Router
Veritabanı tabloları görüntüleme, sorgu çalıştırma, veri yönetimi
"""

from datetime import datetime, timezone
from typing import Any, List, Optional
from uuid import uuid4

from app.auth import require_admin
from app.database import engine, get_db
from app.exceptions import BusinessRuleError, NotFoundError
from app.models import AuditLog, User
from app.utils import create_audit_log
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import inspect as sa_inspect
from sqlalchemy import text
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/sql", tags=["sql"])


# ─── Schemas ───
class TableInfo(BaseModel):
    name: str
    row_count: int
    columns: List[str]


class QueryRequest(BaseModel):
    sql: str
    limit: int = 100


class QueryResult(BaseModel):
    columns: List[str]
    rows: List[List[Any]]
    row_count: int
    execution_time_ms: float
    truncated: bool


class TableDataResult(BaseModel):
    table: str
    columns: List[str]
    rows: List[List[Any]]
    total_rows: int
    page: int
    per_page: int


# ─── Yetki kontrolü (admin only) ───
# require_admin is imported from app.auth (line 10)


# Güvenlik: Sadece SELECT sorgularına izin ver
BLOCKED_KEYWORDS = [
    "DROP",
    "DELETE",
    "TRUNCATE",
    "ALTER",
    "CREATE",
    "INSERT",
    "UPDATE",
    "GRANT",
    "REVOKE",
]


def _is_safe_query(sql: str) -> bool:
    normalized = sql.strip()
    if not normalized:
        return False

    # Tek statement disi sorgulari engelle (stacked query)
    if normalized.endswith(";"):
        normalized = normalized[:-1].strip()
    if ";" in normalized:
        return False

    # Inline yorumlarla kacis denemelerini engelle
    if "--" in normalized or "/*" in normalized or "*/" in normalized:
        return False

    upper = normalized.upper()
    # Sadece SELECT ile başlayanlar
    if not upper.startswith("SELECT"):
        return False
    # Tehlikeli keyword kontrolü
    for kw in BLOCKED_KEYWORDS:
        if kw in upper:
            return False
    return True


# ═══════════════════════════════════════════════════
# TABLO LİSTESİ
# ═══════════════════════════════════════════════════
@router.get("/tables", response_model=List[TableInfo])
def list_tables(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Veritabanındaki tüm tabloları listele"""
    inspector = sa_inspect(engine)
    table_names = inspector.get_table_names()
    result = []
    for name in table_names:
        try:
            count_result = db.execute(text(f'SELECT COUNT(*) FROM "{name}"'))
            count = count_result.scalar() or 0
        except Exception:
            count = 0
        columns = [col["name"] for col in inspector.get_columns(name)]
        result.append(TableInfo(name=name, row_count=count, columns=columns))
    return result


# ═══════════════════════════════════════════════════
# TABLO VERİLERİNİ GÖRÜNTÜLE
# ═══════════════════════════════════════════════════
@router.get("/tables/{table_name}", response_model=TableDataResult)
def get_table_data(
    table_name: str,
    page: int = 1,
    per_page: int = 50,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Bir tablonun verilerini sayfalı olarak getir"""
    inspector = sa_inspect(engine)
    table_names = inspector.get_table_names()
    if table_name not in table_names:
        raise NotFoundError("Tablo")

    columns = [col["name"] for col in inspector.get_columns(table_name)]

    # Total count
    total_result = db.execute(text(f'SELECT COUNT(*) FROM "{table_name}"'))
    total = total_result.scalar() or 0

    # Paginated data
    offset = (page - 1) * per_page
    data_result = db.execute(
        text(f'SELECT * FROM "{table_name}" LIMIT :limit OFFSET :offset'),
        {"limit": per_page, "offset": offset},
    )
    rows = [list(row) for row in data_result.fetchall()]

    # Serialize datetime objects
    for row in rows:
        for i, val in enumerate(row):
            if isinstance(val, datetime):
                row[i] = val.isoformat()

    return TableDataResult(
        table=table_name,
        columns=columns,
        rows=rows,
        total_rows=total,
        page=page,
        per_page=per_page,
    )


# ═══════════════════════════════════════════════════
# SQL SORGU ÇALIŞTIR (Sadece SELECT)
# ═══════════════════════════════════════════════════
@router.post("/query", response_model=QueryResult)
def execute_query(
    body: QueryRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """SQL sorgusu çalıştır (sadece SELECT)"""
    if not _is_safe_query(body.sql):
        raise BusinessRuleError(
            "Sadece SELECT sorguları çalıştırılabilir. DML/DDL sorgularına izin verilmez."
        )

    limit = min(body.limit, 500)
    start = datetime.now(timezone.utc)

    sql_query = body.sql.strip()
    if "LIMIT" not in sql_query.upper():
        sql_query += f" LIMIT {limit}"

    try:
        result = db.execute(text(sql_query))
        columns = list(result.keys()) if result.returns_rows else []
        if result.returns_rows:
            raw_rows = result.fetchall()
            rows = []
            for row in raw_rows:
                processed = []
                for val in row:
                    if isinstance(val, datetime):
                        processed.append(val.isoformat())
                    else:
                        processed.append(val)
                rows.append(processed)
        else:
            rows = []
    except Exception as e:
        raise BusinessRuleError(f"SQL hatası: {str(e)}")

    elapsed = (datetime.now(timezone.utc) - start).total_seconds() * 1000

    # Audit log
    log = AuditLog(
        id=str(uuid4()),
        user_id=admin.id,
        order_id=None,
        action="SQL_QUERY",
        detail=body.sql[:200],
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()

    return QueryResult(
        columns=columns,
        rows=rows,
        row_count=len(rows),
        execution_time_ms=round(elapsed, 2),
        truncated=len(rows) >= limit,
    )


# ═══════════════════════════════════════════════════
# TABLO ŞEMASI
# ═══════════════════════════════════════════════════
@router.get("/schema/{table_name}")
def get_table_schema(
    table_name: str,
    _admin: User = Depends(require_admin),
):
    """Bir tablonun şema bilgilerini getir"""
    inspector = sa_inspect(engine)
    table_names = inspector.get_table_names()
    if table_name not in table_names:
        raise NotFoundError("Tablo")

    columns = inspector.get_columns(table_name)
    pk = inspector.get_pk_constraint(table_name)
    fks = inspector.get_foreign_keys(table_name)
    indexes = inspector.get_indexes(table_name)

    return {
        "table": table_name,
        "columns": [
            {
                "name": col["name"],
                "type": str(col["type"]),
                "nullable": col.get("nullable", True),
                "default": str(col.get("default", "")) if col.get("default") else None,
                "primary_key": col["name"] in (pk.get("constrained_columns", []) if pk else []),
            }
            for col in columns
        ],
        "primary_key": pk.get("constrained_columns", []) if pk else [],
        "foreign_keys": [
            {
                "columns": fk.get("constrained_columns", []),
                "referred_table": fk.get("referred_table"),
                "referred_columns": fk.get("referred_columns", []),
            }
            for fk in fks
        ],
        "indexes": [
            {
                "name": idx.get("name"),
                "columns": idx.get("column_names", []),
                "unique": idx.get("unique", False),
            }
            for idx in indexes
        ],
    }


# ═══════════════════════════════════════════════════
# KAYITLI SORGULAR
# ═══════════════════════════════════════════════════


class SavedQueryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sql: str


class SavedQueryOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    sql_query: str
    created_at: str

    class Config:
        from_attributes = True


@router.get("/saved", response_model=List[SavedQueryOut])
def list_saved_queries(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Kayıtlı sorguları listele"""
    from app.models import SavedQuery

    queries = db.query(SavedQuery).order_by(SavedQuery.created_at.desc()).all()
    return [
        SavedQueryOut(
            id=q.id,
            name=q.name,
            description=q.description,
            sql_query=q.sql_query,
            created_at=q.created_at.isoformat(),
        )
        for q in queries
    ]


@router.post("/saved", response_model=SavedQueryOut)
def create_saved_query(
    body: SavedQueryCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Yeni sorgu kaydet"""
    from app.models import SavedQuery

    if not _is_safe_query(body.sql):
        raise BusinessRuleError("Sadece SELECT sorguları kaydedilebilir.")

    q = SavedQuery(
        id=str(uuid4()),
        name=body.name,
        description=body.description,
        sql_query=body.sql,
        created_by=admin.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(q)
    db.commit()

    return SavedQueryOut(
        id=q.id,
        name=q.name,
        description=q.description,
        sql_query=q.sql_query,
        created_at=q.created_at.isoformat(),
    )


@router.delete("/saved/{id}", status_code=204)
def delete_saved_query(
    id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Kayıtlı sorguyu sil"""
    from app.models import SavedQuery

    db.query(SavedQuery).filter(SavedQuery.id == id).delete()
    db.commit()
    return None


import io
import urllib.parse

# ═══════════════════════════════════════════════════
# EXPORT
# ═══════════════════════════════════════════════════
from fastapi.responses import StreamingResponse
from openpyxl import Workbook


@router.post("/export")
def export_query_result(
    body: QueryRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Sorgu sonucunu Excel olarak indir"""
    if not _is_safe_query(body.sql):
        raise BusinessRuleError("Güvenli olmayan sorgu")

    limit = min(body.limit, 5000)  # Export limit higher
    sql_query = body.sql.strip()
    if "LIMIT" not in sql_query.upper():
        sql_query += f" LIMIT {limit}"

    try:
        result = db.execute(text(sql_query))
        columns = list(result.keys()) if result.returns_rows else []
        rows = result.fetchall() if result.returns_rows else []
    except Exception as e:
        raise BusinessRuleError(f"SQL Hatası: {str(e)}")

    # Excel oluştur
    wb = Workbook()
    ws = wb.active
    ws.title = "Query Result"

    # Header
    ws.append(columns)

    # Rows
    for row in rows:
        row_data = []
        for val in row:
            if isinstance(val, datetime):
                row_data.append(val.isoformat())
            else:
                row_data.append(val)
        ws.append(row_data)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"export_{timestamp}.xlsx"
    encoded_filename = urllib.parse.quote(filename)

    # Audit log
    # Audit log
    create_audit_log(db, admin.id, "SQL_EXPORT", body.sql[:200], None)
    db.commit()

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"},
    )
