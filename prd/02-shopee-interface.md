# PRD 02 — Shopee Interface + Reporting Surfaces

> **Owner:** H2 (FE-Shopee + Reporting) · **Branch:** `h2-shopee` · **Stack:** React + TypeScript + Tailwind + shadcn/ui
> **Read first:** [`00-OVERVIEW.md`](00-OVERVIEW.md) — shared contracts §5.
> **Parent:** [`../PRD.md`](../PRD.md) §6.3, §6.4, §8, §9.

---

## 1. Scope (what you own)

Two related surfaces:

**A. The Shopee listing page** — a faithful, **locally-recreated** Shopee SG
product page that the browser-use agents actually browse. It renders entirely
from a `ListingConfig` (OVERVIEW §5.4), so the recommendation engine can mutate
fields and re-render. It is **interactive and funnel-gated** (gallery, variants,
reviews, add-to-cart, checkout) and exposes the **stable selectors** (OVERVIEW
§5.6) browser-use depends on.

> Why a local recreation instead of real Shopee.com: reliability (no anti-bot /
> layout drift), mutability (the whole point — fixes must change the page),
> clean screenshots, and deterministic selectors for H3. Real Shopee scraping is
> explicitly out of scope (PRD §12).

**B. Post-run reporting surfaces** — read-only screens rendered from H4's report
data: the Analytics view, the Recommendations panel (with "Test this fix"), and
the Viability report.

You **own**:
- `shopee/` listing page (config-driven, gated, selector-stable, screenshot-clean).
- Canonical `fixtures/listing.sample.json` (the Matin Kim beanie).
- `shopee-stub.html` (selectors-only static page) — **ship day 1 for H3**.
- Listing config rendering + the **scenario flow** (apply mutated config → re-render → re-run).
- Analytics view, Recommendations panel, Viability report (UI).

You **do NOT** own:
- The live dashboard (header/strip/funnel/rail/tweaks) → H1 ([`01`](01-dashboard-interface.md)).
- browser-use navigation of your page → H3 ([`03`](03-browser-use-runtime.md)).
- Report/recommendation *generation* → H4 ([`04`](04-simulation-engine.md)). You render its output.

---

## 2. Dependencies

| You need | From | Until ready, build against |
|---|---|---|
| `ViabilityReport` + `Recommendation` schema/data | H4 | `fixtures/report.sample.json` (H4 commits; you may hand-author a stopgap from §6 here). |
| `POST /simulation/{id}/rerun` for "Test this fix" | H4 | Stub returns a fake `run_id`; wire later. |
| Shared `frontend/` scaffold + `tokens.css` | H1 | Coordinate — H1 seeds; you import tokens. |

| Others depend on YOU | Who | Deliver by |
|---|---|---|
| `shopee-stub.html` (selector contract, OVERVIEW §5.6) | H3 | **M0/day 1** — H3 is blocked without it (critical path). |
| `fixtures/listing.sample.json` | H3, H4 | M0. |
| Stable selectors maintained on the real page | H3 | through M3. |

**Your day-1 priority is the stub page** — it unblocks the project's critical
path (H2→H3→H4-real→H1-thumbnails). Build the stub before the pretty page.

---

## 3. Tech setup

Shares the `frontend/` app with H1. The Shopee page can be a route
(`/shopee/:listingId`) inside the same Vite app **and** exportable as a
standalone static page (so H3's Playwright can load it directly without the
dashboard). Keep it self-contained: no dependency on the dashboard store.

```bash
cd frontend && npm install && npm run dev
# Shopee page:        http://localhost:5173/shopee/matinkim-beanie
# Standalone for H3:  served static, e.g. http://localhost:5173/shopee-stub.html
```

---

## 4. Implementation

### 4.0 File structure (your part of `frontend/`)

