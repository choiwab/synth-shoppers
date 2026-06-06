# Design — H2 Shopee Interface + Reporting Surfaces

**Date:** 2026-06-06  
**Owner:** H2  
**Branch:** `h2-shopee`  
**Stack:** Vite + React + TypeScript + Tailwind CSS + shadcn/ui

---

## 1. Scope

Full Shopee SG recreation for browser-use agent simulation of the Matin Kim beanie launch. Covers:

- **Shopee frontend** — Home, Search Results, Product pages (all agent-browsable)
- **Reporting surfaces** — Analytics, Recommendations panel, Viability report
- **Fixtures & contracts** — `listing.sample.json`, `report.sample.json`, `shopee-stub.html`

Does NOT own: live dashboard (H1), browser-use runtime (H3), report/rec generation (H4).

---

## 2. Routes

| Route | Screen |
|---|---|
| `/` | Home — Shopee SG landing page |
| `/search?keyword=beanie` | Search results — 10 beanies, 5×2 grid, sidebar filters |
| `/shopee/:listingId` | Product page — config-driven (matinkim-beanie) or hardcoded fixture (competitors) |
| `/report/:runId` | Reporting surfaces — Analytics, Recommendations, Viability |

---

## 3. Architecture

```
frontend/
  public/
    shopee-stub.html             # day-1 static stub for H3
  src/
    shopee/
      ShopeePage.tsx             # config-driven product page
      Gallery.tsx
      VariantPicker.tsx
      ReviewsSection.tsx
      BuyBox.tsx
      CheckoutFlow.tsx
      SellerCard.tsx
      config/
        loadConfig.ts            # loads ListingConfig from ?config= / API / fixture
        competitors.ts           # 9 hardcoded competitor fixtures
    report/
      AnalyticsView.tsx
      FunnelDropChart.tsx
      ObjectionHeatmap.tsx
      ArchetypeTable.tsx
      AgentJourneyLog.tsx
      RecommendationsPanel.tsx
      ViabilityReport.tsx
    pages/
      HomePage.tsx
      SearchPage.tsx
    components/
      ShopeeHeader.tsx           # orange header + search bar (shared across all pages)
      ProductCard.tsx            # card used in search results + home flash deals
    types/
      contracts.ts               # ListingConfig, ViabilityReport, Recommendation, etc.
    lib/
      applyRecommendation.ts     # (config, rec) -> config mutation helper
  fixtures/
    listing.sample.json          # Matin Kim beanie (canonical)
    report.sample.json           # stopgap ViabilityReport
```

---

## 4. Browser-use Compatibility

Browser-use reads the DOM accessibility tree via CDP. Every interactive element must be:
- A native `<button>`, `<a>`, `<input>`, `<select>` — detected automatically
- OR a div/span with a JS onClick — also detected via CDP event listeners
- Equipped with descriptive `aria-label` where text alone is ambiguous

Additional stable hooks on the Matin Kim product page (H3 contract, OVERVIEW §5.6):

| Attribute | Where |
|---|---|
| `data-gate="land\|photos\|reviews\|price\|cart\|checkout"` | section wrappers |
| `data-action="scroll-gallery\|open-reviews\|select-variant\|add-to-cart\|checkout\|confirm-order"` | interactive controls |
| `data-field="title\|price\|rating\|review-count\|seller-name"` | readable fields |
| `data-listing-id` | page root |

These hooks are identical in `shopee-stub.html` and `ShopeePage.tsx`. Never rename without pinging H3.

---

## 5. Home Page (`/`)

