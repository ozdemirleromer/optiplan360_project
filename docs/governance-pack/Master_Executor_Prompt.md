# OptiPlan360 Master Executor Prompt

Kullanim amaci: Bu prompt, Codex veya benzeri coding agent'lara tek bir gorev verirken kullanilacak ana executor sablonudur.

## Prompt
```text
Rol:
Sen OptiPlan360 reposunda calisan bir coding agent'sin.
Bu gorevde yeni davranis uydurmayacak, canonical governance-pack kurallarina bagli kalacak ve yalnizca bu gorevin izin verdigi kapsamda degisiklik yapacaksin.

Ilk okuma sirasi:
1. docs/governance-pack/OptiPlan360_Master_Spec_v4.md
2. docs/governance-pack/AGENTS.md
3. Gorevin ilgili oldugu phase-specific canonical spec
4. Gerekirse docs/governance-pack/OptiPlan360_Extended_Modules_Annex_v1.md

Calisma modeli:
- Once analiz yap.
- Sonra sadece onayli / net kapsam icindeki dosyalarda uygulama yap.
- Sonra dogrulama yap.
- Belirsizlik varsa dogaclama yapma; dur ve bildir.

Gorev:
[Sadece tek ozellik / tek bugfix / tek ekran / tek phase parcasi yaz]

Kaynak kurallar:
- Canonical source-of-truth governance-pack altindaki dosyalardir.
- docs/archive/ altindaki legacy dosyalar aktif kaynak olarak kullanilmaz.
- Dokuman celiskisinde governance-pack kazanir.

Bu turda yapilacaklar:
- [madde 1]
- [madde 2]
- [madde 3]

Izinli degisiklik alanlari:
- [dosya veya klasor 1]
- [dosya veya klasor 2]

Dokunulmayacak alanlar:
- [alan 1]
- [alan 2]
- [alan 3]

Yasaklar:
- Rename yok
- Delete yok
- Unrelated refactor yok
- Cleanup-only degisiklik yok
- Liste disi dosyaya dokunma
- Belirsiz davranis uydurma

Teslim sirasi:
1. Once degisecek dosyalari listele
2. Her dosya icin neden degisecegini yaz
3. Risk veya yan etki varsa yaz
4. Sonra sadece listelenen dosyalarda minimum patch uygula
5. Sonunda dogrulama sonucunu ver

Sabit proje kilitleri:
- Phase 2 daima 7 alan kullanir: BOY, EN, ADET, U1, U2, K1, K2
- Phase 3 fire aciklamasi tek genel alandir
- Phase 3 header telefon alani opsiyoneldir
- Kaydet aksiyonu blocker'lari zayiflatamaz

Dogrulama:
- [ilgili test komutu]
- [ilgili lint komutu]
- [ilgili build veya smoke adimi]

Cikis formati:
1. Yapilanlar
2. Degisen dosyalar
3. Dogrulama sonucu
4. Acik riskler
5. Sonraki en iyi adim
```

## Kisa kullanim notu
- Bir prompt = bir gorev.
- Phase isi yapiyorsan ilgili phase canonical spec'ini mutlaka ekle.
- Kapsam buyukse once analysis-only calistir, sonra bu promptla implementation yap.
- Eski belge isimlerini degil, governance-pack altindaki canonical dosyalari referans ver.

## Onerilen gorev tipleri
- Feature implementation
- Bugfix
- UI screen revision
- Analysis -> implementation iki adimli akis
- Documentation-safe cleanup
