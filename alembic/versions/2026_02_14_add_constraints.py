"""
Alembic migration script to enforce critical rules.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2026_02_14_add_constraints'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Add constraint to ensure no edge banding for ARKALIK
    op.execute("""
    ALTER TABLE parts
    ADD CONSTRAINT chk_no_edge_banding_arkalik
    CHECK (
        part_group != 'ARKALIK' OR (
            edge_banding_u1 IS NULL AND
            edge_banding_u2 IS NULL AND
            edge_banding_k1 IS NULL AND
            edge_banding_k2 IS NULL
        )
    );
    """)

def downgrade():
    # Remove the constraint
    op.execute("""
    ALTER TABLE parts
    DROP CONSTRAINT chk_no_edge_banding_arkalik;
    """)