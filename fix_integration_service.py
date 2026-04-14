import re
from pathlib import Path

path = Path(r"c:\optiplan360_project\backend\app\services\integration_service.py")
text = path.read_text(encoding="utf-8")

replacements = {
    "list_entity_maps": '''def list_entity_maps(
    db: Session,
    entity_type: Optional[str] = None,
    internal_id: Optional[str] = None,
    external_system: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    q = db.query(IntegrationEntityMap)
    if entity_type:
        q = q.filter(sa_func.upper(IntegrationEntityMap.entity_type) == entity_type.strip().upper())
    if internal_id:
        q = q.filter(IntegrationEntityMap.internal_id == str(internal_id))
    if external_system:
        q = q.filter(sa_func.upper(IntegrationEntityMap.external_system) == external_system.strip().upper())
    total = q.count()
    items = q.order_by(IntegrationEntityMap.created_at.desc()).offset(skip).limit(limit).all()
    return items, total
''',
    "create_entity_map": '''def create_entity_map(
    db: Session,
    entity_type: str,
    internal_id: str,
    external_id: str,
    user_id: int,
    mapping_data: Optional[str] = None,
) -> IntegrationEntityMap:
    normalized_entity_type = (entity_type or "").strip().upper()

    existing = (
        db.query(IntegrationEntityMap)
        .filter(
            sa_func.upper(IntegrationEntityMap.entity_type) == normalized_entity_type,
            IntegrationEntityMap.internal_id == internal_id,
            IntegrationEntityMap.external_system == "MIKRO",
        )
        .first()
    )
    if existing:
        existing.external_id = external_id
        existing.mapping_data = mapping_data
        existing.last_synced_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing

    m = IntegrationEntityMap(
        id=str(uuid4()),
        entity_type=normalized_entity_type,
        internal_id=internal_id,
        external_id=external_id,
        external_system="MIKRO",
        mapping_data=mapping_data,
        last_synced_at=datetime.now(timezone.utc),
    )
    db.add(m)
    _audit(
        db,
        "MAP_CREATE",
        normalized_entity_type,
        internal_id,
        f"Eşleme oluşturuldu: {internal_id} ↔ {external_id}",
        user_id,
    )
    db.commit()
    db.refresh(m)
    return m
''',
    "list_outbox": '''def list_outbox(
    db: Session,
    status: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    q = db.query(IntegrationOutbox)
    if status:
        q = q.filter(IntegrationOutbox.status == status)
    if entity_type:
        q = q.filter(sa_func.upper(IntegrationOutbox.entity_type) == entity_type.strip().upper())
    if entity_id:
        q = q.filter(IntegrationOutbox.entity_id == str(entity_id))
    total = q.count()
    items = q.order_by(IntegrationOutbox.created_at.desc()).offset(skip).limit(limit).all()
    return items, total
''',
    "list_errors": '''def list_errors(
    db: Session,
    is_resolved: Optional[bool] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    q = db.query(IntegrationError)
    if is_resolved is not None:
        q = q.filter(IntegrationError.is_resolved == is_resolved)
    if entity_type:
        q = q.filter(sa_func.upper(IntegrationError.entity_type) == entity_type.strip().upper())
    if entity_id:
        q = q.filter(IntegrationError.entity_id == str(entity_id))
    total = q.count()
    items = q.order_by(IntegrationError.created_at.desc()).offset(skip).limit(limit).all()
    return items, total
''',
    "_audit": '''def _audit(
    db: Session,
    action: str,
    entity_type: Optional[str],
    entity_id: Optional[str],
    detail: Optional[str],
    user_id: Optional[int] = None,
):
    normalized_entity_type = (entity_type or "").strip().upper() or None
    a = IntegrationAudit(
        id=str(uuid4()),
        action=action,
        entity_type=normalized_entity_type,
        entity_id=entity_id,
        detail=detail,
        user_id=user_id,
    )
    db.add(a)
''',
    "list_audit": '''def list_audit(
    db: Session,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    q = db.query(IntegrationAudit)
    if entity_type:
        q = q.filter(sa_func.upper(IntegrationAudit.entity_type) == entity_type.strip().upper())
    if entity_id:
        q = q.filter(IntegrationAudit.entity_id == str(entity_id))
    total = q.count()
    items = q.order_by(IntegrationAudit.created_at.desc()).offset(skip).limit(limit).all()
    return items, total
''',
}

for name, new_block in replacements.items():
    pattern = rf"def {re.escape(name)}\([\s\S]*?(?=\n\ndef |\Z)"
    m = re.search(pattern, text)
    if not m:
        print(f"NOT FOUND: {name}")
        continue
    text = text[:m.start()] + new_block + text[m.end():]
    print(f"REPLACED: {name}")

path.write_text(text, encoding="utf-8")
print("DONE")