```
frontend/
  public/
    shopee-stub.html          # day-1 selectors-only page for H3
  src/shopee/
    ShopeePage.tsx            # config-driven product page (gated)
    Gallery.tsx               # data-action="scroll-gallery"
    VariantPicker.tsx         # data-action="select-variant"
    ReviewsSection.tsx        # data-action="open-reviews"
    BuyBox.tsx                # price, ATC (data-action="add-to-cart")
    CheckoutFlow.tsx          # checkout + confirm-order
    SellerCard.tsx            # seller name/verified/response-rate
    config/loadConfig.ts      # ListingConfig loader (fixture or API)
  src/report/
    AnalyticsView.tsx
    FunnelDropChart.tsx
    ObjectionHeatmap.tsx
    ArchetypeTable.tsx
    AgentJourneyLog.tsx
    RecommendationsPanel.tsx  # ranked cards + "Test this fix"
    ViabilityReport.tsx
  src/types/contracts.ts      # shared (seeded by H1; you add report types)
fixtures/listing.sample.json
fixtures/report.sample.json   # stopgap until H4's real one
```

### 4.1 `shopee-stub.html` — ship first (OVERVIEW §5.6)

A single static HTML file with the **exact** `data-gate` / `data-action` /
`data-field` hooks, minimal styling, real-ish content. No React needed. This is
H3's target for building navigation. Example skeleton:

```html
<main data-listing-id="matinkim-beanie">
  <section data-gate="land">…title (data-field="title"), seller (data-field="seller-name")…</section>
  <section data-gate="photos"><button data-action="scroll-gallery">…</button></section>
  <section data-gate="reviews"><button data-action="open-reviews">…</button>
    <span data-field="rating">4.8</span><span data-field="review-count">312</span></section>
  <section data-gate="price"><span data-field="price">S$24.90</span>
    <button data-action="select-variant">Colour</button></section>
  <section data-gate="cart"><button data-action="add-to-cart">Add to Cart</button></section>
  <section data-gate="checkout"><button data-action="checkout">Checkout</button>
    <button data-action="confirm-order">Place Order</button></section>
</main>
```

Keep these hooks identical in the real React page. **Never rename a hook without
pinging H3.**

### 4.2 `ShopeePage.tsx` — config-driven, gated, screenshot-clean

- Renders **everything** from `ListingConfig` — no hardcoded product values
  beyond the sample fixture. Changing the config changes the page (this is what
  powers "Test this fix").
- **Funnel gates** map to real sections/interactions so an agent traverses them:
  - `land` — page header (title, seller, market, rating visible).
  - `photos` — `Gallery` (scrollable, `data-action="scroll-gallery"`); renders
    `config.photos` with `type` badges (product/lifestyle/closeup).
  - `reviews` — `ReviewsSection` (`config.rating`, `config.reviews`,
    seller `response_rate`, seller responses).
  - `price` — `BuyBox` price (`data-field="price"`, red if `> base_price`),
    `VariantPicker` (`config.variants`), shipping fee.
  - `cart` — Add-to-cart button → mini cart state.
  - `checkout` — `CheckoutFlow` → confirm order.
- **Visual fidelity** to Shopee SG (orange accents, layout) — enough to be
  recognizable in screenshots/thumbnails. The agent strip thumbnails (H1) and
  report screenshots (H3) crop this page, so keep it clean at 160×120 and full.
- **Authenticity** block driven by `config.authenticity` (certificate/serial/
  unboxing badges) — a lever the recommendation engine toggles.
- Stateless re: the dashboard. Reads config from `?config=` param, a posted
  message, or the API — your `loadConfig.ts` abstracts this.

### 4.3 Scenario flow (the loop's UI side) — PRD §6.4 button

`RecommendationsPanel` "Test this fix" →
1. take current `ListingConfig`, apply the recommendation's field change,
2. `POST /simulation/{run_id}/rerun` with the mutated config + `from_recommendation`,
3. dashboard (H1) picks up the new `run_id` stream; the Shopee page re-renders
   from the mutated config for the next run's agents.

