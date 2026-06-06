# Synthetic Shoppers — Browser-Use Agent & Simulation Engine

Handoff doc for the `backend/`. Covers what the browser-use shopper agent can do **today**:
the pages it drives, its chain-of-thought + reasoning capture, dropout mechanics, and every metric
the sim emits (including the control-vs-treatment uplift engine).

> Status: backend implemented, **21/21 unit tests passing** (`pytest`). Real mode (GPT-4o + Chromium)
> is coded to the browser-use 0.9.x API but has **not been run end-to-end yet** — see [Caveats](#caveats).

---

## 1. What the agent is (one paragraph)

Each synthetic shopper is **one autonomous `browser_use.Agent` (GPT-4o), one per persona, one
isolated headless browser**. It is **not** a scripted walk: the LLM, conditioned on a persona, decides
what to do next from a **fixed menu of funnel tools** and decides for itself whether to buy or bail.
Every tool clicks a stable `data-action` selector, screenshots, and **emits a live event**, so the
dashboard updates as the agent moves. The whole design lives in
[`sim/browser_use_driver.py`](sim/browser_use_driver.py).

```
persona ──▶ Agent(task + extend_system_message, llm=gpt-4o, tools=funnel)
              │  loops up to max_steps=15
              ▼
   look_at_photos → read_reviews → check_price → add_to_cart → checkout
                              │                                    │
                          bail(...)                        confirm_purchase(...)
              each tool: click [data-action] · screenshot · emit AgentEvent(s)
```

---

## 2. File map

| File | Responsibility |
|---|---|
| `sim/browser_use_driver.py` | **The agent.** Builds the persona prompt, the constrained tools, captures CoT + sentiment, screenshots, emits events. |
| `sim/agents.py` | The **7 personas** — blurb, names, per-stage bail probabilities, objection pools. |
| `sim/runner.py` | **Orchestrator.** Builds the cohort, runs agents (10 concurrent real / 50 mock), streams events, builds the report. Also the **mock gate-stepping** path. |
| `sim/decision.py` | Mock-mode probabilistic bail logic + synthetic sentiment/comment/reason stand-ins. |
| `sim/mock_driver.py` | No-browser, no-LLM driver (fast demo/offline). |
| `sim/report.py` | Aggregates traces → `ViabilityReport` (funnel, archetypes, sentiment arc, comments, diagnostics, dropoff distribution, recommendations). |
| `sim/uplift.py` | **Control-vs-treatment uplift engine** (`compute_uplift`). |
| `sim/recommendations.py` | The 3 ranked fix cards + their `config_patch` and targeted `field`. |
| `sim/screenshots.py` | Crop/resize viewport shot → 160×120 JPEG under `/tmp/shots`, served at `/static/shots/...`. |
| `contracts.py` | **All shared schemas** (Pydantic): events, `ListingConfig`, `AgentTrace`, `ViabilityReport`, `UpliftReport`. Mirrored in `frontend/src/types/contracts.ts`. |
| `api/routes.py` · `api/ws.py` · `main.py` | FastAPI: REST + WebSocket. |
| `demo/single_agent_demo.py` · `demo/stub/index.html` | One real agent against a self-contained stub page; prints events. |

---

## 3. Pages the agent drives

The agent navigates **by stable selectors only** (OVERVIEW §5.6), never free-clicking. A page is
"drivable" if it exposes this contract:

- **Root:** `data-listing-id="<slug>"`
- **Gates (sections):** `data-gate="land|photos|reviews|price|cart|checkout"`
- **Actions (buttons):** `data-action="scroll-gallery|open-reviews|select-variant|add-to-cart|checkout|confirm-order"`
- **Fields (text):** `data-field="title|price|rating|review-count|seller-name|…"`

The driver builds the URL in `run_journey` → `_page_url`:

```python
url = f"{self.base_url}/shopee/{slug}?config=<base64(ListingConfig)>"   # base_url = $LISTING_BASE_URL
```

It drives the **real React page** at `/shopee/:id`, passing the live config so the page renders exactly
what's being simulated (and so mutated "Test this fix" reruns render). **Playwright-verified end-to-end**
(`scripts/driver_path_check.py`, 9/9, no LLM): the URL lands on the product page, `?config=` injection
renders (tested with a mutated price), every `data-action` clicks, and the multi-page
**`/cart → /checkout → /order-confirmed`** hops work — the `checkout` gate clicks the cart icon
(`a[href="/cart"]`, see `GATE_NAV`) to reach `/cart` first, then `data-action="checkout"`.

> Point `LISTING_BASE_URL` at the frontend (e.g. `http://localhost:5173`). The bundled stub
> ([`demo/stub/index.html`](demo/stub/index.html)) — a deliberately "deck-stacked" single-page listing —
> remains as the `:8080` default for the single-agent demo when `LISTING_BASE_URL` is unset.

### What the agent actually "sees"
1. **Config facts** (text in the task prompt) — price vs base, photo counts by type, rating, seller
   verified/response-rate, authenticity flags. *This is the agent's ground truth.*
2. **Per-gate summaries** returned by each tool (also computed from the config).
3. **The rendered page** — browser-use feeds a screenshot (vision = ground truth for reasoning), so
   visual quality conditions persona judgment. (Confirm `use_vision` on first real run.)

---

## 3.1 End-to-end: browse · click · scroll · back (VERIFIED)

The agent can **see what's on a screen, click any button/link, scroll, and go back** — the whole
shopper journey, not just the single-listing funnel. Proven by replaying browser-use's exact
perceive→decide→act loop with Playwright (the same engine it drives under the hood) in
[`scripts/agent_sim.py`](scripts/agent_sim.py): **15/15 steps, 0 console errors.**

**How each capability maps to browser-use (doc-confirmed 0.9.x API):**
- **"See the buttons"** — browser-use hands the LLM the page's interactive elements (links, buttons,
  `[data-action]`, inputs) + a screenshot each step. The harness prints that same list per screen, so
  you can see exactly what the agent perceives.
