# OptiPlanning Gelişmiş Özellikler Uygulama Planı

Bu plan, `OPTIPLANNING_ROUTER_EKLENDI.md` belgesinde belirtilen **Kısa/Orta Vadeli Stratejik Hedefler** doğrultusunda uygulamanın genişletilmesini hedeflemektedir.

## 1. Veritabanı Modelleri ve Şemaları (Backend)

`backend/app/models/` ve `backend/app/schemas.py` dosyalarına aşağıdaki yapıların eklenmesi:
- **`MachineConfig`**: OptiPlanning makine ve testere konfigürasyonlarının veritabanında saklanması.
- **`OptimizationJob`**: Daha gelişmiş optimizasyon görevlerinin asenkron veya loglanarak saklanması.
- **`OptimizationReport`**: Kesim ve verimlilik raporlarının saklanması.

## 2. API Uç Noktaları (Router)

Mevcut olan `backend/app/routers/optiplanning_router.py` dosyasına aşağıdaki gelişmiş endpointlerin eklenmesi:
- `GET /api/v1/optiplanning/machine/config`: Makine konfigürasyonlarını getir.
- `PUT /api/v1/optiplanning/machine/config`: Makine konfigürasyonlarını güncelle.
- `GET /api/v1/optiplanning/optimization/params`: Operatörlerin yönettiği optimizasyon parametrelerini getir.
- `POST /api/v1/optiplanning/optimization/run`: Asenkron veya gelişmiş bir Optimizasyon Job'ı başlat.

## 3. Servis Katmanı (Business Logic)

`backend/app/services/optiplanning_service.py` içerisine yeni metotlar eklenecek:
- `get_machine_config()`, `update_machine_config()`
- `run_advanced_optimization()`

## 4. Frontend Arayüzü

`frontend/src/features/Integrations/OptiPlanningPage` veya mevcut sayfalarda yeni bileşenler geliştirilmesi:
- OptiPlanning'e özel bir yönetim kontrol paneli (Dashboard) veya `Machine Config` yapılandırma modal'ının genişletilmesi.
- Optimizasyon parametrelerinin UI üzerinden yönetilebilmesi.

## 5. Doğrulama ve Test
- Yeni eklenen modellerin ve API fonksiyonlarının Pydantic validasyonlarından başarıyla geçtiğine dair Swagger UI testleri.
- Frontend'de form elamanları ile DB update işlemlerinin başarıyla bağlandığının teyidi.
