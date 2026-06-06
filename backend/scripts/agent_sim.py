"""Agent simulator — drives the REAL frontend the way browser-use does.

browser-use's loop is: (1) perceive the page as a list of interactive elements +
a screenshot, (2) the LLM decides an action ("click element N" / scroll / go back),
(3) execute. This harness replicates that mechanically with Playwright (the same
engine browser-use drives under the hood) so we can prove the frontend supports the
full shopper journey — click, scroll, back, and "what buttons can it see".

Run:  FRONTEND_BASE=http://localhost:5180 .venv/bin/python scripts/agent_sim.py
"""

from __future__ import annotations

import asyncio
import os
import sys

from playwright.async_api import async_playwright

BASE = os.environ.get("FRONTEND_BASE", "http://localhost:5173").rstrip("/")
HEADLESS = os.environ.get("HEADLESS", "1") != "0"

results: list[tuple[str, bool, str]] = []
console_errors: list[str] = []


def log(step: str, ok: bool, detail: str = "") -> None:
    results.append((step, ok, detail))
    mark = "PASS" if ok else "FAIL"
    print(f"  [{mark}] {step}" + (f" — {detail}" if detail else ""))


SEE_JS = r"""() => {
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  return [...document.querySelectorAll('a[href],button,[data-action],[role=button],input')]
    .filter(vis)
    .map(e => ({
      tag: e.tagName.toLowerCase(),
      text: (e.innerText || e.value || e.getAttribute('aria-label') || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      action: e.getAttribute('data-action'),
      href: e.getAttribute('href'),
    }));
}"""


async def see(page) -> list[dict]:
    return await page.evaluate(SEE_JS)


def show_view(label: str, els: list[dict], limit: int = 22) -> None:
    actions = [e for e in els if e["action"]]
    print(f"\n  what the agent SEES on {label}: {len(els)} interactive elements"
          + (f", incl. funnel hooks: {[e['action'] for e in actions]}" if actions else ""))
    for e in els[:limit]:
        if e["action"]:
            handle = f"[data-action={e['action']}]"
        elif e["href"]:
            handle = f"-> {e['href']}"
        else:
            handle = f"<{e['tag']}>"
        print(f"       - {(e['text'] or '(no text)'):<40} {handle}")
    if len(els) > limit:
        print(f"       ... +{len(els) - limit} more")


async def click_action(page, action: str) -> bool:
    loc = page.locator(f'[data-action="{action}"]').first
    if await loc.count() == 0:
        return False
    await loc.scroll_into_view_if_needed()
    await loc.click()
    await page.wait_for_timeout(450)  # match the driver's settle window
    return True


