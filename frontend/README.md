# Synthetic Shoppers — Frontend (H1 dashboard + H2 surfaces)

Shared Vite + React + TS app. **H1** owns the scaffold, design system, and the
live simulation monitor. **H2** adds the Shopee page and the report surfaces into
the routes/placeholders reserved here.

## Run

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173  (mock mode on by default — see below)
npm run typecheck  # tsc, clean
npm run lint       # eslint, clean
npm run build      # tsc -b && vite build
```

The committed `.env.development` sets `VITE_MOCK=1`, so `npm run dev` replays
`public/fixtures/events.sample.jsonl` with **no backend** (milestone M1) — clone
and run, the dashboard animates a full run on its own. To run against H4's live
engine, set `VITE_MOCK=0` (e.g. in a local `.env.local`) and point
`VITE_API_BASE` / `VITE_WS_BASE` at the FastAPI server.

## Routes

| Route | Owner | Notes |
|---|---|---|
| `/` | **H1** | Live simulation monitor (this PRD). |
| `/report/:runId` | **H2** | Placeholder in `app/ReportRoute.tsx`. Dashboard navigates here on `run_complete` ("View Report"). Replace with analytics / recommendations / viability report. |
| `/shopee/:listingId` | **H2** | Placeholder in `app/ShopeeRoute.tsx`. Replace with `<ShopeePage/>`. |

## Integration surface (what H2 imports from H1)

- **`src/types/contracts.ts`** — canonical TS mirror of `00-OVERVIEW.md` §5
  (`AgentEvent`, `ListingConfig`, REST bodies, `ViabilityReport`,
  `Recommendation`, `PersonaId`, `FunnelStage`, archetype hues). One import
  surface for both halves of the frontend. **Change here first, then ping.**
- **`src/styles/tokens.css`** — design tokens + archetype color vars. Imported
  via `src/index.css`. Do not introduce a second palette.
- **`src/lib/archetype.ts`** — `archetypeColor(id)`, labels, initials. Use these
  for any persona-colored UI so colors stay consistent across H1/H2.

## Contract extension — market / competitor funnel (pending H4)

The funnel now shows an upstream **Market** stage: of the whole crowd, who even
*considers* our listing vs. leaks to a competitor before `land`. This is an
**additive, forward-compatible** extension of OVERVIEW §5 (flagged to H4):

- `FunnelStage` += `"discovery"` (intake, where agents spawn) and `"diverted"`
  (terminal — left for a competitor).
- New event **`agent_diverted`** `{ agent_id, competitor, competitor_name?,
  converted?, reason? }` — emitted at discovery when an agent picks a competitor
  instead of us. `converted` drives the competitor's mini-funnel (land → bought).
- `run_started` += optional `competitors: { id, name }[]` (declares destinations;
  the reducer also lazily creates any competitor seen only in events).
- Agents now spawn at `discovery`; a `stage_enter:"land"` means they chose us.

Until H4 emits these, nothing breaks: the mock fixture (`scripts/genFixture.mjs`)
already produces them, and a stream without them simply shows no leakage (every
agent goes straight into the funnel). Keep competitor detail lean — H4/H3 own the
richer per-agent behavior.

## Agent spotlight — big featured window (teammate integration)

The Agent Preview shows **7 agents**: one representative per archetype (the
first-spawned of each persona, in canonical order). One is *featured* in the big
left window; the other 6 are small tiles on the right. Clicking a small tile
promotes it; the previously-featured agent drops back into the grid. The default
featured agent is the first persona's rep and auto-resets on a new run.

**Integration point:** the big window's detail content lives in
`src/components/FeaturedAgentDetails.tsx` — a stub that receives the featured
`AgentState`. H1 owns the enlarged visual + meta (`FeaturedAgentView`) and keeps
the detail component in sync with the selected agent; the teammate builds the
rich content (e.g. live/enlarged browser view, step trace) inside that one file.

## Swapping the fixture for H4's stream

The mock player (`src/store/mockSocket.ts`) and real WS client
(`src/store/socket.ts`) share the `SimSocket` interface and the **same sink**
(`simStore.apply`). When H4 commits `fixtures/events.sample.jsonl`, drop it into
`public/fixtures/` (or regenerate the stopgap with
`node scripts/genFixture.mjs public/fixtures/events.sample.jsonl`). The player
path is identical — the swap is free.

## Architecture

```
store/
  simStore.ts       zustand: the AgentEvent reducer (heart of PRD 01 §4.1)
  controlStore.ts   tweaks state (persona mix, crowd size, speed, price)
  runController.ts  start/rerun/pause/resume — wires API + socket + store
  api.ts            REST client (OVERVIEW §5.7); fabricates run_id in mock mode
  socket.ts         real WS client (reconnect/backoff, pause-buffering)
  mockSocket.ts     fixture player (timestamp-honoring, speed-scaled)
app/                Sidebar (left rail: listing + run controls), AgentStrip
                    (spotlight: 1 featured + 6 small, one rep per archetype),
                    FunnelTrack, RightRail, ActivityFeed, PersonaRoster,
                    TweaksPanel, App shell (sidebar | resizable main column),
                    route placeholders
components/         AgentTile, AgentDot, PriceChip, StatusBadge,
                    FeaturedAgentView, FeaturedAgentDetails (⛳ teammate slot)
components/         AgentTile, AgentDot, PriceChip, StatusBadge
```

Forward-compat: unknown `AgentEvent.type` values are ignored (OVERVIEW §5.3).
