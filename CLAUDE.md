# OptiPlan360 — Claude Kod Kuralları

Bu dosya her Claude oturumunda otomatik yüklenir.
**Her yeni kod eklemesinde bu kurallara uy.**

---

## 1. Proje Yapısı

```
optiplan360_project/
├── backend/          # FastAPI + SQLAlchemy
│   └── app/
│       ├── routers/        # Route katmanı (sadece HTTP in/out)
│       ├── services/       # İş mantığı (tüm ağır kod buraya)
│       ├── models.py       # SQLAlchemy ORM modelleri
│       ├── schemas.py      # Pydantic request/response şemaları
│       ├── exceptions.py   # Merkezi hata hiyerarşisi
│       ├── permissions.py  # RBAC tanımları (Permission enum + ROLE_PERMISSIONS)
│       ├── rate_limit.py   # slowapi singleton (circular import önler)
│       └── main.py         # App factory, middleware, exception handler
└── frontend/         # React 18 + TypeScript + Vite
    └── src/
        ├── components/     # Paylaşılan UI bileşenleri
        ├── features/       # Domain modülleri (Operations, Payments, …)
        ├── stores/         # Zustand store'ları (authStore, uiStore)
        ├── services/       # API istemcileri
        ├── types/          # Merkezi TypeScript tip tanımları (index.ts)
        ├── themes.ts       # Tema adları
        └── test/           # Test setup (setup.ts)
```

---

## 2. Teknoloji Yığını

| Katman | Teknoloji | Versiyon |
|--------|-----------|----------|
| Frontend runtime | React | 18 |
| Frontend dili | TypeScript | 4.9.5 |
| Frontend build | Vite | 7 |
| State yönetimi | Zustand | 5 |
| Backend | FastAPI | latest |
| ORM | SQLAlchemy | latest |
| JWT | python-jose | latest |
| Rate limiting | slowapi | latest |
| Test (FE) | vitest + jsdom | 4 |
| Test (BE) | pytest | latest |
| Lint | ESLint v10 flat config | 10 |

---

## 3. Backend Kuralları

### 3.1 Katman Sorumlulukları
- **Router**: Sadece HTTP parametresi al, servisi çağır, yanıt dön. İş mantığı **yok**.
- **Service**: Tüm iş mantığı, validasyon, yetki kontrolü burada.
- **Model**: SQLAlchemy sütun tanımları. Metod **yok** (iş mantığı serviste).

### 3.2 Hata Yönetimi — ZORUNLU
`app/exceptions.py` hiyerarşisini kullan, asla ham `HTTPException` fırlatma:

```python
# DOĞRU
from app.exceptions import NotFoundError, AuthorizationError, ValidationError, ConflictError

raise NotFoundError("Sipariş", order_id)          # → 404
raise AuthorizationError("Bu işlem için yetkin yok")  # → 403
raise ValidationError("Geçersiz durum geçişi")        # → 422
raise ConflictError("Bu kaynak zaten mevcut")          # → 409

# YANLIŞ — kullanma
raise HTTPException(status_code=404, detail="not found")
```

Global handler `main.py`'de kayıtlı; `AppError` alt sınıfları otomatik JSON'a dönüşür:
```json
{"error": {"code": "NOT_FOUND", "message": "...", "details": []}}
```

### 3.3 RBAC — Yetkilendirme
- `app/permissions.py` → `Permission` enum ve `ROLE_PERMISSIONS` dict
- Yeni özellik ekliyorsan önce `Permission` enum'a değer ekle, sonra `ROLE_PERMISSIONS`'a ekle
- Servis metodlarında sahiplik kontrolü:

```python
@staticmethod
def _assert_can_modify(resource, user) -> None:
    role = (user.role or "").upper()
    if role == "ADMIN":
        return
    if role == "OPERATOR":
        if resource.created_by != user.id:
            raise AuthorizationError("Yalnızca kendi oluşturduğunuz kaydı değiştirebilirsiniz")
        return
    raise AuthorizationError("Bu işlem için yetersiz rol")
```

Roller: `ADMIN > OPERATOR > VIEWER > STATION > KIOSK`

### 3.4 Rate Limiting
Tüm auth endpointlerine `@limiter.limit()` ekle:

```python
from app.rate_limit import limiter
from fastapi import Request

@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, ...):
    ...
```

### 3.5 JWT
- `sub` claim her zaman `str(user.id)` olmalı (JWT standardı: string)
- Refresh endpoint: `POST /auth/refresh`

### 3.6 Şema Kuralları
- Request şemaları: `Create`, `Update`, `ListQuery` soneki
- Response şemaları: `Response`, `ListResponse` soneki
- `Optional` alanlar için her zaman default değer ver

---

## 4. Frontend Kuralları

