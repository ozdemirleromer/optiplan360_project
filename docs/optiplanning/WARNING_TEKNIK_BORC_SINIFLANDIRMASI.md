# Workflow Warning Teknik Borç Sınıflandırması

## Amaç

Bu doküman, workflow regresyon çalıştırmalarında görülen warning kayıtlarını sınıflandırır, etki seviyesini belirtir ve aksiyon önerisi üretir.

## Kapsam

- [API] Workflow backend test koşuları
- [SQL-TEKNIK] Test ortamı bağımlılıkları
- [EKLENMESI-GEREKLI] Warning azaltma aksiyon planı

## Tespit Edilen Warning'ler

### W-001 — `python_multipart` PendingDeprecationWarning

- **Kaynak:** `starlette.formparsers`
- **Metin özeti:** `Please use import python_multipart instead`
- **Gözlendiği komut:** `pytest tests/test_optiplan_workflow_router_schema.py tests/test_optiplan_workflow_service.py -q`
- **Durum:** Sürekli tekrar eden çevresel warning
- **Etki seviyesi:** Orta (şu an işlevsel bloklayıcı değil, ileri sürümlerde kırılma riski var)

## Sınıflandırma

| ID | Tür | Şiddet | Üretim Etkisi | Kısa Vadeli Risk | Uzun Vadeli Risk |
|---|---|---|---|---|---|
| W-001 | Bağımlılık deprecation | Orta | Düşük | Düşük | Orta-Yüksek |

## Önerilen Aksiyonlar

1. [API] Python ortamında `python-multipart` sürümü netleştirildi (`backend/requirements.txt` -> `python-multipart>=0.0.20`).
2. [EKLENMESI-GEREKLI] FastAPI/Starlette bağımlılık pinleri gözden geçirilerek uyumlu sürüm matrisi netlenmeli.
3. [EKLENMESI-GEREKLI] CI koşusunda warning metrik takibi eklenmeli (warning sayısı trendi izlenmeli).

## Geçici Azaltım (Uygulandı)

- [API] Test gürültüsünü azaltmak için `pytest.ini` içinde `starlette.formparsers` kaynaklı bilinen `PendingDeprecationWarning` filtresi eklendi.
- [VARSAYIM] Bu filtre yalnızca raporlama temizliği sağlar; kök neden bağımlılık uyum güncellemesi ile kalıcı kapatılmalıdır.

## Kapanış Kriteri

- [API] Workflow test koşusunda `W-001` warning kaydı görülmüyorsa madde kapatılır.
- [API] Bağımlılık güncellemesi sonrası workflow regresyonu (`router_schema + service`) tekrar tam geçmelidir.
