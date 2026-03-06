"""Add performance indexes for frequently queried columns

Revision ID: 2026_02_18_add_performance_indexes
Revises: 2026_02_16_add_station_fields
Create Date: 2026-02-18 03:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "2026_02_18_add_performance_indexes"
down_revision: Union[str, None] = "2026_02_16_stations"
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


def _create_index_if_possible(index_name: str, table_name: str, columns: list[sa.TextClause | str]) -> None:
    if not _table_exists(table_name) or _index_exists(table_name, index_name):
        return

    table_columns = {col["name"] for col in _inspector().get_columns(table_name)}
    for col in columns:
        if isinstance(col, str):
            if col not in table_columns:
                return
        else:
            text_col = str(col).split()[0]
            if text_col not in table_columns:
                return

    if _table_exists(table_name) and not _index_exists(table_name, index_name):
        op.create_index(index_name, table_name, columns)


def _drop_index_if_exists(index_name: str, table_name: str) -> None:
    if _index_exists(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)


def upgrade() -> None:
    _create_index_if_possible("idx_orders_status_created", "orders", ["status", sa.text("created_at DESC")])
    _create_index_if_possible("idx_orders_customer_status", "orders", ["customer_id", "status"])
    _create_index_if_possible("idx_orders_ts_code", "orders", ["ts_code"])
    _create_index_if_possible("idx_orders_status_date", "orders", ["status", sa.text("created_at DESC")])

    _create_index_if_possible("idx_ocr_jobs_status_created", "ocr_jobs", ["status", sa.text("created_at DESC")])
    _create_index_if_possible("idx_ocr_jobs_customer", "ocr_jobs", ["customer_id"])
    _create_index_if_possible("idx_ocr_jobs_order", "ocr_jobs", ["order_id"])
    _create_index_if_possible("idx_ocr_jobs_status", "ocr_jobs", ["status"])

    _create_index_if_possible("idx_invoices_status_due", "invoices", ["status", "due_date"])
    _create_index_if_possible("idx_invoices_account", "invoices", ["account_id", "status"])
    _create_index_if_possible("idx_invoices_reminder", "invoices", ["reminder_sent", "next_reminder_date"])
    _create_index_if_possible("idx_invoices_due_date", "invoices", ["due_date"])

    _create_index_if_possible("idx_crm_accounts_mikro", "crm_accounts", ["mikro_cari_kod"])
    _create_index_if_possible("idx_crm_accounts_type", "crm_accounts", ["account_type", "is_active"])
    _create_index_if_possible("idx_crm_accounts_tax", "crm_accounts", ["tax_id"])

    _create_index_if_possible("idx_audit_logs_user", "audit_logs", ["user_id", sa.text("created_at DESC")])
    _create_index_if_possible("idx_audit_logs_order", "audit_logs", ["order_id", sa.text("created_at DESC")])
    _create_index_if_possible("idx_audit_logs_action", "audit_logs", ["action", sa.text("created_at DESC")])
    _create_index_if_possible("idx_audit_logs_entity", "audit_logs", ["entity_type", "entity_id"])

    _create_index_if_possible("idx_stock_cards_code", "stock_cards", ["stock_code"])
    _create_index_if_possible("idx_stock_cards_active", "stock_cards", ["is_active"])

    _create_index_if_possible("idx_users_username", "users", ["username"])
    _create_index_if_possible("idx_users_email", "users", ["email"])
    _create_index_if_possible("idx_users_role_active", "users", ["role", "is_active"])

    _create_index_if_possible("idx_whatsapp_status", "whatsapp_messages", ["status"])
    _create_index_if_possible("idx_whatsapp_order", "whatsapp_messages", ["order_id"])


def downgrade() -> None:
    _drop_index_if_exists("idx_orders_status_created", "orders")
    _drop_index_if_exists("idx_orders_customer_status", "orders")
    _drop_index_if_exists("idx_orders_ts_code", "orders")
    _drop_index_if_exists("idx_orders_status_date", "orders")

    _drop_index_if_exists("idx_ocr_jobs_status_created", "ocr_jobs")
    _drop_index_if_exists("idx_ocr_jobs_customer", "ocr_jobs")
    _drop_index_if_exists("idx_ocr_jobs_order", "ocr_jobs")
    _drop_index_if_exists("idx_ocr_jobs_status", "ocr_jobs")

    _drop_index_if_exists("idx_invoices_status_due", "invoices")
    _drop_index_if_exists("idx_invoices_account", "invoices")
    _drop_index_if_exists("idx_invoices_reminder", "invoices")
    _drop_index_if_exists("idx_invoices_due_date", "invoices")

    _drop_index_if_exists("idx_crm_accounts_mikro", "crm_accounts")
    _drop_index_if_exists("idx_crm_accounts_type", "crm_accounts")
    _drop_index_if_exists("idx_crm_accounts_tax", "crm_accounts")

    _drop_index_if_exists("idx_audit_logs_user", "audit_logs")
    _drop_index_if_exists("idx_audit_logs_order", "audit_logs")
    _drop_index_if_exists("idx_audit_logs_action", "audit_logs")
    _drop_index_if_exists("idx_audit_logs_entity", "audit_logs")

    _drop_index_if_exists("idx_stock_cards_code", "stock_cards")
    _drop_index_if_exists("idx_stock_cards_active", "stock_cards")

    _drop_index_if_exists("idx_users_username", "users")
    _drop_index_if_exists("idx_users_email", "users")
    _drop_index_if_exists("idx_users_role_active", "users")

    _drop_index_if_exists("idx_whatsapp_status", "whatsapp_messages")
    _drop_index_if_exists("idx_whatsapp_order", "whatsapp_messages")
