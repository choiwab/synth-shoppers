from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routes import router as routes_router
from api.ws import router as ws_router
from contracts import ListingConfig
from env import load_env
from sim.runner import registry

load_env()  # pick up backend/.env (OPENAI_API_KEY, LISTING_BASE_URL) if present

app = FastAPI(title="Synthetic Shoppers Simulation Engine")


def _real_driver_factory(listing: ListingConfig):
    # Lazy import so mock mode / tests never require browser-use or Chromium.
    from sim.browser_use_driver import BrowserUseAgenticDriver

    return BrowserUseAgenticDriver(listing)


# Register H3's autonomous browser-use driver for `mode: "real"` runs.
registry.set_real_driver_factory(_real_driver_factory)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_router)
app.include_router(ws_router)
app.mount("/static", StaticFiles(directory="/tmp", check_dir=False), name="static")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

