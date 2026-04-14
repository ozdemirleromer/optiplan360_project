# Phase 4 UI/UX Kontrat Matrisi

## 1) Kapsam
- [DOKUMAN] Bu matris, `ExportXmlFirePage` ekraninin Phase 4 operasyon davranislarini testlenebilir kontrata cevirir.
- [API] Kanonik endpoint ailesi: `phase4Service` (`getPhase4Queue`, `getPhase4RecordDetail`, `createPhase4Preview`, `exportPhase4Record`, `retryPhase4Record`).
- [VARSAYIM] Bu matris, mevcut kodda tanimli durum adlarini esas alir (`PHASE4_PENDING`, `PHASE4_PREVIEW_READY`, `PHASE4_EXPORT_FAILED`, `PHASE4_RETRY_PENDING`, `COMPLETED`).

## 2) Durum -> Aksiyon Kurali
| Durum | Onizleme | Export | Retry | Beklenen UI |
|---|---|---|---|---|
| `PHASE4_PENDING` | Acik | Kapali | Kapali | Preview CTA aktif, export/retry sebep metinli disabled |
| `PHASE4_PREVIEW_READY` | Kapali | Acik | Kapali | Export CTA aktif |
| `PHASE4_EXPORT_FAILED` | Kapali | Kapali | Acik | Retry paneli aktif, son hata gorunur |
| `PHASE4_RETRY_PENDING` | Kapali | Acik | Kapali | Export tekrar tetiklenebilir |
| `COMPLETED` | Kapali | Kapali | Kapali | Manifest/output ozetleri aktif, aksiyonlar kapanir |

## 3) Hard-Blocker Benzeri Kilitler
- [API] `phase4Ready=false` ise preview/export aksiyonlari acilmamalidir.
- [API] Status tabanli kapali aksiyonlar `title`/tooltip ile neden belirtmelidir.
- [EKLENMESI-GEREKLI] QA checklist'te disabled neden metinleri zorunlu kontrol kalemi olmalidir.

## 4) Cekirdek Test Senaryolari
- [API] Preview butonu `PHASE4_PENDING` durumunda `createPhase4Preview(recordId)` cagirir.
- [API] Export butonu `PHASE4_PREVIEW_READY` durumunda `exportPhase4Record(recordId)` cagirir.
- [API] Retry butonu `PHASE4_EXPORT_FAILED` durumunda `retryPhase4Record(recordId)` cagirir.
- [API] `phase4Ready=false` iken Export disabled + sebep metni gorunur.

## 5) Gozlenebilir UI Kanitlari
- [DOKUMAN] Kuyruk tablosunda durum, retry, son hata, fire alanlari tek bakista gorunur.
- [DOKUMAN] Drawer katmani (`export` / `manifest` / `mapping`) operasyon kararini tek yuzeyde tutar.
- [API] Aksiyon sonucu paneli `ok/message/status/manifestId/outputFileName` alanlarini gosterir.

## 6) Acik Riskler
- [VARSAYIM] Durum adlari backend tarafinda degisirse test fixture'lari kirilabilir.
- [EKLENMESI-GEREKLI] Phase 4 hata kodu (`errorCode`) bazli kullanici metni standardizasyonu netlestirilmeli.
