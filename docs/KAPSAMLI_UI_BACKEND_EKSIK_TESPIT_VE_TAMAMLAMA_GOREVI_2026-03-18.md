# Kapsamli UI/Frontend + Backend Eksik Tespit ve Tamamlama Gorevi (2026-03-18)

## 1) Yonetici Ozeti
Bu calisma; UI/frontend ve backend katmanlarinda kod eksiklerini tespit etmek, test-oncesi kalan bosluklari kapatmak ve dogrulama testleri ile temiz kapanis saglamak icin hazirlanmistir. Bu turda kodu kiran bir hata bulunmamistir; daha once tamamlanan eksiklerin stabil oldugu yeniden dogrulanmistir. Sadece CI workflow dosyasinda secret dogrulamasi ile ilgili editor uyarisi kalmistir.

## 2) Kapsam
- Frontend: OCR Phase-2 akislari, Orders workspace, servis kontratlari, UI blocker gorunurlugu
- Backend: mikro SQL client test kapsami ve calisma dogrulamasi
- CI/kontrat: workspace test gorevleri ve editor problem taramasi

## 3) Kullanilan Referanslar
- [DOKUMAN] `.github/instructions/backend.instructions.md`
- [DOKUMAN] `.github/instructions/ui.instructions.md`
- [API] `frontend/src/services/optiplanWorkflowService.ts` ve testleri
- [API] `frontend/src/features/OptiPlanWorkflow/OCRKontrolPage.tsx` ve testleri
- [SQL-TEKNIK] `backend/tests/test_mikro_sql_client.py`

## 4) Kaynaklardan Cikarilan Bulgular
- [API] Orders workspace regresyonu temiz: 17 test dosyasi, 196 test geciyor.
- [API] OCR ekrani + servis kontrat testleri temiz geciyor (27/27 ve 12/12).
- [SQL-TEKNIK] mikro SQL client testleri temiz geciyor (35/35).
- [EKLENMESI-GEREKLI] `.github/workflows/ci-cd.yml` icinde `DOCKER_USERNAME` ve `DOCKER_PASSWORD` context erisimi editor tarafinda uyari veriyor.

## 5) Alan Matrisi
| Alan | Katman | Durum | Not |
|---|---|---|---|
| OCR Phase-2 blocker render | Frontend UI | Tamam | Blockerlar gorunur durumda |
| Phase-2 endpoint kontratlari | Frontend Service | Tamam | Validate/Decide/Gate/Audit/Undo/Batch testli |
| Orders 4-faz akis | Frontend Feature | Tamam | Workspace testleri yeşil |
| Mikro SQL istemci | Backend Test | Tamam | 35 test yesil |
| Docker secret context | CI Workflow | Acik/Uyari | Editor dogrulama uyarisi |

## 6) UI / Bilgi Mimarisi
- [DOKUMAN] Teknik alanlar ana kullanici akisindan ayrik tutuldu.
- [API] Gate durumu, undo zaman cizgisi ve blocker aciklamalari ayni kayit baglaminda gorunur.
- [EKLENMESI-GEREKLI] CI tarafi icin operasyonel gizli degiskenlerin (secret) repo/organization seviyesinde tanimlanmasi gerekiyor.

## 7) Is Kurallari ve Validasyonlar
- [API] Blocker varsa bir ust faza gecis engelleniyor.
- [API] Decision/Undo akisinda kayit bazli tutarlilik korunuyor.
- [SQL-TEKNIK] Mikro istemci testleri ile sorgu/connection davranislari dogrulandi.

## 8) API Entegrasyon Analizi
- [API] Frontend servis katmaninda yeni endpointlerin request/response map dogrulamasi testlenmis durumda.
- [API] OCR ekrani bu endpointleri aktif olarak tuketiyor; UI state ile servis state tutarli.

## 9) SQL Entegrasyon Analizi
- [SQL-TEKNIK] `test_mikro_sql_client.py` test seti geciyor; SQL istemci katmaninda bu turda acik kusur tespit edilmedi.

## 10) Bosluk Analizi
- [EKLENMESI-GEREKLI] CI workflow secret uyarilari kodu kiran hata degil; ancak operasyonel kurulum eksigi olarak ele alinmali.
- [VARSAYIM] Uretim/CI ortaminda bu secretlar tanimliysa runtime sorunu olmayacagi varsayilmaktadir.

## 11) Riskler
- [EKLENMESI-GEREKLI] Secretlar tanimli degilse Docker login adimi pipeline’da fail olabilir.
- [VARSAYIM] Lokal editor uyarisinin CI runtime sonucunu birebir temsil etmedigi varsayilir.

## 12) Yapilacaklar / TODO
1. [EKLENMESI-GEREKLI] CI ortaminda `DOCKER_USERNAME` ve `DOCKER_PASSWORD` secretlarini dogrula.
2. [EKLENMESI-GEREKLI] Gerekirse workflow’a secret yoksa adimi atlayan kosul ekle.
3. [API] Orders + OCR + backend mikro test zincirini release oncesi tek seferde tekrar kos.

## 13) Acik Sorular
1. [EKLENMESI-GEREKLI] Docker registry icin kimlik dogrulama zorunlu mu, yoksa bu adim belirli branch/release kosuluna mi baglanmali?
2. [VARSAYIM] Secret adlari proje standardinda sabit mi, yoksa environment bazli adlandirma var mi?

---

## Bu Turdaki Dogrulama Kanitlari (Ozet)
- `frontend/src/features/Orders/**`: 17/17 dosya, 196/196 test gecti.
- `backend/tests/test_mikro_sql_client.py`: 35/35 test gecti.
- Editor hata taramasi: Kod kiran TypeScript/Python hatasi yok; sadece workflow secret-context uyarisi var.
