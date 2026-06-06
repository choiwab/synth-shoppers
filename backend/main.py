from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routes import router as routes_router
from api.ws import router as ws_router

app = FastAPI(title="Synthetic Shoppers Simulation Engine")

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

