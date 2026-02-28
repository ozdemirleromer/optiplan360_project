"""add station fields

Revision ID: 2026_02_16_stations
Revises: 2026_02_14_add_constraints
Create Date: 2026-02-16 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '2026_02_16_stations'
down_revision: Union[str, None] = '2026_02_14_add_constraints'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to stations table
    op.add_column('stations', sa.Column('active', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('stations', sa.Column('last_scan_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('stations', sa.Column('scan_count_today', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('stations', sa.Column('istasyon_durumu', sa.String(), nullable=True, server_default='Hazır'))


def downgrade() -> None:
    # Remove columns from stations table
    op.drop_column('stations', 'istasyon_durumu')
    op.drop_column('stations', 'scan_count_today')
    op.drop_column('stations', 'last_scan_at')
    op.drop_column('stations', 'active')
