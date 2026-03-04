# DEVELOPER RUNBOOK — OptiPlan360

**Versiyon:** 2.0  
**Tarih:** 2026-03-04  
**Hedef Audience:** Backend Geliştirmeciler, QA/Test Mühendisleri  
**Öncül:** BÖLÜM 9-10 testleri ve patch'leri uygulandı

---

## 🚀 HIZLI BAŞLANGAÇ

### Adım 1: Environment Hazırla

```bash
# Backend dizinine git
cd backend

# Virtual environment oluştur (ilk kez)
python -m venv venv
source venv/Scripts/activate  # Windows PowerShell: venv\Scripts\Activate.ps1

# Dependencies yükle
pip install -r requirements.txt
pip install -r requirements-dev.txt  # Test dependencies

# Environment variables ayarla
cp .env.example .env
# .env dosyasında veritabanını yapılandır
```

### Adım 2: Database Hazırla

```bash
# Veritabanı oluştur ve migration'ları uygula
alembic upgrade head

# (Opsiyonel) Test verileri yükle
python create_all_tables.py
python seed_all_data.py
```

### Adım 3: Server Başlat

```bash
# Terminal 1: FastAPI backend
python main.py
# → http://localhost:8000
# → Docs: http://localhost:8000/docs

# Terminal 2 (opsiyonel): Frontend development
cd ../frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## 🧪 TEST ÇALIŞTIRLARI

### Tüm Testleri Çalıştır

```bash
cd backend

# Hepsi (default)
pytest tests/ -v

# Belirli dosya
pytest tests/test_text_normalize.py -v
pytest tests/test_grain_matcher.py -v
pytest tests/test_export_validator.py -v

# Test coverage raporu oluştur
pytest tests/ --cov=app --cov-report=html
# → htmlcov/index.html açılır (browser)
```

### Belirli Test Çalıştır

```bash
# Belirli test sınıfı
pytest tests/test_text_normalize.py::TestNormalizeTurkish -v

# Belirli test fonksiyonu
pytest tests/test_text_normalize.py::TestNormalizeTurkish::test_turkish_to_ascii -v

# Hata olunca durdu (fail-first)
pytest tests/ -v -x

# En yavaş 10 test'i göster
pytest tests/ -v --durations=10
```

### Test Hata Ayıklama

```bash
# Verbose output (detaylı hata mesajı)
pytest tests/test_grain_matcher.py -vv

# Python debugger ile
pytest tests/test_grain_matcher.py -vv --pdb
# → Error'da durur, pdb prompt gelir (c = continue, n = next, etc.)

# Print debug output göster (normally hidden)
pytest tests/test_grain_matcher.py -v -s

# Son başarısız test'i tekrar çalıştır
pytest tests/ --lf

# Belirli markerlı testler
pytest tests/ -m "not integration" -v  # integration testleri hariç
```

---

## 📦 MIGRATION REHBERI

### Alembic Migration Nedir?

OptiPlan360 veritabanı şemasını versiyonla ve track etmek için **Alembic** kullanıyor. Her migration bir `.py` dosyasıdır.

### Migration Uygulamak

```bash
cd backend

# Latest migration'a kadar ilerle (normal)
alembic upgrade head

# Belirli revision'a git
alembic upgrade aaa1111

# Bir önceki revision'a geri dön (downgrade)
alembic downgrade -1

# Tüm migration'ları geri dön (başa dön)
alembic downgrade base
```

### Yeni Migration Oluşturmak

```bash
cd backend

# Model değişti → otomatik migration üret
alembic revision --autogenerate -m "add_user_email_column"

# Manuel migration (boş template)
alembic revision -m "add_new_table"
# → alembic/versions/xxxx_add_new_table.py açılır, doldur

# Migration'ı kontrol et
cat alembic/versions/xxxx_add_new_table.py

# Uygulamadan önce test et (dry-run)
alembic upgrade +1 --sql
# → SQL komutları görülür, apply edilmez

# Uygulanmaya hazırsa
alembic upgrade +1
```

### Migration Sorunları

```bash
# Migration history'yi görüntüle
alembic current      # Şu an hangi revision?
alembic history      # Tüm revision'lar

# Migration'ı mark et (uygulandı ama dosya yok gibi)
alembic stamp aaa1111

# Dirty state (incomplete migration) temizle
alembic stamp head

# Migration'da hata oldu → rollback
alembic downgrade -1
# Fix et, sonra
alembic upgrade head
```

---

## 🔍 COMMON TASKS

### Task 1: Yeni Test Yazmak

```bash
# 1. Test dosyası oluştur (eğer yoksa)
# backend/tests/test_my_feature.py

