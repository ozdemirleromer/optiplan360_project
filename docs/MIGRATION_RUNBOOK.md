# MIGRATION RUNBOOK — OptiPlan360

**Versiyon:** 2.0  
**Tarih:** 2026-03-04  
**Hedef Audience:** Backend Engineers, Database Administrators  
**Spesifik Görev:** Database schema versioning ve deployment with Alembic

---

## 🔧 MIGRATION FOUNDATIONS

### Alembic Nedir?

Alembic, SQLAlchemy ORM'i kullanan projelerde **database schema versioning** ve **DDL (Data Definition Language) management** için Python aracıdır.

**Temel Konseptler:**
- **Model** → Python sınıf (SQLAlchemy `Base` inheritance)
- **Migration** → Veritabanı schema değişikliği (`.sql` versiyonlu)
- **Revision** → Migration'ın unique identifier'ı (timestamp+sıra)
- **Head** → Latest migration (current state)
- **Base** → Initial state (migration yok, boş veritabanı)

### OptiPlan360 Alembic Setup

```
backend/
├── alembic/
│   ├── versions/              # Migration dosyaları
│   │   ├── 001_initial_schema.py
│   │   ├── 002_add_user_email.py
│   │   └── ...
│   ├── env.py                 # Alembic configuration
│   └── script.py.mako         # Migration template
├── alembic.ini                 # Alembic settings
└── app/
    └── models/                # SQLAlchemy models
        ├── order.py
        └── ...
```

---

## 📝 HER GÜN MIGRATION OPERASYONLARI

### Senaryo 1: Yeni Kolonu Eklemek

**Step 1: Model'i güncelle**
```python
# backend/app/models/order.py
class Order(Base):
    __tablename__ = "orders"
    
    id = Column(String, primary_key=True)
    customer_name = Column(String, nullable=False)
    # ✨ NEW
    customer_phone = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
```

**Step 2: Migration oluştur**
```bash
cd backend
alembic revision --autogenerate -m "add_customer_phone_to_orders"
# → alembic/versions/202603041000_add_customer_phone_to_orders.py oluşur
```

**Step 3: Migration'ı incele**
```bash
cat alembic/versions/202603041000_add_customer_phone_to_orders.py
```

Output:
```python
def upgrade() -> None:
    op.add_column('orders', sa.Column('customer_phone', sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_column('orders', 'customer_phone')
```

**Step 4: Lokal'de test et**
```bash
# Staging database'i kullan
export DATABASE_URL="sqlite:///./test.db"
alembic upgrade head
# → customer_phone kolonu eklendi

# Downgrade test et
alembic downgrade -1
# → customer_phone kolonu kaldırıldı

# Tekrar upgrade
alembic upgrade head
```

**Step 5: Git'e commit et**
```bash
git add app/models/order.py
git add alembic/versions/202603041000_add_customer_phone_to_orders.py
git commit -m "feat(models): add customer_phone to Order"
```

**Step 6: Production'da uygula**
```bash
# SSH to production
ssh prod-app-1.example.com
cd /opt/optiplan360/backend

# Backup al
pg_dump -U optiplan360 optiplan360_prod > /backups/pre_migration_$(date +%s).sql

# Migration apply et
alembic upgrade head
# → customer_phone kolonu eklendi

# Verify
psql -U optiplan360 -c "\d orders" | grep customer_phone
# → customer_phone | character varying | null

# Application restart
systemctl restart optiplan360
```

---

### Senaryo 2: Index Eklemek (BÖLÜM 7'deki eksik index'ler)

**Step 1: Migration manuel oluştur**
```bash
cd backend
alembic revision -m "add_missing_indexes"
# → alembic/versions/202603041100_add_missing_indexes.py (boş)
```

