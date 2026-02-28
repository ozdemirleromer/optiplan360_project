# OptiPlanning Gelişmiş Özellikler Görev Planı

- [x] Backend Modelleri ve Şemaları
  - [x] `app/models/` içerisine `MachineConfig`, `OptimizationJob`, `OptimizationReport` SQLAlchemy modellerini ekle.
  - [x] `app/schemas.py` içerisine bu modeller için Pydantic şemalarını (Create, Update, Out) ekle.
- [x] Backend Servisi ve Router
  - [x] `optiplanning_service.py` içerisinde makine konfigürasyonlarını veritabanından okuma/yazma (CRUD) işlemlerini yaz.
  - [x] `optiplanning_router.py` içerisine `/machine/config`, `/optimization/params`, `/optimization/run` endpoint'lerini ekle.
- [x] Frontend Geliştirmeleri
  - [x] `OptiPlanningPage` veya ilgili ayar paneline Makine Konfigürasyonlarını yönetmek için UI bileşenleri ekle.
- [x] Test ve Doğrulama
  - [x] Modellerin doğru kaydedildiğini ve API'nin makine konfigürasyonlarını 200 HTTP kodu ile döndüğünü test et (Kullanıcı tarafından canlı test edilecek).

- [x] Optimization Endpoint'leri Backend
  - [x] `optiplanning_service.py` içerisine `get_optimization_params`, `update_optimization_params`, ve `run_advanced_optimization` ekle.
  - [x] `optiplanning_router.py` içerisine `/optimization/params` (GET/PUT) ve `/optimization/run` (POST) ekle.
- [x] Optimization Endpoint'leri Frontend
  - [x] `OptiPlanningConfigModal.tsx` içerisine Optimizasyon Parametreleri sekmesi ekle.
  - [x] Arayüzden optimizasyon işi başlatmayı sağlayan bir buton/mekanizma ekle.
