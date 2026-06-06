# Synthetic Shoppers — Work Split & Shared Contracts

> **Read this first.** This document is the single source of truth for how the
> build is divided across 4 people, the contracts between you, and the order in
> which the pieces integrate. The four detailed PRDs (`01`–`04`) each reference
> the contracts defined here. If a schema changes, change it **here first**, then
> ping the owners listed below.

Parent spec: [`../PRD.md`](../PRD.md). This split does not change scope — it
partitions it.

---

## 1. Team split

| # | Owner role | PRD | Stack | One-line scope |
|---|---|---|---|---|
| **H1** | **FE-Dashboard** | [`01-dashboard-interface.md`](01-dashboard-interface.md) | React/TS | The live simulation monitor (header, agent strip, funnel track, right rail, tweaks panel) |
| **H2** | **FE-Shopee + Reporting** | [`02-shopee-interface.md`](02-shopee-interface.md) | React/TS | The config-driven Shopee listing page the agents browse + post-run report/analytics/recommendations surfaces |
| **H3** | **BE-Browser** | [`03-browser-use-runtime.md`](03-browser-use-runtime.md) | Python | browser-use/Playwright runtime, screenshots/thumbnails, the live browser demo |
| **H4** | **BE-Sim** | [`04-simulation-engine.md`](04-simulation-engine.md) | Python/FastAPI | Personas, bail model, orchestration, mock mode, WS/REST API, recommendations, improvement loop, viability report |

Pairing: **H1 + H2** are the two "interface" people. **H3 + H4** are the two
"agent / browser-use" people.

---

## 2. Architecture at a glance

```
                         ┌──────────────────────────────────────┐
                         │  H1  Dashboard (live monitor)         │
                         │  ── consumes AgentEvent stream ──────┐│
                         └───────────────▲──────────────────────┘│
                                         │ WS /ws/simulation/{id} │ REST report
                                         │                        ▼
┌───────────────────────┐    ┌───────────┴───────────┐   ┌──────────────────────┐
│ H2  Shopee listing page│    │  H4  Sim engine + API  │   │ H2 Reporting surfaces│
│ (config-driven, gated, │◄───┤  personas, runner,     ├──►│ analytics / recs /   │
│  stable selectors)     │    │  loop, recs, report    │   │ viability report     │
└──────────▲────────────┘    └───────────┬───────────┘   └──────────────────────┘
           │ drives via selectors         │ BrowserDriver
           │                              ▼
           │                  ┌───────────────────────┐
           └──────────────────┤ H3  browser-use runtime│
                              │ Playwright, screenshots │
                              └───────────────────────┘
```

Two execution modes (both produce identical `AgentEvent` streams):

- **Mock / fast mode** (H4 only): no browser. LLM-only (or scripted) decisions
  over a cached page snapshot. This is what makes the dashboard demoable on day 1
  without H3 finished.
- **Real mode** (H4 → H3): H4's runner calls H3's `BrowserDriver`, which drives
  H2's Shopee page in a real Playwright session and returns page state +
  screenshots.

---

## 3. Dependency graph & how to stay unblocked

Every dependency below has a **stub/mock** so no one is ever hard-blocked.

| Consumer | Depends on | For | Unblock with (build against this until ready) |
|---|---|---|---|
| H1 | H4 | `AgentEvent` stream, REST start/report | **Fixture event player**: a local JSON file replayed over a fake WS (`mockSocket`). H4 ships a recorded fixture early. |
| H1 | H3 | thumbnail/frame URLs for agent strip | **Fallback tiles** (archetype color + stage text). Spec'd as a first-class mode, not a hack. |
| H2 | H4 | report + recommendation JSON | **Sample report fixture** committed by H4 (`fixtures/report.sample.json`). |
| H3 | H2 | the Shopee page + stable selectors | **Stub page**: a single static `shopee-stub.html` with the agreed `data-gate`/`data-action` attributes. H2 ships this stub on day 1. |
| H3 | H4 | per-step LLM decision + driver call shape | The `BrowserDriver` Protocol (§5.5). H3 builds the driver standalone with a fake caller. |
| H4 | H3 | `BrowserDriver` (real mode) | `MockBrowserDriver` (H4 owns it) — bypasses browser entirely. |
| H2 | H4 | `ListingConfig` schema (co-owned) | Defined in §5.4 here; H2 ships the canonical sample config. |

**Golden rule:** code against the contract in §5, not against the other
person's code. Integrate when both sides pass the contract.

---

## 4. Integration milestones (suggested order)

1. **M0 — Contracts frozen (everyone, first 60–90 min).** Walk through §5
   together. Each owner commits the stub/fixture they're responsible for:
   - H4 → `fixtures/events.sample.jsonl` + `fixtures/report.sample.json`
   - H2 → `shopee-stub.html` (selectors only) + `fixtures/listing.sample.json`
   - H3 → `BrowserDriver` Protocol file
   - H1 → repo scaffold (`frontend/`) + `tokens.css` + WS client interface
