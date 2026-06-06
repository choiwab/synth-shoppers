# PRD 01 — Dashboard Interface (Live Simulation Monitor)

> **Owner:** H1 (FE-Dashboard) · **Branch:** `h1-dashboard` · **Stack:** React + TypeScript + Tailwind + shadcn/ui (Vercel)
> **Read first:** [`00-OVERVIEW.md`](00-OVERVIEW.md) — shared contracts §5.
> **Parent:** [`../PRD.md`](../PRD.md) §6.1, §6.2, §11.

---

## 1. Scope (what you own)

The **primary screen**: the real-time simulation monitor. Everything that
animates while a run is in flight. You own the app shell, the design system, and
the live dashboard's four regions, plus the tweaks drawer.

You **own**:
- App scaffold (`frontend/`), routing, global state store, WebSocket client.
- Design system: `tokens.css`, fonts, archetype color helpers (shared with H2).
- **Row 1 — Header** (brand, listing identity, price chip, run controls).
- **Row 2 — Agent Preview Strip** (browser-thumbnail tiles + fallback text tiles).
- **Row 3 — Funnel Track** (animated dot-flow, gates, bail sediment, bought vault, tooltips).
- **Row 3 — Right Rail** (Activity Feed + Persona Roster).
- **Tweaks Panel** (side drawer: persona mix, crowd size, speed, price).

You **do NOT** own (other PRDs):
- The Shopee listing page itself → H2 ([`02`](02-shopee-interface.md)).
- Analytics view / recommendations panel / viability report UI → H2.
- Event generation, personas, API → H4 ([`04`](04-simulation-engine.md)).
- Screenshot/thumbnail production → H3 ([`03`](03-browser-use-runtime.md)).

---

## 2. Dependencies

| You need | From | Until ready, build against |
|---|---|---|
| `AgentEvent` stream (WS) | H4 | **Fixture player** — replay `fixtures/events.sample.jsonl` over a fake socket (see §6). This is your day-1 unblock. |
| REST `POST /simulation/start`, `/rerun` | H4 | Same fixture player returns a fake `run_id`. |
| Thumbnail/frame URLs (`browser_frame`, `stage_enter.thumbnail_url`) | H3 | **Fallback tiles** (color + stage text) — first-class mode, §4.2. |
| Archetype colors / persona IDs | OVERVIEW §5.2 | Already defined — bake into `tokens.css`. |

You are a **pure consumer** of contracts. Nothing blocks you from M1 (dashboard
plays fixtures) once H4 commits one recorded fixture. Coordinate with H2 on the
shared `frontend/` scaffold and `tokens.css` ownership (you seed both).

---

## 3. Tech setup

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npx shadcn@latest init
npm install zustand framer-motion clsx
npm run dev       # http://localhost:5173
```

Commands (per CLAUDE.md): `npm run dev`, `npm run build`, `npm run lint`,
`npm run typecheck`.

Add `VITE_API_BASE` / `VITE_WS_BASE` env (default `http://localhost:8000` /
`ws://localhost:8000`). A `VITE_MOCK=1` flag forces the fixture player.

---

## 4. Implementation

### 4.0 File structure (your part of `frontend/`)

```
frontend/src/
  app/
    App.tsx                 # 3-row grid layout
    Header.tsx              # Row 1
    AgentStrip.tsx          # Row 2
    FunnelTrack.tsx         # Row 3 main
    RightRail.tsx           # Row 3 rail container
    ActivityFeed.tsx
    PersonaRoster.tsx
    TweaksPanel.tsx         # side drawer
  components/
    AgentTile.tsx           # one preview tile
    AgentDot.tsx            # one funnel dot
    PriceChip.tsx
    StatusBadge.tsx
  store/
    simStore.ts             # zustand: agents, gates, feed, roster, run meta
    socket.ts               # WS client + reconnect
    mockSocket.ts           # fixture player (dep-free dev)
  styles/tokens.css         # design tokens (you own; H2 imports)
  types/contracts.ts        # mirror of OVERVIEW §5 (seed once, shared)
  lib/archetype.ts          # color/label helpers from PersonaId
```

### 4.1 State store (`simStore.ts`)

Single zustand store, updated by the event reducer. Shape:

