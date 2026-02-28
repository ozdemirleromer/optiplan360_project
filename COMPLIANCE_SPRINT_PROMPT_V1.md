# OPTIPLAN360 COMPLIANCE SPRINT — AI EXECUTION PROMPT v1.0

**Tarih:** 2026-02-28  
**Durum:** PRODUCTION BASELINE → AGENT_ONEFILE FULL COMPLIANCE  
**Hedef:** 4 sprint (8 hafta) ile dokümantasyona %100 uyum + production-ready

---

## ROL

Sen OptiPlan360 projesinde **compliance engineer + senior full-stack developer** rolündesin.

Görevin: Mevcut çalışan sistemi **AGENT_ONEFILE_INSTRUCTIONS.md** ve **docs/** standardlarına %100 uyumlu hale getirmek.

**Kurallar:**
- Doğaçlama yok, yorum ekleme yok.
- Kod değişimi dokümana referansla yapılır.
- Her değişiklik test ile doğrulanır.
- Commit message formatı: `compliance(sprint-N): [scope] açıklama`
- Breaking change yapmadan önce sor.

---

## KAYNAK ÖNCELİĞİ (Çelişki durumunda bu sıra uygulanır)

1. **AGENT_ONEFILE_INSTRUCTIONS.md** (§G2, §3, §THICKNESS POLICY) — LOCKED
2. **docs/RESMI_KARAR_DOKUMANI_V1.md** — resmi kararlar
3. **docs/API_CONTRACT.md** + **docs/STATE_MACHINE.md** — teknik davranış
4. **OPTIPLAN360_MASTER_HANDOFF.md** — iş kuralları
5. **CLAUDE.md** — kodlama standartları
6. **OPTIPLAN360_TAM_PAKET_SATIS_OPTIPLANNING_MIKRO.md** — faz bazlı TODO

---

## MEVCUT DURUM (BASELINE)

### ✅ Çalışan Bileşenler
- Backend FastAPI (port 8000) + PostgreSQL (Docker)
- `/api/v1/orchestrator/jobs` endpoint'leri (POST, GET, retry, approve)
- OptiJob model + OptiAuditEvent
- OrchestratorService: CRM gate, plaka ebatı kontrolü, arkalık validasyonu
- OptiPlanningService: Excel_sablon.xlsx template, tag validation
- Quality framework: pre-commit hooks, GitHub Actions (Black, Flake8, MyPy)
- Frontend: React 18 + TypeScript + lucide-react (kısmi)

### ❌ Kritik Gap'ler (AGENT_ONEFILE uyumsuzluğu)

**GAP-1: State Machine Uyumsuzluğu**
```
AGENT_ONEFILE §G2:
  NEW → PREPARED → OPTI_IMPORTED → OPTI_RUNNING → OPTI_DONE → XML_READY → DELIVERED → DONE

Mevcut Enum:
  NEW → OPTI_IMPORTED → ... (PREPARED YOK)

Mevcut Flow:
  orchestrator_service.py:275 → direkt NEW → OPTI_IMPORTED
```

**GAP-2: Icon Standardı**
```
AGENT_ONEFILE §F: Lucide-react + tek Icon wrapper zorunlu
Mevcut: lucide-react import'ları var ama wrapper standardı yok
```

**GAP-3: A11Y Eksikleri**
```
AGENT_ONEFILE §E: aria-modal, ESC, focus trap, 44×44 zorunlu
Mevcut: Bazı modallarda var, standart pattern yok
```

**GAP-4: Orchestrator Port Uyumsuzluğu**
```
AGENT_ONEFILE: Port 8090 orchestrator API
Mevcut: Port 8000 (backend içinde)
```

---

## SPRINT PLANI (4×2 hafta = 8 hafta)

### SPRINT 1: STATE MACHINE COMPLIANCE (P0 — 2 hafta)

**Hedef:** AGENT_ONEFILE §G2 state machine'i tam uygula.

#### TASK 1.1: PREPARED State Ekleme
**Dosyalar:**
- `backend/app/models/enums.py`
- `backend/app/services/orchestrator_service.py`
- `backend/app/schemas.py`

**Değişiklikler:**
```python
# enums.py:125
class OptiJobStateEnum(str, enum.Enum):
    NEW = "NEW"
    PREPARED = "PREPARED"  # ← EKLE
    OPTI_IMPORTED = "OPTI_IMPORTED"
    OPTI_RUNNING = "OPTI_RUNNING"
    OPTI_DONE = "OPTI_DONE"
    XML_READY = "XML_READY"
    DELIVERED = "DELIVERED"
    DONE = "DONE"
    HOLD = "HOLD"
    FAILED = "FAILED"
```

```python
# orchestrator_service.py:_process_job_locally içinde (line ~200)
# Mevcut: job.state = OptiJobStateEnum.OPTI_IMPORTED (line ~275)
# Değişiklik:

# -- 3) Dönüşüm adımı (AGENT_ONEFILE §G4) --
# cm→mm, trim mapping, edge mapping, grain mapping
transformed_parts = self._transform_parts(parts, order)

job.state = OptiJobStateEnum.PREPARED  # ← YENİ STATE
_add_audit(self.db, job.id, "STATE_PREPARED", 
    "Parça dönüşüm kuralları uygulandı (cm→mm, trim, edge, grain)")
self.db.commit()

# -- 4) XLSX generation --
opti_svc = OptiPlanningService()
xlsx_files = opti_svc.export_to_xlsx(order, transformed_parts)

job.state = OptiJobStateEnum.OPTI_IMPORTED
_add_audit(self.db, job.id, "STATE_OPTI_IMPORTED", 
    f"XLSX dosyaları OptiPlanning import klasörüne alındı: {len(xlsx_files)} adet")
self.db.commit()
```

**Yeni Metod:**
```python
def _transform_parts(self, parts: list[OrderPart], order: Order) -> list[dict]:
    """AGENT_ONEFILE §G4: cm→mm, trim, edge, grain mapping."""
    transformed = []
    for part in parts:
        part_group = (getattr(part, "part_group", "") or "GOVDE").upper()
        
        # cm → mm
        boy_mm = float(getattr(part, "boy_mm", 0) or getattr(part, "boy", 0)) * 10
        en_mm = float(getattr(part, "en_mm", 0) or getattr(part, "en", 0)) * 10
        
        # Trim mapping
        thickness = float(order.thickness_mm or 18) if part_group == "GOVDE" else 8
        thickness_key = str(int(thickness))
        trim = TRIM_BY_THICKNESS.get(thickness_key, 10.0)
        
        # Edge mapping (arkalıkta NULL)
        if part_group == "ARKALIK":
            edges = {"u1": None, "u2": None, "k1": None, "k2": None}
        else:
            edges = {
                "u1": _map_edge(getattr(part, "u1", False)),
                "u2": _map_edge(getattr(part, "u2", False)),
                "k1": _map_edge(getattr(part, "k1", False)),
                "k2": _map_edge(getattr(part, "k2", False)),
            }
        
        # Grain mapping
        grain_code = getattr(part, "grain_code", "0-Material")
        grain = _map_grain(grain_code)
        
        transformed.append({
            "boy_mm": boy_mm,
            "en_mm": en_mm,
            "adet": getattr(part, "adet", 1),
            "trim": trim,
            "grain": grain,
            **edges,
            "part_desc": getattr(part, "part_desc", ""),
            "drill_code_1": getattr(part, "drill_code_1", None),
            "drill_code_2": getattr(part, "drill_code_2", None),
        })
    
    return transformed
```

#### TASK 1.2: Alembic Migration

```bash
# Backend klasöründe:
cd c:\PROJE\optiplan360_project\backend

# Migration oluştur
alembic revision --autogenerate -m "add_prepared_state_to_opti_jobs"

# Preview
alembic upgrade head --sql

# Uygula
alembic upgrade head

# Doğrula
docker compose exec db psql -U user -d appdb -c "\d opti_jobs"
```

#### TASK 1.3: Test Suite

**Test dosyası:** `backend/tests/test_orchestrator_compliance.py`

```python
import pytest
from app.models.enums import OptiJobStateEnum
from app.services.orchestrator_service import OrchestratorService

def test_state_machine_prepared_transition(db_session):
    """PREPARED state geçişi doğru çalışmalı."""
    svc = OrchestratorService(db_session)
    
    # Job oluştur
    job = svc.create_job(
        order_id=1,
        customer_phone="5551234567",
        parts=[{"boy_mm": 100, "en_mm": 50, "adet": 1}],
    )
    
    # İlk state NEW olmalı
    assert job.state == OptiJobStateEnum.NEW
    
    # Process sonrası PREPARED olmalı
    svc._process_job_locally(job, mock_order)
    db_session.refresh(job)
    assert job.state == OptiJobStateEnum.PREPARED
    
    # Audit event oluşmalı
    events = db_session.query(OptiAuditEvent).filter(
        OptiAuditEvent.job_id == job.id,
        OptiAuditEvent.event_type == "STATE_PREPARED"
    ).all()
    assert len(events) == 1

def test_transform_parts_cm_to_mm(db_session):
    """cm → mm dönüşümü 10x olmalı."""
    svc = OrchestratorService(db_session)
    
    parts = [
        MockPart(boy=100, en=50),  # cm
    ]
    transformed = svc._transform_parts(parts, mock_order)
    
    assert transformed[0]["boy_mm"] == 1000  # 100cm * 10
    assert transformed[0]["en_mm"] == 500    # 50cm * 10

def test_arkalik_edges_null(db_session):
    """Arkalıkta bant NULL olmalı (AGENT_ONEFILE §0.4)."""
    svc = OrchestratorService(db_session)
    
    parts = [
        MockPart(part_group="ARKALIK", u1=True, k1=True),
    ]
    transformed = svc._transform_parts(parts, mock_order)
    
    assert transformed[0]["u1"] is None
    assert transformed[0]["u2"] is None
    assert transformed[0]["k1"] is None
    assert transformed[0]["k2"] is None
```

#### TASK 1.4: Validation

```bash
# Test çalıştır
cd backend
pytest tests/test_orchestrator_compliance.py -v

# Backend restart
docker compose restart backend

# Logs kontrol
docker compose logs --tail 100 backend | Select-String "STATE_PREPARED"

# Manuel smoke test
curl -X POST http://localhost:8000/api/v1/orchestrator/jobs \
  -H "Content-Type: application/json" \
  -d '{"order_id": 1, "customer_phone": "5551234567", "parts": [...]}'

# State'i kontrol
curl http://localhost:8000/api/v1/orchestrator/jobs/{job_id}
```

**Acceptance Criteria (Sprint 1):**
- [ ] C1: OptiJobStateEnum PREPARED değeri mevcut
- [ ] C2: NEW → PREPARED → OPTI_IMPORTED geçişi dokümanda
- [ ] C3: _transform_parts metodu cm→mm, trim, edge, grain doğru uygular
- [ ] C4: Arkalıkta bant NULL (test ile doğrulandı)
- [ ] C5: Audit event STATE_PREPARED kaydediliyor
- [ ] C6: Backend restart sonrası yeni job'lar PREPARED'dan geçiyor

---

### SPRINT 2: ICON & A11Y COMPLIANCE (P0 — 2 hafta)

**Hedef:** AGENT_ONEFILE §F (Icon) ve §E (A11Y) tam uyum.

#### TASK 2.1: Icon Wrapper Standardı

**Dosya:** `frontend/src/components/Shared/Icon.tsx`

```tsx
import React from 'react';
import { LucideIcon, LucideProps } from 'lucide-react';

interface IconProps extends Omit<LucideProps, 'ref'> {
  icon: LucideIcon;
  'aria-label': string;  // ← ZORUNLU (AGENT_ONEFILE §F)
  size?: number;
}

/**
 * AGENT_ONEFILE §F: Tek Icon wrapper bileşeni (lucide-react).
 * Emoji icon kullanımı yasak.
 */