async def journey(page) -> None:
    # ── 1. HOME ──────────────────────────────────────────────────────────────
    print("\n=== SCREEN: home (/) ===")
    await page.goto(f"{BASE}/", wait_until="domcontentloaded")
    await page.wait_for_timeout(400)
    show_view("home", await see(page))
    log("load home", "Shopee" in await page.title() or await page.locator("header").count() > 0)

    # ── 2. HOME -> SEARCH (use the real search box, like a shopper) ──────────
    print("\n=== ACTION: type 'beanie' in search, submit ===")
    box = page.locator('input[name="keyword"]').first
    if await box.count():
        await box.fill("beanie")
        await page.locator('button[aria-label="Search"]').first.click()
        try:
            await page.wait_for_url("**/search**", timeout=4000)
            log("home -> /search via search box", True, page.url.split(BASE)[-1])
        except Exception:
            log("home -> /search via search box", False, f"url={page.url}")
    else:
        log("find search box", False, "no input[name=keyword]")

    await page.wait_for_timeout(500)
    cards = await see(page)
    show_view("search results", cards)
    listing_links = await page.eval_on_selector_all(
        'a[href^="/shopee/"]', "els => [...new Set(els.map(e => e.getAttribute('href')))]"
    )
    log("search shows clickable listings", len(listing_links) > 0, f"{len(listing_links)} product links")

    # ── 3. SEARCH -> the Matin Kim listing ──────────────────────────────────
    print("\n=== ACTION: click the Matin Kim listing ===")
    target = page.locator('a[href*="matin_kim_beanie_sg"]').first
    if await target.count() == 0:
        target = page.locator('a[href^="/shopee/"]').first
    await target.click()
    try:
        await page.wait_for_url("**/shopee/**", timeout=4000)
        await page.wait_for_selector("[data-listing-id]", timeout=5000)
        log("open product page", True, page.url.split(BASE)[-1])
    except Exception as exc:
        log("open product page", False, f"{type(exc).__name__}: {page.url}")

    await page.wait_for_timeout(400)
    show_view("product page", await see(page))

    # ── 4. INTERACT with the funnel gates (click 'something') ───────────────
    print("\n=== ACTION: interact with funnel gates ===")
    for action in ["scroll-gallery", "open-reviews", "select-variant"]:
        ok = await click_action(page, action)
        log(f"click [data-action={action}]", ok, "" if ok else "selector not found on page")

    # ── 5. SCROLL ───────────────────────────────────────────────────────────
    print("\n=== ACTION: scroll the page ===")
    y0 = await page.evaluate("() => window.scrollY")
    await page.mouse.wheel(0, 1400)
    await page.wait_for_timeout(300)
    y1 = await page.evaluate("() => window.scrollY")
    log("scroll down", y1 > y0, f"scrollY {y0} -> {y1}")

    # ── 6. GO BACK ──────────────────────────────────────────────────────────
    print("\n=== ACTION: go back (browser back) ===")
    await page.go_back()
    try:
        await page.wait_for_url("**/search**", timeout=4000)
        log("go back to search", True, page.url.split(BASE)[-1])
    except Exception:
        log("go back to search", False, f"url={page.url}")

    # ── 7. LOOK AT ANOTHER LISTING ──────────────────────────────────────────
    print("\n=== ACTION: open a different listing ===")
    await page.wait_for_timeout(400)
    others = await page.eval_on_selector_all(
        'a[href^="/shopee/"]',
        "els => [...new Set(els.map(e=>e.getAttribute('href')))].filter(h => !h.includes('matin_kim_beanie_sg'))",
    )
    if others:
        await page.locator(f'a[href="{others[0]}"]').first.click()
        try:
            await page.wait_for_selector("[data-listing-id]", timeout=5000)
            log("open a second listing", True, page.url.split(BASE)[-1])
        except Exception:
            log("open a second listing", False, f"url={page.url}")
        show_view("second product page", await see(page))
    else:
        log("find a second listing", False, "only one product link on search")

    # ── 8. BACK to a buyable listing + ADD TO CART ──────────────────────────
    print("\n=== ACTION: go to Matin Kim and add to cart ===")
    await page.goto(f"{BASE}/shopee/matin_kim_beanie_sg", wait_until="domcontentloaded")
    await page.wait_for_selector("[data-listing-id]", timeout=5000)
    ok = await click_action(page, "add-to-cart")
    await page.wait_for_timeout(400)
    cart_count = await page.locator('[data-field="cart-count"]').count()
    log("click [data-action=add-to-cart]", ok)
    log("cart badge updates", cart_count > 0, f"data-field=cart-count present: {cart_count>0}")

    # ── 9. OPEN CART ────────────────────────────────────────────────────────
    print("\n=== ACTION: open cart ===")
    await page.locator('a[href="/cart"]').first.click()
    try:
        await page.wait_for_url("**/cart", timeout=4000)
        log("navigate to /cart", True, page.url.split(BASE)[-1])
    except Exception:
        log("navigate to /cart", False, f"url={page.url}")
    await page.wait_for_timeout(400)
    show_view("cart", await see(page))

    # ── 10. CHECKOUT ────────────────────────────────────────────────────────
    print("\n=== ACTION: checkout ===")
    ok = await click_action(page, "checkout")
    if ok:
        try:
            await page.wait_for_url("**/checkout", timeout=4000)
            log("click [data-action=checkout] -> /checkout", True, page.url.split(BASE)[-1])
        except Exception:
            log("click [data-action=checkout] -> /checkout", False, f"url={page.url}")
    else:
        log("click [data-action=checkout]", False, "checkout button not found on /cart")
    await page.wait_for_timeout(400)
    show_view("checkout", await see(page))

    # ── 11. CONFIRM ORDER ───────────────────────────────────────────────────
    print("\n=== ACTION: place order ===")
    ok = await click_action(page, "confirm-order")
    if ok:
        try:
            await page.wait_for_url("**/order-confirmed", timeout=4000)
            log("click [data-action=confirm-order] -> /order-confirmed", True, page.url.split(BASE)[-1])
        except Exception:
            log("click [data-action=confirm-order] -> /order-confirmed", False, f"url={page.url}")
    else:
        log("click [data-action=confirm-order]", False, "confirm-order button not found on /checkout")


async def main() -> int:
    print(f"Agent simulator → {BASE}  (headless={HEADLESS})")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: console_errors.append(f"PAGEERROR: {e}"))
        try:
            await journey(page)
        finally:
            await browser.close()

    passed = sum(1 for _, ok, _ in results if ok)
    print("\n" + "=" * 64)
    print(f"RESULT: {passed}/{len(results)} steps passed")
    for step, ok, detail in results:
        if not ok:
            print(f"   FAIL: {step}  {detail}")
    if console_errors:
        print(f"\n  {len(console_errors)} console/page errors (first 5):")
        for e in console_errors[:5]:
            print(f"   ! {e[:160]}")
    print("=" * 64)
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