### 4.1 Tip Sistemi
- **Tüm tipler** `src/types/index.ts`'de tanımlanır
- Bileşen-spesifik küçük tipler bileşenin yanında olabilir, ama `User`, `Order` gibi domain tipleri merkezi
- Backend yanıtını frontend tipine **her zaman map et**:

```typescript
// DOĞRU — backend snake_case → frontend camelCase
const user: User = {
  id: String(data.user.id),
  username: data.user.username,
  email: data.user.email ?? "",
  role: (data.user.role as UserRole) || "OPERATOR",
  active: data.user.is_active ?? true,
  createdAt: data.user.created_at ?? new Date().toISOString(),
};

// YANLIŞ — direk ata
login(data.token, data.user as User);
```

### 4.2 State Yönetimi (Zustand)
- Auth durumu: `useAuthStore` (`src/stores/authStore.ts`)
- UI durumu: `useUIStore` (`src/stores/uiStore.ts`)
- Store testlerinde `useXStore.setState({...})` ile sıfırla

### 4.3 React Hooks Kuralları — KRİTİK
- Hook'ları koşul/döngü içinde çağırma (ESLint `rules-of-hooks: error`)
- `useEffect` bağımlılıklarını eksiksiz yaz (`exhaustive-deps: warn`)
- Conditional rendering için `AuthenticatedApp` / `UnauthenticatedApp` pattern kullan:

```tsx
// DOĞRU — hook'ları bölme
function AuthenticatedApp() {
  const data = useProtectedHook();  // her zaman çağrılır
  return <Dashboard />;
}

function App() {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <AuthenticatedApp /> : <LoginPage />;
}
```

### 4.4 Polling / Async Data
Periyodik veri çekimi için **exponential backoff** pattern:

```typescript
const REFRESH_MS   = 45_000;
const MIN_RETRY_MS =  5_000;
const MAX_RETRY_MS = 120_000;

const retryDelayRef = useRef(REFRESH_MS);
const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
const isMountedRef  = useRef(true);

// Hata varsa gecikmeyi ikiye katla (max 120s), başarıda sıfırla
if (anyFailed) {
  retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_MS);
} else {
  retryDelayRef.current = REFRESH_MS;
}
if (isMountedRef.current) {
  timerRef.current = setTimeout(() => void loadData(), retryDelayRef.current);
}

// Cleanup
useEffect(() => {
  isMountedRef.current = true;
  return () => {
    isMountedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
  };
}, [loadData]);
```

### 4.5 Bileşen Kuralları
- `src/components/Shared/` → küçük, tekrar kullanılabilir atomlar (Button, Badge, Modal, …)
- `src/features/<Domain>/` → bir domain'e ait tüm bileşen + hook + servis
- Bileşenlerden veri çekme mantığını custom hook'lara taşı (`useXData` pattern)
- Prop olarak geçilen `title` her zaman `ButtonProps`'a eklenmiş; yeni HTML attr ekliyorsan arayüze de ekle

### 4.6 Format Yardımcıları
Mevcut yardımcıları tekrar yazma, import et:

```typescript
import { toHumanCount, toPercent } from "../hooks/useAIOpsData";
// toHumanCount(1234) → "1.234" (tr-TR)
// toPercent(85.6)    → "86%"
```

---

## 5. Test Kuralları

### 5.1 Frontend (vitest)
- Config: `frontend/vitest.config.ts`
- Setup: `frontend/src/test/setup.ts` (`@testing-library/jest-dom`)
- Test dosyaları: `src/**/__tests__/*.test.ts(x)` veya `src/**/*.test.ts(x)`
- Çalıştır: `npm test` (tek seferlik) / `npm run test:watch` (geliştirme)
- Saf fonksiyonları önce test et; store testlerinde `beforeEach` ile state sıfırla

### 5.2 Backend (pytest)
- Testler: `backend/tests/`
- Çalıştır: `pytest tests/ -v`
- Yeni permission ekleyince `test_permissions.py`'yi güncelle
- Rol hiyerarşi invariantlarını koru: OPERATOR ⊆ ADMIN, VIEWER ⊆ OPERATOR

### 5.3 Kapsam Hedefleri
- Saf yardımcı fonksiyonlar: **%100**
- Store'lar: **%100**
- Servis katmanı (BE): kritik iş kuralları
- Entegrasyon testleri: yeni endpoint eklenince

---

## 6. ESLint / Kalite

- Config: `frontend/eslint.config.js` (ESLint v10 flat config — CJS format)
- `npm run lint` → genel lint
- `npm run lint:hooks` → hook kuralı ihlali sıfır tolerans
- `@typescript-eslint/no-explicit-any: warn` — `any` kullanmadan önce gerçek tip yaz
- CI'da hooks kontrolü bloklayıcı (max-warnings 0)

---

## 7. Genel Kurallar

