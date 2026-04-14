"""drop_legacy_optiplan_export_columns

Revision ID: 2026_03_14_optiplan_xlsx_only
Revises: 2026_03_13_order_header
Create Date: 2026-03-14 00:00:00.000000
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "2026_03_14_optiplan_xlsx_only"
down_revision: Union[str, None] = "2026_03_13_order_header"
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


def _legacy_name(*parts: str) -> str:
    return "".join(parts)


_legacy_prefix = _legacy_name("o", "pj")
_folder_table = "optiplan_folder_settings"
_export_table = "optiplan_workflow_export_kayitlari"
_folder_output_column = f"{_legacy_prefix}_cikti_klasoru"
_folder_enabled_column = f"{_legacy_prefix}_aktif_mi"
_export_enabled_column = f"{_legacy_prefix}_aktif_mi"
_export_status_column = f"{_legacy_prefix}_status"
_export_message_column = f"{_legacy_prefix}_message"


def upgrade() -> None:
    if _table_exists(_export_table):
        for column_name in (
            _export_enabled_column,
            _export_status_column,
            _export_message_column,
        ):
            if _column_exists(_export_table, column_name):
                op.drop_column(_export_table, column_name)

    if _table_exists(_folder_table):
        for column_name in (
            _folder_output_column,
            _folder_enabled_column,
        ):
            if _column_exists(_folder_table, column_name):
                op.drop_column(_folder_table, column_name)


def downgrade() -> None:
    if _table_exists(_folder_table):
        if not _column_exists(_folder_table, _folder_output_column):
            op.add_column(_folder_table, sa.Column(_folder_output_column, sa.String(), nullable=False, server_default=""))
        if not _column_exists(_folder_table, _folder_enabled_column):
            op.add_column(
                _folder_table,
                sa.Column(_folder_enabled_column, sa.Boolean(), nullable=False, server_default=sa.false()),
            )

    if _table_exists(_export_table):
        if not _column_exists(_export_table, _export_enabled_column):
            op.add_column(
                _export_table,
                sa.Column(_export_enabled_column, sa.Boolean(), nullable=False, server_default=sa.false()),
            )
        if not _column_exists(_export_table, _export_status_column):
            op.add_column(
                _export_table,
                sa.Column(_export_status_column, sa.String(), nullable=False, server_default="PASIF"),
            )
        if not _column_exists(_export_table, _export_message_column):
            op.add_column(_export_table, sa.Column(_export_message_column, sa.Text(), nullable=True))
