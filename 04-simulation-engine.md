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
- The deterministic agent decision engine: seeded, config-sensitive bail model,
  with LLM/persona text used only for objection wording and recommendations.
- Orchestration / parallel runner + event buffer/subscriber stream (`sim/runner.py`).
- **Mock/fast mode** (`MockBrowserDriver`) — no browser, cached page state.
- FastAPI app: REST + WebSocket (`api/`), static mount for H3's screenshots.
- **Canonical `AgentEvent` schema** (OVERVIEW §5.3) + emission.
- Recommendation engine (`sim/recommendations.py`, GPT-4o).
- Improvement loop (`sim/loop.py`, up to 3 iterations).
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

> **LLM note:** For the demo build, the probability engine is authoritative for
> agent actions. GPT-4o is used for recommendation cards and optional objection
> wording polish. Claude copy rewriting stays out of H4 scope unless time remains.
> Keep model calls behind a thin `llm.py` wrapper so they are easy to disable,
> mock, or swap.

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
    decision.py             # deterministic seeded action + objection selection
    runner.py               # orchestration + event buffer/subscriber stream
    mock_driver.py          # MockBrowserDriver (BrowserDriver, no browser)
    recommendations.py      # GPT-4o: results -> ranked Recommendation[]
    loop.py                 # improvement loop (<=3)
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

The calibrated probability engine is the **authoritative** decision-maker for
`continue` / `bail` / `buy`.

For each run, store:
- `seed`
- fixed agent cohort (`agent_id`, persona, name)
- stable per-agent, per-stage random thresholds
- optional `parent_run_id` for scenario reruns

For each gate, compute the effective bail probability from:
- persona base probability,
- `ListingConfig` signals (price, shipping, photo mix, rating count, seller
  response rate, authenticity fields),
- scenario changes from a recommendation patch or price slider.

Then compare the stage threshold with the effective probability. The threshold
does not change across reruns; only the listing-derived probability changes.
This makes before/after deltas attributable to the listing change rather than
random noise.

LLM usage is deliberately narrow:
- Use local objection pools by default.
- Optionally ask GPT-4o to polish or diversify objection text.
- Do **not** let the LLM override the action in mock mode.
- A single real-browser showcase agent may use full LLM decisioning if H3/H4 want
  a narrative demo, but it is not the source of truth for aggregate metrics.

Return type feeds the runner, which converts decisions into `AgentEvent`s and
updates the internal run state.

### 4.3 Runner, run state & event stream (`sim/runner.py`) — PRD §7.2

The orchestrator. For a run:
1. Build or reuse the cohort from `{personas, crowd_size, seed}`. A baseline run
   creates the cohort and thresholds; a scenario rerun reuses them from
   `parent_run_id`.
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

Keep a single internal `RunState` as the source of truth for reports and
analytics. The WebSocket event stream is a presentation log, not the report data
source.

Events are stored in an append-only buffer per `run_id`. Each WebSocket
connection gets its own subscriber queue:
- On connect, replay buffered events from the start.
- Then stream live events.
- Reconnects and late joins must still receive `run_started` and all prior
  `agent_spawned` events.

Fixtures are recorded from the event buffer into `events.sample.jsonl`.

### 4.4 `MockBrowserDriver` (`sim/mock_driver.py`) — PRD §7.2 fast mode

Satisfies `BrowserDriver` with **no browser**: returns canned `PageState` per
gate derived from `ListingConfig` (text summary), `screenshot()` returns a
placeholder URL (or none → H1 uses fallback tiles). This makes 4× mode (~30s for
60 agents, PRD §7.2) and is the demo-safe path. Ship this **before** H3's real
driver exists so the whole pipeline runs.

### 4.5 API (`api/routes.py`, `api/ws.py`) — OVERVIEW §5.7

- `POST /simulation/start` → create `run_id`, store `seed`, build cohort, kick
  off runner task, return `{run_id, seed}`.
