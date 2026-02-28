# DEVELOPMENT_GUIDELINES.md
# Kod Kontrolü ve Güvenliği İçin Best Practices

## 🎯 AI Token Limit Optimizasyonu

### 1. Hızlı Hata Tespiti
```bash
# Pre-commit hooks ile otomatik kontrol
pre-commit run --all-files

# Hızlı lint çalıştırma (belirli dosya)
flake8 backend/app/services/my_service.py --statistics

# Type checking (time saver)
mypy backend --ignore-missing-imports --no-error-summary
```

### 2. Kod Kompleksitesi Kontrol
- **Dosya boyutu**: < 300 satır (modülarize et)
- **Fonksiyon boyutu**: < 50 satır (extract method)
- **İç içe geçmiş blok**: < 3 seviye (refactor et)
- **Cyclomatic complexity**: < 10 (simplify logic)

### 3. Minimum Viable Changes (MVC) Kuralı
Her değişikliği **en küçük, bağımsız üniteler** halinde yap:
```python
# ❌ YANLIŞ: Birçok şeyi bir commit'te
# Users + Orders + Payments sistemi refactor

# ✅ DOĞRU: Adım adım
# Commit 1: User service'i refactor (type hints ekle)
# Commit 2: Order service'i refactor (error handling)
# Commit 3: Payment integration test yaz
```

### 4. Code Review Checklist
Commit'ten önce değerlendir:

#### Yapısal Kontrol
- [ ] Dosya max 300 satır
- [ ] Fonksiyon max 50 satır
- [ ] Service layer'da iş mantığı
- [ ] DRY: Tekrar eden kod yok
- [ ] SOLID prensiplerine uy

#### Tip Güvenliği
- [ ] Type hints var (parametreler)
- [ ] Return types var
- [ ] None check'lar yapılıyor
- [ ] cast() minimize edilmiş

#### Hata Yönetimi
- [ ] Specific exceptions (bare except: yok)
- [ ] AppError hiyerarşisi kullanılıyor
- [ ] Logging var (error/warning/info)
- [ ] User-friendly mesajlar

#### Güvenlik
- [ ] Secret'lar hardcoded değil
- [ ] SQL injection koruması (parametrized queries)
- [ ] Authorization check'ı var
- [ ] Rate limiting (auth endpoints)
- [ ] Input validation

#### Test
- [ ] Unit tests var (%80+ coverage)
- [ ] Edge cases test edildi
- [ ] Happy + error path'ler var
- [ ] Mock/stub doğru

## 🚀 Otomatik Araçlar Setup

### Pre-commit Hooks Kurulumu
```bash
# 1. Yükle
pip install pre-commit

# 2. Install hooks (her checkout'ta çalışır)
pre-commit install

# 3. Manual çalıştır (PR'dan önce)
pre-commit run --all-files

# 4. Bypass (acil durumda)
git commit --no-verify  # NOT: Sadece acil durumlarda!
```

### GitHub Actions CI/CD
Dosya: `.github/workflows/code-quality.yml`
- Lint (flake8)
- Format kontrol (black)
- Type checking (mypy)
- Security scan (bandit)
- Tests (pytest)

## 📊 Token Kullanımı Optimize Etme

### Problem: Uzun Hata İşleme
```python
# ❌ YANLIŞ: AI'ye tüm error stack gönder
try:
    result = complex_operation()
except Exception as e:
    # Büyük traceback -> token harcanıyor
    print(e)

# ✅ DOĞRU: Hızlı self-recovery
try:
    result = complex_operation()
except ValueError as e:
    logger.error(f"Invalid input: {e}")
    raise ValidationError("Lütfen geçerli format girin")
except DatabaseError as e:
    logger.error(f"DB error: {e}")
    raise ConflictError("Veritabanı sorunu - sonra deneyin")
```

### Problem: Fazla Log Output
```python
# ❌ YANLIŞ: Her adımı log et
logger.info("Starting user creation")
logger.info(f"User data: {user_data}")
logger.info(f"User created: {user.id}")

# ✅ DOĞRU: Önemli noktaları log et
logger.info(f"User created: {user.id}")
if duplicate_check_failed:
    logger.error(f"Duplicate user: {user.email}")
```

### Problem: Fazla Test Output
```bash
# ❌ YANLIŞ: Tüm output'u Al
pytest backend -v

# ✅ DOĞRU: Özet al
pytest backend -q  # quiet mode
pytest backend --tb=short  # short traceback
```

## 🔍 Hızlı Bug Bulma Teknikleri

### 1. Static Analysis
```bash
# Flake8 + extensions
flake8 backend --extend-ignore=E203 --max-line-length=100

# Pylint spot-check
pylint backend/app/services/specific_file.py --disable=all --enable=E,F

# Bandit security scan
bandit -r backend --quiet
```

### 2. Type Checking
```bash
# MyPy without import errors
mypy backend --ignore-missing-imports

# MyPy single file
mypy backend/app/models.py
```

### 3. Code Complexity
```bash
# Radon complexity check
pip install radon
radon cc backend --min C  # Seri C ve üzeri

# McCabe complexity
radon metrics backend --total
```

## 📝 Git Workflow Best Practices

### Atomic Commits
```bash
# ❌ YANLIŞ
git add .
git commit -m "refactor and add tests and update docs"

# ✅ DOĞRU
git add backend/app/services/user.py
git commit -m "refactor: extract user validation logic"

git add backend/tests/test_user*.py
git commit -m "test: add user validation tests"

git add docs/API.md
git commit -m "docs: update user API documentation"
```

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>

# type: feat, fix, refactor, test, docs, chore
# scope: user, order, payment, auth
# subject: imperative mood, max 50 chars
# body: explain what and why (not how)
```

Örnek:
```
feat(auth): add JWT token refresh endpoint

- Implement refresh_token endpoint at POST /api/v1/auth/refresh
- Add token expiration logic (15 min access, 7 day refresh)
- Update AppError for expired token handling

Fixes #123
```

## 🛡️ Security Checklist

### Startup Kontrolü
- [ ] `.env` dosyası `.gitignore`'da
- [ ] Secrets Manager kullanılıyor (production)
- [ ] Database credentials secured
- [ ] API keys environment variables

### Per-Request
- [ ] Authentication check var
- [ ] Authorization (RBAC) check'ı var
- [ ] Input validation yapılıyor
- [ ] Rate limiting aktif

### Database
- [ ] Parametrized queries (ORM)
- [ ] Foreign key constraints
- [ ] Audit logging var
- [ ] Backup strategy tanımlanmış

## 🚨 Acil Durum Protokolü

### Kritik Bug Bulundu
```bash
# 1. Atla (staging'de testa et)
git stash

# 2. Yeni branch aç
git checkout -b hotfix/critical-bug

# 3. Fix yap + test
# ... fix code ...
pytest backend -k test_critical

# 4. Commit + push
git commit -m "fix: critical bug in payment processing"
git push origin hotfix/critical-bug

# 5. PR açıp merge et
# (normal workflow)
```

## 📚 Kaynaklar

- [PEP 8](https://pep8.org/) - Python style guide
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Clean Code](https://amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
