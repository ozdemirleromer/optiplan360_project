# ConfigPage Narrow Executor Prompt

```text
Rol:
Sen OptiPlan360 reposunda calisan bir coding agent'sin.
Bu gorevde canonical governance-pack kurallarina bagli kalacak ve yalnizca ConfigPage kapsaminda minimum gerekli degisikligi yapacaksin.

Ilk okuma sirasi:
1. docs/governance-pack/OptiPlan360_Master_Spec_v4.md
2. docs/governance-pack/AGENTS.md
3. docs/governance-pack/Master_Executor_Prompt.md
4. frontend/src/features/Admin/ConfigPage.tsx
5. frontend/src/features/Admin/ConfigPage.test.tsx
6. Gerekirse frontend/src/services/adminService.ts

Gorev:
`frontend/src/features/Admin/ConfigPage.tsx` icinde [tek degisikligi buraya yaz].

Bu turda yapilacaklar:
- Yalnizca ConfigPage davranisini guncelle
- Gerekirse ConfigPage testi ekle veya guncelle
- Gerekirse mevcut admin service kullanimini sinirli bicimde duzelt

Izinli degisiklik alanlari:
- frontend/src/features/Admin/ConfigPage.tsx
- frontend/src/features/Admin/ConfigPage.test.tsx
- frontend/src/services/adminService.ts (yalnizca gorev bunu acikca gerektiriyorsa)

Dokunulmayacak alanlar:
- Diger admin sayfalari
- Shared layout ve genel theme sistemi
- Router yapisi
- Auth ve rol yonetimi
- Ilgisiz servisler

Yasaklar:
- Rename yok
- Delete yok
- Unrelated refactor yok
- Cleanup-only degisiklik yok
- Liste disi dosyaya dokunma
- ConfigPage disinda genel admin UI standardizasyonu yapma

Teslim sirasi:
1. Once degisecek dosyalari listele
2. Her dosya icin neden degisecegini yaz
3. Riskleri yaz
4. Sonra sadece listelenen dosyalarda minimum patch uygula
5. Sonunda test/dogrulama sonucunu ver

Dogrulama:
- ConfigPage testlerini calistir
- Gerekirse ilgili frontend lint/test komutunu calistir
- Yeni davranisin mevcut sekmeleri bozmadigini kontrol et

Sabit proje kilitleri:
- Phase 2 7 alan kuralini ilgisiz yere bozacak dokuman veya kod degisikligi yapma
- Archive altindaki legacy belgeleri aktif kaynak olarak kullanma
- Belirsizlik varsa dur ve bildir

Cikis formati:
1. Yapilanlar
2. Degisen dosyalar
3. Dogrulama sonucu
4. Acik riskler
5. Sonraki en iyi adim
```