**Step 2: Migration'ı doldur**
```python
# alembic/versions/202603041100_add_missing_indexes.py
from alembic import op

def upgrade() -> None:
    # BÖLÜM 7'den eksik index'ler
    op.create_index('ix_orders_status_created', 'orders', ['status', 'created_at'], unique=False)
    op.create_index('ix_opti_jobs_state', 'opti_jobs', ['state'], unique=False)
    op.create_index('ix_invoices_due_date', 'invoices', ['due_date'], unique=False)
    op.create_index('ix_invoices_status', 'invoices', ['status'], unique=False)
    op.create_index('ix_audit_events_job_created', 'opti_audit_events', ['job_id', 'created_at'], unique=False)
    op.create_index('ix_order_parts_order_id', 'order_parts', ['order_id'], unique=False)

def downgrade() -> None:
    op.drop_index('ix_order_parts_order_id', 'order_parts')
    op.drop_index('ix_audit_events_job_created', 'opti_audit_events')
    op.drop_index('ix_invoices_status', 'invoices')
    op.drop_index('ix_invoices_due_date', 'invoices')
    op.drop_index('ix_opti_jobs_state', 'opti_jobs')
    op.drop_index('ix_orders_status_created', 'orders')
```

**Step 3: Test lokal'de**
```bash
export DATABASE_URL="sqlite:///./test.db"
alembic upgrade head

# Index'leri verify et (PostgreSQL)
psql -c "\d orders" | grep ix_
# → ix_orders_status_created

# Downgrade test
alembic downgrade -1
```

**Step 4: Production'da non-blocking uygulanma**
```bash
# PostgreSQL: CONCURRENTLY ile oluştur (table locked değil)
# Alembic otomatik CONCURRENTLY eklemiyor, manuel olarak:

-- Production SQL
CREATE INDEX CONCURRENTLY ix_orders_status_created ON orders(status, created_at DESC);
-- Duration: 5-10 minutes (large tables için), application continues

-- Doğrulandığında
alembic stamp head  # Mark migration as applied without running
```

---

### Senaryo 3: Data Migration (Veri Dönüştürme)

**Örnek:** `grain_code` sütununu string'den enum'a çevir

**Step 1: Migration oluştur**
```bash
alembic revision -m "convert_grain_code_to_enum"
```

**Step 2: Migration'ı doldur**
```python
from alembic import op, context
from sqlalchemy import text

def upgrade() -> None:
    # 1. Enum type oluştur (PostgreSQL)
    conn = op.get_bind()
    conn.execute(text("CREATE TYPE grain_enum AS ENUM ('0-Material', '1-Boyuna', '2-Enine', '3-Material')"))
    
    # 2. Yeni kolonu oluştur (default ile)
    op.add_column('orders', 
                  sa.Column('grain_code_new', sa.Enum('0-Material', '1-Boyuna', '2-Enine', '3-Material')))
    
    # 3. Eski veriden kopyala, dönüştür
    conn.execute(text("""
        UPDATE orders 
        SET grain_code_new = CAST(grain_code AS grain_enum)
    """))
    
    # 4. NOT NULL constraint ekle
    op.alter_column('orders', 'grain_code_new', existing_type=sa.String(), nullable=False)
    
    # 5. Eski kolonu sil
    op.drop_column('orders', 'grain_code')
    
    # 6. Yeni kolonu rename et
    op.execute(text("ALTER TABLE orders RENAME COLUMN grain_code_new TO grain_code"))

def downgrade() -> None:
    # Reverse: enum → string
    op.add_column('orders', sa.Column('grain_code_old', sa.String()))
    op.execute(text("""
        UPDATE orders SET grain_code_old = CAST(grain_code AS varchar)
    """))
    op.drop_column('orders', 'grain_code')
    op.execute(text("ALTER TABLE orders RENAME COLUMN grain_code_old TO grain_code"))
    op.execute(text("DROP TYPE grain_enum"))
```

**Step 3: Backup + Test**
```bash
# Staging db'de test et
export DATABASE_URL="postgresql://user:pass@staging-db/optiplan360"
alembic upgrade head
# → Veri dönüştürüldü, type changed

# Downgrade test
alembic downgrade -1
# → Veri eski duruma döndü
```

**Step 4: Production Apply**
```bash
# Backup
pg_dump optiplan360_prod > backup_before_enum_conversion.sql

# Apply (large table ise, maintenance window'da)
alembic upgrade head

# Verify
psql optiplan360_prod -c "SELECT * FROM orders LIMIT 5 \gx"
SELECT distinct(grain_code) FROM orders;
```

---

