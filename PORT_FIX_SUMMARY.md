# Port Fix Summary

Tarih: 2026-03-03
Durum: Current normalized baseline

Bu belge, repo icindeki daginik port bilgisini tek standarda indirger.

## Guncel Standart

- Ana backend: `8080`
- Ana frontend dev: `3001`
- Orchestrator: `8090`
- Admin UI: deploy sekline gore degisir

## Duzeltilen Catisma Noktalari

- `8000` referanslari tarihi/deprecated kabul edildi
- `3008` referanslari tarihi/deprecated kabul edildi
- Ana repo kullanimi icin `npm run dev` -> `3001` standardi esas alindi
- Backend API standardi `http://127.0.0.1:8080`

## Teknik Notlar

- `frontend/src/services/apiClient.ts` fallback backend portunu `8080` kabul eder
- `frontend/vite.config.ts` backend proxy hedefini `8080` kabul eder
- Kok `package.json` frontend dev komutunu `3001` portunda calistirir

## Beklenen Erisim Adresleri

### Ana uygulama
- Frontend: `http://127.0.0.1:3001`
- Backend: `http://127.0.0.1:8080`
- API docs: `http://127.0.0.1:8080/docs`

### Orchestrator
- Service/API: `http://127.0.0.1:8090`

## Not

Eski raporlarda 3000, 3008 ve 8000 gorulebilir. Bunlar tarihsel izdir; guncel calisma standardi olarak yorumlanmamalidir.