Faithful Shopee SG recreation:
- **Header**: orange bg, Shopee logo, search input (`<input type="search">`), cart icon
- **Hero banners**: 2 promotional banners (static images or CSS-drawn)
- **Category grid**: 10 category tiles (Women's Apparel, Mobile & Gadgets, etc.) — clicking any navigates to `/search?keyword=<category>`
- **Flash Deals section**: 4–6 product cards with countdown timer, discount badges
- **Recommended section**: 8 product cards including the Matin Kim beanie

Search bar submits to `/search?keyword=<value>` on Enter or clicking the search button.

---

## 6. Search Results Page (`/search?keyword=beanie`)

- **Sidebar filters**: Shop Type checkboxes, Service & Promotion, Shipped From, Shipping Option — all rendered with `<input type="checkbox">` and proper labels
- **Sort bar**: Relevance / Latest / Top Sales / Price tabs + pagination `1/13`
- **Product grid**: 10 beanie cards, 5 per row, 2 rows, randomised order on each page load
  - Matin Kim beanie always present in the 10
  - 9 hardcoded competitor beanies (varied prices S$5–S$45, ratings 4.5–5.0, different sellers)
- Each `ProductCard` is a `<a href="/shopee/:listingId">` with price, rating, discount badge, image, seller location

---

## 7. Product Page (`/shopee/:listingId`)

### Matin Kim (`matinkim-beanie`) — config-driven

Renders entirely from `ListingConfig`. All 6 funnel gates present with stable selectors:

1. **land** — title, seller name (verified badge), category, star rating visible on load
2. **photos** — `<Gallery>` scrollable image strip; `data-action="scroll-gallery"` button
3. **reviews** — `<ReviewsSection>` showing rating score, count, review cards, seller response rate; `data-action="open-reviews"`
4. **price** — `<BuyBox>` showing price (red if > base_price), `<VariantPicker>` for 8 colour options, shipping fee
5. **cart** — "Add to Cart" button → mini cart state updates
6. **checkout** — `<CheckoutFlow>` with Checkout + Place Order buttons

Authenticity block: shows/hides certificate, serial, unboxing badges driven by `config.authenticity`.  
Config loaded via `loadConfig.ts`: checks `?config=` URL param → `postMessage` → API `/simulation/:id/config` → falls back to `fixtures/listing.sample.json`.

### Competitors (9 listings) — hardcoded

Same visual layout as Matin Kim page. No `data-gate`/`data-action` hooks needed — browser-use will navigate via standard buttons. Content is static fixture data per competitor (different title, price, photos, rating, reviews).

---

## 8. Scenario Flow ("Test this fix")

`RecommendationsPanel` → "Test this fix" button:
1. `applyRecommendation(currentConfig, rec)` → mutated `ListingConfig`
2. `POST /simulation/{run_id}/rerun` with `{ listing_config: mutated, from_recommendation: rec.id }`
3. Returns new `run_id` → H1 picks up new WS stream; Shopee page re-renders from mutated config
4. Before/after config exposed as state for optional delta view

Stub: if backend not ready, `/rerun` returns `{ run_id: "fake-rerun-001" }`.

---

## 9. Reporting Surfaces (`/report/:runId`)

Three tabbed views rendered from `ViabilityReport` (loaded from `GET /simulation/:runId/report` or fixture):

**Analytics tab:**
- `FunnelDropChart` — horizontal bar chart per gate, % bailed, stacked by archetype color (Recharts `BarChart`)
- `ObjectionHeatmap` — bar chart of listing fields vs bail count
- `ArchetypeTable` — table: archetype, agents, bought, bailed, buy rate, avg retention, top objection
- `AgentJourneyLog` — searchable list with stage trace per agent, screenshot thumbnail if available

**Recommendations tab:**
- Ranked cards: field, issue, fix, impact estimate, archetype chips, "Test this fix" button

**Viability tab:**
- Market fit score (0–100), recommended launch price, top-3 fixes, risk archetypes, go/no-go badge

---

## 10. Fixtures

### `fixtures/listing.sample.json` (Matin Kim beanie)
- Title: "CozyKnit Ribbed Merino Beanie — Unisex, 8 Colours"
- Price: S$24.90, base_price: S$24.90
- Seller: MatinKimSG, verified: false, response_rate: 0.1 (lever for "reviews" objection)
- 2 product photos + 1 lifestyle photo
- 8 colour variants (Black, White, Beige, Grey, Navy, Rust, Olive, Dusty Pink)
- 5 reviews (mixed 3–5 star, no seller responses — lever)
- authenticity: { certificate: false, serial: false, unboxing: false } (all levers)
- Shipping: S$1.99, 3–5 days

### `fixtures/report.sample.json` (stopgap ViabilityReport)
Full `ViabilityReport` structure per H4 schema: run_id, market_fit_score: 62, recommended_price: 22.90, go_no_go: { decision: "no_go", confidence: 0.7 }, 3 recommendations with config_patch, archetype breakdown, funnel data, agent traces.

---

## 11. Design System

Imports `tokens.css` from H1 (or self-seeded until H1 merges). Shopee brand colours layered on top:

```css
--shopee-orange: #ee4d2d;
--shopee-orange-light: #f53d2d;
```

Fonts: Hanken Grotesk for UI; fallback system-ui. No Bricolage/Space Mono on the Shopee pages (these are for the dashboard, H1's territory).

---

## 12. Cross-team Wiring Points

| Interface | Status at build time | Wire-up action |
|---|---|---|
| `ListingConfig` schema | Defined in OVERVIEW §5.4 — use as-is | Import from `types/contracts.ts` |
| `ViabilityReport`/`Recommendation` schema | H4 owns; use fixture stopgap | Replace fixture with `GET /simulation/:id/report` at M5 |
| `POST /simulation/:id/rerun` | Stub returns fake run_id | Wire real URL when H4 ships API (M2) |
| `shopee-stub.html` selectors | Own + deliver day 1 | H3 depends on this — ship first |
| `tokens.css` | H1 seeds; import it | Coordinate; self-seed if H1 not ready |
| Thumbnail URLs in product page | H3 provides via `stage_enter.thumbnail_url` | Already optional — page renders without them |

---

## 13. Definition of Done

- [ ] `shopee-stub.html` with all OVERVIEW §5.6 hooks — ship first
- [ ] `fixtures/listing.sample.json` committed (Matin Kim beanie)
- [ ] Home page renders with search, banners, categories, product cards
- [ ] Search results: 10 beanies in 5×2 grid, sidebar filters, sort bar
- [ ] Matin Kim product page: all 6 gates reachable, all fields config-driven
- [ ] 9 competitor product pages: realistic content, browsable by agents
- [ ] "Test this fix" mutates config + calls `/rerun`; before/after diffable
- [ ] Reporting surfaces render from fixture (Analytics, Recommendations, Viability)
- [ ] `npm run typecheck` + `npm run lint` clean
