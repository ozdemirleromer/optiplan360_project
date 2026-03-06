"""Add price tracking tables

Revision ID: 2026_02_19_price_tracking_tables
Revises: 2026_02_18_add_performance_indexes
Create Date: 2026-02-19 14:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2026_02_19_price_tracking_tables"
down_revision: Union[str, None] = "2026_02_18_add_performance_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _table_exists(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def _index_exists(table_name: str, index_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    return any(idx.get("name") == index_name for idx in _inspector().get_indexes(table_name))


def upgrade() -> None:
    if not _table_exists("price_upload_jobs"):
        op.create_table(
            "price_upload_jobs",
            sa.Column("id", sa.String(), primary_key=True, nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="PENDING"),
            sa.Column("original_filename", sa.String(), nullable=True),
            sa.Column("content_type", sa.String(), nullable=True),
            sa.Column("file_size", sa.Integer(), nullable=True),
            sa.Column("file_data", sa.LargeBinary(), nullable=True),
            sa.Column("supplier", sa.String(), nullable=False),
            sa.Column("rows_extracted", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("uploaded_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=True),
        )

    if not _index_exists("price_upload_jobs", "idx_price_upload_jobs_uploaded_by"):
        op.create_index(
            "idx_price_upload_jobs_uploaded_by",
            "price_upload_jobs",
            ["uploaded_by_id"],
        )
    if not _index_exists("price_upload_jobs", "idx_price_upload_jobs_created_at"):
        op.create_index(
            "idx_price_upload_jobs_created_at",
            "price_upload_jobs",
            ["created_at"],
        )

    if not _table_exists("price_items"):
        op.create_table(
            "price_items",
            sa.Column("id", sa.String(), primary_key=True, nullable=False),
            sa.Column("job_id", sa.String(), sa.ForeignKey("price_upload_jobs.id"), nullable=False),
            sa.Column("urun_kodu", sa.String(), nullable=True),
            sa.Column("urun_adi", sa.String(), nullable=False),
            sa.Column("birim", sa.String(), nullable=False, server_default="ADET"),
            sa.Column("liste_fiyati", sa.Numeric(12, 2), nullable=True),
            sa.Column("iskonto_orani", sa.Numeric(5, 2), nullable=False, server_default="0"),
            sa.Column("net_fiyat", sa.Numeric(12, 2), nullable=True),
            sa.Column("kdv_orani", sa.Numeric(5, 2), nullable=False, server_default="20"),
            sa.Column("kdv_dahil_fiyat", sa.Numeric(12, 2), nullable=True),
            sa.Column("para_birimi", sa.String(), nullable=False, server_default="TRY"),
            sa.Column("kategori", sa.String(), nullable=True),
            sa.Column("marka", sa.String(), nullable=True),
            sa.Column("tedarikci", sa.String(), nullable=False),
        )

    if not _index_exists("price_items", "idx_price_items_job_id"):
        op.create_index("idx_price_items_job_id", "price_items", ["job_id"])


def downgrade() -> None:
    if _index_exists("price_items", "idx_price_items_job_id"):
        op.drop_index("idx_price_items_job_id", table_name="price_items")
    if _table_exists("price_items"):
        op.drop_table("price_items")

    if _index_exists("price_upload_jobs", "idx_price_upload_jobs_created_at"):
        op.drop_index("idx_price_upload_jobs_created_at", table_name="price_upload_jobs")
    if _index_exists("price_upload_jobs", "idx_price_upload_jobs_uploaded_by"):
        op.drop_index("idx_price_upload_jobs_uploaded_by", table_name="price_upload_jobs")
    if _table_exists("price_upload_jobs"):
        op.drop_table("price_upload_jobs")
