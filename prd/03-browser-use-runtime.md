# PRD 03 — Browser-Use Runtime & Live Browser Demo

> **Owner:** H3 (BE-Browser) · **Branch:** `h3-browser` · **Stack:** Python · browser-use · Playwright
> **Read first:** [`00-OVERVIEW.md`](00-OVERVIEW.md) — shared contracts §5 (esp. §5.5 `BrowserDriver`, §5.6 selectors).
> **Parent:** [`../PRD.md`](../PRD.md) §7.1, §7.2, §10 (Agent Runtime).

---

## 1. Scope (what you own)

The **real browser layer**. You make LLM-driven agents actually navigate H2's
Shopee page in a real Playwright session, capture screenshots at every gate, and
expose all of it behind one clean interface (`BrowserDriver`) that H4's runner
calls. You also own the **"≥1 real browser-use session" demo** (PRD §12
must-have) and the live thumbnail feed that powers H1's agent strip.

You **own**:
- browser-use + Playwright integration (`backend/browser/`).
- The `BrowserDriver` implementation (real) satisfying OVERVIEW §5.5.
- Navigation logic over H2's selector contract (OVERVIEW §5.6): land→…→checkout.
- Per-agent session lifecycle + **10 concurrent sessions** (PRD §7.2).
- Screenshot capture per gate + thumbnail generation + static serving of URLs.
- Live frame/thumbnail emission (so H1 shows real browser previews).
- The standalone single-agent demo script.

You **do NOT** own:
- Persona prompts / bail probabilities / orchestration → H4 ([`04`](04-simulation-engine.md)).
- The page being driven → H2 ([`02`](02-shopee-interface.md)).
- The dashboard that displays thumbnails → H1 ([`01`](01-dashboard-interface.md)).

> **Boundary with H4:** H4 owns *what the agent decides* (the persona LLM call
> returning `continue/bail/buy` + objection). You own *how the browser moves and
> what it sees*. The clean line: H4's runner loops the gates and, at each, asks
> you (`goto_gate`/`act` + `screenshot`) for the `PageState`, then asks the LLM
> for a decision. Agree at M0 whether the per-step LLM call lives in H4's runner
> (recommended) or is passed into your driver as a callback.

---

## 2. Dependencies

| You need | From | Until ready, build against |
|---|---|---|
| The Shopee page + stable selectors | H2 | **`shopee-stub.html`** (OVERVIEW §5.6) — H2 ships day 1. Build all nav against the stub; it swaps to the real page transparently. |
| `ListingConfig` (URL/params to load a given config) | H2 | `fixtures/listing.sample.json`. |
| The caller shape (`BrowserDriver` Protocol) | OVERVIEW §5.5 | Defined — implement to it; test with a fake caller. |
| LLM decision per step (if callback model chosen) | H4 | A stub decision fn (`always continue`) so you can prove navigation end-to-end. |

| Others depend on YOU | Who |
|---|---|
| `BrowserDriver` (real) | H4 (runner swaps `MockBrowserDriver` → yours) |
| Thumbnail/screenshot URLs | H1 (agent strip), H2 (journey log screenshots) |

You can reach a working **single-agent real run** using only H2's stub + a stub
decision fn — no H4 needed. That's your M3 target.

---

## 3. Tech setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install browser-use playwright openai pillow
playwright install chromium
# .env: OPENAI_API_KEY=...
```

`backend/requirements.txt` is shared with H4 — append, don't overwrite.

---

## 4. Implementation

### 4.0 File structure (`backend/browser/`)

```
backend/
  contracts.py              # Pydantic mirror of OVERVIEW §5 (shared w/ H4)
  browser/
    driver.py               # RealBrowserDriver(BrowserDriver) + PageState
    mock_driver.py          # optional: a 2nd mock (H4 also has one) for your tests
    navigation.py           # gate map: selectors -> actions (OVERVIEW §5.6)
    screenshots.py          # capture, crop, thumbnail, save, -> URL
    pool.py                 # concurrency: up to 10 live sessions
  demo/
    single_agent_demo.py    # the must-have standalone demo
  static/shots/             # served screenshots (FastAPI StaticFiles, mounted by H4)
```

### 4.1 `RealBrowserDriver` (OVERVIEW §5.5)

Implement the Protocol exactly:

```python
class RealBrowserDriver:
    async def open(self, listing_url, agent_id) -> BrowserSession: ...
    async def goto_gate(self, s, gate) -> PageState: ...   # scroll/route to data-gate=<gate>
    async def act(self, s, action) -> PageState: ...       # click data-action=<action>
    async def screenshot(self, s) -> str:                  # -> "/static/shots/<agent>/<n>.jpg" URL
    async def close(self, s) -> None: ...