```ts
interface AgentState {
  agent_id: string; name: string; archetype: PersonaId;
  stage: FunnelStage;                 // current gate or terminal
  outcome: "active" | "bought" | "bailed";
  objection?: string;
  thumbnail_url?: string; scroll_pct?: number;
  retention_time_s?: number;
}
interface SimStore {
  runId?: string;
  listing?: { title: string; price: number; seller: string };
  status: "idle" | "running" | "paused" | "complete";
  agents: Record<string, AgentState>;
  gateCounts: Record<FunnelStage, number>;     // derived per render or maintained
  bailsByGate: Record<FunnelStage, number>;
  feed: FeedItem[];                              // newest-first, cap 60
  roster: Record<PersonaId, { total: number; bought: number; bailed: number }>;
  apply(ev: AgentEvent): void;                   // the reducer
  reset(): void;
}
```

**Event → state mapping** (the reducer, the heart of this PRD):

| Event | Effect |
|---|---|
| `run_started` | set `listing`, `status="running"`, reset agents |
| `agent_spawned` | add agent at `stage:"land"`, `outcome:"active"`; `roster[arch].total++` |
| `stage_enter` | move agent to `stage`; set `thumbnail_url` if present |
| `browser_frame` | update agent `thumbnail_url`, `scroll_pct` |
| `objection` | prepend `FeedItem` (neutral); set agent `objection` |
| `agent_bailed` | agent `outcome="bailed"`, `stage=ev.stage`; `bailsByGate[stage]++`; `roster[arch].bailed++`; prepend feed item (bail) |
| `agent_bought` | agent `outcome="bought"`; `roster[arch].bought++`; prepend feed item (buy, green) |
| `run_progress` | optional header counters |
| `run_complete` | `status="complete"`; surface "View Report" affordance (handoff to H2) |

Keep the reducer pure and idempotent-ish; cap `feed` at 60 items.

### 4.2 Row 2 — Agent Preview Strip (`AgentStrip.tsx`, `AgentTile.tsx`)

Replaces stat-number cards (PRD §6.1 Row 2). Fluid grid of tiles, sorted by
archetype then spawn order.

Each `AgentTile`:
- **160×120** viewport.
- If `thumbnail_url` present → `<img>` cropped to the agent's scroll position;
  else **fallback mode**: archetype avatar dot + agent name + current stage label
  + last action text. *Both modes ship; fallback is the default until H3 lands.*
- Archetype-colored 2px border (from `lib/archetype.ts`).
- Footer label: agent name + tag (Space Mono 9px) + current stage.
- State styling: `active` → subtle pulse; `bailed` → grayscale + 55% opacity;
  `bought` → green glow ring.
- Render decision per tile: `thumbnail_url ? <Thumb/> : <FallbackTile/>` — never
  blank.

Performance: with 60 tiles updating from a stream, memoize tiles
(`React.memo` keyed on `agent_id` + relevant fields) so only changed tiles
re-render.

### 4.3 Row 3 main — Funnel Track (`FunnelTrack.tsx`, `AgentDot.tsx`)

The signature visual. Horizontal pipeline, 6 gates `land…checkout` left→right,
then a **Bought vault** on the far right.

- **Gate columns** above the pipe: stage number, name, live count here.
- **Agent dots** (14px, archetype-colored) cluster at their current gate. Use
  `framer-motion` `layout` animation so dots glide between gates on stage change.
- **Bail sediment band** below the pipe ("WHERE THEY BAILED"): a bailed dot peels
  downward and settles under the gate it bailed at. Red `↓ N bailed` drop chip
  per gate.
- **Bought vault**: green-bordered collector on the right; bought dots flow in.
- **Tooltip on hover**: agent name · archetype · current stage · last objection.
- Empty/idle state: faint gate skeleton + "Press Run".

Aim for readability over realism — clustering + counts must be legible at 60
agents. Throttle layout animations if the stream is bursty (batch store updates
per animation frame).

### 4.4 Row 3 rail — Activity Feed + Persona Roster

**ActivityFeed.tsx** (top, larger): newest-first list, auto-scroll, cap 60.
Each item: archetype dot · agent name · relative time · action text (Singlish
objection or "bought ✓"). Buy items get a green left-border; bails neutral.
Pause auto-scroll when the user scrolls up.

**PersonaRoster.tsx** (bottom): one row per *enabled* archetype — avatar dot ·
name · tag · animated horizontal buy-rate bar · `buy% (bought/total)`. Buy rate =
`bought / total` from `roster`. Sort by buy rate descending once
`status==="complete"`; stable order while running.

### 4.5 Row 1 — Header (`Header.tsx`)

One row, no nav/tabs. Contains:
- **Brand mark**: conic-gradient dot + "Synthetic" wordmark + "live shopper sim".
- **Listing identity**: thumbnail placeholder + title + seller + market (SG) +
  star rating (from `listing` / `ListingConfig`).
