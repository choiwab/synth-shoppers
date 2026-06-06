"""Standalone single-agent browser-use demo (PRD §4.6 must-have).

Runs ONE autonomous browser-use agent (headed, so judges watch the browser move)
through the local Shopee stub end to end, streams the contract events to the
console, saves per-gate thumbnails under /tmp/shots, and prints the final trace.

This is H3's proof-of-life and demo safety net — it exercises the exact same
`run_journey` the runner calls for the 7-agent run, just with headless=False.

Usage:
    cd backend
    python demo/single_agent_demo.py            # default persona: budget
    python demo/single_agent_demo.py xmm        # any of the 7 PersonaIds

Requires:  pip install -r requirements-browser-use.txt ; playwright install chromium
           export OPENAI_API_KEY=...
A tiny http server for the stub is started automatically (no manual step).
"""

from __future__ import annotations

import asyncio
import functools
import http.server
import json
import socketserver
import sys
import threading
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from contracts import ListingConfig  # noqa: E402
from env import load_env  # noqa: E402
from sim.agents import PERSONAS  # noqa: E402
from sim.browser_use_driver import BrowserUseAgenticDriver  # noqa: E402

load_env()  # pick up OPENAI_API_KEY / LISTING_BASE_URL from backend/.env

STUB_DIR = BACKEND / "demo" / "stub"
LISTING = BACKEND.parents[0] / "fixtures" / "listing.sample.json"


def _serve_stub(port: int = 8080) -> str:
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(STUB_DIR))
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{port}"


async def _print_event(event: object) -> None:
    payload = event.model_dump(exclude_none=True) if hasattr(event, "model_dump") else event
    print(json.dumps(payload))


async def main() -> None:
    archetype = sys.argv[1] if len(sys.argv) > 1 else "budget"
    if archetype not in PERSONAS:
        raise SystemExit(f"unknown persona '{archetype}'; choose from {list(PERSONAS)}")

    base_url = _serve_stub()
    listing = ListingConfig.model_validate(json.loads(LISTING.read_text()))
    driver = BrowserUseAgenticDriver(listing, headless=False, max_steps=15, base_url=base_url)

    print(f"# stub at {base_url}  ·  persona: {archetype}\n")
    trace = await driver.run_journey(
        listing_url=listing.id,
        agent_id=f"{archetype}_demo",
        name=PERSONAS[archetype].names[0],
        archetype=archetype,  # type: ignore[arg-type]
        listing=listing,
        seed=1,
        run_id="run_demo",
        emit=_print_event,
    )
    print("\n=== RESULT ===")
    print(trace.model_dump_json(indent=2))


if __name__ == "__main__":
    asyncio.run(main())
