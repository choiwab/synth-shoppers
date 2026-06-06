# PRD — Synthetic Shoppers
### AI Focus Group for Online Listings · Hackathon Build

**Track:** AI-Native Products & Operations  
**Target Market:** Singapore  
**Listing Under Test:** Matin Kim Beanie (Shopee SG)  
**Date:** June 2026

---

## 1. Problem

A seller has a product trending on TikTok Shop US. Before committing real budget to launch in Singapore, they need to know:

- Will Singapore buyers respond?
- Where in the funnel will they drop off?
- Why — and what specifically needs to change?

Today this costs weeks of real traffic and ad spend. The signal arrives late, diluted, and without actionable root causes.

---

## 2. Solution

**Synthetic Shoppers** replaces that wait with a simulation loop you can run in minutes.

Spin up a crowd of LLM shopper-agents — each modeled on a distinct Singapore buyer archetype — and send them through the live Shopee listing via browser-use. Every agent produces a complete decision trace: bought or bailed, where in the funnel, and the exact objection that stopped them. Run hundreds. See the patterns. Tweak the listing. Re-run. Repeat until drop-off falls.

---

## 3. Core Loop

```
Configure agents → Run simulation → Read drop-off pattern
       ↑                                        ↓
  Apply listing fix ←←←← AI recommendations ←←←
```

Up to 10 automated improvement loops. Each loop produces a delta: before/after buy rate, which fix moved the needle.

---

## 4. Buyer Archetypes (Persona Model)

Seven Singapore-native archetypes, each with distinct bail behavior and objection language.

| Archetype | Tag | Bail trigger | Sample objection |
|---|---|---|---|
| **XMM** | Trend-led | Photos, social proof | "Photos damn ugly leh, vibe not there." |
| **Auntie** | Value & trust | Reviews, price | "Never hear of this brand one." |
| **Nerd** | Spec-rational | Reviews, price | "Price not justified by the specs." |
| **Geek** | Enthusiast | Photos, price variant | "Can't tell the knit gauge from these." |
| **Insecure** | Scam-wary | Reviews, checkout | "So many scams nowadays… what if fake?" |
| **Budget-tight** | Price-first | Price | "Add shipping also? Forget it." |
| **High-spender** | Convenience-led | Rarely bails | "Done, next." |

Each archetype has calibrated per-stage bail probabilities that mirror realistic Singapore shopping behavior.

---

## 5. Funnel Stages

Agents traverse six gates before the terminal outcome:

1. **Landed** — opened the listing
2. **Photos** — scrolled the gallery
3. **Reviews** — read ratings + comments
4. **Price** — checked price + variants
5. **Add to cart** — added to cart
6. **Checkout** — started checkout
7. **Bought** ✓ (terminal success) / **Bailed** ✗ (terminal drop)

Each gate captures: time spent, objection text (if bailed), screenshot of the page state at drop-off.

---

## 6. Interface — Screen Inventory

### 6.1 Dashboard — Live Simulation Monitor

The primary screen. Designed for minimal text — the agents *are* the data.

