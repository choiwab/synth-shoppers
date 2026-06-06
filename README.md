# Synthetic Shoppers

AI shoppers browse a Shopee-style listing, react like real buyer personas, and produce a visual viability report.

Built for fast product validation: tweak the listing, run agents, watch where they hesitate, then inspect the report for conversion risk, objections, screenshots, and per-persona lift.

## Why It Exists

Most listing feedback arrives after launch, when the cost of being wrong is already paid. Synthetic Shoppers lets a team test a product page before launch by sending a small panel of persona-driven agents through the same browsing path a buyer would take.

The result is not just a score. It shows where agents dropped, what they objected to, which personas were lost, and which listing tweaks are most likely to improve conversion.

## Run

```bash
docker compose up --build
```

- Dashboard: http://localhost:5175
- Shopee listing: http://localhost:5174
- Backend API: http://localhost:8000

The Docker stack runs three services: the live dashboard, the Shopee storefront, and the FastAPI simulation backend. The backend drives the storefront, captures screenshots, streams events to the dashboard, and generates the final report.

## Demo Flow

1. Open the dashboard.
2. Click **Run agents**.
3. Watch synthetic shoppers move through the funnel.
4. Use **Tweaks** to change price, title, description, shipping, trust signals, ratings, and variants.
5. Click **View report** after the run completes.

## What You Get

- Live funnel monitor with agent previews.
- Configurable listing experiments.
- Screenshot-backed agent traces for every run.
- Visual report with buy rate, read rate, engagement, drop-offs, objections, persona conversion, and recommendations.
- Control vs rerun uplift metrics for tested changes.

## Report Outputs

- **Run snapshot:** buy rate, buyers, bails, orders, and trace coverage.
- **Funnel drop-off:** where agents leave the listing.
- **Objection heatmap:** which listing areas caused the most friction.
- **Persona conversion:** who buys, who hesitates, and who never converts.
- **Agent trace cards:** stage path, timing, screenshots, comments, and final reason.
- **Recommendations:** prioritized fixes with config patches for reruns.

## Stack

- React dashboards and Shopee storefront.
- FastAPI simulation engine.
- Docker Compose for the full local demo.
- Browser-driven agents with mock fallback.

## Useful Commands

```bash
docker compose up --build
docker compose logs -f backend
curl http://localhost:8000/health
```

For detailed Docker notes, see `DOCKER.md`.
