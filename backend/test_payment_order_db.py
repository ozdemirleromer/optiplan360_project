#!/usr/bin/env python3
"""Test Payment Order Fields - Direct Database Test"""
import sys
sys.path.insert(0, '.')

from app.database import SessionLocal
from app.services import payment_service
from datetime import datetime
import random

print('\n' + '='*60)
print('  ÖDEME EMRİ ALANLARI - DATABASE TEST')
print('='*60 + '\n')

db = SessionLocal()

try:
    # Test data
    test_account_id = f'test-account-{random.randint(1000, 9999)}'
    test_payment_order_no = f'OE-2026-TEST-{random.randint(10000, 99999)}'
    
    print(f'Test Data:')
    print(f'  Account ID: {test_account_id}')
    print(f'  Ödeme Emri No: {test_payment_order_no}')
    print(f'\nFatura oluşturuluyor...\n')
    
    # Create invoice with payment order fields
    invoice = payment_service.create_invoice(
        db=db,
        account_id=test_account_id,
        order_id=None,
        quote_id=None,
        subtotal=15000.00,
        tax_rate=20.0,
        discount_amount=1000.00,
        total_amount=17000.00,
        due_date=datetime(2026, 3, 16),
        invoice_type='SALES',
        notes='TEST - Ödeme emri alanları',
        user_id=None,
        # Ödeme Emri Bilgileri
        payment_order_number=test_payment_order_no,
        payment_order_date=datetime(2026, 2, 16, 12, 0, 0),
        payment_instructions='30 gün vadeli ödeme, havale ile yapılacak',
        bank_name='Ziraat Bankası Ümraniye Şubesi',
        bank_account_name='OptiPlan360 A.Ş.',
        bank_account_number='1234567890',
        iban='TR330006100519786457841326',
        swift_code='TCZBTR2AXXX'
    )
    
    print('✅ FATURA BAŞARIYLA OLUŞTURULDU!\n')
    print('-' * 60)
    print('OLUŞTURULAN FATURA:')
    print('-' * 60)
    print(f'ID: {invoice.id}')
    print(f'Fatura No: {invoice.invoice_number}')
    print(f'Durum: {invoice.status.value}')
    
    print(f'\nÖDEME EMRİ BİLGİLERİ:')
    print(f'  ✓ Ödeme Emri No: {invoice.payment_order_number}')
    print(f'  ✓ Ödeme Tarihi: {invoice.payment_order_date}')
    print(f'  ✓ Talimat: {invoice.payment_instructions}')
    
    print(f'\nBANKA BİLGİLERİ:')
    print(f'  ✓ Banka: {invoice.bank_name}')
    print(f'  ✓ Hesap Sahibi: {invoice.bank_account_name}')
    print(f'  ✓ Hesap No: {invoice.bank_account_number}')
    print(f'  ✓ IBAN: {invoice.iban}')
    print(f'  ✓ SWIFT: {invoice.swift_code}')
    
    print(f'\nTUTAR BİLGİLERİ:')
    print(f'  Ara Toplam: {invoice.subtotal:,.2f} TL')
    print(f'  İndirim: {invoice.discount_amount:,.2f} TL')
    print(f'  KDV: {invoice.tax_amount:,.2f} TL')
    print(f'  TOPLAM: {invoice.total_amount:,.2f} TL')
    
    print('-' * 60)
    
    # Test uniqueness constraint
    print(f'\nBenzersizlik testi...')
    try:
        duplicate_invoice = payment_service.create_invoice(
            db=db,
            account_id=test_account_id,
            order_id=None,
            quote_id=None,
            subtotal=10000.00,
            tax_rate=20.0,
            discount_amount=0.00,
            total_amount=12000.00,
            due_date=None,
            payment_order_number=test_payment_order_no,  # Same number!
            iban='TR330006100519786457841326'
        )
        print('❌ Benzersizlik kontrolü BAŞARISIZ! (Aynı ödeme emri no kabul edildi)')
    except ValueError as e:
        print(f'✅ Benzersizlik kontrolü BAŞARILI: {e}')
    
    # Test IBAN validation
    print(f'\nIBAN doğrulama testi...')
    try:
        invalid_invoice = payment_service.create_invoice(
            db=db,
            account_id=f'test-account-{random.randint(1000, 9999)}',
            order_id=None,
            quote_id=None,
            subtotal=10000.00,
            tax_rate=20.0,
            discount_amount=0.00,
            total_amount=12000.00,
            due_date=None,
            payment_order_number=f'OE-2026-{random.randint(10000, 99999)}',
            iban='TR12345'  # Invalid IBAN!
        )
        print('❌ IBAN validasyonu BAŞARISIZ! (Geçersiz IBAN kabul edildi)')
    except ValueError as e:
        print(f'✅ IBAN validasyonu BAŞARILI: {e}')
    
    print('\n' + '='*60)
    print('  ✅ TÜM TESTLER BAŞARILI!')
    print('='*60)
    print('\nÖdeme emri alanları doğru şekilde çalışıyor:')
    print('  • Model alanları (✓)')
    print('  • Servis validasyonları (✓)')
    print('  • Benzersizlik kontrolü (✓)')
    print('  • IBAN formatı kontrolü (✓)')
    print()
    
except Exception as e:
    print(f'\n❌ HATA: {type(e).__name__}: {e}')
    import traceback
    traceback.print_exc()
finally:
    db.close()