**Layout: 3-row grid**

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: brand · listing identity · price · run controls│
├─────────────────────────────────────────────────────────┤
│  AGENT PREVIEW STRIP  (replaces metric numbers)         │
├──────────────────────────────────────┬──────────────────┤
│                                      │  Activity Feed   │
│      FUNNEL TRACK                    │  (live objections│
│   (animated agent dots)              │   streaming)     │
│                                      ├──────────────────┤
│                                      │  Persona Roster  │
│                                      │  (buy rates per  │
│                                      │   archetype)     │
└──────────────────────────────────────┴──────────────────┘
```

---

#### Row 1 — Header

Minimal. One row. Contains:
- **Brand mark** — conic-gradient dot + "Synthetic" wordmark + "live shopper sim" sub-label
- **Listing identity** — product thumbnail placeholder + title + seller + market + star rating
- **Price chip** — live S$ value; turns red when price is above baseline threshold
- **Run controls** — Pause/Resume · Re-run · Live status badge (pulsing green dot)

No navigation. No tabs. Single-purpose screen.

---

#### Row 2 — Agent Preview Strip *(replaces stat numbers)*

Instead of four stat cards, this strip shows a **live mosaic of agent browser previews** — small browser viewport thumbnails, one per active agent, labeled by archetype color and name.

Each preview tile:
- 160×120px browser viewport (cropped Shopee listing at the agent's current scroll position)
- Archetype color-coded border
- Agent name + archetype tag (Space Mono, 9px)
- Current funnel stage label
- Subtle pulse animation when active; fade+grayscale when bailed; green glow when bought

Tiles are arranged in a fluid grid, sorted by archetype. As agents bail or buy, their tiles shift states in real time. The strip is scannable at a glance — you see _who is still shopping_ and _who dropped off_.

> Fallback (pre-simulation or no browser-use session): tiles show archetype avatar + stage name + last action as text. Same grid, same color coding, no screenshots.

---

#### Row 3 — Funnel Track + Right Rail

**Funnel Track (main, ~70% width)**

The animated dot-flow visualization:
- Horizontal pipeline from left (Landed) to right (Checkout)
- Agent dots (14px circles, archetype-colored) cluster at their current gate
- Dots that bail peel downward into a "WHERE THEY BAILED" sediment band below the pipe
- Bought agents collect in a green-bordered "Bought" vault on the right
- Gate labels above the pipe: stage number, name, count currently here
- Drop chips below the pipe: ↓ N bailed (shown in red, per gate)
- Hover any dot → tooltip: agent name, archetype, current stage, last objection

**Right Rail (~30% width)**

Two stacked panels:

*Activity Feed* (top, larger)
- Streaming list of events, newest first
- Each event: archetype-colored dot · agent name · time · action text (Singlish objections or "bought")
- Buy events have green border; bail events are neutral
- Auto-scrolls; max 60 visible events

*Persona Roster* (bottom)
- One row per archetype: avatar dot · name · tag · horizontal buy-rate bar · buy % + count
- Bars animate as simulation progresses
- Sorted by buy rate descending at run completion

---

### 6.2 Tweaks Panel (Side Drawer)

Slide-in panel from the right, toggled by a settings button in the header.

**Persona mix** — toggle each of the 7 archetypes on/off  
**Crowd size** — slider, 20–200 agents  
**Speed** — 1× / 2× / 4×  
**Listing price** — slider, S$10–S$60 (triggers re-sim with same agents)

Changing any control auto-resets and restarts the simulation.

---

### 6.3 Analytics View (Post-Simulation)

Accessible via "View Report" after a run completes. Read-only.

**Sections:**
- **Funnel drop-off chart** — bar chart per stage: % bailed, colored by archetype contribution
- **Objection heatmap** — which listing element triggered the most bails (photos, price, reviews, checkout)
- **Archetype breakdown** — table: archetype · agents · bought · bailed · buy rate · avg retention time · top objection
- **Agent journey log** — searchable list of all 60 agents with full trace: stage sequence, time per stage, decision, objection text, screenshot at drop-off (if available)
- **Revenue projection** — estimated conversion rate × avg Shopee daily traffic for comparable listings

---

### 6.4 Recommendations Panel (AI-Generated)

Appears as a panel below the funnel after run completion, or as a dedicated tab.

Format: ranked improvement cards.

Each card:
- **Field** — what to change (e.g. Photos, Price, Reviews, Description, Authenticity, Title)
- **Issue** — one-line diagnosis ("38% of Auntie and Insecure agents bailed at Reviews — seller response rate is 0%")
- **Fix** — specific actionable recommendation ("Add seller FAQ response + authenticity certificate shot")
- **Impact estimate** — projected buy rate lift if applied ("Est. +6–9% buy rate")
- **Scenario button** — "Test this fix" → auto-mutates the listing config and re-runs

---

## 7. Agent Simulation — Technical Spec

### 7.1 Per-Agent Execution

Each agent is an LLM call (GPT-4o) with a system prompt encoding its archetype:

```
You are {name}, a {archetype} shopper in Singapore.
{archetype_blurb}
You are browsing a Shopee listing for: {listing_title} at S${price}.
For each step, decide: continue or bail. If bail, state your exact objection in character.
Return JSON: { action: "continue"|"bail"|"buy", stage: "...", objection: "..." }
```

browser-use drives the actual Shopee session. The LLM sees the rendered page and decides. Screenshots are captured at each gate transition.

### 7.2 Parallelism

- Default crowd: 60 agents
- Parallelism: 10 concurrent browser-use sessions
- Estimated wall time at 1×: ~3–4 minutes for 60 agents
- At 4× (mock/fast mode): ~30 seconds using cached page state + LLM-only decisions (no real browser)

### 7.3 Improvement Loop

```python
for loop in range(10):
    results = run_simulation(listing_config, agents)
    if results.buy_rate >= target or results.delta < threshold:
        break
    recommendations = llm_analyze(results)
    listing_config = apply_top_recommendation(listing_config, recommendations)
