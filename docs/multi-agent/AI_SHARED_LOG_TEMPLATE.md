# AI SHARED LOG TEMPLATE

Bu sablon, tum AI ajanlari tarafindan ortak ve tek formatta kayit tutmak icin zorunludur.
Kullanim: Her gorev sonunda asagidaki blok oldugu gibi kopyalanir, alanlar doldurulur ve `AI_SHARED_EXECUTION_LOG.md` dosyasina eklenir.

```
## Kayit ID: <YYYYMMDD-AGENT-SEQ>
- Tarih/Saat: <YYYY-MM-DD HH:MM>
- Ajan: <Codex|Claude|Gemini|...>
- Gorev Tipi: <Build|Fix|Refactor|Doc|Test|Ops>
- Durum: <IN_PROGRESS|DONE|BLOCKED>
- Protokol: AI_UNIVERSAL_ONEFILE_PROTOCOL.md v<version>

### 1) Amac
<Bu kaydin amaci ve is kapsaminin tek cumle ozeti>

### 2) Yapilanlar
1. <adim 1>
2. <adim 2>
3. <adim 3>

### 3) Degisen Dosyalar
1. <absolute/path/or/relative/path>
2. <path>

### 4) Dogrulama
1. Komut: `<command>`
Sonuc: <PASS|FAIL|NOT_RUN>
Not: <kisa aciklama>

### 5) Riskler / Acik Noktalar
1. <risk veya yok>

### 6) Sonraki Adim
1. <next action>
```