Keep the **config mutation logic** here (you own `ListingConfig` rendering) — a
small `applyRecommendation(config, rec) -> config` helper, so before/after is
diffable. Expose the before/after config for the "delta" story (nice-to-have:
before/after comparison view).

### 4.4 Analytics view (`AnalyticsView.tsx`) — PRD §6.3

Read-only, rendered from `ViabilityReport` (H4). Sections:
- **FunnelDropChart** — per-stage bar: % bailed, stacked by archetype
  contribution (color per OVERVIEW §5.2).
- **ObjectionHeatmap** — which listing element (photos/price/reviews/checkout/…)
  triggered most bails (`report.objection_heatmap`).
- **ArchetypeTable** — archetype · agents · bought · bailed · buy rate · avg
  retention · top objection (`report.archetypes`).
- **AgentJourneyLog** — searchable list of all agents: stage sequence, time per
  stage, decision, objection, drop-off screenshot if available
  (`report.agents[].stage_trace`).

Use a light chart lib (Recharts) or hand-rolled SVG bars — keep it themed with
`tokens.css`. No new color system.

### 4.5 Recommendations panel (`RecommendationsPanel.tsx`) — PRD §6.4

Ranked improvement cards from `report.recommendations`. Each card:
- **Field** (Photos/Price/Reviews/Description/Authenticity/Title…),
- **Issue** (one-line diagnosis),
- **Fix** (actionable),
- **Impact estimate** (e.g. "+6–9% buy rate"),
- **affected_archetypes** chips (colored),
- **"Test this fix"** button → §4.3 scenario flow.

### 4.6 Viability report (`ViabilityReport.tsx`) — PRD §9

Summary deliverable from `report`: market-fit score (0–100), recommended launch
price, top-3 fixes (ranked, with evidence), risk archetypes (never-convert + why),
go/no-go with confidence. Make it screenshot-worthy for the demo close.

---

## 5. Listing fields you must render (PRD §8)

Photos, Title, Price, Description, Ratings, Comments/Reviews (+ seller response
rate), Authenticity, Category, Store name. Each must be (a) driven by
`ListingConfig` and (b) visibly affected when the recommendation engine mutates
it — these are the levers the whole demo turns on.

---

## 6. Fixtures you own / stopgap

- `fixtures/listing.sample.json` — the **Matin Kim beanie** per CLAUDE.md
  (`CozyKnit Ribbed Merino Beanie — Unisex, 8 Colours`, base S$24.90, Shopee SG).
  Include 2 product + 1 lifestyle photos, 8 colour variants, ~5 reviews with a
  low seller response rate (so the "reviews" objection is real), authenticity all
  `false` initially (a lever).
- `fixtures/report.sample.json` — stopgap mirroring H4's `ViabilityReport` so you
  can build §4.4–4.6 before the backend. Replace with H4's real fixture at M5.

---

## 7. Definition of done

- [ ] `shopee-stub.html` shipped day 1 with all OVERVIEW §5.6 hooks; H3 can drive it.
- [ ] `ShopeePage` renders fully from `ListingConfig`; all §8 fields config-driven.
- [ ] All 6 gates are reachable via the `data-action` hooks; page is clean at
      160×120 and full size.
- [ ] Changing a config field visibly changes the page (price, photos, reviews,
      authenticity at minimum).
- [ ] "Test this fix" mutates config + triggers `/rerun`; before/after config diffable.
- [ ] Analytics view, Recommendations panel, Viability report render from report data.
- [ ] Selectors stable through M3; documented in `shopee/README.md`.
- [ ] `npm run typecheck` + `npm run lint` clean.

## 8. Demo beats you enable (PRD §14)

Beat 2 (real agents on the Shopee listing — your page is what they're on),
beat 5/6 (analytics + "AI recommends"), beat 7 (re-run after fix). The price
lever (beat 3) is rendered by your BuyBox; H1's slider drives the value.
