import requests

BASE = 'http://127.0.0.1:8000/api/v1'

# Login first
login_resp = requests.post(f'{BASE}/auth/login', json={'username': 'admin', 'password': 'admin'})
print(f"Login: {login_resp.status_code}")

if login_resp.status_code != 200:
    print("Login failed:", login_resp.text)
    exit(1)

token = login_resp.json()['token']
headers = {'Authorization': f'Bearer {token}'}

invoices = [
    {'account_id': 'ACC-001', 'subtotal': 4167, 'tax_rate': 20.0, 'discount_amount': 0, 'total_amount': 5000, 'paid_amount': 0, 'invoice_type': 'SALES', 'notes': 'Test 1', 'reminder_type': 'EMAIL', 'reminder_status': 'PENDING', 'status': 'PENDING'},
    {'account_id': 'ACC-002', 'subtotal': 2917, 'tax_rate': 20.0, 'discount_amount': 0, 'total_amount': 3500, 'paid_amount': 1750, 'invoice_type': 'SALES', 'notes': 'Test 2', 'reminder_type': 'SMS', 'reminder_status': 'SENT', 'status': 'PARTIAL'},
    {'account_id': 'ACC-003', 'subtotal': 1667, 'tax_rate': 20.0, 'discount_amount': 0, 'total_amount': 2000, 'paid_amount': 2000, 'invoice_type': 'SALES', 'notes': 'Test 3', 'reminder_type': None, 'reminder_status': None, 'status': 'PAID'},
]

for inv in invoices:
    resp = requests.post(f'{BASE}/payments/invoices', json=inv, headers=headers)
    print(f"{inv.get('notes', 'unknown')}: {resp.status_code}")
    if resp.status_code >= 400:
        print(f"  Error: {resp.text[:200]}")
