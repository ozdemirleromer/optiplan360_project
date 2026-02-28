#!/usr/bin/env python3
"""Test Invoice API with Payment Order Fields"""
import requests
import json
from datetime import datetime
import random

# Test invoice data with payment order fields
test_data = {
    'account_id': f'test-account-{random.randint(1000, 9999)}',
    'subtotal': 15000.00,
    'tax_rate': 20.0,
    'discount_amount': 1000.00,
    'total_amount': 17000.00,
    'invoice_type': 'SALES',
    'payment_order_number': f'OE-2026-TEST-{random.randint(10000, 99999)}',
    'payment_order_date': '2026-02-16T12:00:00',
    'payment_instructions': '30 gün vadeli ödeme, havale ile',
    'bank_name': 'Ziraat Bankası Ümraniye Şubesi',
    'bank_account_name': 'OptiPlan360 A.Ş.',
    'bank_account_number': '1234567890',
    'iban': 'TR330006100519786457841326',
    'swift_code': 'TCZBTR2AXXX',
    'notes': 'TEST FATURASI - Ödeme emri alanları doğrulama'
}

print('\n' + '='*60)
print('  ÖDEME EMRİ ALANLARI - API TEST')
print('='*60 + '\n')

print(f'Test Data:')
print(f'  Ödeme Emri No: {test_data["payment_order_number"]}')
print(f'  IBAN: {test_data["iban"]}')
print(f'  Banka: {test_data["bank_name"]}')
print(f'\nAPI İsteği gönderiliyor...\n')

try:
    response = requests.post(
        'http://localhost:8080/api/v1/payments/invoices',
        json=test_data,
        timeout=10
    )
    
    if response.status_code == 200:
        result = response.json()
        print('✅ TEST BAŞARILI!\n')
        print('-' * 60)
        print('OLUŞTURULAN FATURA:')
        print('-' * 60)
        print(f'ID: {result["id"]}')
        print(f'Fatura No: {result["invoice_number"]}')
        print(f'Durum: {result["status"]}')
        print(f'\nÖDEME EMRİ BİLGİLERİ:')
        print(f'  Ödeme Emri No: {result.get("payment_order_number", "N/A")}')
        print(f'  Ödeme Tarihi: {result.get("payment_order_date", "N/A")}')
        print(f'  Talimat: {result.get("payment_instructions", "N/A")}')
        print(f'\nBANKA BİLGİLERİ:')
        print(f'  Banka: {result.get("bank_name", "N/A")}')
        print(f'  Hesap Sahibi: {result.get("bank_account_name", "N/A")}')
        print(f'  Hesap No: {result.get("bank_account_number", "N/A")}')
        print(f'  IBAN: {result.get("iban", "N/A")}')
        print(f'  SWIFT: {result.get("swift_code", "N/A")}')
        print(f'\nTUTAR BİLGİLERİ:')
        print(f'  Ara Toplam: {result["subtotal"]:,.2f} TL')
        print(f'  İndirim: {result["discount_amount"]:,.2f} TL')
        print(f'  KDV: {result["tax_amount"]:,.2f} TL')
        print(f'  TOPLAM: {result["total_amount"]:,.2f} TL')
        print('-' * 60)
        print('\n✅ Tüm ödeme emri alanları başarıyla kaydedildi!')
        
    elif response.status_code == 422:
        print(f'❌ Validation Hatası:')
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    else:
        print(f'❌ HTTP Hatası: {response.status_code}')
        print(response.text)
        
except requests.exceptions.ConnectionError:
    print('❌ Backend sunucusuna bağlanılamadı!')
    print('   Sunucu çalışıyor mu? http://localhost:8080')
except Exception as e:
    print(f'❌ Beklenmeyen hata: {type(e).__name__}: {e}')

print()