- `WS /ws/simulation/{run_id}` → replay buffered events, then stream live
  `AgentEvent`s as JSON from this connection's subscriber queue.
- `GET /simulation/{run_id}/report` → `ViabilityReport`.
- `POST /simulation/{run_id}/rerun` → apply a validated scenario patch or full
  mutated `ListingConfig`, reuse the original cohort/thresholds, set
  `parent_run_id`, start a new run, return `{run_id, seed, parent_run_id}`.
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
    config_patch: list[dict]   # JSON Patch ops for "Test this fix"
```

`config_patch` is what makes the scenario loop work. Use JSON Patch-style ops:

```json
[
  { "op": "replace", "path": "/price", "value": 29.9 },
  { "op": "replace", "path": "/authenticity/certificate", "value": true }
]
```

Before `/rerun` starts, apply the patch and validate the resulting
`ListingConfig` with Pydantic. Invalid patches return `422` and do not start a
run. Target the PRD §8 levers. Must produce ≥3 distinct, specific fixes
(PRD §13).

### 4.7 Improvement loop (`sim/loop.py`) — PRD §3, §7.3

```python
for i in range(3):
    results = await run_simulation(listing_config, crowd)
    if results.buy_rate >= target or results.delta < threshold: break
    recs = analyze(results)
    listing_config = apply_top(listing_config, recs)   # uses config_patch
```

Each iteration records: buy rate, delta vs previous, fix applied, archetype that
moved most. Surface this for the before/after story (nice-to-have UI in H2).

For demo day, prioritize the manual scenario path:
`baseline run → choose recommendation → deterministic rerun → show delta`.
The automated loop is a reuse of that path, capped at 3 iterations.

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

Build the report from internal `RunState`, not by replaying WebSocket events.
Events may be optimized for UI display; the report needs complete traces,
thresholds, probabilities, applied patches, and aggregate calculations.

---

## 5. Definition of done

- [ ] 7 personas with calibrated per-stage bail probs + Singlish objection pools;
      config-sensitive (price/authenticity/response-rate move the numbers).
- [ ] Deterministic seeded decision engine; reruns preserve cohort and per-stage
      thresholds.
- [ ] `fixtures/events.sample.jsonl` committed **day 1** (unblocks H1).
- [ ] Mock mode runs a full crowd, streams valid `AgentEvent`s end-to-end to H1 (M2).
- [ ] Event buffer + per-connection subscriber queues support late join/reconnect.
- [ ] FastAPI REST + WS live per OVERVIEW §5.7; static mount for screenshots.
- [ ] Runner is driver-agnostic; swaps to H3's real driver with no logic change (M4).
- [ ] Recommendation engine returns ≥3 specific, ranked fixes with validated JSON
      Patch `config_patch`.
- [ ] `/rerun` scenario works; buy rate responds to price change in <1s (mock, PRD §13).
- [ ] Viability report generated; `fixtures/report.sample.json` committed for H2.
- [ ] `pytest` green for personas, runner event shape, report builder.

### Demo-day core

Ship this before polishing architecture:
1. Deterministic mock runner.
2. Seven personas with config-sensitive bail model.
3. Event replay buffer + WS stream.
4. Start/report/rerun REST endpoints.
5. Polished fixtures (`events.sample.jsonl`, `report.sample.json`,
   `listing.sample.json`) that tell the Photos/Price demo story.
6. Rule-based report builder.
7. Three ranked recommendations with validated patches.
8. One deterministic rerun delta.

Below the line for demo day:
- Full LLM per-step decisions.
- 60 real browser sessions.
- Automated multi-iteration loop beyond the manual recommendation rerun.
- Claude listing-copy rewriting.

## 6. Demo beats you enable (PRD §14)

The engine behind every beat: dots flow (your events), price spike tanks buy rate
(config-sensitive bail), Singlish objections (your pools), Photos/Price as killers
(your calibration), AI recommends + re-run delta (your recs + loop). Mock mode is
what keeps the live demo under the <5 min / <1s targets (PRD §13).