# 2. Test sınıfı + fonksiyon yaz
# class TestMyFeature:
#     def test_scenario_1(self):
#         ...

# 3. Lokal'de çalıştırarak test et
pytest tests/test_my_feature.py -vv

# 4. Gerekirse fixture ekle
# @pytest.fixture
# def my_fixture():
#     return TestData()

# 5. Git'e commit et
git add tests/test_my_feature.py
git commit -m "test: add tests for my_feature"
```

### Task 2: Yeni Endpoint Eklemek

```python
# 1. Service'e mantık yaz (app/services/my_service.py)
class MyService:
    def do_something(self, param):
        # İş mantığı
        pass

# 2. Schema (request/response) oluştur (app/schemas.py)
class MyRequest(BaseModel):
    param: str

class MyResponse(BaseModel):
    result: str

# 3. Router'a endpoint ekle (app/routers/my_router.py)
@router.post("/my-endpoint")
async def my_endpoint(req: MyRequest) -> MyResponse:
    # Permission check
    service = MyService()
    result = service.do_something(req.param)
    return MyResponse(result=result)

# 4. Test yaz (tests/test_my_router.py)
def test_my_endpoint(client):
    response = client.post("/my-endpoint", json={"param": "test"})
    assert response.status_code == 200
    assert response.json()["result"] == "expected"

# 5. main.py'de router'ı include et
app.include_router(my_router.router, prefix="/api", tags=["my"])
```

### Task 3: Duplicate Kod Temizlemek

```bash
# 1. Duplicate'i bul
grep -r "duplicate_pattern" backend/app/

# 2. Canonical source oluştur (örn: constants/excel_schema.py)
# GRAIN_MAP = {...}

# 3. Diğer yerlerden kaldır
# rm -f duplicate_file.py
# veya
# import GRAIN_MAP from constants

# 4. Test'leri çalıştır
pytest tests/ -v

# 5. Commit et
git add backend/app/constants/excel_schema.py
git commit -m "refactor: consolidate GRAIN_MAP to single source"
```

### Task 4: Encoding Sorunları Çözmek

```python
# ✅ DOĞRU — encoding="utf-8" ile open ve FileHandler
with open("file.csv", encoding="utf-8") as f:
    data = f.read()

# ✅ DOĞRU — XML generation
xml_str = ET.tostring(root, encoding="utf-8", xml_declaration=True)

# ❌ YANLIŞ — encoding belirtmeden
with open("file.csv") as f:
    data = f.read()  # System default (Windows: cp1252, Linux: utf-8)

# ✅ Turkish character test
text = "Ceviz, Meşe, ÇİKOLATA"
normalized = normalize_turkish(text)
# → Ceviz, Mese, CIKOLATA
```

---

## 🐛 DEBUGGING TİPLERİ

### Bug Tipi 1: Test Başarısız

```bash
# 1. Verbose output'la çalıştır
pytest tests/test_x.py::TestY::test_z -vv -s

# 2. Hata mesajını oku
# AssertionError: assert 0 == 1
#   where 1 = function_call()

# 3. Fonksiyonu inceleme için interactive debug
pytest tests/test_x.py::TestY::test_z -vv --pdb

# 4. Breakpoint koy (debug'dan çıkmak için 'c' yaz)
import pdb; pdb.set_trace()  # Kodda koy
# → pytest çalıştırırken durur, interaktif debug

# 5. Fixture'ı kontrol et
# @pytest.fixture
# def my_fixture():
#     print("FIXTURE VALUE:", value)  # Debug output
#     return value
```

### Bug Tipi 2: Import Hatası

```bash
# HATA: ModuleNotFoundError: No module named 'app.services.x'

# 1. Path'i kontrol et
ls -la backend/app/services/x.py

# 2. __init__.py var mı?
ls -la backend/app/__init__.py
ls -la backend/app/services/__init__.py

# 3. Circular import var mı?
python -c "from app.services.x import MyClass"  # Çalışırsa OK

# 4. PYTHONPATH ayarla
export PYTHONPATH="$(pwd)/backend:$PYTHONPATH"
python -c "from app.services.x import MyClass"
```

### Bug Tipi 3: Database Hataları

```bash
# HATA: sqlalchemy.exc.IntegrityError: UNIQUE constraint failed

# 1. Migration'ları kontrol et
alembic history

# 2. Migrationu ters çevir (downgrade)
alembic downgrade -1

# 3. Modeli kontrol et (unique=True var mı?)
# class User(Base):
#     email = Column(String, unique=True)

# 4. Veritabanını sıfırla (development sadece!)
rm backend/optiplan360.db
alembic upgrade head
python seed_all_data.py

