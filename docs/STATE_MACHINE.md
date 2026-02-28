# OptiPlan360 Orchestrator — State Machine Dokümantasyonu

> Bu belge orchestrator iş kuyruğundaki durum makinesini tanımlar.
> **Kaynak:** `src/domain/job.ts`, `src/services/orchestratorService.ts`, `src/db/jobRepository.ts`

---

## 1. Durum Listesi

| State | Kısa Açıklama |
|-------|---------------|
| `NEW` | İş oluşturuldu veya retry sonrası yeniden kuyruğa alındı |
| `PREPARED` | Parçalar dönüştürüldü (cm→mm, trim, edge, grain mapping) |
| `OPTI_IMPORTED` | XLSX dosyaları OptiPlanning import klasörüne bırakıldı |
| `OPTI_RUNNING` | OptiPlanning çalıştırılıyor (tek seferde yalnız 1 iş) |
| `OPTI_DONE` | XML çıktı dosyası export klasöründen yakalandı |
| `XML_READY` | XML validasyonu tamamlandı |
| `DELIVERED` | XML dosyası OSI makinesine teslim edildi ve ACK alındı |
| `DONE` | İş başarıyla tamamlandı (terminal state) |
| `HOLD` | Operatör müdahalesi gerekiyor (bekleme durumu) |
| `FAILED` | İş kalıcı olarak başarısız (terminal state) |

---

## 2. ASCII Durum Diyagramı

```
                    ┌──────────────────────────────────────────────┐
                    │              BAŞARILI AKIŞ (happy path)       │
                    │                                              │
  POST /jobs ──►  [NEW] ──►  [PREPARED] ──►  [OPTI_IMPORTED]      │
                   ▲  │                          │                 │
                   │  │                          ▼                 │
                   │  │    Mode C & not approved?                  │
                   │  │         YES ──► [HOLD] ◄─── HOLD hataları │
                   │  │         NO                     │           │
                   │  │          │                      │           │
                   │  │          ▼                      │ approve   │
                   │  │    [OPTI_RUNNING] ◄─────────────┘           │
                   │  │          │                                  │
                   │  │          ▼                                  │
                   │  │    [OPTI_DONE]                              │
                   │  │          │                                  │
                   │  │          ▼                                  │
                   │  │    [XML_READY]                              │
                   │  │          │                                  │
                   │  │          ▼                                  │
                   │  │    [DELIVERED]                              │
                   │  │          │                                  │
                   │  │          ▼                                  │
                   │  │       [DONE]  ✓                             │
                   │  │                                            │
                   │  │  ┌─────────────────────────────────────┐   │
                   │  └─►│  HATA DURUMLARINDA                 │   │
                   │     │                                     │   │
                   │     │  HOLD hatası? ──► [HOLD]            │   │
                   │     │     approve ──────────────┐         │   │
                   │     │                           ▼         │   │
                   │     │  Geçici hata? ──► [FAILED]          │   │
                   │     │     retry ────────────────┐         │   │
                   │     │                           ▼         │   │
                   │     └─────────────────────► [NEW]         │   │
                   │                                           │   │
                   └───────────────────────────────────────────┘   │
                                                                   │
                    ┌──────────────────────────────────────────────┘
                    │  KALICI HATA (permanent):
                    │  E_TEMPLATE_INVALID, E_CRM_NO_MATCH,
                    │  E_PLATE_SIZE_MISSING, E_XML_INVALID
                    │       ──► retry engellenir
                    └──────────────────────────────────────────────
```

---

## 3. Durum Geçişleri (Transitions)

### 3.1 Normal akış

```
NEW → PREPARED → OPTI_IMPORTED → OPTI_RUNNING → OPTI_DONE → XML_READY → DELIVERED → DONE
```

Her geçiş `jobRepository.setState()` ile yapılır ve `audit_events` tablosuna bir kayıt eklenir.

### 3.2 HOLD geçişleri

| Kaynak State | Hedef | Tetiklenme Koşulu |
|-------------|-------|-------------------|
| NEW (işlenirken) | HOLD | `E_CRM_NO_MATCH` — müşteri CRM'de bulunamadı |
| NEW (işlenirken) | HOLD | `E_TEMPLATE_INVALID` — şablon dosyası geçersiz |
| NEW (işlenirken) | HOLD | `E_PLATE_SIZE_MISSING` — levha boyutu tanımsız |
| NEW (işlenirken) | HOLD | `E_BACKING_THICKNESS_UNKNOWN` — arkalık kalınlığı tanımsız |
| NEW (işlenirken) | HOLD | `E_TRIM_RULE_MISSING` — trim kuralı eksik |
| OPTI_IMPORTED | HOLD | `E_OPERATOR_TRIGGER_REQUIRED` — Mode C, operatör onayı gerekli |

### 3.3 HOLD → NEW (Approve)

