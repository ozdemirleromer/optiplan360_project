# Phase 2 + Phase 3 Birleşik Uyum Matrisi

## 1. Yönetici Özeti
- [DOKUMAN] Bu çıktı, `docs/governance-pack/OptiPlan360_Phase2_Implementation_Spec_v2.md` ve `docs/governance-pack/OptiPlan360_Phase3_UIUX_Spec_v2.md` gereksinimlerinin tek matriste doğrulanması için hazırlanmıştır.
- [DOKUMAN] Phase 2 tarafinda odak: 7 alanli review modeli, split-screen, blocker ve Phase 3'e kontrollu gecistir.
- [DOKUMAN] Phase 3 tarafında odak: cari/stok/fire/merge blocker yönetimi, dense grid, operasyon aksiyonları ve export kilit mantığıdır.
- [EKLENMESI-GEREKLI] Canlı kabul sürecinde bu matris QA checklist ile birebir kullanılmalıdır.

## 2. Kapsam
- [DOKUMAN] Kapsam içi: `OCRKontrolPage`, `SiparisKontrolPage`, ilgili test dosyaları.
- [DOKUMAN] Kapsam dışı: ERP ana veri yönetimi, gerçek WhatsApp gönderimi, mobil-first tasarım.

## 3. Kullanılan Referanslar
- [DOKUMAN] `docs/governance-pack/OptiPlan360_Phase2_Implementation_Spec_v2.md`
- [DOKUMAN] `docs/governance-pack/OptiPlan360_Phase3_UIUX_Spec_v2.md`
- [API] `frontend/src/services/optiplanWorkflowService.ts`
- [API] `frontend/src/features/OptiPlanWorkflow/usePhase2Gate.ts`

## 4. Kaynaklardan Çıkarılan Bulgular
- [DOKUMAN] Phase 2'de blocker mantigi canonical 7 alanli review modeli ve operator onay akisina dayanmalidir.
- [DOKUMAN] Phase 2 split-screen’de hücre seçimi ile görsel odak (bbox) bozulmadan çalışmalıdır.
- [DOKUMAN] Phase 3’te cari/stok/fire/merge kaynaklı blocker durumları export’u kilitlemelidir.
- [DOKUMAN] Phase 3 ekranı dense ERP karakterinde, hızlı operasyon odaklı olmalıdır.

## 5. Alan Matrisi
| Faz | Kural | Kod Karşılığı | Test Karşılığı | Durum |
|---|---|---|---|---|
| Phase 2 | 7 alanli confidence warning modeli | `OCRKontrolPage.tsx` | `OCRKontrolPage.test.tsx` low-confidence testleri | Tamam |
| Phase 2 | Operatör onayı ile warning temizleme | `handleApproveCell`, `handleCellEdit` | onay ve otomatik onay testleri | Tamam |
| Phase 2 | Split-screen + resizer | `leftPanelRatio`, separator handler | layout/interaction testleri dolaylı | Tamam |
| Phase 2 | Hücre focus -> bbox odak göstergesi | `selectedField`, odak metni, bbox vurgusu | “hücre focus olduğunda…” testi | Tamam |
| Phase 2 | Hatalı Görsel akışı + modal | `handleMarkError`, modal state | hatalı modal testleri | Tamam |
| Phase 2 | Phase 3 geçiş blocker | `canApprove`, CTA disabled | geçiş butonu testleri | Tamam |
| Phase 3 | Cari blocker | `calcBlocker` | Senaryo B testleri | Tamam |
| Phase 3 | Stok blocker | `calcBlocker` + row state | Senaryo A / stok eşleşme testleri | Tamam |
| Phase 3 | Fire blocker | `calcFireMissing` + tooltip reason | Senaryo E tooltip testi | Tamam |
| Phase 3 | Kritik merge blocker | `calcCriticalMergeGroupCount` | kritik merge blocker testi | Tamam |
| Phase 3 | Kritik merge görünür iz | row highlight + `Merge Kritik` badge | `Merge Kritik` rozeti testi | Tamam |
| Phase 3 | Footer ve export kilit metni | `blockerMesaji`, `exportBlockerReasons` | footer/export disabled testleri | Tamam |

## 6. UI / Bilgi Mimarisi
- [DOKUMAN] Phase 2: Header + split-screen (görsel/grid) + doğrulama özeti + footer karar barı korunmuştur.
- [DOKUMAN] Phase 3: Header + aksiyon şeridi + validation bandı + plaka şeridi + dense grid + footer aksiyonları korunmuştur.
- [DOKUMAN] Her iki fazda da yoğun ve operasyonel layout tercih edilmiştir.

## 7. İş Kuralları ve Validasyonlar
- [DOKUMAN] Phase 2 blocker: canonical 7 alanli review modelinde gerekli operator onayi yoksa gecis engeli.
- [DOKUMAN] Phase 3 blocker: cari eksik, stok eksik, fire zorunlu ama boş, kritik merge grubu bekliyor.
- [API] UI disabled olsa dahi backend tarafında gate/blocker doğrulaması devam eder (`usePhase2Gate` / backend gate endpointleri).

## 8. API Entegrasyon Analizi
- [API] Phase 2 onay/undo/gate: `decidePhase2Cell`, `undoPhase2Decision`, `getPhase2GateStatus`, `getPhase2AuditTrail`.
- [API] Phase 3 canlı veri/lookup: `listRecords`, `getRecord`, `lookupCustomers`, `lookupStocks`, `updatePhase3`.
- [API] Hatalı görsel akışı: `markError` çağrısı ile kayıt statü değişimi.

## 9. SQL Entegrasyon Analizi
- [SQL-TEKNIK] Bu UI çalışmasında yeni SQL şeması eklenmemiştir.
- [SQL-TEKNIK] Blocker/karar kayıtları mevcut backend servis ve event modelleri üzerinden sürdürülmektedir.

## 10. Boşluk Analizi
- [VARSAYIM] OCR bbox verisinin tüm satırlarda eksiksiz gelmesi garanti değildir; UI buna toleranslı tasarlanmıştır.
- [EKLENMESI-GEREKLI] Phase 2 test altyapısında `canvas` mock standardizasyonu yapılırsa test loglarındaki jsdom uyarıları azaltılabilir.
- [EKLENMESI-GEREKLI] Phase 3 için kritik merge nedenini kullanıcıya satır detay panelinde de metinsel anlatım olarak eklemek değerlidir.

## 11. Riskler
- [VARSAYIM] Backend status/field adları değişirse mevcut UI test fixture’ları güncelleme ister.
- [VARSAYIM] Çok büyük kayıt setlerinde grid etkileşim performansı, gerçek yük altında ayrıca ölçülmelidir.

## 12. Yapılacaklar / TODO
- [EKLENMESI-GEREKLI] QA tarafında bu matrisi release checklist’ine bağla.
- [EKLENMESI-GEREKLI] Phase 2 canvas mock’unu global test setup’a taşı.
- [EKLENMESI-GEREKLI] Phase 3 kritik merge için satır detay paneline kısa neden metni ekle (opsiyonel).

## 13. Açık Sorular
- [VARSAYIM] Kritik merge kuralı tüm müşteriler için mi, yoksa müşteri/profil bazlı mı çalışacak?
- [VARSAYIM] Fire zorunluluğu tetik koşulları sadece metin+stok durumu mu, yoksa ek backend kural seti var mı?

