# OptiPlan360 Agent Workflow

Bu dosya, canonical governance-pack kullanilarak bir gorevin nasil yurutulecegini kisa ve net sekilde tanimlar.

## 1. Baslangic okuma sirasi
Her yeni gorevde once su sirayi izle:
1. `AGENTS.md`
2. `docs/governance-pack/AGENTS.md`
3. `docs/governance-pack/OptiPlan360_Master_Spec_v4.md`
4. Gorevin ilgili oldugu phase-specific canonical spec
5. Gerekirse `docs/governance-pack/OptiPlan360_Extended_Modules_Annex_v1.md`

## 2. Gorev tipini sec
- Analysis-only: once sadece etki alani ve degisecek dosyalar cikarilacaksa
- Implementation: tek feature, tek bugfix veya tek ekran degisikligi yapilacaksa
- Documentation cleanup: yalnizca belge canonicalization, tasima veya arsivleme yapilacaksa
- Review: mevcut diff veya implementasyon kapsam kontrolu yapilacaksa

## 3. Analysis-only akisi
Bu akis, kapsam buyuk veya riskliyse once kullanilir.
- Canonical spec'leri oku
- Etkilenecek dosyalari listele
- Dokunulmayacak alanlari listele
- Risk ve belirsizlikleri yaz
- Kod degisikligi yapma

## 4. Implementation akisi
Bu akis, analiz netlestikten sonra kullanilir.
- `docs/governance-pack/Master_Executor_Prompt.md` dosyasini temel al
- Gorevi tek parca ve dar kapsamli yaz
- Izinli dosya/klasor listesini acik ver
- Liste disi dosyalara dokunma
- Minimum patch uygula
- Test/lint/build veya smoke dogrulama yap

## 5. Documentation cleanup akisi
Belge tasima, arsivleme veya isim duzeltmede su sirayi izle:
- Once `docs/governance-pack/Docs_Naming_Policy.md` oku
- Sonra `docs/governance-pack/Docs_Cleanup_Prompt.md` kullan
- Sonra `docs/governance-pack/Docs_Archive_Plan.md` ile eslesmeleri kontrol et
- Emin degilsen tasima/silme yapma
- Permanent delete yerine once `docs/archive/` altina tasi

## 6. Sabit proje kilitleri
- Phase 2 daima 7 alanlidir: BOY, EN, ADET, U1, U2, K1, K2
- Phase 3 fire aciklamasi tek genel alandir
- Phase 3 header telefon alani opsiyoneldir
- Kaydet aksiyonu blocker mantigini zayiflatamaz
- Archive altindaki legacy belgeler aktif source-of-truth degildir

## 7. Onerilen gunluk kullanim sirasi
1. Gorev tanimini yaz
2. Canonical spec'i sec
3. Gerekirse analysis-only yap
4. Sonra master executor prompt ile implementation yap
5. Sonunda review / dogrulama yap

## 8. Hangi dosyalar temel giris noktasidir
- `README.md`
- `DOCUMENTATION_INDEX.md`
- `AGENTS.md`
- `docs/governance-pack/AGENTS.md`
- `docs/governance-pack/OptiPlan360_Master_Spec_v4.md`
- `docs/governance-pack/Master_Executor_Prompt.md`

## 9. Pratik kural
- Bir prompt = bir gorev
- Bir gorev = net kapsam
- Belirsizlik = dur ve sor
- Canonical spec disinda yeni kural uydurma