```
POST /jobs/:id/approve
  → state = 'NEW'
  → claim_token = NULL
  → error_code = NULL
  → error_message = NULL
  → manual_trigger_approved = 1  (sadece E_OPERATOR_TRIGGER_REQUIRED ise)
  → next_run_at = now()
```

Approve sonrası iş kuyrukta tekrar işlenmeye başlar. Mode C durumunda `manual_trigger_approved` flag'i set edilir, böylece ikinci geçişte HOLD döngüsüne girilmez.

### 3.4 FAILED geçişleri

Herhangi bir state'ten işleme sırasında yakalanan hata, `HOLD_ERROR_CODES` setinde değilse `FAILED` state'ine geçer.

```typescript
// HOLD_ERROR_CODES'da olmayan hatalar → FAILED
if (!HOLD_ERROR_CODES.has(errorCode)) {
  repository.setFailed(jobId, code, "Islem FAILED");
}
```

### 3.5 FAILED → NEW (Retry)

```
POST /jobs/:id/retry
  → retry_count += 1
  → state = 'NEW'
  → claim_token = NULL
  → next_run_at = now() + backoff
```

**Kısıtlamalar:**
- `retry_count >= retry_count_max` (3) ise → `E_RETRY_LIMIT_REACHED` fırlatılır
- Permanent error ise (`E_TEMPLATE_INVALID`, `E_CRM_NO_MATCH`, `E_PLATE_SIZE_MISSING`, `E_XML_INVALID`) → retry engellenir

---

## 4. Eşzamanlılık Kontrolü

### 4.1 Claim mekanizması

JobRunner her tick'te `claimNextJob()` çağırır:

1. `state = 'NEW'` ve `next_run_at <= now()` olan en eski iş seçilir
2. `claim_token` atomik olarak set edilir (`WHERE claim_token IS NULL`)
3. İşlem tamamlanınca `releaseClaim()` ile token temizlenir

Bu mekanizma birden fazla runner instance'ını güvenli kılar, ancak üretimde tek instance önerilir.

### 4.2 Tek OPTI_RUNNING kısıtı

```sql
CREATE UNIQUE INDEX uq_single_opti_running ON jobs(state) WHERE state = 'OPTI_RUNNING';
```

Bu partial unique index, aynı anda yalnızca bir işin `OPTI_RUNNING` state'inde olmasını garanti eder. OptiPlanning tek seferde yalnızca bir optimizasyon çalıştırabilir.

### 4.3 Payload dedup

```sql
CREATE UNIQUE INDEX uq_jobs_payload_hash ON jobs(payload_hash);
```

Aynı payload iki kez gönderildiğinde yeni iş oluşturulmaz; mevcut iş döner.

---

## 5. Retry Mantığı

### 5.1 Backoff stratejisi

`rules.json → retry_backoff_minutes: [1, 3, 9]`

| retry_count | Bekleme süresi |
|-------------|---------------|
| 0 → 1 | 1 dakika |
| 1 → 2 | 3 dakika |
| 2 → 3 | 9 dakika |
| 3+ | Retry engellenir |

### 5.2 Retry sonrası akış

```
FAILED ──(retry)──► NEW ──(claim)──► processClaimedJob() ──► normal akış veya tekrar FAILED
```

---

## 6. OptiPlanning Tetikleme Modları

| Mod | Tetikleme | HOLD durumu |
|-----|-----------|-------------|
| A (CLI) | `spawnSync(OptiPlanning.exe, importFiles)` | Hayır |
| B (Excel COM) | RunOptiPlanning.xls macro kontrolü | Hayır |
| C (Manuel) | Operatör el ile çalıştırır | Evet — `E_OPERATOR_TRIGGER_REQUIRED` |

Mode C akışı:
1. XLSX dosyaları import klasörüne bırakılır → `OPTI_IMPORTED`
2. `E_OPERATOR_TRIGGER_REQUIRED` → `HOLD`
3. Operatör OptiPlanning'i çalıştırır
4. Operatör Admin UI'dan approve yapar → `manual_trigger_approved = 1`
5. İş NEW'e döner → ikinci geçişte HOLD atlanır → `OPTI_RUNNING` → devam

---

## 7. Audit Trail

Her durum geçişi `audit_events` tablosuna `STATE_{STATE_NAME}` event tipiyle kaydedilir.

Ek event tipleri:
- `JOB_CREATED` — iş oluşturuldu
- `JOB_DEDUP` — aynı payload hash bulundu
- `JOB_RETRY_SCHEDULED` — retry planlandı
- `HOLD_APPROVED` — HOLD operatör tarafından onaylandı

Her audit kaydı:
```json
{
  "id": 42,
  "job_id": "uuid",
  "event_type": "STATE_PREPARED",
  "message": "Job donusum icin hazirlandi",
  "details_json": "{\"batch_count\":2,\"backing_edge_reset_count\":0}",
  "created_at": "2026-02-17T10:30:00.000Z"
}
```
