"""add crm_quotes.document_no column

Revision ID: 2026_03_18_crm_quote_document_no
Revises: phase1_canonical_v3_enums
Create Date: 2026-03-18
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "2026_03_18_crm_quote_document_no"
down_revision: Union[str, None] = "phase1_canonical_v3_enums"
branch_labels = None
depends_on = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _table_exists(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def _column_exists(table_name: str, column_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    return any(column.get("name") == column_name for column in _inspector().get_columns(table_name))


def _index_exists(table_name: str, index_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    return any(index.get("name") == index_name for index in _inspector().get_indexes(table_name))


def upgrade() -> None:
    if not _table_exists("crm_quotes"):
        return

    if not _column_exists("crm_quotes", "document_no"):
        op.add_column("crm_quotes", sa.Column("document_no", sa.String(), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE crm_quotes
            SET document_no = quote_number
            WHERE document_no IS NULL
            """
        )
    )

    if not _index_exists("crm_quotes", "ix_crm_quotes_document_no"):
        op.create_index("ix_crm_quotes_document_no", "crm_quotes", ["document_no"], unique=False)


def downgrade() -> None:
    if not _table_exists("crm_quotes"):
        return

    if _index_exists("crm_quotes", "ix_crm_quotes_document_no"):
        op.drop_index("ix_crm_quotes_document_no", table_name="crm_quotes")

    if _column_exists("crm_quotes", "document_no"):
        op.drop_column("crm_quotes", "document_no")