export const Icon: React.FC<IconProps> = ({ 
  icon: IconComponent, 
  'aria-label': ariaLabel,
  size = 20,
  ...rest 
}) => {
  return (
    <IconComponent 
      size={size} 
      aria-label={ariaLabel}
      role="img"
      {...rest} 
    />
  );
};
```

**Kullanım Örneği:**
```tsx
// ❌ ÖNCE (doğrudan import)
import { X, Save, Edit } from 'lucide-react';
<X onClick={onClose} />

// ✅ SONRA (Icon wrapper)
import { Icon } from '@/components/Shared/Icon';
import { X, Save, Edit } from 'lucide-react';
<Icon icon={X} aria-label="Kapat" onClick={onClose} />
<Icon icon={Save} aria-label="Kaydet" />
<Icon icon={Edit} aria-label="Düzenle" />
```

**Değiştirilecek Dosyalar:** (grep sonucu ~20 dosya)
```bash
# Önce Icon wrapper'ı oluştur
# Sonra tüm lucide-react import'larını güncelle
frontend/src/features/*/
frontend/src/components/*/
frontend/src/utils/*/
```

#### TASK 2.2: A11Y Modal Standardı

**Dosya:** `frontend/src/components/Shared/Modal.tsx`

```tsx
import React, { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * AGENT_ONEFILE §E: A11Y compliant modal.
 * - aria-modal="true"
 * - ESC ile kapanma
 * - Focus trap
 * - Focus restore
 */
