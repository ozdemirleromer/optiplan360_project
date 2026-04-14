"""expand phase1 canonical enums to master spec v3

Revision ID: phase1_canonical_v3_enums
Revises: phase1_canonical_v2
Create Date: 2026-03-18 00:30:00.000000
"""

from __future__ import annotations

from alembic import op

revision = "phase1_canonical_v3_enums"
down_revision = "phase1_canonical_v2"
branch_labels = None
depends_on = None

_PHASE1_STATUS_VALUES = (
    "PHASE4_PREVIEW_READY",
    "PHASE4_EXPORT_RUNNING",
    "PHASE4_EXPORT_FAILED",
    "PHASE4_RETRY_PENDING",
)

_AUDIT_EVENT_VALUES = (
    "PHASE4_PREVIEW_CREATED",
    "PHASE4_EXPORT_STARTED",
    "PHASE4_EXPORT_SUCCEEDED",
    "PHASE4_EXPORT_FAILED",
    "MANIFEST_CREATED",
    "RETRY_DECISION_TAKEN",
)


def _add_postgres_enum_values(enum_name: str, values: tuple[str, ...]) -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for value in values:
        op.execute(f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS '{value}'")


def upgrade() -> None:
    _add_postgres_enum_values("phase1recordstatus", _PHASE1_STATUS_VALUES)
    _add_postgres_enum_values("auditeventtype", _AUDIT_EVENT_VALUES)


def downgrade() -> None:
    # PostgreSQL enum value removal requires type recreation; keep downgrade no-op.
    pass
