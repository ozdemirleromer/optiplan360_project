# Architecture Partitioning Plan (Horizontal + Vertical)

Tarih: 2026-03-06

Bu belge, projeyi kirilma yaratmadan hibrit mimariye gecirmek icin ilk fazi tanimlar.

## Hedef

1. Yatay bolumleme:
- `routers` = transport/API katmani
- `services` = uygulama/is katmani
- `models` = veri katmani
- `integrations` = dis baglanti adaptorleri
- `utils/constants/config` = paylasilan altyapi

2. Dikey bolumleme:
- Feature/domain gruplari ile rota kompozisyonu
- Ornek grup: `core_operations`, `integrations`, `ocr_external`, `business_modules`

## Faz 1 (Bu commit)

1. `backend/app/features/` kompozisyon katmani eklendi.
2. `backend/app/features/v1_router_groups.py` ile v1 route registry grup bazli tanimlandi.
3. `backend/app/routers/v1/api.py` artik grup registry uzerinden route include ediyor.
4. Endpoint path/kontrat degismedi; sadece include mekanizmasi merkezilesti.

## Fayda

1. Buyuk `api.py` dosyasi sadeleşir.
2. Hangi domainin nerede include edildigi tek noktadan gorulur.
3. Sonraki fazda router -> feature paketi tasima islemleri daha guvenli olur.

## Sonraki Faz (Oneri)

1. Backend:
- `app/features/<feature>/` altina `router.py`, `service.py`, `schemas.py`, `repository.py` tasinacak.
- Legacy router dosyalari adim adim thin-wrapper haline getirilecek.

2. Frontend:
- `src/features/<feature>/` altinda UI + hook + service + test birlikte tutulacak.
- `src/components` altindaki feature-ozel bilesenler feature klasorlerine tasinacak.
- `src/components/shared` yalnizca ortak bileşenler icin kalacak.

3. Guardrails:
- Import sinirlari (feature disina dogrudan erisim kurali)
- Dosya boyutu ve modulerlik lint kurallari
- CI'da architecture check

## Basari Kriteri

1. Route kontratinda degisiklik olmamasi.
2. Testlerin ayni sekilde calismasi.
3. Yeni feature eklemek icin sadece `v1_router_groups.py` guncellemesinin yeterli olmasi.

