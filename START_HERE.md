# START HERE

OptiPlan360 reposunda canonical dokuman ve prompt sistemiyle calismaya baslamak icin bu dosyayi takip et.

## 1. Ilk okunacak dosyalar
1. `AGENTS.md`
2. `DOCUMENTATION_INDEX.md`
3. `docs/governance-pack/AGENTS.md`
4. `docs/governance-pack/OptiPlan360_Master_Spec_v4.md`

## 2. Goreve gore sonraki dosya
- Phase 1 isi: `docs/governance-pack/OptiPlan360_Phase1_Implementation_Spec_v3.md`
- Phase 2 isi: `docs/governance-pack/OptiPlan360_Phase2_Implementation_Spec_v2.md`
- Phase 2 UI isi: `docs/governance-pack/OptiPlan360_Phase2_UI_Spec_7Fields_v2.md`
- Phase 3 isi: `docs/governance-pack/OptiPlan360_Phase3_UIUX_Spec_v2.md`
- Genisletilmis ERP modulleri: `docs/governance-pack/OptiPlan360_Extended_Modules_Annex_v1.md`

## 3. Prompt kullanimi
- Genel implementation gorevleri icin: `docs/governance-pack/Master_Executor_Prompt.md`
- Kullanim akisi icin: `docs/governance-pack/Workflow.md`
- Dokuman temizligi icin: `docs/governance-pack/Docs_Cleanup_Prompt.md`

## 4. Sabit proje kurallari
- Phase 2 sabit olarak 7 alan kullanir.
- Phase 3 fire aciklamasi tek genel alandir.
- Archive altindaki legacy belgeler aktif source-of-truth degildir.
- Belirsizlik varsa dogaclama yok, once netlestirme vardir.

## 5. Ne yapma
- Eski arsiv belgelerini aktif kaynak gibi kullanma.
- Tek promptla tum projeyi uygulatmaya calisma.
- Kapsami netlestirmeden refactor veya cleanup yapma.

## 6. Pratik baslangic
1. Gorevi tek cumleyle yaz
2. Ilgili canonical spec'i sec
3. Gerekirse once analysis-only yap
4. Sonra master executor prompt ile uygula
5. En sonda dogrulama yap