2. **M1 — Dashboard plays fixtures (H1 alone).** Live funnel + feed + roster
   animate off the recorded event stream. *Demo-able already.*
3. **M2 — Mock-mode end-to-end (H4 → H1).** H4's mock runner streams real
   (LLM-driven, no browser) events to H1's live dashboard.
4. **M3 — Real Shopee page (H2) + browser-use (H3).** H3 drives H2's page,
   captures screenshots, exposes the driver.
5. **M4 — Real mode end-to-end (H3 → H4 → H1).** Runner swaps `MockBrowserDriver`
   for the real driver; thumbnails appear in H1's agent strip.
6. **M5 — Reporting + recommendations (H4 → H2).** Run completes → report +
   recommendation cards render → "Test this fix" mutates config → re-run.
7. **M6 — Polish, demo beats, fast mode for the live demo.**

Critical path runs **H2 → H3 → H4(real) → H1(thumbnails)**. Everything else can
proceed against fixtures, so protect that path.

---

## 5. SHARED CONTRACTS (canonical)

> These are the only cross-team interfaces. Owners are noted; changes require a
> ping to all consumers. Types are shown as TypeScript for clarity; Python side
> mirrors them with Pydantic models (H3/H4).

### 5.1 Funnel stages (shared by all)

```ts
type FunnelStage =
  | "land" | "photos" | "reviews" | "price" | "cart" | "checkout"  // gates
  | "bought"   // terminal success
  | "bailed";  // terminal drop (can occur at any gate land..checkout)
```

Order of gates is fixed: `land → photos → reviews → price → cart → checkout → bought`.

### 5.2 Persona IDs & archetype colors (shared)

Canonical IDs (used in events, configs, prompts). **Owner of definitions: H4.**
Colors **must** match these exact oklch hues (`L=0.74 C=0.135`), mirrored in
H1's `tokens.css`:

```ts
type PersonaId =
  | "xmm" | "auntie" | "nerd" | "geek"
  | "insecure" | "budget" | "high_spender";

// oklch(0.74 0.135 <hue>)
const ARCHETYPE_HUE: Record<PersonaId, number> = {
  xmm: 10, auntie: 75, nerd: 175, geek: 300,
  insecure: 250, budget: 145, high_spender: 40,
};
```

| PersonaId | Display | Tag | Primary bail gates |
|---|---|---|---|
| `xmm` | XMM | Trend-led | photos, reviews |
| `auntie` | Auntie | Value & trust | reviews, price |
| `nerd` | Nerd | Spec-rational | reviews, price |
| `geek` | Geek | Enthusiast | photos, price |
| `insecure` | Insecure | Scam-wary | reviews, checkout |
| `budget` | Budget-tight | Price-first | price |
| `high_spender` | High-spender | Convenience | (rarely) |

### 5.3 `AgentEvent` — WebSocket message union  ·  **Owner: H4 · Consumer: H1**

Streamed over `WS /ws/simulation/{run_id}`, one JSON object per message,
newline-delimited in fixtures (`.jsonl`). Discriminated on `type`. Every event
has `run_id` and `ts` (epoch ms).

```ts
type AgentEvent =
  | { type: "run_started";  run_id: string; ts: number;
      listing: { title: string; price: number; seller: string };
      agents_total: number; }
  | { type: "agent_spawned"; run_id: string; ts: number;
      agent_id: string; name: string; archetype: PersonaId; }
  | { type: "stage_enter"; run_id: string; ts: number;
      agent_id: string; stage: FunnelStage; thumbnail_url?: string; }
  | { type: "browser_frame"; run_id: string; ts: number;       // live preview
      agent_id: string; thumbnail_url: string; scroll_pct?: number; }
  | { type: "objection"; run_id: string; ts: number;
      agent_id: string; stage: FunnelStage; text: string; }
  | { type: "agent_bailed"; run_id: string; ts: number;
      agent_id: string; stage: FunnelStage; objection: string;
      retention_time_s: number; }
  | { type: "agent_bought"; run_id: string; ts: number;
      agent_id: string; retention_time_s: number; }
  | { type: "run_progress"; run_id: string; ts: number;
      active: number; bought: number; bailed: number; }
  | { type: "run_complete"; run_id: string; ts: number;
      buy_rate: number; report_ready: boolean; };
```

H1 should treat unknown `type` values as ignorable (forward-compat).

### 5.4 `ListingConfig` — the page state  ·  **Co-owned: H2 (render) + H4 (mutate)**

The simulation input. H2 renders the Shopee page from it; H4's recommendation
engine mutates fields to produce scenarios. H2 ships the canonical sample.