- **PriceChip**: live S$; turns red (`--red`) when `price > base_price`.
- **Run controls**: Pause/Resume, Re-run, **settings (⚙) → opens Tweaks Panel**,
  `StatusBadge` (pulsing green dot when running).

Pause/Resume controls the local stream consumption + visual; Re-run calls
`POST /simulation/start` (or `/rerun`) with current tweaks.

### 4.6 Tweaks Panel (`TweaksPanel.tsx`) — PRD §6.2

Right side-drawer (shadcn `Sheet`), toggled from header ⚙.

- **Persona mix** — toggle each of 7 archetypes on/off.
- **Crowd size** — slider 20–200 (default 60).
- **Speed** — 1× / 2× / 4× segmented control (4× ⇒ request `mode:"mock"`).
- **Listing price** — slider S$10–S$60; reflects into header PriceChip live.

Changing any control **auto-resets and restarts** the sim: debounce ~300ms, then
`POST /simulation/start` with `{ crowd:{personas,crowd_size,speed}, listing_config:{…price}, mode }`.
Price-only changes should feel instant in mock mode (<1s, PRD §13).

### 4.7 WebSocket client (`socket.ts` / `mockSocket.ts`)

- `connect(runId)` → `ws://…/ws/simulation/{runId}`; parse each message as
  `AgentEvent`; call `store.apply(ev)`. Reconnect with backoff; ignore unknown
  `type`.
- `mockSocket.ts`: reads `fixtures/events.sample.jsonl`, replays with timestamps
  honored (or accelerated by `speed`), same `apply` path. Switch via `VITE_MOCK`.
  **This is what lets you finish M1 before any backend exists.**

---

## 5. Design system (you own `tokens.css`) — PRD §11

Bake these into `:root` and provide helpers. H2 imports this file.

```css
:root{
  --bg:     oklch(0.165 0.008 70);
  --panel:  oklch(0.205 0.008 72);
  --fg:     oklch(0.945 0.012 88);
  --muted:  oklch(0.68 0.014 82);
  --accent: oklch(0.79 0.14 45);
  --green:  oklch(0.8 0.15 145);
  --red:    oklch(0.72 0.16 25);
  --radius: 14px;
}
```

- Archetype color: `oklch(0.74 0.135 var(--hue))`, hues per OVERVIEW §5.2 →
  expose `archetypeColor(id)` in `lib/archetype.ts`.
- Fonts: Bricolage Grotesque 800 (display/numbers), Hanken Grotesk 400–700 (UI),
  Space Mono 400 (labels/mono). Load via `@fontsource` or Google Fonts.
- Layout: 16–18px padding, 14px gaps, 14px radius panels. Grid:
  `header / agent-strip / (funnel-track | right-rail)`; right rail 350px fixed,
  funnel track fills remainder. Desktop-only (mobile out of scope).

Use the claude.ai/design HTML prototype (referenced in PRD §11 / CLAUDE.md) as
the visual source of truth for class names + component structure.

---

## 6. Fixtures you depend on (and a stopgap you can self-author)

H4 commits `fixtures/events.sample.jsonl`. If it's not there yet, hand-write a
~40-line `.jsonl` of `run_started → agent_spawned ×N → stage_enter / objection /
agent_bailed / agent_bought → run_complete` so you can build immediately. Replace
with H4's real fixture at M2. Keep the player path identical so the swap is free.

---

## 7. Definition of done

- [ ] 3-row layout matches PRD §6.1 / prototype; desktop.
- [ ] Dashboard animates a full run from fixtures (**M1**) and from live WS (**M2**).
- [ ] Agent strip renders both thumbnail mode and fallback mode; tile states
      (active/bailed/bought) correct.
- [ ] Funnel dots glide between gates; bails sediment under correct gate; bought
      vault fills; tooltips work.
- [ ] Activity feed streams Singlish objections newest-first, auto-scroll + pause.
- [ ] Persona roster bars animate; buy rates correct; sort-on-complete.
- [ ] Tweaks panel re-runs on change; price slider tints chip; 4× ⇒ mock mode.
- [ ] Handoff to report: "View Report" appears on `run_complete` (routes to H2).
- [ ] `npm run typecheck` + `npm run lint` clean; 60 agents render smoothly.

## 8. Demo beats you enable (PRD §14)

1, 3, 4, 5 directly: dots flow on open; price spike tanks buy rate live;
objections scroll by; Photos/Price emerge as killers. Beats 2 (thumbnails) and
6–7 (recs/re-run) are shared with H3/H2 — make sure the strip + re-run hooks are
ready for them.
