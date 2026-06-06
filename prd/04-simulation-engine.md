# PRD 04 — Simulation Engine, Personas, Recommendations & API

> **Owner:** H4 (BE-Sim) · **Branch:** `h4-sim` · **Stack:** Python · FastAPI · OpenAI GPT-4o (· Claude optional)
> **Read first:** [`00-OVERVIEW.md`](00-OVERVIEW.md) — you are the **canonical owner** of most shared contracts (§5.2 personas, §5.3 AgentEvent, §5.7 API; co-own §5.4 ListingConfig).
> **Parent:** [`../PRD.md`](../PRD.md) §4, §7, §9, §10.

---

## 1. Scope (what you own)

The **brain and the spine**. Personas and their bail behavior, the orchestration
that runs a crowd of agents in parallel, the event stream every other surface
consumes, the API, and the intelligence (recommendations, improvement loop,
viability report). Crucially you own **mock/fast mode**, which lets the whole
product demo without a real browser — and lets H1 build against your events on
day 1.

You **own**:
- Persona definitions, per-stage bail probabilities, objection pools (`sim/agents.py`).
- The agent decision LLM call (GPT-4o) returning `{action, stage, objection}`.
- Orchestration / parallel runner + event queue (`sim/runner.py`).
- **Mock/fast mode** (`MockBrowserDriver`) — no browser, cached page state.
- FastAPI app: REST + WebSocket (`api/`), static mount for H3's screenshots.
- **Canonical `AgentEvent` schema** (OVERVIEW §5.3) + emission.
- Recommendation engine (`sim/recommendations.py`, GPT-4o).
- Improvement loop (`sim/loop.py`, up to 10 iterations).
- Viability report generation (`sim/report.py`).
- Fixtures: `fixtures/events.sample.jsonl`, `fixtures/report.sample.json`.

You **do NOT** own:
- Real browser navigation/screenshots → H3 ([`03`](03-browser-use-runtime.md)) (you call its `BrowserDriver`).
- The page → H2 ([`02`](02-shopee-interface.md)). The dashboard/report UI → H1/H2.

---

## 2. Dependencies

| You need | From | Until ready, build against |
|---|---|---|
| `BrowserDriver` (real mode) | H3 | **`MockBrowserDriver`** — you own it; bypasses browser entirely. Mock mode is your primary build/demo path. |
| `ListingConfig` shape + sample | H2 | Co-own the schema (OVERVIEW §5.4); use `fixtures/listing.sample.json`. |
| Screenshot static path | H3 | Agree mount path at M0 (`/static/shots`). |

| Others depend on YOU | Who | Deliver early |
|---|---|---|
| `AgentEvent` stream + `fixtures/events.sample.jsonl` | H1 | **M0/day 1** — H1's whole build unblocks on one recorded fixture. |
| REST/WS API | H1, H2 | M2. |
| `ViabilityReport`/`Recommendation` schema + `fixtures/report.sample.json` | H2 | M0 schema, M5 real data. |
| `BrowserDriver` Protocol agreement | H3 | M0. |

**Your highest-leverage day-1 deliverable: commit `fixtures/events.sample.jsonl`
and the contract types** — it unblocks H1 immediately and de-risks the demo.

---

## 3. Tech setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install fastapi "uvicorn[standard]" openai anthropic pydantic websockets
uvicorn main:app --reload          # :8000
pytest                             # tests
```

Shared `backend/requirements.txt` + `backend/contracts.py` (Pydantic mirror of
OVERVIEW §5 — you seed it; H3 imports). `.env`: `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY` (optional copy rewriting).

> **LLM note:** PRD/CLAUDE.md specify GPT-4o for agent decisions + recommendations
> and Claude (claude-sonnet-4-6) optionally for listing-copy rewriting. Keep the
> model behind a thin `llm.py` wrapper so models are swappable. If you add
> Anthropic calls, use the current SDK/model ids (don't hardcode from memory).

---

## 4. Implementation

### 4.0 File structure (`backend/`)

```
backend/
  main.py                   # FastAPI app, mounts api/, StaticFiles(/static)
  contracts.py              # Pydantic: AgentEvent, ListingConfig, Report, etc.
  llm.py                    # GPT-4o / Claude wrapper
  sim/
    agents.py               # persona defs, bail probs, objection pools
    decision.py             # per-step LLM decision -> {action,stage,objection}
    runner.py               # parallel orchestration + event queue
    mock_driver.py          # MockBrowserDriver (BrowserDriver, no browser)
    recommendations.py      # GPT-4o: results -> ranked Recommendation[]
    loop.py                 # improvement loop (<=10)
    report.py               # ViabilityReport builder
  api/
    routes.py               # POST /simulation/start, /rerun, GET .../report
    ws.py                   # WS /ws/simulation/{run_id}
  fixtures/                 # events.sample.jsonl, report.sample.json, listing...
  tests/