# 5. Test et
pytest tests/test_orders_crud.py -v
```

---

## 📋 GIT WORKFLOW

### Feature Branch Akışı

```bash
# 1. Feature branch oluştur
git checkout -b feature/add-grain-validation

# 2. Geliştir ve test et
pytest tests/ -v

# 3. Commit'le
git add .
git commit -m "feat: add grain validation to export"

# 4. Changes'i kontrol et
git log --oneline -5
git diff HEAD~1

# 5. Push et
git push origin feature/add-grain-validation

# 6. Pull Request aç (GitHub/GitLab)
# → Reviewer'lar test sonuçları + code review yapar
# → Approved → Merge → Delete branch

# 7. Local'de cleanup
git checkout main
git pull origin main
git branch -d feature/add-grain-validation
```

### Commit Message Convention

```bash
# Format: type(scope): description

# ✅ DOĞRU
git commit -m "feat(export): add GRAIN_MAP constant"
git commit -m "test(grain_matcher): add confidence scoring tests"
git commit -m "fix(bridge): remove duplicate GRAIN_MAP"
git commit -m "docs: update migration runbook"

# ❌ YANLIŞ
git commit -m "fix stuff"
git commit -m "updated"
git commit -m "wip"
```

---

## 🔄 PRE-COMMIT HOOKS (Opsiyonel)

```bash
# .git/hooks/pre-commit kurulumu
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "Running linting..."
cd backend
python -m isort app/ tests/
python -m black app/ tests/
echo "Running tests..."
pytest tests/ -q
if [ $? -ne 0 ]; then
  echo "Tests failed! Commit aborted."
  exit 1
fi
EOF

chmod +x .git/hooks/pre-commit

# Test et
git commit -m "test"
# → auto-format + test çalışır
```

---

## 📊 PERFORMANCE TUNING

### Yavaş Test'i Hızlandırma

```bash
# 1. Yavaş test'i sakla
pytest tests/ --durations=10
# → 10 en yavaş test'i gösterir

# 2. Parallel test çalıştırma (pytest-xdist)
pip install pytest-xdist
pytest tests/ -n auto
# → CPU core sayısı kadar paralel

# 3. Test cache'i kullan
pytest tests/ --cache-clear  # Cache sıfırla
pytest tests/ -l  # Last failed testler

# 4. Fixture'ları optimize et
# ✅ DOĞRU — session-scoped (bir kez)
@pytest.fixture(scope="session")
def db_connection():
    return Database()

# ❌ YANLIŞ — function-scoped (her test için)
@pytest.fixture(scope="function")
def db_connection():
    return Database()
```

---

## 🚨 PRODUCTION DEPLOYMENT CHECKLIST

Deployment öncesi kapatması gereken şeyler:

```bash
# ✅ Tüm testler geçti
pytest tests/ -v

# ✅ Coverage yeterli (min %80)
pytest tests/ --cov=app --cov-report=term-missing | grep TOTAL

# ✅ Linting sorunları yok
python -m pylint app/ --disable=all --enable=E,F

# ✅ Type hints doğru
mypy app/ --ignore-missing-imports

# ✅ Migration'lar tested
alembic upgrade head  # staging db'de

# ✅ Environment variables set
cat .env | grep "DATABASE_URL"

# ✅ Secret'ler güvenli (hardcoded secret yok)
grep -r "password" app/ | grep -v "password_hash"

# ✅ Debug mode kapalı (main.py)
# app = FastAPI(debug=False)

# ✅ Log level production (INFO+)
# logging.getLogger().setLevel(logging.INFO)

# Hepsi OK → Deploy!
```

---

## 📚 KAYNAKLAR

- **pytest:** https://docs.pytest.org/
- **SQLAlchemy:** https://docs.sqlalchemy.org/
- **Alembic:** https://alembic.sqlalchemy.org/
- **FastAPI:** https://fastapi.tiangolo.com/
- **OptiPlan360 Kodlar:**
  - Backend services: `backend/app/services/`
  - Tests: `backend/tests/`
  - Models: `backend/app/models/`

---

## 🆘 SOS — Hızlı Çözümler

| Problem | Çözüm |
|---------|-------|
| `ModuleNotFoundError` | `export PYTHONPATH="$(pwd)/backend"` |
| Test timeout | `pytest tests/ --timeout=10` |
| Database lock | `rm optiplan360.db && alembic upgrade head` |
| Encoding hata | Tüm `open()`'a `encoding="utf-8"` ekle |
| Migration conflict | `alembic downgrade -1` sonra `alembic upgrade head` |
| Circular import | Service'leri `__init__.py`'de import etme, sadece yönlendir |

---

**Son Güncelleme:** 2026-03-04  
**Kontrol Listesi:** [x] Test çalıştırma [ ] Migration [ ] Deployment