- **Click** — `page = await browser_session.must_get_current_page()` →
  `await page.get_elements_by_css_selector(sel)` → `elements[0].click()`. The driver clicks the
  `[data-action="…"]` hooks (and the cart link `a[href="/cart"]` for the checkout hop).
- **Scroll** — page + gallery scroll (verified `scrollY 93 → 1493`).
- **Back** — `page.go_back()` returns to the previous route (search → product → back to search).

**The verified journey:**

| step | action | result |
|---|---|---|
| home | type "beanie", click Search | → `/search` |
| search | click a product card | → `/shopee/:id` (funnel hooks visible) |
| product | scroll-gallery / open-reviews / select-variant | gates interact |
| product | scroll | page scrolls |
| product | **go back** | → `/search` |
| search | open a *different* listing | → `/shopee/:other` |
| product | add-to-cart | cart badge updates |
| cart | checkout | → `/checkout` |
| checkout | place order | → `/order-confirmed` |

**Re-run anytime** (frontend must be running):
```bash
FRONTEND_BASE=http://localhost:5173 .venv/bin/python scripts/agent_sim.py          # 15/15 full journey
FRONTEND_BASE=http://localhost:5173 .venv/bin/python scripts/driver_path_check.py  # 9/9 driver funnel + ?config=
```

**Notes for whoever picks this up:**
- The **frontend needed zero changes** — every screen already exposes clickable links / `data-action`
  hooks, and standard React-Router anchors make navigation (incl. browser-back) just work.
- The **driver** was updated to (a) open `/shopee/{slug}?config=<b64>` and (b) hop to `/cart` before the
  checkout click (`GATE_NAV`). That's it — those two changes make the real funnel reach order-confirmed.
