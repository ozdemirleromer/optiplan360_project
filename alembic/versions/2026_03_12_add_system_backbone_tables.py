"""add_system_backbone_tables

Revision ID: 2026_03_12_system_backbone
Revises: 2026_03_11_optiplan_workflow
Create Date: 2026-03-12 00:00:00.000000
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "2026_03_12_system_backbone"
down_revision: Union[str, None] = "2026_03_11_optiplan_workflow"
branch_labels = None
depends_on = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _table_exists(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def _index_exists(table_name: str, index_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    return any(index.get("name") == index_name for index in _inspector().get_indexes(table_name))


def upgrade() -> None:
    if not _table_exists("system_backbone_flows"):
        op.create_table(
            "system_backbone_flows",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("flow_name", sa.String(), nullable=False),
            sa.Column("entity_type", sa.String(), nullable=False),
            sa.Column("entity_id", sa.String(), nullable=False),
            sa.Column("external_id", sa.String(), nullable=True),
            sa.Column("company_id", sa.Integer(), nullable=False),
            sa.Column("branch_id", sa.Integer(), nullable=False),
            sa.Column("fiscal_year", sa.Integer(), nullable=False),
            sa.Column("source_system", sa.String(), nullable=False),
            sa.Column("target_system", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("stage", sa.String(), nullable=False),
            sa.Column("retry_count", sa.Integer(), nullable=False),
            sa.Column("max_retries", sa.Integer(), nullable=False),
            sa.Column("retry_cooldown_seconds", sa.Integer(), nullable=False),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column("metadata_json", sa.Text(), nullable=True),
            sa.Column("last_retry_at", sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column("next_retry_at", sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("updated_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _table_exists("system_backbone_flow_audits"):
        op.create_table(
            "system_backbone_flow_audits",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("flow_id", sa.String(), nullable=False),
            sa.Column("event_type", sa.String(), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("payload_json", sa.Text(), nullable=True),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["flow_id"], ["system_backbone_flows.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    indexes = (
        ("system_backbone_flows", "ix_system_backbone_flows_id", ["id"]),
        ("system_backbone_flows", "ix_system_backbone_flows_flow_name", ["flow_name"]),
        ("system_backbone_flows", "ix_system_backbone_flows_entity_type", ["entity_type"]),
        ("system_backbone_flows", "ix_system_backbone_flows_entity_id", ["entity_id"]),
        ("system_backbone_flows", "ix_system_backbone_flows_external_id", ["external_id"]),
        ("system_backbone_flows", "ix_system_backbone_flows_company_id", ["company_id"]),
        ("system_backbone_flows", "ix_system_backbone_flows_branch_id", ["branch_id"]),
        ("system_backbone_flows", "ix_system_backbone_flows_fiscal_year", ["fiscal_year"]),
        ("system_backbone_flows", "ix_system_backbone_flows_status", ["status"]),
        ("system_backbone_flows", "ix_system_backbone_flows_stage", ["stage"]),
        ("system_backbone_flows", "ix_system_backbone_flows_next_retry_at", ["next_retry_at"]),
        ("system_backbone_flows", "ix_system_backbone_flows_created_by", ["created_by"]),
        ("system_backbone_flows", "ix_system_backbone_flows_updated_by", ["updated_by"]),
        ("system_backbone_flow_audits", "ix_system_backbone_flow_audits_id", ["id"]),
        ("system_backbone_flow_audits", "ix_system_backbone_flow_audits_flow_id", ["flow_id"]),
        ("system_backbone_flow_audits", "ix_system_backbone_flow_audits_event_type", ["event_type"]),
        ("system_backbone_flow_audits", "ix_system_backbone_flow_audits_created_by", ["created_by"]),
        ("system_backbone_flow_audits", "ix_system_backbone_flow_audits_created_at", ["created_at"]),
    )
    for table_name, index_name, columns in indexes:
        if not _index_exists(table_name, index_name):
            op.create_index(index_name, table_name, columns)

    if not _index_exists("system_backbone_flows", "uq_system_backbone_flows_external_context"):
        op.create_index(
            "uq_system_backbone_flows_external_context",
            "system_backbone_flows",
            ["external_id", "company_id", "branch_id", "fiscal_year"],
            unique=True,
        )


def downgrade() -> None:
    indexes = (
        ("system_backbone_flows", "uq_system_backbone_flows_external_context"),
        ("system_backbone_flow_audits", "ix_system_backbone_flow_audits_created_at"),
        ("system_backbone_flow_audits", "ix_system_backbone_flow_audits_created_by"),
        ("system_backbone_flow_audits", "ix_system_backbone_flow_audits_event_type"),
        ("system_backbone_flow_audits", "ix_system_backbone_flow_audits_flow_id"),
        ("system_backbone_flow_audits", "ix_system_backbone_flow_audits_id"),
        ("system_backbone_flows", "ix_system_backbone_flows_updated_by"),
        ("system_backbone_flows", "ix_system_backbone_flows_created_by"),
        ("system_backbone_flows", "ix_system_backbone_flows_next_retry_at"),
        ("system_backbone_flows", "ix_system_backbone_flows_stage"),
        ("system_backbone_flows", "ix_system_backbone_flows_status"),
        ("system_backbone_flows", "ix_system_backbone_flows_fiscal_year"),
        ("system_backbone_flows", "ix_system_backbone_flows_branch_id"),
        ("system_backbone_flows", "ix_system_backbone_flows_company_id"),
        ("system_backbone_flows", "ix_system_backbone_flows_external_id"),
        ("system_backbone_flows", "ix_system_backbone_flows_entity_id"),
        ("system_backbone_flows", "ix_system_backbone_flows_entity_type"),
        ("system_backbone_flows", "ix_system_backbone_flows_flow_name"),
        ("system_backbone_flows", "ix_system_backbone_flows_id"),
    )
    for table_name, index_name in indexes:
        if _index_exists(table_name, index_name):
            op.drop_index(index_name, table_name=table_name)

    if _table_exists("system_backbone_flow_audits"):
        op.drop_table("system_backbone_flow_audits")
    if _table_exists("system_backbone_flows"):
        op.drop_table("system_backbone_flows")
