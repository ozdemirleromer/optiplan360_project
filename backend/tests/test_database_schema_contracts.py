from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import StaticPool

from app.database import Base
import app.models  # noqa: F401


def _index_map(inspector, table_name):
    return {index["name"]: index for index in inspector.get_indexes(table_name)}


def test_database_schema_contracts():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    try:
        Base.metadata.create_all(bind=engine)
        inspector = inspect(engine)

        order_indexes = _index_map(inspector, "orders")
        assert order_indexes["ix_order_status_created"]["column_names"] == ["status", "created_at"]

        order_part_indexes = _index_map(inspector, "order_parts")
        assert order_part_indexes["ix_order_part_order_id"]["column_names"] == ["order_id"]

        opti_job_indexes = _index_map(inspector, "opti_jobs")
        assert opti_job_indexes["ix_opti_job_order_created"]["column_names"] == ["order_id", "created_at"]

        audit_indexes = _index_map(inspector, "opti_audit_events")
        assert audit_indexes["ix_audit_events_job_created"]["column_names"] == ["job_id", "created_at"]

        invoice_indexes = _index_map(inspector, "invoices")
        assert invoice_indexes["ix_invoice_account_status"]["column_names"] == ["account_id", "status"]
        assert invoice_indexes["ix_invoice_due_date"]["column_names"] == ["due_date"]

        crm_indexes = _index_map(inspector, "crm_accounts")
        assert bool(crm_indexes["ux_crm_account_mikro_cari_kod"]["unique"]) is True

        payment_promise_columns = {
            column["name"]: column for column in inspector.get_columns("payment_promises")
        }
        assert "reminder_count" in payment_promise_columns
        assert payment_promise_columns["reminder_count"]["nullable"] is False
    finally:
        engine.dispose()
