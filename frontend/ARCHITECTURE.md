## OptiPlan360 Frontend/Backend Split - Operational Blueprint

Tarih: 2026-03-03

### Current frontend state

- `frontend/` Vite/React uygulamasi repo kokunden `npm run dev` ile `3001` portunda calistirilir.
- Docker build `Dockerfile.frontend` uzerinden yapilir ve Nginx ile `3001` portunda servis eder.
- Tum API trafigi `src/services/apiClient.ts` uzerinden akar.
- `apiClient`, `VITE_API_BASE_URL` verilmediginde `/api` bazini kullanir ve proxy yoksa `8080` backend fallback'i dener.
- Frontend tarafi backend `snake_case` yanitlarini camelCase'e map eder.

### Why full separation matters

1. Backend tarafinda JWT, yetki, veri erisimi ve entegrasyon sirlarini tutmak gerekir.
2. Frontend ve backend ayri deploy edilerek gozlemleme ve bakim kolaylasir.
3. Static UI ile API'nin ayri olmasi production topolojisini sade tutar.

### Recommended architecture

```text
optiplan360_project/
|- backend/            # FastAPI API ve domain servisleri
|- frontend/           # React operator/yetkili UI
|- apps/orchestrator/  # Node.js orchestrator
|- apps/admin-ui/      # Orchestrator admin paneli
`- docs/               # Resmi karar, operasyon ve sozlesmeler
```

### Communication contract

- Ana backend base URL: `http://127.0.0.1:8080/api/v1`
- Frontend dev entrypoint: `http://127.0.0.1:3001`
- Proxy/compose ortami yoksa frontend backend `8080` fallback'ini kullanir
- Backend yanitlari snake_case kalmali veya mapper bilincli guncellenmelidir

### Token lifecycle

- Tokenlar localStorage icinde tutulur
- `apiClient` expire kontrolu yapar
- Gerekirse `/auth/refresh` ile yenileme dener
- `401` durumunda tek seferlik refresh sonrasi istegi tekrarlar

### Operational note

- Bu belge tarihsel taslak degil, mevcut repo davranisinin ozetidir.
- Port standardi icin `../PORT_FIX_SUMMARY.md` esas alinmalidir.