export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  size = 'md',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap + restore
  useEffect(() => {
    if (isOpen) {
      // Önceki focus'u kaydet
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      // İlk focusable element'e focus
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();

      // ESC handler
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);

      // Focus trap
      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;
        const focusables = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };
      document.addEventListener('keydown', handleTab);

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('keydown', handleTab);
        // Focus restore
        previousFocusRef.current?.focus();
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative bg-white rounded-lg shadow-xl ${sizeClasses[size]}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="modal-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center"  // ← 44×44
            aria-label="Kapat"
          >
            <Icon icon={X} aria-label="Kapat" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

const sizeClasses = {
  sm: 'w-96',
  md: 'w-[512px]',
  lg: 'w-[768px]',
  xl: 'w-[1024px]',
};
```

#### TASK 2.3: Form A11Y Standardı

```tsx
// frontend/src/components/Shared/FormField.tsx
interface FormFieldProps {
  label: string;
  id: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ 
  label, 
  id, 
  error, 
  required, 
  children 
}) => {
  const errorId = error ? `${id}-error` : undefined;
  
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {React.cloneElement(children as React.ReactElement, {
        id,
        'aria-invalid': !!error,
        'aria-describedby': errorId,
        'aria-required': required,
      })}
      
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
```

#### TASK 2.4: Validation

```bash
# Frontend test
cd frontend
npm run lint
npm run test -- --run

# A11Y audit (axe-core)
npm run test:a11y

# Manuel test
# 1. Modal aç → ESC'ye bas → kapanmalı
# 2. Modal açıkken TAB → focus döngüsü modal içinde
# 3. Modal kapandığında focus önceki element'e dönmeli
# 4. Form input hatalı → aria-invalid="true" ve aria-describedby set olmalı
# 5. Touch target tüm butonlarda 44×44 minimum
```

**Acceptance Criteria (Sprint 2):**
- [ ] C1: Icon.tsx wrapper tüm icon kullanımlarında kullanılıyor
- [ ] C2: Hiçbir emoji icon kalmadı (grep "🔍|📊|✅" src/ sonuç: 0)
- [ ] C3: Tüm modaller aria-modal="true" + ESC + focus trap
- [ ] C4: Tüm form inputları htmlFor + aria-describedby + aria-invalid
- [ ] C5: Touch target 44×44 minimum (mobil test)
- [ ] C6: axe-core A11Y testi 0 kritik hata

---

### SPRINT 3: ORCHESTRATOR RELIABILITY (P1 — 2 hafta)

**Hedef:** Tek OPTI_RUNNING kilidi, timeout alarmları, Mode C runbook.

#### TASK 3.1: Tek OPTI_RUNNING Constraint

**DB Constraint:**
```sql
-- PostgreSQL EXCLUDE constraint (sadece 1 OPTI_RUNNING)
ALTER TABLE opti_jobs 
ADD CONSTRAINT single_opti_running 
EXCLUDE USING gist (
  int4range(1, 1) WITH =
) WHERE (state = 'OPTI_RUNNING');
```

**Uygulama Seviyesi Guard:**
```python
# orchestrator_service.py
def _ensure_single_opti_running(self) -> None:
    """AGENT_ONEFILE §G2: Tek OPTI_RUNNING kontrolü."""
    running = self.db.query(OptiJob).filter(
        OptiJob.state == OptiJobStateEnum.OPTI_RUNNING
    ).count()
    
    if running > 0:
        raise ConflictError(
            "Başka bir iş OptiPlanning'de çalışıyor. "
            "Aynı anda yalnız 1 OPTI_RUNNING job olabilir (AGENT_ONEFILE §G2)"
        )
```

#### TASK 3.2: Timeout Monitor

**Dosya:** `backend/app/tasks/job_monitor.py`

```python
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import OptiJob, OptiJobStateEnum
from ..database import SessionLocal
from ..integrations.slack_service import send_slack_alert  # opsiyonel

logger = logging.getLogger(__name__)

# AGENT_ONEFILE §7: timeout kuralları
OPTI_XML_TIMEOUT = timedelta(minutes=20)
OSI_ACK_TIMEOUT = timedelta(minutes=5)

async def check_job_timeouts():
    """
    OPTI_RUNNING > 20 dk → alarm
    DELIVERED bekleme > 5 dk → alarm
    """
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # OPTI_RUNNING timeout
        stuck_running = db.query(OptiJob).filter(
            OptiJob.state == OptiJobStateEnum.OPTI_RUNNING,
            func.now() - OptiJob.updated_at > OPTI_XML_TIMEOUT
        ).all()
        
        for job in stuck_running:
            logger.error(
                f"Job {job.id} timeout: OPTI_RUNNING > 20 dakika. "
                f"Order: {job.order_id}, başlangıç: {job.updated_at}"
            )
            send_slack_alert(
                f"🚨 OptiPlanning Timeout: Job {job.id} 20 dakikadır XML üretemiyor"
            )
        
        # ACK timeout (opsiyonel - DELIVERED state'i varsa)
        # ...
        
    finally:
        db.close()
```

**Cron/Scheduler:**
```python
# backend/app/main.py içinde
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from .tasks.job_monitor import check_job_timeouts

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def startup_event():
    # Her 5 dakikada bir timeout kontrolü
    scheduler.add_job(check_job_timeouts, 'interval', minutes=5)
    scheduler.start()
```

#### TASK 3.3: Mode C Runbook

**Dosya:** `docs/MODE_C_OPERATOR_RUNBOOK.md`

````markdown
# OptiPlanning Mode C — Operator El Kitabı

## Mode C Nedir?

Mode C: OptiPlanning'in operatör tarafından manuel tetiklenmesi modu.

**Ne zaman kullanılır:**
- OptiPlanning CLI/COM otomasyonu mevcut değilse
- Operator Workstation üzerinden manuel kontrol isteniyorsa

## Adım Adım Prosedür

### 1. Job Hazırlığı

Orchestrator job'u **OPTI_IMPORTED** state'ine alır:
```
Job State: NEW → PREPARED → OPTI_IMPORTED → [HOLD: E_OPERATOR_TRIGGER_REQUIRED]
```

### 2. XLSX Dosyalarını Bulma

**Klasör:** `C:\Biesse\OptiPlanning\ImpFile\`

**Dosya formatı:**
```
{CRM_ISIM}_{TIMESTAMP}_18mm_Beyaz_GOVDE.xlsx
{CRM_ISIM}_{TIMESTAMP}_5mm_Beyaz_ARKALIK.xlsx
```

**Örnek:**
```
AHMET_YILMAZ_20260228_143022_18mm_Beyaz_GOVDE.xlsx
```

### 3. OptiPlanning'de Import

1. OptiPlanning uygulamasını aç
2. **Import** menüsü → **Excel Import**
3. `.xlsx` dosyalarını seç (birden fazla seçilebilir)
4. **Import** butonuna tık
5. Doğrulama ekranında **OK**

### 4. Optimizasyon Çalıştırma

1. Import edilen job'ları listeden seç
2. **Run Optimization** butonu
3. Parametre ekranı: varsayılan değerler OK
4. Başlat → İşlem ~5-15 dakika sürer

### 5. Export Bekleme

OptiPlanning optimizasyon bitince otomatik olarak `.xml` dosyasını export eder:

**Export klasörü:** `C:\Biesse\OptiPlanning\Tmp\Sol\`

**Orchestrator otomatik devam eder:**
```
OPTI_IMPORTED → OPTI_RUNNING (operator başlattı)
              → OPTI_DONE (XML oluştu)
              → XML_READY
              → DELIVERED
              → DONE
```

### 6. Job Approve

Eğer job **HOLD: E_OPERATOR_TRIGGER_REQUIRED** durumundaysa:

**API:**
```bash
POST /api/v1/orchestrator/jobs/{job_id}/approve
```

**UI:** Admin panel → Jobs → [Job detay] → **Approve** butonu

### 7. Sorun Giderme

**Problem:** XML dosyası oluşmadı
- Kontrol: OptiPlanning logları (`C:\Biesse\OptiPlanning\Logs\`)
- Kontrol: Excel dosyası tag'leri doğru mu?
- Aksiyon: Job'u **Retry** et

**Problem:** Timeout (20 dakika)
- Kontrol: OptiPlanning yanıt veriyor mu?
- Aksiyon: OptiPlanning'i restart et, job'u retry et

**Problem:** Yanlış XML
- Kontrol: Job audit logs (hangi XLSX import edildi?)
- Aksiyon: Job'u **Cancel** et, yeni job oluştur
````

**Acceptance Criteria (Sprint 3):**
- [ ] C1: PostgreSQL EXCLUDE constraint aktif
- [ ] C2: Uygulama seviyesi guard _ensure_single_opti_running çalışıyor
- [ ] C3: Timeout monitor her 5 dakikada çalışıyor, 20 dk timeout'u algılıyor
- [ ] C4: Slack/log alert gönderiliyor
- [ ] C5: MODE_C_OPERATOR_RUNBOOK.md eksiksiz
- [ ] C6: Operator runbook ile test edildi (dry-run)

---

### SPRINT 4: MIKRO P1 + SPEC-FIRST SEARCH (P1 — 2 hafta)

**Hedef:** Mikro read-only entegrasyon + SpecFirst ürün arama.

#### TASK 4.1: Mikro Health Detaylı

```python
# backend/app/routers/mikro_router.py
@router.get("/health/detailed")
def mikro_health_detailed(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.ADMIN))
):
    """Mikro entegrasyon detaylı sağlık kontrolü."""
    mikro_svc = MikroService(db)
    
    return {
        "connection": mikro_svc.test_connection(),
        "cari_count": mikro_svc.count_cari_records(),
        "stok_count": mikro_svc.count_stok_records(),
        "last_sync_at": mikro_svc.get_last_sync_time(),
        "read_only_mode": True,  # LOCKED
        "tables_accessible": [
            "CARI_HESAPLAR",
            "STOK_KARTI",
            # ...
        ],
    }
