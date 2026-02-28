## OptiPlan360 Frontend/Backend Split — Operational Blueprint

### Current frontend state
- The existing `frontend/` Vite/React app runs on port `3001` locally and, in Docker, uses `Dockerfile.frontend` which builds with `npm run build` and serves `dist/` via Nginx.
- All API traffic flows through `src/services/apiClient.ts`, which resolves `import.meta.env.VITE_API_BASE_URL || http://127.0.0.1:8000` and appends `/api/v1`. This module also manages JWT persistence, proactive refresh (token lifetime margin 10 min), and transparent retry on `401`.
- The UI assumes backend JSON keys arrive as `snake_case`, so `apiClient` permanently maps them to camelCase before any consumer sees the data.
- Frontend dev uses `vite.config.ts` (now with `strictPort: true`) for proxying `/api` traffic via `server.proxy` to whatever `VITE_API_BASE_URL` points at, avoiding CORS surprises and ensuring parity between `npm run dev` and Dockerized builds.

### Why full separation matters
1. **Security & trust boundary**: Backend is the only place where JWT secrets, refresh logic, user claims, database credentials, RBAC checks and other sensitive rules should live. The UI only carries short-lived tokens via `localStorage` and never handles secret keys directly.
2. **Stability & scaling**: Keeping the UI and API in separate services allows independent scaling/patching, better observability (each service can expose health endpoints/metrics) and more predictable CI/CD deployments.
3. **Deployment alignment**: Frontend can live behind a CDN or static host (Nginx in Docker), while backend is shielded behind API gateways or load balancers with enforced TLS and rate-limiting.

### Recommended architecture
```
optiplan360_project/
├── backend/                  # to be created (FastAPI/Express, API layer, data access)
│   ├── Dockerfile
│   ├── app/
│   │   ├── routers/
│   │   └── services/
│   └── etc.
├── frontend/                 # current repo (Vite, src/, Dockerfile.frontend)
├── docker-compose.yml        # to bind both services + optional infra (db/cache)
└── ARCHITECTURE.md           # this document
```

#### Backend implementation (FastAPI)
- `backend/app/main.py` boots FastAPI with CORS from `backend/app/core/config.py`, exposes `/health`, mounts the `/api/v1/status` router and the auth router for `/auth/login` and `/auth/refresh`.
- Tokens are issued via `backend/app/core/security.py`; user authentication uses a demo user defined in `backend/app/services/user_service.py` while tokens are minted by `backend/app/services/token_service.py`.
- `backend/app/dependencies.py` rejects invalid or mislabeled tokens before handlers (including refresh) execute, and `/api/v1/status` requires bearer tokens to prove the user identity.
- The demo credentials are meant as placeholders; production should replace `DEMO_USER_PASSWORD` and `DEMO_USER_USERNAME` with a real user store and secrets managed outside version control.

#### Communication contract
- Frontend uses `VITE_API_BASE_URL` (set in `.env.local`/Compose) to locate the backend. The dev proxy maps `/api` → backend service, and the production Nginx config in `Dockerfile.frontend` mirrors that with `proxy_pass http://optiplan360-backend:8080/api/`.
- Backend should expose REST endpoints under `/api/v1` to match `apiClient`. It must also expose `/auth/refresh` for the proactive refresh flow.
- All backend responses should keep snake_case naming so the frontend’s mapper stays valid, or change both sides to a new contract deliberately.

#### Token lifecycle (controlled by frontend today)
- Tokens sit inside `localStorage` under `optiplan-auth-storage` and `optiplan-auth-token`.
- Before every request `apiClient` checks expiration (`decodeTokenExp`), triggers `refreshAccessToken` if within 10 minutes of expiry, updates persisted storage, and retries the original call after refresh.
- A `401` triggers a single refresh attempt; if that fails, frontend clears storage and broadcasts `auth:session-expired`. Backend must honor this flow by returning standard HTTP codes/messages.

### Docker Compose blueprint
```yaml
version: "3.9"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8080"           # expose API for local dev/CI
    environment:
      - NODE_ENV=production_or_dev
      - DATABASE_URL=postgresql://...
      - JWT_SECRET=...        # keep secrets outside repo
    networks:
      - opti-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      retries: 3

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3001:3001"
    depends_on:
      backend:
        condition: service_healthy
    environment:
      VITE_API_BASE_URL: http://backend:8080
    networks:
      - opti-net

networks:
  opti-net:
    driver: bridge
```
- Compose ensures that, when both containers run together, the UI automatically targets backend via Docker DNS (`http://backend`) while still exposing port `3001` to the host for manual testing.
- For local dev, keep using `npm run dev` (React) and whatever command starts backend (e.g., `uvicorn`), but maintain the same env contract (`VITE_API_BASE_URL=http://localhost:8000`).

### Operational considerations
- Keep `.env`/`.env.local` out of source control; document variables needed for each service (`JWT_SECRET`, `DATABASE_URL`, `VITE_API_BASE_URL`, etc.).
- Backend should enforce HTTPS/TLS on public deployments and only expose health/auth endpoints necessary for tooling. Frontend continues to rely on the backend for audit logging, RBAC, and sensitive operations.
- Logs: the backend should emit structured JSON/line logs; the frontend can aggregate Nginx logs (Docker) for access metrics. Use Compose volume mounts if you need persistent logs.
- Monitoring: add readiness and liveness probes in Compose/ deployment scripts so orchestration (K8s/ECS) can recycle failing containers quickly.

### Next implementation steps
1. **Create `backend/` scaffold** (choose FastAPI/Express) with `/auth/refresh`, `/api/v1` routers, and Dockerfile that listens on `8080`, exposes metrics, and validates JWTs.
2. **Add `docker-compose.yml`** (see blueprint above) to orchestrate both services plus any infra (Postgres, Redis, etc.).
3. **Define `.env.{dev,prod}`** files that set `VITE_API_BASE_URL` and backend secrets, and update deployment scripts to inject the values.
4. **Document environment/deployment workflow** (npm scripts, Compose commands, health checks, logging) so future engineers replicate the architecture.

Bu analiz en yüksek seviyede mimari netlik sağlamak için yapıldı. İstersen bu blueprint üzerine adım adım ilerleyelim; bir sonraki adıma hazır olduğunda bana söyle yeter.  
