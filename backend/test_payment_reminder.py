#!/usr/bin/env python3
"""Test Payment Reminder Fields"""
import sys
sys.path.insert(0, '.')

from app.database import SessionLocal
from app.services import payment_service
from app.models import ReminderTypeEnum, ReminderStatusEnum
from datetime import datetime, timedelta
import random

print('\n' + '='*60)
print('  ÖDEME HATIRLATICI - KAPSAMLI TEST')
print('='*60 + '\n')

db = SessionLocal()

try:
    # Test data
    test_account_id = f'test-account-{random.randint(1000, 9999)}'
    
    # Test 1: Create invoice with email reminder
    print('TEST 1: E-posta Hatırlatıcılı Fatura Oluştur')
    print('-' * 60)
    
    invoice = payment_service.create_invoice(
        db=db,
        account_id=test_account_id,
        order_id=None,
        quote_id=None,
        subtotal=25000.00,
        tax_rate=20.0,
        discount_amount=2000.00,
        total_amount=27800.00,
        due_date=datetime(2026, 3, 16),
        invoice_type='SALES',
        notes='Test faturası - E-posta hatırlatıcısı',
        user_id=None,
        reminder_type=ReminderTypeEnum.EMAIL,
        next_reminder_date=datetime(2026, 2, 25)
    )
    
    print(f'✓ Fatura oluşturuldu: {invoice.invoice_number}')
    print(f'  Hatırlatma Türü: {invoice.reminder_type.value}' if invoice.reminder_type else '  Hatırlatma Türü: Yok')
    print(f'  Hatırlatma Durumu: {invoice.reminder_status.value}' if invoice.reminder_status else '  Hatırlatma Durumu: Yok')
    print(f'  Sonraki Hatırlatma: {invoice.next_reminder_date}')
    print(f'  Hatırlatma Gönderildi: {invoice.reminder_sent}')
    print(f'  Hatırlatma Sayısı: {invoice.reminder_count}')
    
    # Test 2: Create invoice with SMS reminder
    print('\nTEST 2: SMS Hatırlatıcılı Fatura Oluştur')
    print('-' * 60)
    
    invoice2 = payment_service.create_invoice(
        db=db,
        account_id=f'test-account-{random.randint(1000, 9999)}',
        order_id=None,
        quote_id=None,
        subtotal=15000.00,
        tax_rate=20.0,
        discount_amount=500.00,
        total_amount=17300.00,
        due_date=datetime(2026, 3, 20),
        invoice_type='SALES',
        notes='Test faturası - SMS hatırlatıcısı',
        reminder_type=ReminderTypeEnum.SMS,
        next_reminder_date=datetime(2026, 2, 20)
    )
    
    print(f'✓ Fatura oluşturuldu: {invoice2.invoice_number}')
    print(f'  Hatırlatma Türü: {invoice2.reminder_type.value}')
    print(f'  Hatırlatma Durumu: {invoice2.reminder_status.value}')
    print(f'  Sonraki Hatırlatma: {invoice2.next_reminder_date}')
    
    # Test 3: Create invoice without reminder
    print('\nTEST 3: Hatırlatıcı Olmayan Fatura Oluştur')
    print('-' * 60)
    
    invoice3 = payment_service.create_invoice(
        db=db,
        account_id=f'test-account-{random.randint(1000, 9999)}',
        order_id=None,
        quote_id=None,
        subtotal=10000.00,
        tax_rate=20.0,
        discount_amount=0.00,
        total_amount=12000.00,
        due_date=datetime(2026, 3, 10),
        invoice_type='SALES',
        notes='Test faturası - Hatırlatıcı yok'
    )
    
    print(f'✓ Fatura oluşturuldu: {invoice3.invoice_number}')
    print(f'  Hatırlatma Türü: {invoice3.reminder_type}')
    print(f'  Hatırlatma Durumu: {invoice3.reminder_status}')
    print(f'  Hatırlatma Gönderildi: {invoice3.reminder_sent}')
    
    # Test 4: Verify all reminder types
    print('\nTEST 4: Tüm Hatırlatma Türleri')
    print('-' * 60)
    
    reminder_types = list(ReminderTypeEnum)
    for rtype in reminder_types:
        print(f'  ✓ {rtype.name}: {rtype.value}')
    
    # Test 5: Verify reminder statuses
    print('\nTEST 5: Tüm Hatırlatma Durumları')
    print('-' * 60)
    
    reminder_statuses = list(ReminderStatusEnum)
    for rstatus in reminder_statuses:
        print(f'  ✓ {rstatus.name}: {rstatus.value}')
    
    print('\n' + '='*60)
    print('  ✅ TÜM TESTLER BAŞARILI!')
    print('='*60)
    print('\nÖdeme Hatırlatıcısı Özellikleri:')
    print('  • Hatırlatma Türü: EMAIL, SMS, IN_APP, LETTER')
    print('  • Hatırlatma Durumu: PENDING, SENT, READ, IGNORED, BOUNCED')
    print('  • Hatırlatma Sayaç: Kaç kez hatırlatıldığını izle')
    print('  • Sonraki Hatırlatma: Tarihini ayarla')
    print('  • Hatırlatıcı Gönderimleri: datetime ile takip et')
    print()
    
except Exception as e:
    print(f'\n❌ HATA: {type(e).__name__}: {e}')
    import traceback
    traceback.print_exc()
finally:
    db.close()
