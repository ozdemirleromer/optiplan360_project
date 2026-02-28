#!/usr/bin/env python3
"""Update database schema - Replace payment order with payment reminders"""
import sys
sys.path.insert(0, '.')

from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # Drop old payment order columns
    drop_commands = [
        'ALTER TABLE invoices DROP COLUMN payment_order_number',
        'ALTER TABLE invoices DROP COLUMN payment_order_date',
        'ALTER TABLE invoices DROP COLUMN payment_instructions',
        'ALTER TABLE invoices DROP COLUMN bank_name',
        'ALTER TABLE invoices DROP COLUMN bank_account_name',
        'ALTER TABLE invoices DROP COLUMN bank_account_number',
        'ALTER TABLE invoices DROP COLUMN iban',
        'ALTER TABLE invoices DROP COLUMN swift_code'
    ]
    
    print('\n=== VERITABANI ŞEMASI GÜNCELLEME ===\n')
    
    print('Kaldırılan alanlar:')
    for cmd in drop_commands:
        try:
            db.execute(text(cmd))
            field_name = cmd.split('DROP COLUMN ')[1]
            print(f'  ✓ {field_name}')
        except Exception as e:
            if 'no such column' in str(e).lower():
                field_name = cmd.split('DROP COLUMN ')[1]
                print(f'  ℹ {field_name} (zaten yok)')
    
    # Add new payment reminder columns
    add_commands = [
        ('reminder_type', 'VARCHAR'),
        ('reminder_sent', 'BOOLEAN DEFAULT 0'),
        ('reminder_sent_at', 'TIMESTAMP'),
        ('reminder_status', 'VARCHAR'),
        ('next_reminder_date', 'TIMESTAMP'),
        ('reminder_count', 'INTEGER DEFAULT 0')
    ]
    
    print('\nEklenen alanlar:')
    for field, dtype in add_commands:
        try:
            db.execute(text(f'ALTER TABLE invoices ADD COLUMN {field} {dtype}'))
            print(f'  ✓ {field}')
        except Exception as e:
            error_msg = str(e).lower()
            if 'duplicate column' in error_msg or 'already exists' in error_msg:
                print(f'  ℹ {field} (zaten mevcut)')
            else:
                print(f'  ℹ {field}: {e}')
    
    db.commit()
    print('\n✅ Veritabanı şeması başarıyla güncellendi!')
    
except Exception as e:
    print(f'\n❌ Hata: {e}')
    db.rollback()
finally:
    db.close()