- `select-variant` renders 4× (one per colour); the driver clicks `elements[0]`, which is correct.
- Still unverified: the **LLM actually choosing** the clicks (needs `OPENAI_API_KEY` + a real run) — the
  *mechanics* above are all proven; what's left is the model's decisions. See [Caveats](#caveats).

---

## 4. Reasoning capture — two layers

The agent **reasons every step**; we capture it on two complementary tracks.

### Layer 1 — native chain-of-thought (the agent's own reasoning)
An `on_step_end` hook (`_on_step`) reads browser-use's `agent.history.model_thoughts()` after each
step and emits an **`agent_thought`** event per new step:

```jsonc
{ "type": "agent_thought", "agent_id": "budget_1", "stage": "photos",
  "thinking": "These photos look cheap, not feeling it.",
  "evaluation": "Opened the gallery.", "next_goal": "Read the reviews next." }
```

The persona is also injected into the **system** prompt (`extend_system_message`), so this raw CoT
reads in-character, not like a generic web bot. (Real mode only; it's free — already generated.)

### Layer 2 — elicited per-stage sentiment (the consumer-insight track)
Every funnel tool **forces** an in-character reaction + a sentiment label, so we capture *what the
shopper thinks/feels at each gate* — for buyers and bailers alike:

```python
look_at_photos(reaction: str, sentiment: love|like|neutral|dislike|reject)   # same for read_reviews,
                                                                              # check_price, add_to_cart, checkout
confirm_purchase(reason: str)            # why a buyer committed  → AgentTrace.purchase_reason
bail(objection: str, reason_category)    # why they left          → AgentTrace.bail_reason
```

Each emits a **`stage_sentiment`** event and writes `sentiment`+`comment` onto that gate's
`StageTrace`. Sentiment → score for aggregation: `love 1 · like .5 · neutral 0 · dislike −.5 · reject −1`.

**Reason categories** (for dropout analytics): `price_value · trust_authenticity · visual_photos ·
social_proof_reviews · shipping · other`. The LLM picks one on `bail`; falls back to a
stage-derived default (`REASON_BY_STAGE`).

> Mock mode synthesizes the same `sentiment`/`comment`/`reason`/`purchase_reason` shape deterministically
> (no LLM), so the dashboard/report work offline. Layer-1 `agent_thought` is real-mode only.

---

## 5. The 7 personas (`sim/agents.py`)

| id | display · tag | cares about / bails when… | hot gates |
|---|---|---|---|
| `xmm` | XMM · Trend-led | vibe, lifestyle photos, social proof | photos, reviews |
| `auntie` | Auntie · Value & trust | seller trust, value, proof | price, reviews |
| `nerd` | Nerd · Spec-rational | specs, ratings, price-to-performance | price, reviews |
| `geek` | Geek · Enthusiast | close-ups, variants, authenticity | photos, price |
| `insecure` | Insecure · Scam-wary | fakes, checkout safety, trust signals | checkout, reviews |
| `budget` | Budget-tight · Price-first | price spikes, shipping fees, cart total | price |
| `high_spender` | High-spender · Convenience | rarely bails unless trust is bad | (few) |

Each has a `blurb` (drives the prompt + CoT), 4 names, an objection pool, and per-stage bail
probabilities (mock mode).

---

## 6. Dropout mechanics

The funnel is fixed: `land → photos → reviews → price → cart → checkout → bought | bailed`.

- **Real mode:** the LLM bails *in character* the moment something puts it off, via
  `bail(objection, reason_category)`. The trace records `outcome="bailed"`, `bail_stage`,
  `objection` (free text), `bail_reason` (category). A crash or running out of `max_steps`
  degrades to a clean bail.
- **Mock mode:** `decision.decide()` compares a per-agent stable threshold (seeded) against a
  **config-sensitive** bail probability — e.g. budget gets `+0.60 × (price/base − 1)` at the price
  gate, insecure `+0.25` at checkout with zero authenticity. This is the *spec* of expected behavior
  and makes reruns move predictably.
- Either way the dropout surfaces as: `objection` event + `agent_bailed` event (now carrying
  `reason_category`) + `stage_sentiment`(reject).

---

## 7. Events emitted (the live log)

Union in `contracts.py` (`AgentEvent`), streamed over WS and buffered on the run. **Bold = added by
the reasoning upgrade.**

| event | when | key fields |
|---|---|---|
| `run_started` / `run_progress` / `run_complete` | run lifecycle | totals, buy_rate |
| `agent_spawned` | per agent | agent_id, name, archetype |
| `stage_enter` | enters a gate | stage, thumbnail_url |
| `browser_frame` | screenshot ready | thumbnail_url, scroll_pct |
| **`agent_thought`** | each step (real) | thinking, evaluation, next_goal, stage |
| **`stage_sentiment`** | per gate | sentiment, comment, stage |
| `objection` | on bail | stage, text |
| `agent_bailed` | on bail | stage, objection, **reason_category**, retention_time_s |
| `agent_bought` | on buy | retention_time_s |

---

## 8. Metrics we emit (this is the point)

### 8a. Per-run report (`ViabilityReport`, built by `sim/report.py`)
- `funnel` — per stage: entered / bailed / bail_rate.
- `archetypes` — per persona: agents, bought, bailed, buy_rate, avg_retention, top_objection,
  **`sentiment_arc`** (avg sentiment per gate — *where* each persona sours).
- `objection_heatmap` — bails per listing field.
- **`dropoff_reasons`** — share bailed per reason category (the dropoff-reason distribution).
- **`diagnostics`** — `review_read_rate` (entered reviews ÷ landed), `engagement_rate` (reached the
  price gate ÷ landed), `click_rate` = **null** (honest — needs the Tier-2 impression stage, not faked).
- **`comments`** — the "what they said" feed: `{archetype, stage, sentiment, comment}` per agent.
- **`purchase_reasons`** — why buyers bought.
- `recommendations` — 3 ranked fixes, each with a `config_patch` + targeted `field`.
- `market_fit_score`, `go_no_go`, `risk_archetypes`.

### 8b. Uplift — control vs treatment (`sim/uplift.py`, `GET /simulation/{id}/uplift`)
Because a **rerun reuses the parent's cohort + seed**, the same agents face both listings → matched
1:1 by `agent_id` → uplift is **exact, not estimated**. `compute_uplift(control, treatment)` returns
an `UpliftReport`:

- **`buyer_uplift`** / **`order_uplift`** — `{control, treatment, delta, delta_pp}` (orders == buyers
  until carts hold multiples).
- **`per_persona`** — per-archetype buy-rate before→after + verdict (win/loss/flat).
- **`funnel_delta`** — per-stage entered/bail-rate change.
- **`objection_resolution`** — for each recommendation `field`: of control agents who bailed for that
  reason, the share that **no longer** do in treatment (`{field, targeted, resolved, rate}`).
- `dropoff_reasons_control/treatment`.

### 8c. North-star mapping
| Your metric | Where | Status |
|---|---|---|
| Buyer uplift, Order uplift | `UpliftReport.buyer_uplift / order_uplift` | ✅ |
| Per-persona uplift | `UpliftReport.per_persona` | ✅ |
| Dropoff-reason distribution | `report.dropoff_reasons` | ✅ |
| Objection-resolution rate | `UpliftReport.objection_resolution` | ✅ |
| Read rate / Engagement rate | `report.diagnostics` | ✅ |
| Click rate / CTR | `report.diagnostics.click_rate` = null | ⏳ Tier 2 (needs impression→click pre-stage on the real page) |
| Description-read, scroll/zoom engagement | — | ⏳ Tier 2 |
| Average basket cost | — | ⏳ Tier 3 (needs multi-item cart / cross-sell) |

### 8d. Example output (mock, 35 agents, price→base + free shipping fix)
```
DIAGNOSTICS (control): {review_read_rate: 0.743, engagement_rate: 0.457, click_rate: None}
DROPOFF: price_value 34.5% · social_proof_reviews 34.5% · visual_photos 31%
BUDGET sentiment arc: land +0.5 → photos 0.0 → reviews −0.2 → price −1.0   (sours at price)

UPLIFT: buyer_uplift {control: 6, treatment: 10, delta: +4, delta_pp: +11.43}
  budget       0.00 → 0.40  (+40pp) win
  high_spender 0.60 → 0.80  (+20pp) win
  nerd         0.40 → 0.60  (+20pp) win
  (xmm/auntie/insecure/geek flat — the fix was price-only)
objection_resolution: Price 5/10 resolved (0.50) · Photos 0/9 · Authenticity n/a
```

---

## 9. API

| method · path | does |
|---|---|
| `POST /simulation/start` | body `{listing_config, crowd, mode: "mock"|"real"}` → `{run_id, seed}` |
| `GET  /simulation/{run_id}/report` | `ViabilityReport` (202 until ready) |
| `POST /simulation/{run_id}/rerun` | apply `listing_config` or `config_patch` → new run (reuses cohort+seed) |
| `GET  /simulation/{run_id}/uplift` | `UpliftReport` vs the run's parent (400 if no parent, 202 if not ready) |
| `WS   /ws/simulation/{run_id}` | newline-delimited `AgentEvent` stream, ends with `null` |
| `GET  /static/shots/<agent>/<gate>.jpg` | agent screenshots |

---

## 10. Running it

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt            # mock mode + tests
pytest -q                                  # 21 passing

# Real mode (autonomous GPT-4o agents):
pip install -r requirements-browser-use.txt
playwright install chromium
cp .env.example .env                        # set OPENAI_API_KEY (+ optional LISTING_BASE_URL)

# Watch one real agent (headed) against the stub:
python demo/single_agent_demo.py budget     # prints agent_thought / stage_sentiment / bail per gate

# Or the server:
uvicorn main:app --port 8000
```

**Integration verification (no LLM, against the real frontend):**
```bash
# with the frontend running (e.g. npm run dev), point the harness at it:
FRONTEND_BASE=http://localhost:5173 .venv/bin/python scripts/agent_sim.py          # full shopper journey: 15/15
FRONTEND_BASE=http://localhost:5173 .venv/bin/python scripts/driver_path_check.py  # driver's exact funnel: 9/9
```
`agent_sim.py` proves the frontend is drivable (home→search→listing→back→other→cart→checkout, with the
elements the agent "sees" printed per screen). `driver_path_check.py` replays the driver's real URL +
`GATE_ACTION`/`GATE_NAV`/`CONFIRM_ACTION` and confirms it reaches `/order-confirmed`.

**mock** = no browser, no LLM, 50 concurrent, deterministic — the offline/demo path.
**real** = one Chromium + GPT-4o per agent, 10 concurrent, persona decides autonomously.

---

## 11. Caveats / not-done-yet  <a id="caveats"></a>

- **Real mode (LLM in the loop) is unverified.** The browser API is **doc-confirmed** —
  `must_get_current_page()` / `get_elements_by_css_selector()` / `element.click()` / `go_back()` and
  `on_step_end` + `history.model_thoughts()` all match browser-use 0.9.x — and the navigation is
  Playwright-proven. What's **not** yet run: `pip install -r requirements-browser-use.txt`, then a real
  **GPT-4o + Chromium** journey (`OPENAI_API_KEY`, `LISTING_BASE_URL=http://localhost:5173`,
  `python demo/single_agent_demo.py budget`). The only still-unconfirmed touchpoints are
  `take_screenshot` (defensive `hasattr` fallback already) and `use_vision` default. Fixes, if any,
  are localized to `_click_css` / `_screenshot_bytes` / `_make_browser` / `_on_step`.
- **Frontend TS mirror is stale.** New fields/events (`agent_thought`, `stage_sentiment`,
  `StageTrace.sentiment/comment`, `bail_reason`, `purchase_reason`, `diagnostics`, `dropoff_reasons`,
  `UpliftReport`) are **not yet** in `frontend/src/types/contracts.ts`. Mirror them when wiring the UI.
- **Navigation is verified; the LLM-in-the-loop run is not.** `scripts/driver_path_check.py` proves the
  driver's URL + click + cart→checkout navigation works on the real page (no LLM). The remaining unknown
  is the full GPT-4o run (see the real-mode caveat above) — set `LISTING_BASE_URL=http://localhost:5173`.
- **Vite proxy still needed for the report UI**, not for driving: the frontend's `/api`·`/static`·`/ws`
  calls (report + screenshots + live events) need a `vite.config.ts` proxy to `:8000`. Driving the page
  doesn't need it; consuming the results does.
- **Roadmap:** Tier 2 = CTR impression→click pre-stage + description-read + scroll/zoom engagement.
  Tier 3 = multi-item carts / cross-sell → average basket cost & order-uplift divergence.

---

## 12. Key data contracts (`contracts.py`)

```python
StageTrace      = { stage, time_s, screenshot_url?, sentiment?, comment? }
AgentTrace      = { agent_id, name, archetype, outcome, bail_stage?, objection?,
                    retention_time_s, stage_trace[], purchase_reason?, bail_reason? }
Sentiment       = love | like | neutral | dislike | reject
ReasonCategory  = price_value | trust_authenticity | visual_photos
                  | social_proof_reviews | shipping | other
ViabilityReport = { …funnel, archetypes(+sentiment_arc), objection_heatmap, recommendations,
                    risk_archetypes, market_fit_score, go_no_go, agents[],
                    comments[], purchase_reasons[], diagnostics{}, dropoff_reasons[] }
UpliftReport    = { control_run_id, treatment_run_id, buyer_uplift, order_uplift,
                    per_persona[], funnel_delta[], objection_resolution[],
                    dropoff_reasons_control[], dropoff_reasons_treatment[] }
```
