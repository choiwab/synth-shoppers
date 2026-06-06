# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Synthetic Shoppers** — an AI Focus Group for Online Listings. A hackathon project that simulates Singapore buyer archetypes browsing a Shopee listing, producing a decision trace (bought/bailed, funnel stage, objection) and actionable listing recommendations.

**Target:** Shopee Singapore · **Product under test:** Matin Kim Beanie · **Track:** AI-Native Products & Operations

## Team Structure

| Owner | Role | Branch | Stack |
|---|---|---|---|
| **H1** | FE-Dashboard (live monitor) | `h1-dashboard` | React/TS, Tailwind, shadcn/ui |
| **H2** | FE-Shopee listing + Reporting | `h2-shopee` | React/TS |
| **H3** | BE-Browser (Playwright runtime) | `h3-browser` | Python, browser-use |
| **H4** | BE-Sim (engine + API) | `h4-sim` | Python, FastAPI, GPT-4o |

H1+H2 = interface people. H3+H4 = agent/browser people.

## Architecture

```
H1 Dashboard ──consumes──► WS /ws/simulation/{run_id} ──◄── H4 Sim Engine + API
                                                         │
H2 Shopee page ◄──driven by── H3 browser-use ◄──────────┘
H2 Reporting ◄──consumes── REST /simulation/{run_id}/report
```

Two execution modes producing identical `AgentEvent` streams:
- **Mock/fast mode** (no browser, LLM-only or scripted decisions over cached page state)
- **Real mode** (H4 runner → H3's BrowserDriver → H2's Shopee page in Playwright)

## Planned Repo Layout

```
frontend/          # H1 + H2 (React/TS)
  src/types/contracts.ts   # shared TS types from §5 contracts
backend/           # H3 + H4 (Python)
  contracts.py             # Pydantic mirror of shared contracts
  main.py                  # FastAPI app
  sim/                     # H4: agents, runner, mock_driver, recommendations, loop, report
  api/                     # H4: REST routes + WebSocket handler
  llm.py                   # GPT-4o / Claude wrapper
fixtures/          # cross-team sample data
  events.sample.jsonl      # recorded AgentEvent stream (H4 → H1)
  report.sample.json       # sample ViabilityReport (H4 → H2)
  listing.sample.json      # sample ListingConfig (H2 ships)
prds/              # this folder — planning documents
```

Branching: one branch per PRD (`h1-dashboard`, `h2-shopee`, `h3-browser`, `h4-sim`).

## Tech Stack & Running

**Backend:** `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn main:app --reload` (port 8000)
**Frontend:** React + TS + Tailwind + shadcn/ui → Vercel
**Tests:** `pytest` in backend

**LLMs:** GPT-4o for agent decisions + recommendations. Claude claude-sonnet-4-6 optional for listing copy rewriting. Access via a thin `llm.py` wrapper — models must be swappable.
**Env:** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` in `backend/.env`. Never commit keys.

## Shared Contracts (Single Source of Truth)

All cross-team interfaces are defined in `00-OVERVIEW.md` §5. **If a schema changes, change it there first, then ping consumers.** Code against the contract, not against another person's implementation.

### Key Types

- **`FunnelStage`**: `"land" | "photos" | "reviews" | "price" | "cart" | "checkout" | "bought" | "bailed"` — gate order is fixed.
- **`PersonaId`**: `"xmm" | "auntie" | "nerd" | "geek" | "insecure" | "budget" | "high_spender"` — 7 Singapore buyer archetypes.
- **`AgentEvent`**: discriminated union on `type` (`run_started`, `agent_spawned`, `stage_enter`, `browser_frame`, `objection`, `agent_bailed`, `agent_bought`, `run_progress`, `run_complete`). Streamed over WS, newline-delimited in fixtures.
- **`ListingConfig`**: full listing state (title, seller, price, variants, photos, reviews, authenticity, etc.) — co-owned by H2 (renders) + H4 (mutates via recommendation engine).
- **`BrowserDriver`** (Python Protocol): `open`, `goto_gate`, `act`, `screenshot`, `close` — owner H3, consumer H4.
- **`ViabilityReport`**: `market_fit_score`, `recommended_price`, `go_no_go`, funnel breakdown, archetype stats, `risk_archetypes`, `recommendations[]`, `agents[]` (full trace per PRD §7.4).
- **`Recommendation`**: `field`, `issue`, `fix`, `impact_estimate`, `affected_archetypes`, `config_patch` (the mutation "Test this fix" applies).

### API Endpoints

```
POST /simulation/start   → { run_id }
WS   /ws/simulation/{run_id}  → stream of AgentEvent
GET  /simulation/{run_id}/report  → ViabilityReport
POST /simulation/{run_id}/rerun   → { run_id }  (new run)
```

### Shopee DOM Selectors

H2's page uses `data-gate`, `data-action`, `data-field` attributes for H3's browser automation. See `00-OVERVIEW.md` §5.6 for the full selector table.

## Design System

- **Theme:** warm dark mode with oklch color tokens defined in `PRD (2).md` §11
- **Archetype colors:** oklch(0.74 0.135 `<hue>`) — hues: xmm=10, auntie=75, nerd=175, geek=300, insecure=250, budget=145, high_spender=40
- **Typography:** Bricolage Grotesque (display/numbers), Hanken Grotesk (UI/body), Space Mono (labels/mono)
- **Layout:** header / agent-strip / (funnel-track | right-rail). Right rail 350px fixed.

## Calibration Requirements

Bail probabilities must be config-sensitive so the demo story holds:
- High price → raise `price` bail prob
- `authenticity=false` → raise Insecure's `checkout`/`reviews` bail
- Low `seller.response_rate` → raise Auntie/Insecure `reviews` bail
- **Photos and Price** should emerge as the two biggest killers
- Budget-tight bails hard on price spikes; High-spender rarely bails
- Target: simulation completes in <5 min demo, re-sim in <1s (mock mode)

## Unblocking Strategy

Every cross-team dependency has a stub/mock — no one is hard-blocked:
- H1 uses **fixture event player** (JSON replayed over fake WS) until H4 ships real events
- H1 uses **fallback tiles** (archetype color + stage text) until H3 ships thumbnails
- H3 uses **stub page** (`shopee-stub.html` with `data-gate`/`data-action` attrs) until H2's real page
- H4 uses **MockBrowserDriver** until H3's real driver

Integration milestones: M0 (contracts frozen) → M1 (dashboard+fixtures) → M2 (mock mode E2E) → M3 (real Shopee page+browser) → M4 (real mode E2E) → M5 (reporting+recs) → M6 (polish)
