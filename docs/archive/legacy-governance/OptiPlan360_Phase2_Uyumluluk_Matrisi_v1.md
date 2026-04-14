# OptiPlan360 – Phase 2 Uyumluluk Matrisi v1

## 1. Yonetici Ozeti

Bu dokuman, `docs/governance-pack/OptiPlan360_Phase2_Implementation_Spec_v2.md` ile mevcut `OCRKontrolPage` implementasyonunun uyum durumunu ozetler.

Genel durum:
- Phase 2 odagi (7 alanli dogrulama modeli, blocker, manuel onay, Phase 3 gate) buyuk oranda uygulanmis durumda. `[DOKUMAN]`
- Kapsam disi aksiyonlar (cari/stok esleme) OCR ekranindan kaldirildi. `[DOKUMAN]`
- Split-screen ve bbox highlight mevcut, ancak panel resizer ile zoom/pan kontrolleri eksik. `[EKLENMESI-GEREKLI]`

## 2. Kapsam

Bu matriste sadece su alanlar degerlendirilir:
- OCR Kontrol ekrani (`frontend/src/features/OptiPlanWorkflow/OCRKontrolPage.tsx`)
- OCR Phase 2 testleri (`frontend/src/features/OptiPlanWorkflow/OCRKontrolPage.test.tsx`)

Bu dokuman su alanlari kapsamaz:
- Phase 3 siparis duzenleme davranislari
- ERP/cari/stok esleme akislarinin detaylari

## 3. Kullanilan Referanslar

- `docs/governance-pack/OptiPlan360_Phase2_Implementation_Spec_v2.md` `[DOKUMAN]`
- `frontend/src/features/OptiPlanWorkflow/OCRKontrolPage.tsx` `[DOKUMAN]`
- `frontend/src/features/OptiPlanWorkflow/OCRKontrolPage.test.tsx` `[DOKUMAN]`

## 4. Kaynaklardan Cikarilan Bulgular

1. Dogrulama blocker mantigi canonical olarak 7 alanli modele baglidir. `[DOKUMAN]`
2. `confidence < 80` hucreleri warning state aliyor ve onaysizken Phase 3 gecisi kilitli kalıyor. `[DOKUMAN]`
3. Hucre onayi (buton, Enter, F2) sonrasinda warning kalkiyor. `[DOKUMAN]`
4. Phase 3 aktarim CTA'si sadece blocker temizse aktif. `[DOKUMAN]`
5. Hatali gorsel modal akisi mevcut ve `markError` cagrisi yapiliyor. `[DOKUMAN]`
6. BBox yoksa canvas cizimi sessizce atlanarak ekran bozulmuyor. `[DOKUMAN]`
7. Cari/stok arama ve secim kontrolleri OCR ekranindan kaldirildi. `[DOKUMAN]`

## 5. Alan Matrisi

| Spesifikasyon Alani | Durum | Not |
|---|---|---|
| 7 alanli review modeli | Karsilandi | Canonical model BOY / EN / ADET / U1 / U2 / K1 / K2 alanlarini kapsar. |
| Confidence esigi `<80` | Karsilandi | Turuncu warning + onay gereksinimi var. |
| Hucre onayi ve warning kalkmasi | Karsilandi | Onay butonu, Enter, F2 ile temizleniyor. |
| Phase 3 gate | Karsilandi | Onaysiz hucre varsa CTA disable + reason var. |
| Footer blocker bari | Karsilandi | Onay bekleyen sayisi + secili kayit + CTA var. |
| Empty state aciklayici metin | Karsilandi | Faz amaci ve davranis adimlari yaziyor. |
| Cari/Stok esleme kontrolleri | Karsilandi | Phase 2 kapsamindan cikarildi. |
| Panel resizer (50/50 ayarlanabilir) | Eksik | Split-screen var, ama draggable resizer yok. `[EKLENMESI-GEREKLI]` |
| Zoom in/out + pan/drag kontrolleri | Eksik | BBox overlay var; kullanici zoom/pan kontrolu sinirli. `[EKLENMESI-GEREKLI]` |
| Arrow key navigasyonu | Kismen | Tab/Shift+Tab/Enter/F2 var; Arrow hareketi yok. `[EKLENMESI-GEREKLI]` |

