# Running Synthetic Shoppers with Docker

One command brings up the whole stack — the **live dashboard** (frontend) and the **simulation
engine + API** (backend). The default run is **instant and keyless**: no API key, no Chromium
download. Real browser-use agents are an opt-in profile.

```bash
docker compose up --build
```

- Dashboard → http://localhost:8080
- Backend API → http://localhost:8000 (health: http://localhost:8000/health)

---

## The three ways to run

| Command | What you get | Needs a key? |
|---|---|---|
| `docker compose up --build` | Dashboard (live demo) + lightweight backend | No |
| `docker compose --profile real up --build` | Adds browser-use backend + real dashboard + Shopee storefront | **Yes** — `OPENAI_API_KEY` |
| `docker compose --profile shopee up --build` | Also serves the standalone Shopee storefront app | No |

For real mode, copy the key first:

```bash
cp .env.example .env          # then put your OPENAI_API_KEY in .env
docker compose --profile real up --build
```

Real-mode URLs:

- Real dashboard → http://localhost:8082
- Real backend API → http://localhost:8001 (health: http://localhost:8001/health)
- Shopee storefront preview → http://localhost:5174

---

## Why two modes (how the apps are wired)

- **Backend has two cleanly-separated modes.** *Mock* mode needs only `fastapi/uvicorn/pydantic` —
  `browser_use_driver` is imported lazily, so the default image carries **no Chromium and needs no
  API key**. *Real* mode pulls in `browser-use` + `openai` + Chromium and reads `OPENAI_API_KEY`.
- **The frontend bakes its config at build time** (Vite inlines `VITE_*`). With `VITE_MOCK=1` the
  dashboard plays a bundled fixture and animates instantly with **no backend**. With `VITE_MOCK=0`
  it asks the backend for a *real* (Chromium) run. So the guaranteed-instant demo is the dashboard
  in mock mode — that's the default image build.
- **Browser-use must not use host `localhost` from inside Docker.** The browser-use backend runs in
  the `backend-real` container, so it reaches Shopee over the Compose network at `http://shopee`.
  The host-facing `http://localhost:5174` URL is only for humans and local browser preview.

Real-mode data path:

```
host browser
  -> http://localhost:8082 dashboard
  -> http://localhost:8001 REST + ws://localhost:8001 WebSocket
  -> backend-real FastAPI
  -> browser-use headless Chromium
  -> http://shopee/shopee/:id?config=...  (Compose service DNS, container port 80)
```

This keeps app-level wiring flexible for the teammate owning the Shopee integration: the Shopee app
is packaged as a first-class service, and the browser-use backend already has the correct internal
`LISTING_BASE_URL`.

---

## What gets built

```
backend/
  Dockerfile           # python:3.11-slim · requirements.txt only · uvicorn :8000   (lightweight)
  Dockerfile.browser   # + requirements-browser-use.txt + `playwright install chromium`  (real mode)
  .dockerignore
frontend/
  Dockerfile           # multi-stage: node:20 build → nginx:alpine   (VITE_* as build ARGs)
  nginx.conf           # SPA fallback (try_files → /index.html) + serves /fixtures
  .dockerignore
docker-compose.yml     # services: backend (:8000), frontend (:8080); profiles: real, shopee
.env.example           # OPENAI_API_KEY (real mode only)
```

### Services

- **`backend`** — `uvicorn main:app` on `:8000`, healthcheck on `/health`. Lightweight (~150 MB).
- **`frontend`** — static dashboard built by Vite, served by nginx on `:8080`. Built with
  `VITE_MOCK=1` by default so it's demoable with zero backend.
- **`backend-real`** *(profile `real`)* — built from `Dockerfile.browser` (Chromium + browser-use),
  `env_file: .env`, published on host `:8001`, and configured with `LISTING_BASE_URL=http://shopee`
  so headless Chromium reaches the Shopee service over the Compose network.
- **`frontend-real`** *(profile `real`)* — dashboard built with `VITE_MOCK=0`,
  `VITE_API_BASE=http://localhost:8001`, and `VITE_WS_BASE=ws://localhost:8001`, served on `:8082`.
- **`shopee`** *(profile `real` and `shopee`)* — H2's standalone Shopee listing app, served by nginx
  on container `:80` and published on host `:5174`.

### Build-time knobs (frontend)

Vite inlines these at **build** time, so changing them needs a rebuild (`--build`), not just a restart:

| ARG | Default | Meaning |
|---|---|---|
| `VITE_MOCK` | `1` | `1` = play bundled fixture (no backend); `0` = drive the real backend |
| `VITE_API_BASE` | `http://localhost:8000` | REST base the browser calls |
| `VITE_WS_BASE` | `ws://localhost:8000` | WebSocket base the browser calls |

> These point at `localhost` because the browser runs on **your host**, reaching the published
> container ports — not the compose-internal hostnames.

For `frontend-real`, those values point to `localhost:8001` so the host browser talks to
`backend-real`.

---

## Verify it's working

```bash
curl -s localhost:8000/health            # → {"status":"ok"}
open http://localhost:8080               # dashboard auto-starts; agents move through the funnel

# backend mock API (no key):
curl -s -XPOST localhost:8000/simulation/start \
  -H 'content-type: application/json' \
  -d '{"listing_config": { ... }, "crowd": {"personas": [...], "crowd_size": 60, "speed": 1}, "mode": "mock"}'
# → {"run_id": "..."}   then GET /simulation/{run_id}/report  → ViabilityReport
```

Real profile smoke checks:

```bash
cp .env.example .env                      # set OPENAI_API_KEY
docker compose --profile real up --build
curl -s localhost:8001/health             # → {"status":"ok"}
open http://localhost:5174                # Shopee storefront, for human preview
open http://localhost:8082                # dashboard built to call backend-real
```

---

## Caveats (honest notes)

1. **Default dashboard plays a bundled fixture.** The backend is up, healthy, and reachable for
   `mock` API calls, but the live dashboard isn't *driven by* the backend unless you use the `real`
   profile (a small ~5-line frontend change could stream the backend's mock engine without Chromium —
   not included).
2. **Real-mode Shopee page is still a placeholder** in the main app (`/shopee/:id`). The real
   config-driven listing page is the separate `frontend/shopee` app, not yet integrated — so real
   browsing is packaged as a separate service for the teammate handoff.
3. **Env is baked into the frontend image at build time.** To change the API base or toggle mock,
   rebuild (`docker compose up --build`).