```

### 4.1 Personas (`sim/agents.py`) — PRD §4, OVERVIEW §5.2

Define the 7 archetypes with: `id` (PersonaId), display name pool, archetype
blurb (for the system prompt), and **per-stage bail probabilities** + **objection
line pools** (Singlish, in character). Example shape:

```python
PERSONAS: dict[PersonaId, Persona] = {
  "budget": Persona(
    id="budget", display="Budget-tight", tag="Price-first",
    blurb="You scrutinize every dollar; shipping fees enrage you.",
    bail_prob={"land":.02,"photos":.05,"reviews":.08,"price":.55,"cart":.2,"checkout":.15},
    objections={"price":["Add shipping also? Forget it.","Over budget liao, next."], ...},
  ),
  # xmm, auntie, nerd, geek, insecure, high_spender ...
}
```

Calibrate so the demo story holds (PRD §14): **Photos and Price** emerge as the
two killers; Budget-tight bails hard on a price spike; High-spender rarely bails.
Bail probability should also respond to `ListingConfig` (e.g. high price ⇒ raise
`price` bail prob; `authenticity=false` ⇒ raise Insecure's `checkout`/`reviews`
bail; low `seller.response_rate` ⇒ raise Auntie/Insecure `reviews` bail). This
config-sensitivity is what makes "Test this fix" actually move the numbers.

### 4.2 Agent decision (`sim/decision.py`) — PRD §7.1

Per gate, build the system prompt (persona blurb + listing context) and ask
GPT-4o for `{ action: "continue"|"bail"|"buy", stage, objection }` given the
`PageState.text` from the driver. Blend with the calibrated bail probability:
e.g. sample the probability for a fast/cheap baseline, and use the LLM for the
**objection wording** and edge decisions — or run full-LLM in 1× and
probability-only in 4× mock mode. Keep objections in character + Singlish.

Return type feeds the runner, which converts it into `AgentEvent`s.

### 4.3 Runner & event queue (`sim/runner.py`) — PRD §7.2

The orchestrator. For a run:
1. Build the crowd from `{personas, crowd_size}` (distribute per archetype).
2. Emit `run_started`, then per agent `agent_spawned`.
3. Run agents with bounded concurrency (mock: high; real: defer to H3's pool, 10).
4. For each agent, walk gates `land→…→checkout`:
   - `driver.goto_gate(...)` → `PageState` → `driver.screenshot()` → emit
     `stage_enter{thumbnail_url}` (+ `browser_frame` for live preview),
   - `decision()` → on `continue` advance; on `bail` emit `objection` +
     `agent_bailed` (record stage, objection, retention) and stop; on `buy`/reach
     end emit `agent_bought`.
   - Throttle by `speed` (sleep scaled by 1/2/4×).
5. Periodic `run_progress`. On completion emit `run_complete{buy_rate}` and build
   the report.

**Driver-agnostic:** the runner depends only on `BrowserDriver` (OVERVIEW §5.5).
`mode:"mock"` → `MockBrowserDriver`; `mode:"real"` → H3's `RealBrowserDriver`.
Same event output either way.

Events flow into an `asyncio.Queue` per `run_id`; the WS handler drains it. Also
support **recording** the queue to `events.sample.jsonl` (so you can produce
H1's fixture from a real mock run).

### 4.4 `MockBrowserDriver` (`sim/mock_driver.py`) — PRD §7.2 fast mode

Satisfies `BrowserDriver` with **no browser**: returns canned `PageState` per
gate derived from `ListingConfig` (text summary), `screenshot()` returns a
placeholder URL (or none → H1 uses fallback tiles). This makes 4× mode (~30s for
60 agents, PRD §7.2) and is the demo-safe path. Ship this **before** H3's real
driver exists so the whole pipeline runs.

### 4.5 API (`api/routes.py`, `api/ws.py`) — OVERVIEW §5.7

- `POST /simulation/start` → create `run_id`, kick off runner task, return id.
- `WS /ws/simulation/{run_id}` → drain the run's queue, send each `AgentEvent`
  as JSON. Handle late joiners (optionally replay buffered events).
- `GET /simulation/{run_id}/report` → `ViabilityReport`.
- `POST /simulation/{run_id}/rerun` → apply mutated `ListingConfig` (scenario),
  start a new run, return new `run_id`.
- Mount `StaticFiles` at `/static` for H3's screenshots. CORS open for the FE dev
  origin. In-memory run registry (PRD §10 storage). Traces/screens in `/tmp` per
  run.

### 4.6 Recommendations (`sim/recommendations.py`) — PRD §6.4, §8

GPT-4o reads aggregate results (per-gate bail %, per-archetype objections,
heatmap) and returns ranked `Recommendation[]`:

```python
class Recommendation(BaseModel):
    id: str
    field: str                 # Photos|Price|Reviews|Description|Authenticity|Title|...
    issue: str                 # diagnosis w/ numbers ("38% of Auntie+Insecure bailed at Reviews; response rate 0%")
    fix: str                   # actionable
    impact_estimate: str       # "+6–9% buy rate"
    affected_archetypes: list[PersonaId]
    config_patch: dict         # the ListingConfig mutation "Test this fix" applies
