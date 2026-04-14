# ConfigPage Analysis-Only Prompt

```text
Rol:
Sen OptiPlan360 reposunda calisan bir coding agent'sin.
Bu gorevde kod degisikligi yapmayacaksin. Yalnizca ConfigPage kapsamini analiz edeceksin.

Ilk okuma sirasi:
1. docs/governance-pack/OptiPlan360_Master_Spec_v4.md
2. docs/governance-pack/AGENTS.md
3. AGENTS.md
4. frontend/src/features/Admin/ConfigPage.tsx
5. frontend/src/features/Admin/ConfigPage.test.tsx
6. frontend/src/services/adminService.ts

Gorev:
Yalnizca `frontend/src/features/Admin/ConfigPage.tsx` etrafindaki etki alanini cikar.

Amaç:
- Sayfanin mevcut sorumluluklarini cikar
- Tema, sistem kontrol matrisi ve servis feature-flag alanlarini ayir
- Hangi degisikligin hangi dosyalari etkileyecegini listele
- Gerekli olmayan dosyalari acikca kapsam disi birak
- Riskleri ve belirsizlikleri yaz

Kurallar:
- Kod yazma
- Dosya degistirme
- Refactor onermeden once mevcut siniri tarif et
- Belirsiz davranis uydurma
- docs/archive altindaki belgeleri aktif kaynak olarak kullanma

Izinli inceleme alanlari:
- frontend/src/features/Admin/ConfigPage.tsx
- frontend/src/features/Admin/ConfigPage.test.tsx
- frontend/src/services/adminService.ts
- frontend/src/features/Admin/* yakin komsu dosyalar, yalnizca karsilastirma gerekiyorsa

Cikti formati:
1. Mevcut bolumler ve sorumluluklar
2. Muhtemel write-scope
3. Dokunulmamasi gereken alanlar
4. Test etkisi
5. Riskler / belirsizlikler
```