```ts
interface ListingConfig {
  id: string;
  title: string;
  seller: { name: string; verified: boolean; rating: number; response_rate: number };
  price: number;          // current S$
  base_price: number;     // baseline for "price above threshold" UI
  variants: { name: string; options: string[] }[];   // e.g. Colour × 8
  photos: { url: string; type: "product" | "lifestyle" | "closeup" }[];
  description: string;
  rating: { score: number; count: number };
  reviews: {
    author: string; rating: number; text: string; date: string;
    seller_response?: string;
  }[];
  authenticity: { certificate: boolean; serial: boolean; unboxing: boolean };
  category: string[];
  shipping: { fee: number; days: string };
}
```

### 5.5 `BrowserDriver` — runtime boundary  ·  **Owner: H3 · Consumer: H4**

Python Protocol. H4's runner depends only on this; `MockBrowserDriver`
(no browser) and the real Playwright driver both satisfy it.

```python
from typing import Protocol, Optional

class PageState:
    text: str                  # rendered summary the LLM reads
    screenshot_url: Optional[str]
    scroll_pct: float

class BrowserSession(Protocol): ...

class BrowserDriver(Protocol):
    async def open(self, listing_url: str, agent_id: str) -> BrowserSession: ...
    async def goto_gate(self, s: BrowserSession, gate: str) -> PageState: ...
    async def act(self, s: BrowserSession, action: str) -> PageState: ...
    async def screenshot(self, s: BrowserSession) -> str:  # -> thumbnail_url
        ...
    async def close(self, s: BrowserSession) -> None: ...
```

### 5.6 Shopee DOM / selector contract  ·  **Owner: H2 · Consumer: H3**

H2's page exposes stable hooks so browser-use navigates deterministically.
H2 ships these in `shopee-stub.html` on day 1 and keeps them stable.

| Hook | Where | Used by H3 to |
|---|---|---|
| `data-gate="land\|photos\|reviews\|price\|cart\|checkout"` | section wrapper per gate | detect/scroll to gate |
| `data-action="scroll-gallery"` | photo gallery | advance past photos |
| `data-action="open-reviews"` | reviews toggle | reach reviews |
| `data-action="select-variant"` | variant picker | price/variant gate |
| `data-action="add-to-cart"` | ATC button | cart gate |
| `data-action="checkout"` | checkout button | checkout gate |
| `data-action="confirm-order"` | confirm button | buy |
| `data-field="title\|price\|rating\|review-count\|seller-name"` | fields | read values for the LLM |
| `data-listing-id` | page root | sanity check |

### 5.7 REST + run-control API  ·  **Owner: H4 · Consumer: H1, H2**

```
POST /simulation/start
  body: { listing_config: ListingConfig,
          crowd: { personas: PersonaId[], crowd_size: number, speed: 1|2|4 },
          mode: "mock" | "real" }
  -> { run_id: string }

WS   /ws/simulation/{run_id}        -> stream of AgentEvent

GET  /simulation/{run_id}/report    -> ViabilityReport      (see 04 PRD §)

POST /simulation/{run_id}/rerun     // scenario: apply a fix and re-run
  body: { listing_config: ListingConfig, from_recommendation?: string }
  -> { run_id: string }             // new run id
```

`ViabilityReport`, `Recommendation` schemas live in
[`04-simulation-engine.md`](04-simulation-engine.md) (owner H4); H2 consumes them
and should import the same TS types from a shared `types/` module.

---

## 6. Shared conventions

- **Repo layout:** `frontend/` (H1 + H2 share it), `backend/` (H3 + H4 share it),
  `prds/` (this folder), `fixtures/` (cross-team sample data).
- **Shared types:** put cross-team TS types in `frontend/src/types/contracts.ts`;
  Python Pydantic mirror in `backend/contracts.py`. One PR seeds both from §5.
- **Run ids:** `run_<shortuuid>`. **Agent ids:** `<archetype>_<n>`.
- **No real Shopee.com traffic.** Agents browse H2's local recreation (reliable,
  mutable, screenshot-clean, no anti-bot). Out of scope: live Shopee scraping.
- **Branching:** one branch per PRD (`h1-dashboard`, `h2-shopee`, `h3-browser`,
  `h4-sim`); integrate at the milestones above.
- **Env:** OpenAI + Anthropic keys in `backend/.env` (H3/H4). Never commit keys.

---

## 7. Where each "must-have" lands (traceability to PRD.md §12)

| Must-have | Primary owner | Support |
|---|---|---|
| Live funnel track w/ animated dots | H1 | — |
| Agent preview strip (thumbnails + fallback) | H1 | H3 (thumbnails) |
| Activity feed (Singlish objections) | H1 | H4 (objection text) |
| Persona roster w/ live buy rates | H1 | H4 (events) |
| 7 archetypes + per-stage bail probs | H4 | — |
| Tweaks panel (mix / speed / price) | H1 | H4 (re-run) |
| ≥1 real browser-use Shopee session | H3 | H2 (page) |
| Recommendations panel (3 fixes) | H2 (UI) | H4 (generation) |
| Viability report | H2 (UI) | H4 (generation) |
| Shopee listing page (config-driven) | H2 | — |
| WS streaming + REST API | H4 | — |