```

`config_patch` is what makes the scenario loop work: H2 applies it, re-renders,
and `/rerun` runs again. Target the PRD §8 levers. Must produce ≥3 distinct,
specific fixes (PRD §13).

### 4.7 Improvement loop (`sim/loop.py`) — PRD §3, §7.3

```python
for i in range(10):
    results = await run_simulation(listing_config, crowd)
    if results.buy_rate >= target or results.delta < threshold: break
    recs = analyze(results)
    listing_config = apply_top(listing_config, recs)   # uses config_patch
```

Each iteration records: buy rate, delta vs previous, fix applied, archetype that
moved most. Surface this for the before/after story (nice-to-have UI in H2).

### 4.8 Viability report (`sim/report.py`) — PRD §9

Build `ViabilityReport` (canonical schema — H2 renders it):

```python
class ViabilityReport(BaseModel):
    run_id: str
    market_fit_score: int                 # 0..100
    recommended_price: float
    go_no_go: dict                         # {decision:"go"|"no_go", confidence: float}
    funnel: list[dict]                     # {stage, entered, bailed, bail_rate}
    archetypes: list[dict]                 # {archetype, agents, bought, bailed, buy_rate, avg_retention_s, top_objection}
    objection_heatmap: list[dict]         # {field, bail_count}
    risk_archetypes: list[PersonaId]
    recommendations: list[Recommendation]
    agents: list[AgentTrace]              # full per-agent trace (PRD §7.4)
```

`AgentTrace` per PRD §7.4: `{agent_id,name,archetype,outcome,bail_stage,objection,
retention_time_s, stage_trace:[{stage,time_s,screenshot_url}]}`. Commit a filled
`fixtures/report.sample.json` for H2.

---

## 5. Definition of done

- [ ] 7 personas with calibrated per-stage bail probs + Singlish objection pools;
      config-sensitive (price/authenticity/response-rate move the numbers).
- [ ] `fixtures/events.sample.jsonl` committed **day 1** (unblocks H1).
- [ ] Mock mode runs a full crowd, streams valid `AgentEvent`s end-to-end to H1 (M2).
- [ ] FastAPI REST + WS live per OVERVIEW §5.7; static mount for screenshots.
- [ ] Runner is driver-agnostic; swaps to H3's real driver with no logic change (M4).
- [ ] Recommendation engine returns ≥3 specific, ranked fixes with `config_patch`.
- [ ] `/rerun` scenario works; buy rate responds to price change in <1s (mock, PRD §13).
- [ ] Viability report generated; `fixtures/report.sample.json` committed for H2.
- [ ] `pytest` green for personas, runner event shape, report builder.

## 6. Demo beats you enable (PRD §14)

The engine behind every beat: dots flow (your events), price spike tanks buy rate
(config-sensitive bail), Singlish objections (your pools), Photos/Price as killers
(your calibration), AI recommends + re-run delta (your recs + loop). Mock mode is
what keeps the live demo under the <5 min / <1s targets (PRD §13).
