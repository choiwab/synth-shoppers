# Running Synthetic Shoppers with Docker

One command starts the full three-service stack:

```bash
docker compose up --build
```

Services:

- Dashboard frontend: http://localhost:5175
- Backend API/WebSocket: http://localhost:8000
- Shopee frontend: http://localhost:5174

The dashboard does not use frontend fixtures. Press **Run agents** in the left rail; the dashboard calls the backend, the backend opens the Shopee service from inside Docker, captures screenshots, and streams agent events back over WebSocket.

## Service Wiring

```text
host browser
  -> http://localhost:5175 dashboard
  -> http://localhost:8000 REST + ws://localhost:8000 WebSocket
  -> backend container
  -> headless Chromium / Playwright
  -> http://shopee/shopee/:id?config=...
```

`http://shopee` is the Compose-internal hostname for the Shopee frontend container. The public host preview remains http://localhost:5174.

## Environment

The default stack uses the reliable screenshot-producing browser path and does not require OpenAI. If you later want to test autonomous `browser-use`, set:

```bash
BROWSER_USE_AUTONOMOUS=1
OPENAI_API_KEY=...
```

You can place those in `backend/.env` or root `.env`; compose reads both if present.

## Useful Commands

```bash
docker compose up --build
docker compose down
docker compose logs -f backend
curl http://localhost:8000/health
```
