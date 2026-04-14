"""Remove manual payment order columns and add payment reminder columns

Revision ID: 2026_03_14_remove_payment_order_add_reminders
Revises: 2026_03_14_add_password_change_enforcement_fields
Create Date: 2026-03-14

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '2026_03_14_remove_payment_order_add_reminders'
down_revision = '2026_03_14_add_password_change_enforcement_fields'
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


def upgrade():
    """Remove payment order columns and add payment reminder columns"""

    if _table_exists('invoices'):
        # Drop old payment order columns
        with op.batch_alter_table('invoices', schema=None) as batch_op:
            if _column_exists('invoices', 'payment_order_number'):
                batch_op.drop_column('payment_order_number', type_=sa.String())
            if _column_exists('invoices', 'payment_order_date'):
                batch_op.drop_column('payment_order_date', type_=sa.TIMESTAMP())
            if _column_exists('invoices', 'payment_instructions'):
                batch_op.drop_column('payment_instructions', type_=sa.Text())
            if _column_exists('invoices', 'bank_name'):
                batch_op.drop_column('bank_name', type_=sa.String())
            if _column_exists('invoices', 'bank_account_name'):
                batch_op.drop_column('bank_account_name', type_=sa.String())
            if _column_exists('invoices', 'bank_account_number'):
                batch_op.drop_column('bank_account_number', type_=sa.String())
            if _column_exists('invoices', 'iban'):
                batch_op.drop_column('iban', type_=sa.String())
            if _column_exists('invoices', 'swift_code'):
                batch_op.drop_column('swift_code', type_=sa.String())

        # Add new payment reminder columns
        with op.batch_alter_table('invoices', schema=None) as batch_op:
            if not _column_exists('invoices', 'reminder_type'):
                batch_op.add_column(sa.Column('reminder_type', sa.String(), nullable=True))
            if not _column_exists('invoices', 'reminder_sent'):
                batch_op.add_column(sa.Column('reminder_sent', sa.Boolean(), server_default=sa.text('false'), nullable=False))
            if not _column_exists('invoices', 'reminder_sent_at'):
                batch_op.add_column(sa.Column('reminder_sent_at', sa.TIMESTAMP(timezone=True), nullable=True))
            if not _column_exists('invoices', 'reminder_status'):
                batch_op.add_column(sa.Column('reminder_status', sa.String(), nullable=True))
            if not _column_exists('invoices', 'next_reminder_date'):
                batch_op.add_column(sa.Column('next_reminder_date', sa.TIMESTAMP(timezone=True), nullable=True))
            if not _column_exists('invoices', 'reminder_count'):
                batch_op.add_column(sa.Column('reminder_count', sa.Integer(), server_default=sa.text('0'), nullable=False))


def downgrade():
    """Add back payment order columns and remove payment reminder columns"""

    if _table_exists('invoices'):
        # Add back payment order columns
        with op.batch_alter_table('invoices', schema=None) as batch_op:
            if not _column_exists('invoices', 'payment_order_number'):
                batch_op.add_column(sa.Column('payment_order_number', sa.String(), nullable=True))
            if not _column_exists('invoices', 'payment_order_date'):
                batch_op.add_column(sa.Column('payment_order_date', sa.TIMESTAMP(timezone=True), nullable=True))
            if not _column_exists('invoices', 'payment_instructions'):
                batch_op.add_column(sa.Column('payment_instructions', sa.Text(), nullable=True))
            if not _column_exists('invoices', 'bank_name'):
                batch_op.add_column(sa.Column('bank_name', sa.String(), nullable=True))
            if not _column_exists('invoices', 'bank_account_name'):
                batch_op.add_column(sa.Column('bank_account_name', sa.String(), nullable=True))
            if not _column_exists('invoices', 'bank_account_number'):
                batch_op.add_column(sa.Column('bank_account_number', sa.String(), nullable=True))
            if not _column_exists('invoices', 'iban'):
                batch_op.add_column(sa.Column('iban', sa.String(), nullable=True))
            if not _column_exists('invoices', 'swift_code'):
                batch_op.add_column(sa.Column('swift_code', sa.String(), nullable=True))

        # Remove payment reminder columns
        with op.batch_alter_table('invoices', schema=None) as batch_op:
            if _column_exists('invoices', 'reminder_type'):
                batch_op.drop_column('reminder_type')
            if _column_exists('invoices', 'reminder_sent'):
                batch_op.drop_column('reminder_sent')
            if _column_exists('invoices', 'reminder_sent_at'):
                batch_op.drop_column('reminder_sent_at')
            if _column_exists('invoices', 'reminder_status'):
                batch_op.drop_column('reminder_status')
            if _column_exists('invoices', 'next_reminder_date'):
                batch_op.drop_column('next_reminder_date')
            if _column_exists('invoices', 'reminder_count'):
                batch_op.drop_column('reminder_count')