```

Each loop outputs: buy rate, delta vs previous, which fix was applied, which archetype moved most.

### 7.4 Output Schema (per agent)

```typescript
{
  agent_id: string,
  name: string,
  archetype: PersonaId,
  outcome: "bought" | "bailed",
  bail_stage: FunnelStage | null,
  objection: string | null,
  retention_time_s: number,
  stage_trace: { stage: FunnelStage, time_s: number, screenshot_url: string }[],
}
```

---

## 8. Listing Fields Under Analysis

The simulation tests and the recommendation engine targets these configurable listing fields:

| Field | Optimization lever |
|---|---|
| **Photos** | Count, quality, lifestyle vs. product, close-ups |
| **Title** | Keywords, clarity, local terminology |
| **Price** | Absolute price, vs. competitors, promo positioning |
| **Description** | Length, specs, trust signals, Singlish tone |
| **Ratings** | Score, volume, recency |
| **Comments / Reviews** | Depth, seller response rate, handled complaints |
| **Authenticity** | Serial code, brand certificate, unboxing proof |
| **Category** | Correct category + tags for SG search |
| **Store name** | Brand vs. generic, seller profile completeness |

---

## 9. Output — Viability Report

The final deliverable for the seller:

**Market fit score** — 0–100, composite of buy rate, archetype spread, and price sensitivity  
**Recommended launch price** — S$ value that maximizes revenue across the archetype mix  
**Top 3 listing fixes** — ranked by impact, with test evidence  
**Risk archetypes** — which buyer types will never convert and why  
**Go / No-go recommendation** — with confidence level

---

## 10. Technical Architecture

### Frontend
- React + TypeScript
- Tailwind CSS + shadcn/ui
- Deployed to Vercel

### Backend
- FastAPI (Python)
- WebSocket for real-time agent event streaming to frontend

### Agent Runtime
- browser-use (Playwright-based LLM-driven browser)
- OpenAI GPT-4o (agent decision-making + recommendations)
- Claude claude-sonnet-4-6 (optional: listing copy rewriting)

### Data
- Shopee listing scraper (BeautifulSoup / Playwright)
- Competitor price dataset (mocked for hackathon)
- Singapore population archetype weights (hardcoded, based on SG demographic data)

### Storage
- In-memory for hackathon build
- Agent traces + screenshots stored in `/tmp` per run session

---

## 11. Design System

### Color tokens (warm dark mode)

```css
--bg:        oklch(0.165 0.008 70)   /* near-black, warm */
--panel:     oklch(0.205 0.008 72)   /* card surface */
--fg:        oklch(0.945 0.012 88)   /* primary text, warm white */
--muted:     oklch(0.68 0.014 82)    /* secondary text */
--accent:    oklch(0.79 0.14 45)     /* orange, primary accent */
--green:     oklch(0.8 0.15 145)     /* bought / success */
--red:       oklch(0.72 0.16 25)     /* bailed / warning */
```

### Archetype colors (equal L=0.74, C=0.135, varied hue)

| Archetype | Hue |
|---|---|
| XMM | 10 (warm red) |
| Auntie | 75 (amber) |
| Nerd | 175 (teal) |
| Geek | 300 (purple) |
| Insecure | 250 (blue-violet) |
| Budget-tight | 145 (green) |
| High-spender | 40 (orange-gold) |

### Typography

| Role | Font | Weight |
|---|---|---|
| Display / numbers | Bricolage Grotesque | 800 |
| UI / body | Hanken Grotesk | 400–700 |
| Labels / mono data | Space Mono | 400 |

### Layout

- 16–18px padding, 14px internal gaps
- 14px border-radius on panels
- Grid: `header / agent-strip / (funnel-track | right-rail)`
- Right rail: 350px fixed; funnel track fills remainder

---

## 12. Hackathon Scope

### Must-have (demo day)
- [ ] Live funnel track with animated agent dots (frontend, full design)
- [ ] Agent preview strip (browser thumbnails or fallback text tiles)
- [ ] Activity feed with Singlish objection streaming
- [ ] Persona roster with live buy rates
- [ ] 7 archetypes with per-stage bail probabilities
- [ ] Tweaks panel (persona mix, speed, price)
- [ ] At least 1 real browser-use session demonstrating the Shopee flow
- [ ] Recommendations panel with 3 AI-generated listing fixes
- [ ] Viability report summary

### Nice-to-have
- [ ] Full 60-agent parallel run (real browser-use, not mocked)
- [ ] Before/after scenario comparison view
- [ ] Screenshot gallery at drop-off stages
- [ ] Automated improvement loop (up to 10 iterations)
- [ ] Revenue projection chart

### Out of scope
- User authentication
- Multi-listing support
- Real Shopee seller API integration
- Mobile responsive layout

---

## 13. Success Criteria

| Metric | Target |
|---|---|
| Demo runs without crash | ✓ |
| Simulation completes in < 5 min (demo mode) | < 5 min |
| Funnel animation is readable and live | ✓ |
| Recommendations are specific and actionable | 3+ distinct fixes |
| Judges can see agent personality in feed | Singlish objections visible |
| Buy rate responds to price slider change | < 1s re-sim |

---

## 14. Key Demo Beats

1. **Open dashboard** — 7 colored archetype dots start flowing through the funnel
2. **Agent preview strip** — browser thumbnails show real agents on the Shopee listing
3. **Price spike** — drag price slider up → buy rate tanks live, Budget-tight agents bail immediately
4. **Objection feed** — "Over budget liao, next." / "Never hear of this brand one." scroll by
5. **Run completes** — Photos and Price emerge as the two killers
6. **AI recommends** — "Add lifestyle photos for XMM archetype: Est. +9% buy rate"
7. **Re-run after fix** — buy rate rises, delta shown

---

