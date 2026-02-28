#!/usr/bin/env python3
"""
CODE_REVIEW_CHECKLIST.py
Her yeni kod veya PR için kontrol listesi - AI token limitini korumak için
"""

CODE_REVIEW_CHECKLIST = {
    "YAPIYSAL KONTROL": [
        "✓ Dosya boyutu 300 satırdan az mı? (Evet -> modülarize et)",
        "✓ Fonksiyon sayısı 10'dan az mı? (Evet -> refactor et)",
        "✓ İş mantığı service katmanında mı, router'da değil mi?",
        "✓ Triple nested loop var mı? (Var -> döngü logikini refactor et)",
        "✓ Code duplication %10'dan az mı? (DRY ilkesi)",
    ],

    "TIP GÜVENLIĞI": [
        "✓ Tüm parametrelerde type hint var mı?",
        "✓ Return type'ı belirtilmiş mi?",
        "✓ Optional tipler None check'ı yapılıyor mu?",
        "✓ str/int/bool karışıklığı var mı?",
        "✓ cast() kullanımı minimize edilmiş mi?",
    ],

    "HATA YÖNETIMI": [
        "✓ Try-except blokları yalnızca specific exception'ları yakalar mı?",
        "✓ Bare except: var mı? (Yok -> iyi; Var -> spesifikle)",
        "✓ AppError hiyerarşisi kullanılıyor mu?",
        "✓ Hata mesajları user-friendly mi?",
        "✓ Logging var mı? (error/warning/info)",
    ],

    "DATABASE GÜVENLIĞI": [
        "✓ SQL injection koruması var mı? (SQLAlchemy parametrized queries)",
        "✓ N+1 query problemi var mı? (eager loading kontrol)",
        "✓ Transaction yönetimi doğru mu?",
        "✓ Foreign key constraints kontrol edildi mi?",
        "✓ Index'ler optimize mi? (Slow query detection)",
    ],

    "AUTHORIZATION & PERMISSIONS": [
        "✓ Her write endpoint'de _assert_can_modify var mı?",
        "✓ Role-based access control (RBAC) kontrol edilmiş mi?",
        "✓ Data ownership validation yapılıyor mu?",
        "✓ Resource-level permission check'ı var mı?",
        "✓ Admin bypass kontrolü yapılıyor mu?",
    ],

    "API SÖZLEŞMESI": [
        "✓ Request schema'sı Pydantic ile tanımlanmış mı?",
        "✓ Response schema'sı tanımlanmış mı?",
        "✓ Optional alanlar default değer taşıyor mu?",
        "✓ Backend response frontend types'a map ediliyor mu?",
        "✓ API versioning kuralları takip ediliyor mu? (/api/v1/)",
    ],

    "PERFORMANS": [
        "✓ Query count kontrol edildi mi? (<5 per endpoint idealdir)",
        "✓ Response time < 200ms mi? (normal endpoint'ler için)",
        "✓ Caching stratejisi uygulanmış mı?",
        "✓ Memory leak var mı? (reference cycle kontrol)",
        "✓ Pagination var mı? (large dataset'ler için)",
    ],

    "TEST COVERAGE": [
        "✓ Unit test yazılmış mı? (saf fonksiyonlar için min %80)",
        "✓ Edge case'ler test edildi mi?",
        "✓ Happy path + error path'ler var mı?",
        "✓ Mocking/stubbing doğru mu?",
        "✓ Flaky test var mı? (zamanla başarısız olan)",
    ],

    "SECURITY": [
        "✓ Secret (password, token) hardcoded mı? (Yok -> iyi; Var -> environment)",
        "✓ SQL injection var mı? (Hayır -> iyi)",
        "✓ XSS vulnerability var mı? (Frontend'de relevant)",
        "✓ CORS policy kontrol edilmiş mi?",
        "✓ Rate limiting uygulanmış mı? (auth endpoints)",
        "✓ Input validation var mı?",
    ],

    "DOCUMENT": [
        "✓ Docstring var mı? (public methods için)",
        "✓ Complex logic açıklamaya alınan comment var mı?",
        "✓ README güncellenmiş mi?",
        "✓ API documentation (OpenAPI/Swagger) güncel mi?",
    ],

    "GIT PRACTICES": [
        "✓ Commit message açıklayıcı mı?",
        "✓ Atomic commits mi? (tekil görev per commit)",
        "✓ Merge conflict'ler çözülü mü?",
        "✓ Unnecessary files staged mı? (__pycache__, .pyc)",
    ],
}

SEVERITY_LEVELS = {
    "CRITICAL": [
        "SQL injection",
        "Authorization bypass",
        "Hardcoded secrets",
        "Infinite loop / crash cause",
    ],
    "HIGH": [
        "N+1 queries",
        "Type mismatch (str/int)",
        "Unhandled exception",
        "Race condition",
    ],
    "MEDIUM": [
        "Code duplication",
        "Missing docstring",
        "Slow algorithm",
        "Weak naming",
    ],
    "LOW": [
        "Whitespace issues",
        "Import unused",
        "Line too long",
    ],
}

if __name__ == "__main__":
    print("=" * 60)
    print("KOD İNCELEME KONTROL LİSTESİ")
    print("=" * 60)
    for category, items in CODE_REVIEW_CHECKLIST.items():
        print(f"\n📋 {category}")
        for item in items:
            print(f"   {item}")

    print("\n\n⚠️  KRITIK SEVIYE SORUNLAR (KABUL EDİLMEZ):")
    for level, issues in SEVERITY_LEVELS.items():
        if level != "CRITICAL":
            continue
        for issue in issues:
            print(f"   ❌ {issue}")