```

#### TASK 4.2: Material Suggest Endpoint

```python
# backend/app/routers/product_router.py
@router.get("/products/search")
def search_products(
    q: str = Query(..., description="Arama terimi (ör: BEYAZ 18)"),
    width_cm: float | None = None,
    height_cm: float | None = None,
    mikro_enrich: bool = Query(False, description="Mikro stok verisiyle zenginleştir"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    OPTIPLAN360_TAM_PAKET §6.1: Spec-first ürün arama.
    
    Akış:
    1. MaterialSpec tablosunda ara (color, thickness)
    2. SupplierItem varyantlarını getir
    3. Opsiyonel: Mikro stok API'den zenginleştir
    4. Match status döndür (MATCHED/AMBIGUOUS/NO_MATCH)
    """
    # Parse query
    tokens = q.upper().split()
    color_keywords = {"BEYAZ", "SİYAH", "GRİ", "KIRMIZI"}  # ...
    thickness_keywords = {"18", "5", "8", "4", "3"}
    
    color = next((t for t in tokens if t in color_keywords), None)
    thickness = next((int(t) for t in tokens if t in thickness_keywords), None)
    
    if not color or not thickness:
        raise ValidationError("Renk ve kalınlık belirtilmeli (ör: BEYAZ 18)")
    
    # MaterialSpec ara
    specs = db.query(MaterialSpec).filter(
        MaterialSpec.color_id == get_color_id(color),
        MaterialSpec.thickness_mm == thickness,
    )
    
    if width_cm and height_cm:
        specs = specs.filter(
            MaterialSpec.width_cm == width_cm,
            MaterialSpec.height_cm == height_cm,
        )
    
    specs = specs.all()
    
    # SupplierItem varyantları
    for spec in specs:
        spec.suppliers = db.query(SupplierItem).filter(
            SupplierItem.spec_id == spec.id,
            SupplierItem.is_active == True,
        ).order_by(SupplierItem.priority.desc()).all()
    
    # Mikro enrichment
    mikro_data = {}
    if mikro_enrich:
        mikro_svc = MikroService(db)
        mikro_data = mikro_svc.enrich_material_specs(specs)
    
    # Match status
    status = determine_match_status(specs)
    
    return {
        "specs": [serialize_spec(s) for s in specs],
        "match_status": status,  # MATCHED / AMBIGUOUS / NO_MATCH
        "mikro": mikro_data,
    }

def determine_match_status(specs: list[MaterialSpec]) -> str:
    """OPTIPLAN360_TAM_PAKET §6.2: deterministik karar ağacı."""
    if len(specs) == 0:
        return "NO_MATCH"
    elif len(specs) == 1:
        return "MATCHED"
    else:
        return "AMBIGUOUS"
```

#### TASK 4.3: Test

```python
# backend/tests/test_product_search.py
def test_spec_first_search_matched(db_session):
    """Tek sonuç → MATCHED."""
    # Setup: 1 MaterialSpec ekle
    spec = MaterialSpec(color="BEYAZ", thickness_mm=18, width_cm=210, height_cm=280)
    db_session.add(spec)
    db_session.commit()
    
    response = client.get("/api/v1/products/search?q=BEYAZ 18&width_cm=210&height_cm=280")
    assert response.status_code == 200
    data = response.json()
    assert data["match_status"] == "MATCHED"
    assert len(data["specs"]) == 1

def test_spec_first_search_ambiguous(db_session):
    """Çoklu sonuç → AMBIGUOUS (firma seçimi gerekli)."""
    # Setup: 2 SupplierItem (KAST, KRONOSPAN)
    spec = MaterialSpec(...)
    item1 = SupplierItem(spec_id=spec.id, brand_id=1)
    item2 = SupplierItem(spec_id=spec.id, brand_id=2)
    db_session.add_all([spec, item1, item2])
    db_session.commit()
    
    response = client.get("/api/v1/products/search?q=BEYAZ 18")
    data = response.json()
    assert data["match_status"] == "AMBIGUOUS"
```

**Acceptance Criteria (Sprint 4):**
- [ ] C1: `/mikro/health/detailed` endpoint çalışıyor
- [ ] C2: Mikro bağlantı test ediliyor, tabloları sayıyor
- [ ] C3: `/products/search` endpoint spec-first mantık doğru
- [ ] C4: MATCHED/AMBIGUOUS/NO_MATCH logic test ile doğrulandı
- [ ] C5: Mikro enrichment opsiyonel olarak çalışıyor
- [ ] C6: Frontend'de arama UI spec-first akışı kullanıyor

---

## GLOBAL VALIDATION (Tüm Sprintler Sonrası)

### Doküman Uyum Checklist

```bash
# 1. State Machine Doğrulama
grep -r "OptiJobStateEnum" backend/app/
# PREPARED olmalı

# 2. Icon Standardı Doğrulama
grep -r "from 'lucide-react'" frontend/src/ | wc -l
# Tümü Icon wrapper kullanmalı

# 3. A11Y Doğrulama
grep -r "aria-modal" frontend/src/ | wc -l
# Tüm modallerde olmalı

# 4. Emoji Temizlik Doğrulama
grep -rE "🔍|📊|✅|❌|⚠️" frontend/src/
# Sonuç: 0 (hiç emoji yok)

# 5. Orchestrator Endpoint Kontrolü
curl http://localhost:8000/api/v1/orchestrator/jobs
# 200 OK

# 6. AGENT_ONEFILE Referans Kontrolü
grep -r "AGENT_ONEFILE" backend/app/
# En az 5 dosyada referans olmalı
```

### Kabul Test Senaryoları

**Scenario 1: Happy Path (NEW → DONE)**
```bash
# 1. Job oluştur
POST /orchestrator/jobs
  → state: NEW

# 2. Otomatik geçiş
  → PREPARED (dönüşüm kuralları)
  → OPTI_IMPORTED (XLSX)
  → OPTI_RUNNING (Mode C operator tetikler)
  → OPTI_DONE (XML oluştu)
  → XML_READY
  → DELIVERED
  → DONE

# Doğrulama:
GET /orchestrator/jobs/{id}
assert state == "DONE"
assert audit_events include ["STATE_PREPARED", "STATE_OPTI_IMPORTED", ...]
```

**Scenario 2: CRM Gate HOLD**
```bash
# 1. Müşteri mevcut değil
POST /orchestrator/jobs (customer_phone: yeni numara)
  → state: HOLD
  → error_code: E_CRM_NO_MATCH

# 2. Müşteri oluştur
POST /customers

# 3. Approve
POST /orchestrator/jobs/{id}/approve
  → state: NEW (yeniden işleme alınır)
```

**Scenario 3: A11Y Modal Test**
```bash
# Manuel UI test:
1. Modal aç
2. ESC'ye bas → kapanmalı
3. TAB tuşu → focus modal içinde dönmeli
4. Modal kapat → focus önceki element'e dönmeli
5. Form input hata → aria-invalid="true"
6. Tüm butonlar 44×44 minimum
```

---

## KOMUT REFERANSı

### Backend

```bash
# Virtual env aktif et
cd backend
.venv\Scripts\Activate.ps1

# Migration
alembic revision --autogenerate -m "açıklama"
alembic upgrade head

# Test
pytest tests/test_orchestrator_compliance.py -v
pytest tests/ -v --cov=app --cov-report=html

# Lint
black app/
flake8 app/
mypy app/

# Backend restart
docker compose restart backend
docker compose logs --tail 100 backend
```

### Frontend

```bash
cd frontend

# Install
npm install

# Dev
npm run dev

# Test
npm run test -- --run
npm run test:watch

# Lint
npm run lint
npm run lint:fix

# Build
npm run build
```

### Database

```bash
# Connect
docker compose exec db psql -U user -d appdb

# Backup
docker compose exec db pg_dump -U user -d appdb -F c -f /tmp/appdb.backup
docker cp $(docker compose ps -q db):/tmp/appdb.backup ./appdb_$(date +%Y%m%d).backup

# Table inspection
docker compose exec db psql -U user -d appdb -c "\d opti_jobs"
docker compose exec db psql -U user -d appdb -c "\d+ opti_jobs"
```

### Git

```bash
# Commit format
git commit -m "compliance(sprint-1): add PREPARED state to OptiJobStateEnum"
git commit -m "compliance(sprint-2): implement Icon wrapper standard"
git commit -m "compliance(sprint-3): add single OPTI_RUNNING constraint"

# Push
git push origin main
```

---

## ÇıKıŞ KRİTERLERİ

Aşağıdaki tüm maddeler **✅** olmalı:

### Teknik Kriterler
- [ ] T1: OptiJobStateEnum PREPARED state'i mevcut
- [ ] T2: orchestrator_service.py NEW→PREPARED→OPTI_IMPORTED flow
- [ ] T3: _transform_parts cm→mm, trim, edge (arkalık NULL), grain
- [ ] T4: Icon.tsx wrapper tüm icon kullanımlarında
- [ ] T5: Emoji icon 0 adet (grep sonucu)
- [ ] T6: Modal.tsx aria-modal + ESC + focus trap
- [ ] T7: FormField.tsx htmlFor + aria-describedby + aria-invalid
- [ ] T8: PostgreSQL EXCLUDE constraint single_opti_running
- [ ] T9: job_monitor.py timeout kontrolü çalışıyor
- [ ] T10: MODE_C_OPERATOR_RUNBOOK.md eksiksiz
- [ ] T11: /mikro/health/detailed endpoint
- [ ] T12: /products/search spec-first endpoint

### Test Kapsamı
- [ ] T13: test_orchestrator_compliance.py %100 pass
- [ ] T14: test_product_search.py %100 pass
- [ ] T15: Frontend A11Y axe-core 0 kritik hata
- [ ] T16: Backend pytest coverage >80%

### Doküman Uyumu
- [ ] D1: AGENT_ONEFILE §G2 state machine uyumlu
- [ ] D2: AGENT_ONEFILE §F icon uyumlu
- [ ] D3: AGENT_ONEFILE §E A11Y uyumlu
- [ ] D4: docs/API_CONTRACT.md güncel
- [ ] D5: docs/STATE_MACHINE.md PREPARED eklendi

### Operasyon
- [ ] O1: Docker compose up → backend sağlıklı başlıyor
- [ ] O2: Happy path job NEW→DONE test geçti
- [ ] O3: HOLD→APPROVE→NEW flow test geçti
- [ ] O4: Mode C dry-run operator ile yapıldı
- [ ] O5: Timeout monitor alarm gönderdi (test)

---

## NOTLAR

1. **Breaking Change Yok:** Mevcut API endpoint'leri değiştirme, yalnızca state machine genişlet.
2. **Geriye Uyumluluk:** Eski job'lar PREPARED state'siz çalışmaya devam etmeli (migration sonrası default NULL).
3. **Doküman Güncelleme:** Her sprint sonunda API_CONTRACT.md ve STATE_MACHINE.md güncelle.
4. **Git Strategy:** Sprint bazlı branch (compliance/sprint-1), merge sonrası git tag (v1.1-compliance-sprint1).

---

**SON ADIM:** Bu prompt'u çalıştıracak AI agent'e veya geliştiriciye ver. Sprint 1'den başla.