## 6. UI / Bilgi Mimarisi

- Ust bolum: baslik + aciklama + kuyruk metrikleri + ana aksiyonlar. `[DOKUMAN]`
- Orta bolum: 3 kolonlu yapi (kuyruk, split-screen, phase2 ozet paneli). `[DOKUMAN]`
- Split-screen:
  - Sol: orijinal gorsel + bbox overlay
  - Sag: dense OCR grid (BOY/EN/ADET agirlikli)
- Alt bolum: blocker/success footer bari + Phase 3 CTA. `[DOKUMAN]`

## 7. Is Kurallari ve Validasyonlar

- Low confidence kriteri: `score < 80`. `[DOKUMAN]`
- Low confidence hucreler onaysizsa blocker olusur. `[DOKUMAN]`
- Onayli hucreler faz gecisini bloke etmez. `[DOKUMAN]`
- Kapsam disi aksiyonlarin (cari/stok esleme) Phase 2’de bulunmamasi korunur. `[DOKUMAN]`

## 8. API Entegrasyon Analizi

Kullanilan ana servis cagrilari:
- `listRecords`
- `updatePhase2`
- `approvePhase2`
- `removeRow`
- `restoreRow`
- `markError`

Degerlendirme:
- Frontend gate var; backend tarafinda blocker tekrar dogrulamasi beklentisi dokumana uygun olarak korunmali. `[API]`
- `markError` akisi var; WhatsApp taslak akisina yonelik provider pattern gelistirmesi acik gereksinim olarak duruyor. `[EKLENMESI-GEREKLI]`

## 9. SQL Entegrasyon Analizi

Bu ekran frontend agirlikli calisiyor. SQL seviyesinde dogrudan sorgu yok. `[SQL-TEKNIK]`

Teknik beklenti:
- Hucre onayi, override, faz gecisi, hatali isaretleme olaylarinin audit kaydi DB seviyesinde izlenebilir olmalidir. `[SQL-TEKNIK]`

## 10. Bosluk Analizi

1. Ayarlanabilir panel resizer eksik. `[EKLENMESI-GEREKLI]`
2. Zoom in/out + pan/drag kontrolleri eksik. `[EKLENMESI-GEREKLI]`
3. Arrow key hucre navigasyonu eksik. `[EKLENMESI-GEREKLI]`
4. Hatali gorsel akisinda WhatsApp taslak/provider deseninin kapsamli hali eksik. `[EKLENMESI-GEREKLI]`

## 11. Riskler

- Kullanici bekledigi ERP hizina panel resizer/arrow key olmadan ulasamama riski. `[VARSAYIM]`
- Gorsel buyutme/gezdirme davranisinin sinirli olmasi nedeniyle dogrulama hizi dusme riski. `[VARSAYIM]`
- Backend blocker kurali frontend ile birebir degilse tutarsiz gecis riski. `[API]`

## 12. Yapilacaklar / TODO

1. Split-screen icin draggable resizer ekle ve min/max panel sinirlari tanimla.
2. Sol panel icin zoom in/out ve pan davranisi ekle.
3. Grid klavye davranisina Arrow Keys destegi ekle.
4. Hatali gorsel modalinda provider-pattern tabanli taslak mesaj adimini netlestir.
5. Backend tarafinda blocker tekrar dogrulama testini (phase2->phase3) kontrat testiyle sabitle.

## 13. Acik Sorular

1. Arrow key davranisi satir/sutun gecisinde tam ERP semantiginde mi (wrap) calismali? `[VARSAYIM]`
2. Zoom/pan icin hedef minimum/maksimum oran degerleri nedir? `[VARSAYIM]`
3. Hatali gorsel modalinda taslak mesaj metni standart sablon mu olacak, kayda gore dinamik mi? `[API]`

