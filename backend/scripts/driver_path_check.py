"""Verify the REAL driver's navigation contract against the live frontend.

Uses the driver's actual URL builder + selector/nav constants (no LLM, no browser-use)
and replays its exact tool sequence with Playwright, proving the page the driver opens
is config-driven and that its funnel — including the /cart -> /checkout hops — reaches
the order-confirmed page.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from contracts import ListingConfig  # noqa: E402
from sim.browser_use_driver import (  # noqa: E402
    CONFIRM_ACTION,
    GATE_ACTION,
    GATE_NAV,
    BrowserUseAgenticDriver,
)

BASE = os.environ.get("FRONTEND_BASE", "http://localhost:5173").rstrip("/")
results: list[tuple[str, bool, str]] = []


def log(step: str, ok: bool, detail: str = "") -> None:
    results.append((step, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {step}" + (f" — {detail}" if detail else ""))


async def click_css(page, selector: str) -> bool:
    loc = page.locator(selector).first
    if await loc.count() == 0:
        return False
    await loc.scroll_into_view_if_needed()
    await loc.click()
    await page.wait_for_timeout(450)
    return True


async def main() -> int:
    listing = ListingConfig.model_validate(json.loads((ROOT / "fixtures/listing.sample.json").read_text()))
    # mutate the price so we can PROVE ?config= injection (not just the fixture fallback)
    mutated = listing.model_copy(update={"price": 99.99})
    driver = BrowserUseAgenticDriver(mutated, base_url=BASE)
    url = driver._page_url(mutated.id, mutated)  # the EXACT url the driver opens
    print(f"driver opens: {url[:90]}...\n")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        try:
            # 1. the driver's URL lands on the product page
            await page.goto(url, wait_until="domcontentloaded")
            await page.wait_for_timeout(700)
            log("driver URL -> product page", await page.locator("[data-listing-id]").count() > 0, page.url.split(BASE)[-1][:48])

            # 2. ?config= injection rendered (mutated price 99.99, not the fixture's 36.90)
            price_txt = ""
            if await page.locator('[data-field="price"]').count():
                price_txt = (await page.locator('[data-field="price"]').first.inner_text()).strip()
            log("?config= injection rendered", "99" in price_txt, f"price shows '{price_txt}' (expected ~99.99)")

            # 3. funnel gates in order, exactly like the driver's tools
            for gate in ["photos", "reviews", "price", "cart"]:
                ok = await click_css(page, f'[data-action="{GATE_ACTION[gate]}"]')
                log(f"gate {gate}: click [data-action={GATE_ACTION[gate]}]", ok)

            # 4. checkout: GATE_NAV (cart icon) -> /cart, then click Check Out -> /checkout
            nav = GATE_NAV["checkout"]
            await click_css(page, nav)
            await page.wait_for_timeout(400)
            log(f"checkout: navigate via {nav}", "/cart" in page.url, page.url.split(BASE)[-1])
            await click_css(page, f'[data-action="{GATE_ACTION["checkout"]}"]')
            await page.wait_for_timeout(500)
            log("checkout: Check Out -> /checkout", "/checkout" in page.url, page.url.split(BASE)[-1])

            # 5. confirm-order -> /order-confirmed
            await click_css(page, f'[data-action="{CONFIRM_ACTION}"]')
            await page.wait_for_timeout(600)
            log("confirm-order -> /order-confirmed", "/order-confirmed" in page.url, page.url.split(BASE)[-1])
        finally:
            await browser.close()

    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\nDRIVER-PATH: {passed}/{len(results)} passed")
    for s, ok, d in results:
        if not ok:
            print(f"   FAIL: {s}  {d}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