## 🚨 MIGRATION TROUBLESHOOTING

### Problem 1: Migration Conflict (Branch merge)

**Senaryo:** İki branch aynı tabloya migration ekledi

**Hatası:**
```
sqlalchemy.exc.ProgrammingError: (psql.ProgrammingError) 
error: relation "orders" already exists
```

**Çözüm:**
```bash
# 1. Migration file'ları kontrol et
ls -la alembic/versions/ | tail -10

# 2. Merge conflict mi?
git status | grep -i conflict

# 3. Alembic history
alembic history
# 202603041000 add_customer_phone_to_orders
# 202603041050 add_customer_email_to_orders  ← Hang-on, kontrol et

# 4. Manual migration merge et
# Yeni migration oluştur (both changes'i combine et)
alembic revision -m "add_customer_info_fields"
# → Hand-edit ve her iki change'ı ekle

# 5. Sorunlu migration'ları delete et
rm alembic/versions/202603041000_*.py
rm alembic/versions/202603041050_*.py
```

### Problem 2: Migration Failed Mid-Way

**Senaryo:** Migration half-applied, database inconsistent

**Hatası:**
```
ERROR: deadlock detected
```

**Çözüm:**
```bash
# 1. Current state kontrol et
alembic current
# → Hangi revision'da kaldık?

# 2. Transaction rollback (automatic)
# Alembic her migration'ı transaction'da çalıştırır
# Failure ise auto-rollback ✅

# 3. Fix et ve retry
# Migration file'ı incele, lock issue var mı?
# → Smaller batches'e böl, index creation CONCURRENTLY etc.

# 4. Retry
alembic upgrade +1

# 5. Hâlâ fail ediyorsa, manual olarak
psql optiplan360_prod -c "BEGIN; ... (migration SQL); COMMIT;"
# Ver successfully ise
alembic stamp head  # Mark as done without running
```

### Problem 3: Downgrade Başarısız

**Senaryo:** Rollback yapıyorum ama downgrade() fonksiyonu başarısız

**Çözüm:**
```bash
# 1. Migration'ı kontrol et
cat alembic/versions/202603041000_add_customer_phone_to_orders.py | grep -A10 "def downgrade"

# 2. Downgrade() fonksiyonu boş veya yanlışsa, manual fix et
# Op.drop_column başarısız → Column already dropped?

# 3. Manual downgrade
psql optiplan360_prod << EOF
BEGIN;
-- Manual DDL
ALTER TABLE orders DROP COLUMN customer_phone;
-- Mark in alembic
DELETE FROM alembic_version WHERE version_num = '202603041000';
COMMIT;
EOF

# 4. Verify
alembic current
# → Previous revision'ı göstermeli
```

### Problem 4: Migration History Corrupt

**Senaryo:** alembic_version tablosu corrupt, history skip

**Çözüm:**
```bash
# 1. Check table
psql -c "SELECT * FROM alembic_version;"
# → Boş veya garbled

# 2. Repair
alembic stamp base  # Reset to base (no migrations)

# 3. Reapply safely
alembic upgrade head

# 4. Verify
python -c "from app.models import *; Base.metadata.create_all()"
# → Should match database schema
```

---

## 📊 MIGRATION BEST PRACTICES

### ✅ DO's

```python
# ✅ Granular migrations (one change per file)
# 201_add_user_email.py
# 202_add_user_phone.py

# ✅ Descriptive names
alembic revision -m "add_compound_index_orders_status_created_date"

# ✅ Separate data migration
# Drop column with constraints first, then data migration, then add new column

# ✅ Test downgrade
alembic downgrade -1
alembic upgrade head

# ✅ Index'leri CONCURRENTLY oluştur (production)
op.execute("CREATE INDEX CONCURRENTLY ix_table_column ON table(column)")
```

### ❌ DON'Ts

```python
# ❌ Multi-change migration
# 201_add_user_email_and_phone_and_address.py  # BAD

# ❌ Downgrade'siz migration
# def downgrade():
#     pass  # ❌ Downgrade yapılamaz

# ❌ Long lock'u migration'da
# ALTER TABLE big_table ADD COLUMN x TYPE expensive;  # Tüm table locked

# ❌ Raw SQL (without Alembic)
# Database'e manual SQL apply et, migration'ı skip et → state inconsistent
```