### 7.1 Yeni Özellik Eklerken Kontrol Listesi
1. ☐ Backend: `Permission` enum + `ROLE_PERMISSIONS` güncellendi mi?
2. ☐ Backend: `_assert_can_modify` veya `check_permission` eklendi mi?
3. ☐ Backend: `AppError` alt sınıfı kullanılıyor mu (ham HTTPException yok)?
4. ☐ Frontend: Backend yanıtı `types/index.ts` tipine map edildi mi?
5. ☐ Frontend: Yeni hook `rules-of-hooks`'u ihlal ediyor mu?
6. ☐ Test: Saf fonksiyon veya store değişti → test güncellendi mi?

### 7.2 Yapma Listesi
- `any` tipini sessizce kullanma — `unknown` veya gerçek tip yaz
- `setInterval` kullanma — exponential backoff setTimeout kullan
- Auth/permission mantığını router'a koyma — servis katmanında kalmalı
- `_assert_can_modify` bypass etme — her write endpoint kontrolünü almalı
- Yeni role ekleyince sadece `permissions.py` yetmez — `types/index.ts`'deki `UserRole` union'ı da güncelle

### 7.3 İletişim Dili
- Bu projede **Türkçe** iletişim kurulur
- Kod yorumları Türkçe yazılabilir; teknik terimler (route, endpoint, schema) İngilizce kalabilir

---

## 8. Dosya Değiştirme Öncelikleri

Bir özellik eklenirken sırayla etkilenen dosyalar:

```
Yeni API endpoint:
  backend/app/permissions.py     ← permission ekle
  backend/app/schemas.py         ← request/response şema
  backend/app/services/          ← iş mantığı + _assert_can_modify
  backend/app/routers/           ← HTTP binding
  backend/tests/test_*.py        ← test
  frontend/src/services/         ← API istemcisi
  frontend/src/types/index.ts    ← TypeScript tipi
  frontend/src/features/<X>/     ← bileşen + hook
  frontend/src/**/__tests__/     ← frontend test
```

---

## 9. RUN PROMPT (PROJE YURUTME V1)

Asagidaki promptu AI coding agent'e oldugu gibi ver:

```text
Rol:
Sen OptiPlan360 projesinde calisan senior yazilim ajansin. Amacin, mevcut repo yapisini bozmadan projeyi production-ready seviyeye tasimak.

Calisma Sekli:
- Dogaclama yapma.
- Once mevcut kodu ve dokumani oku, sonra uygula.
- Her isi uc adimda yurut: Analiz -> Uygulama -> Dogrulama.
- Her degisiklikte ilgili testleri calistir; calismiyorsa sebebini acik yaz.

Kaynak Onceligi (celiski olursa bu sirayi uygula):
1) AGENT_ONEFILE_INSTRUCTIONS.md
2) docs/RESMI_KARAR_DOKUMANI_V1.md
3) docs/API_CONTRACT.md + docs/STATE_MACHINE.md
4) OPTIPLAN360_MASTER_HANDOFF.md
5) CLAUDE.md
6) Diger dokumanlar

Kilit Teknik Kararlar:
- Canonical orchestrator API: /jobs
- /orders/* sadece facade/uyumluluk katmani
- Canonical state machine:
  NEW -> OPTI_IMPORTED -> OPTI_RUNNING -> OPTI_DONE -> XML_READY -> DELIVERED -> DONE
  Bekleme/Hata: HOLD, FAILED
- Ikon standardi: emoji yasak, lucide-react + tek Icon wrapper
- A11Y minimum: aria-modal, ESC, focus trap, form aria baglantilari, 44x44
- Veri katmani: Production PostgreSQL, local/test SQLite
- Mikro entegrasyon fazlari: P1 read-only zorunlu, P2 kontrollu write-back

Uygulama Kurallari:
- Router sadece HTTP in/out yapar, is mantigi service katmaninda kalir.
- Yetki ve sahiplik kontrollerini atlama.
- Hata yonetiminde merkezi AppError hiyerarsisi disina cikma.
- Type map zorunlu: backend response -> frontend type mapping yap.
- Atomic file write kurali uygula (.tmp -> rename).

Teslim Formati (her gorev sonunda):
1) Yapilanlar (kisa)
2) Degisen dosyalar
3) Test/Dogrulama sonucu
4) Acik riskler
5) Sonraki en iyi adim

Cikis Kriteri:
- Istenen gorev tam biter.
- Dokuman ve kod birbiriyle celismez.
- En az bir dogrulama kaniti (test, komut cikti ozeti veya dosya referansi) verilir.
```

Kullanim Notu:
- Bu prompt, `OPTIPLAN360_TAM_PAKET_SATIS_OPTIPLANNING_MIKRO.md` icindeki faz bazli TODO listesi ile birlikte kullanilmalidir.
- Sprint bazli ilerlemede once P0, sonra P1, en son P2 maddelerini tamamla.
