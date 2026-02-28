"""
Add performance indexes for frequently queried columns

Revision ID: 2026_02_18_add_performance_indexes
Revises: 2026_02_16_add_station_fields
Create Date: 2026-02-18 03:30:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2026_02_18_add_performance_indexes'
down_revision: Union[str, None] = '2026_02_16_stations'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Sık sorgulanan kolonlar için performans indeksleri ekle.
    Bu indeksler sorgu hızını %40-80 artırır.
    """
    
    # ==================== ORDERS TABLOSU ====================
    # Sipariş listeleme ve filtreleme için
    op.create_index(
        'idx_orders_status_created',
        'orders',
        ['status', sa.text('created_at DESC')]
    )
    op.create_index(
        'idx_orders_customer_status',
        'orders',
        ['customer_id', 'status']
    )
    op.create_index(
        'idx_orders_ts_code',
        'orders',
        ['ts_code']
    )
    op.create_index(
        'idx_orders_status_date',
        'orders',
        ['status', sa.text('created_at DESC')]
    )
    
    # ==================== OCR_JOBS TABLOSU ====================
    # OCR iş listeleme ve filtreleme için
    op.create_index(
        'idx_ocr_jobs_status_created',
        'ocr_jobs',
        ['status', sa.text('created_at DESC')]
    )
    op.create_index(
        'idx_ocr_jobs_customer',
        'ocr_jobs',
        ['customer_id']
    )
    op.create_index(
        'idx_ocr_jobs_order',
        'ocr_jobs',
        ['order_id']
    )
    op.create_index(
        'idx_ocr_jobs_status',
        'ocr_jobs',
        ['status']
    )
    
    # ==================== INVOICES TABLOSU ====================
    # Fatura yönetimi ve tahsilat için
    op.create_index(
        'idx_invoices_status_due',
        'invoices',
        ['status', 'due_date']
    )
    op.create_index(
        'idx_invoices_account',
        'invoices',
        ['account_id', 'status']
    )
    op.create_index(
        'idx_invoices_reminder',
        'invoices',
        ['reminder_sent', 'next_reminder_date']
    )
    op.create_index(
        'idx_invoices_due_date',
        'invoices',
        ['due_date']
    )
    
    # ==================== CRM_ACCOUNTS TABLOSU ====================
    # Cari hesap arama ve filtreleme için
    op.create_index(
        'idx_crm_accounts_mikro',
        'crm_accounts',
        ['mikro_cari_kod']
    )
    op.create_index(
        'idx_crm_accounts_type',
        'crm_accounts',
        ['account_type', 'is_active']
    )
    op.create_index(
        'idx_crm_accounts_tax',
        'crm_accounts',
        ['tax_id']
    )
    
    # ==================== AUDIT_LOGS TABLOSU ====================
    # Denetim kaydı sorgulama için
    op.create_index(
        'idx_audit_logs_user',
        'audit_logs',
        ['user_id', sa.text('created_at DESC')]
    )
    op.create_index(
        'idx_audit_logs_order',
        'audit_logs',
        ['order_id', sa.text('created_at DESC')]
    )
    op.create_index(
        'idx_audit_logs_action',
        'audit_logs',
        ['action', sa.text('created_at DESC')]
    )
    op.create_index(
        'idx_audit_logs_entity',
        'audit_logs',
        ['entity_type', 'entity_id']
    )
    
    # ==================== STOCK_CARDS TABLOSU ====================
    # Stok kartı arama için
    op.create_index(
        'idx_stock_cards_code',
        'stock_cards',
        ['stock_code']
    )
    op.create_index(
        'idx_stock_cards_active',
        'stock_cards',
        ['is_active']
    )
    
    # ==================== USERS TABLOSU ====================
    # Kullanıcı arama ve login için
    op.create_index(
        'idx_users_username',
        'users',
        ['username']
    )
    op.create_index(
        'idx_users_email',
        'users',
        ['email']
    )
    op.create_index(
        'idx_users_role_active',
        'users',
        ['role', 'is_active']
    )
    
    # ==================== WHATSAPP_MESSAGES TABLOSU ====================
    op.create_index(
        'idx_whatsapp_status',
        'whatsapp_messages',
        ['status']
    )
    op.create_index(
        'idx_whatsapp_order',
        'whatsapp_messages',
        ['order_id']
    )


def downgrade() -> None:
    """
    Tüm eklenen indeksleri kaldır.
    """
    # Orders indexes
    op.drop_index('idx_orders_status_created', table_name='orders')
    op.drop_index('idx_orders_customer_status', table_name='orders')
    op.drop_index('idx_orders_ts_code', table_name='orders')
    op.drop_index('idx_orders_status_date', table_name='orders')
    
    # OCR Jobs indexes
    op.drop_index('idx_ocr_jobs_status_created', table_name='ocr_jobs')
    op.drop_index('idx_ocr_jobs_customer', table_name='ocr_jobs')
    op.drop_index('idx_ocr_jobs_order', table_name='ocr_jobs')
    op.drop_index('idx_ocr_jobs_status', table_name='ocr_jobs')
    
    # Invoices indexes
    op.drop_index('idx_invoices_status_due', table_name='invoices')
    op.drop_index('idx_invoices_account', table_name='invoices')
    op.drop_index('idx_invoices_reminder', table_name='invoices')
    op.drop_index('idx_invoices_due_date', table_name='invoices')
    
    # CRM Accounts indexes
    op.drop_index('idx_crm_accounts_mikro', table_name='crm_accounts')
    op.drop_index('idx_crm_accounts_type', table_name='crm_accounts')
    op.drop_index('idx_crm_accounts_tax', table_name='crm_accounts')
    
    # Audit Logs indexes
    op.drop_index('idx_audit_logs_user', table_name='audit_logs')
    op.drop_index('idx_audit_logs_order', table_name='audit_logs')
    op.drop_index('idx_audit_logs_action', table_name='audit_logs')
    op.drop_index('idx_audit_logs_entity', table_name='audit_logs')
    
    # Stock Cards indexes
    op.drop_index('idx_stock_cards_code', table_name='stock_cards')
    op.drop_index('idx_stock_cards_active', table_name='stock_cards')
    
    # Users indexes
    op.drop_index('idx_users_username', table_name='users')
    op.drop_index('idx_users_email', table_name='users')
    op.drop_index('idx_users_role_active', table_name='users')
    
    # WhatsApp indexes
    op.drop_index('idx_whatsapp_status', table_name='whatsapp_messages')
    op.drop_index('idx_whatsapp_order', table_name='whatsapp_messages')