---

## 🔄 STAGED MIGRATION STRATEGY

### Production Deployment Process (Zero Downtime)

**Adım 1: Pre-Migration (1 day before)**
```bash
# Staging db'de test
export DATABASE_URL="postgresql://staging-db/optiplan360"
alembic upgrade head
# ✅ Successful

# Performance impact check
# → Query time, index stats
```

**Adım 2: Canary Deployment (5% traffic)**
```bash
# 1. New code (with migration) deploy
# 2. Only 5% traffic to new nodes
# 3. Monitor:
#    - Error rate
#    - Query time
#    - Connection pool

# problematic → Rollback
# OK → Continue
```

**Adım 3: Gradual Rollout (5% → 25% → 50% → 100%)**
```bash
# 1. Every 10 minutes increase traffic percentage
# 2. Monitor each stage
# 3. Rollback anytime if issues
```

**Adım 4: Post-Migration Verification**
```bash
# 1. Schema integrity check
SELECT * FROM information_schema.tables WHERE table_schema = 'public';

# 2. Data integrity
SELECT COUNT(*) FROM orders;
SELECT COUNT(DISTINCT grain_code) FROM orders;

# 3. Index performance
EXPLAIN ANALYZE SELECT * FROM orders 
WHERE status = 'PENDING' AND created_at > NOW() - INTERVAL 7 days;
# → Should use ix_orders_status_created index
```

---

## 🎯 MIGRATION CHECKLIST

### Pre-Migration
- [ ] SQLAlchemy model updated
- [ ] Migration file auto-generated: `alembic revision --autogenerate`
- [ ] Migration file reviewed (upgrade + downgrade)
- [ ] Tested on staging database
- [ ] Downgrade tested on staging
- [ ] Backup strategy in place
- [ ] Rollback plan documented
- [ ] Team notified

### During Migration
- [ ] Nobody pushing code (deploy window)
- [ ] Database backups verified
- [ ] Monitoring dashboard open
- [ ] Error rate baseline recorded
- [ ] Migration applied: `alembic upgrade head`
- [ ] Health checks pass
- [ ] Error rate normal (< 0.1%)

### Post-Migration
- [ ] Data integrity verified
- [ ] Schema matches model
- [ ] Indexes working
- [ ] Performance baseline met
- [ ] Migration documented
- [ ] Git commit with migration
- [ ] Team notified of completion

---

## 📒 MIGRATION LOG EXAMPLE

```
=== Migration Log ===
Date: 2026-03-04
Time: 14:00-14:15 UTC
Duration: 15 minutes

Migration: add_missing_indexes_20260304

Pre-Conditions:
- Orders table: 1.2M rows
- OptiJobs table: 85K rows
- Database size: 2.3 GB

Steps Done:
1. Backup: backup_2026030414.sql (856 MB)
2. Migration applied: alembic upgrade head
3. Index creation: 6 indexes created
4. Performance check: queries 10% slower (warmup phase)
5. After 5min: performance normal

Results:
- Migration time: 3 minutes
- Downtime: 0 (online indexes)
- Data loss: 0
- Errors: 0

Post-Check:
- Schema: ✅ OK
- Data: ✅ OK (1.2M orders intact)
- Indexes: ✅ All 6 created
- Error rate: < 0.01%
- Response time: 320ms avg

Conclusion: ✅ SUCCESS
Rollback needed: NO
```

---

## 🔗 RELEVANT DOCUMENTS

- [DEVELOPER_RUNBOOK.md](DEVELOPER_RUNBOOK.md) — Test, code changes
- [PRODUCTION_RUNBOOK.md](PRODUCTION_RUNBOOK.md) — Monitoring, incident response
- [DB_STABILIZATION_REPORT.md](DB_STABILIZATION_REPORT.md) — Missing indexes (apply migration)
- [SECTION_7_8_FINAL_REPORT.md](SECTION_7_8_FINAL_REPORT.md) — Database schema analysis

---

**Created:** 2026-03-04  
**Maintained By:** Database Engineering Team  
**Next Review:** 2026-04-04
