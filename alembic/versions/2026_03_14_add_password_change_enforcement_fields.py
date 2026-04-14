"""add_password_change_enforcement_fields

Revision ID: 2026_03_14_add_password_change_enforcement_fields
Revises: 2026_03_14_optiplan_xlsx_only
Create Date: 2026-03-14 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2026_03_14_add_password_change_enforcement_fields'
down_revision: Union[str, None] = '2026_03_14_optiplan_xlsx_only'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _table_exists(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def _column_exists(table_name: str, column_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    return any(column.get("name") == column_name for column in _inspector().get_columns(table_name))


def upgrade() -> None:
    """Phase 1 Intake Security: Password change enforcement alanları ekle"""

    if _table_exists('users'):
        if not _column_exists('users', 'password_changed_at'):
            op.add_column('users', sa.Column('password_changed_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True))
        if not _column_exists('users', 'is_default_password'):
            op.add_column('users', sa.Column('is_default_password', sa.Boolean(), server_default='false', nullable=True))

        # Mevcut admin kullanıcıları için default password flag'i ayarla
        op.execute("""
            UPDATE users 
            SET is_default_password = true 
            WHERE username = 'admin' AND is_default_password = false
        """)


def downgrade() -> None:
    """Password change enforcement alanlarını kaldır"""

    if _table_exists('users'):
        # Mevcut admin kullanıcıları için flag'i temizle
        op.execute("""
            UPDATE users 
            SET is_default_password = false 
            WHERE username = 'admin'
        """)

        # Column'ları kaldır
        if _column_exists('users', 'is_default_password'):
            op.drop_column('users', 'is_default_password')
        if _column_exists('users', 'password_changed_at'):
            op.drop_column('users', 'password_changed_at')