```

- `PageState.text` = a compact rendered summary the LLM reads (title, price,
  rating, review snippet, current gate, visible CTA) — extracted via the
  `data-field` hooks (OVERVIEW §5.6). Keep it short; the LLM only needs decision
  signal, not full DOM.
- `PageState.screenshot_url` = result of `screenshot()`. `scroll_pct` = current
  scroll for H1's thumbnail cropping.

### 4.2 Navigation (`navigation.py`)

Map the funnel to concrete browser ops over the selector contract:

| Gate | How you reach it |
|---|---|
| `land` | `open(listing_url)`; read `data-field`s. |
| `photos` | scroll to `data-gate="photos"`, click `data-action="scroll-gallery"`. |
| `reviews` | scroll to `data-gate="reviews"`, click `data-action="open-reviews"`. |
| `price` | scroll to `data-gate="price"`, optionally `data-action="select-variant"`. |
| `cart` | click `data-action="add-to-cart"`. |
| `checkout` | click `data-action="checkout"`. |
| `bought` | click `data-action="confirm-order"`. |

Prefer **selector-driven, deterministic** navigation over letting browser-use
free-roam — it's faster, reliable, and demo-safe. Use browser-use's agent
capability where free interaction adds realism, but always fall back to direct
selectors. Handle "selector not found" gracefully (return a `PageState` flagged
so H4 can treat it as a bail/skip).

### 4.3 Screenshots & thumbnails (`screenshots.py`)

- Capture a JPEG at every `goto_gate` transition (PRD §5/§7.1: "screenshot at
  each gate").
- Generate a **160×120 thumbnail** cropped to the agent's scroll position (for
  H1's strip) plus a full-size shot (for H2's journey log).
- Save under `static/shots/<agent_id>/<gate>.jpg`; return the **URL path** (not
  bytes). H4 mounts `StaticFiles` so the frontend can fetch them. Confirm the
  mount path with H4 at M0 (`/static/shots/...`).
- Keep file sizes small (quality ~70, the thumbnail especially) — 60 agents × 6
  gates is a lot of frames.

### 4.4 Concurrency (`pool.py`) — PRD §7.2

- Up to **10 concurrent** Playwright contexts/pages (semaphore). One browser,
  many contexts (cheaper than many browsers).
- Lifecycle: acquire → `open` → run gates → `close` → release. Guarantee
  `close()` on error (context manager). Cap memory: reuse contexts if possible.
- Expose a simple `async run_agent(agent_id, listing_url, decide_fn)` helper H4
  can call, OR keep it pure-driver and let H4 own the loop — decide at M0 per the
  boundary note in §1.

### 4.5 Live frame emission (for H1's agent strip)

Each gate transition should make a thumbnail available promptly so the runner
(H4) can emit `browser_frame` / `stage_enter{thumbnail_url}` events. You just
produce the URL fast; H4 emits the event. Optionally provide a callback hook
`on_frame(agent_id, thumbnail_url, scroll_pct)` the runner subscribes to.

### 4.6 The demo (`demo/single_agent_demo.py`) — PRD §12 must-have

A standalone script: one persona, real browser-use, navigates H2's Shopee page
end-to-end (land→checkout/buy), prints the decision trace, saves screenshots.
This is the "at least 1 real browser-use session" deliverable and your safety net
if full parallel real-mode isn't ready for the demo. Make it reliable and
headed-mode capable (so judges can watch the browser move).

---

## 5. Performance & reliability targets (PRD §7.2, §13)

- 60 agents @ 10 concurrent, real mode: ~3–4 min wall (don't block the demo on
  this — fast/mock mode is H4's path for the live demo).
- Single-agent demo: rock-solid, <60s, headed.
- No crashes from a missing selector — degrade to a clean bail.
- Screenshots never block the decision loop (capture async / fire-and-forget the
  thumbnail write where possible).

---

## 6. Definition of done

- [ ] `RealBrowserDriver` satisfies OVERVIEW §5.5; passes a contract test with a
      fake caller.
- [ ] Drives `shopee-stub.html` through all 6 gates via the selector contract.
- [ ] Drives H2's real `ShopeePage` once available (M3) with no code change.
- [ ] Screenshots + 160×120 thumbnails saved and served as URLs; confirmed
      visible in H1's strip and H2's journey log.
- [ ] 10 concurrent sessions stable; clean teardown on success/error.
- [ ] `single_agent_demo.py` runs a full real browser-use session reliably (headed).
- [ ] H4's runner runs in real mode by swapping in your driver (M4).

## 7. Demo beats you enable (PRD §14)

Beat 2 ("browser thumbnails show real agents on the Shopee listing") and the
credibility moment of a real browser visibly shopping. You are the proof that
this isn't just animated dots.
