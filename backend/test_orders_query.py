"""
Orders API 500 hatasını debug et
"""
from app.database import SessionLocal
from app.models import Order
from sqlalchemy.orm import joinedload

db = SessionLocal()
try:
    print("Orders sorgusunu test ediyorum...")
    q = db.query(Order).options(joinedload(Order.parts), joinedload(Order.customer))
    print("✓ Query oluşturuldu")
    
    orders = q.limit(5).all()
    print(f"✓ Toplam {len(orders)} sipariş bulundu")
    
    for o in orders:
        print(f"  - ID: {o.id}, Customer: {o.crm_name_snapshot}, Parts: {len(o.parts)}")
        
    print("\nOrderService.order_to_out() test ediliyor...")
    from app.services.order_service import OrderService
    
    if orders:
        result = OrderService.order_to_out(orders[0])
        print(f"✓ OrderOut oluşturuldu: {result.id}")
        print(f"  - Customer ID: {result.customer_id}")
        print(f"  - Parts: {len(result.parts)}")
        
    print("\n✓ Tüm testler başarılı!")
    
except Exception as e:
    print(f"✗ HATA: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
