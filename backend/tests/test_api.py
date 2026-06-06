from __future__ import annotations

import asyncio
import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from main import app


ROOT = Path(__file__).resolve().parents[2]


def test_health_and_start_simulation() -> None:
    client = TestClient(app)
    assert client.get("/health").json() == {"status": "ok"}

    listing = json.loads((ROOT / "fixtures/listing.sample.json").read_text())
    response = client.post(
        "/simulation/start",
        json={
            "listing_config": listing,
            "crowd": {"personas": ["xmm", "budget"], "crowd_size": 4, "speed": 4, "seed": 123},
            "mode": "mock",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["run_id"].startswith("run_")
    assert body["seed"] == 123


@pytest.mark.asyncio
async def test_uplift_endpoint_end_to_end() -> None:
    # Drive the ASGI app on a single event loop so the fire-and-forget
    # run_simulation background task actually progresses (TestClient orphans it).
    listing = json.loads((ROOT / "fixtures/listing.sample.json").read_text())
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        start = await client.post(
            "/simulation/start",
            json={
                "listing_config": listing,
                "crowd": {"personas": ["budget", "auntie"], "crowd_size": 8, "speed": 4, "seed": 77},
                "mode": "mock",
            },
        )
        run_id = start.json()["run_id"]

        async def wait_report(rid: str) -> dict:
            for _ in range(500):
                res = await client.get(f"/simulation/{rid}/report")
                if res.status_code == 200:
                    return res.json()
                await asyncio.sleep(0)  # yield so the background sim makes progress
            raise AssertionError(f"report for {rid} never became ready")

        control = await wait_report(run_id)
        assert "diagnostics" in control and "dropoff_reasons" in control

        # no parent yet -> 400
        assert (await client.get(f"/simulation/{run_id}/uplift")).status_code == 400

        rerun = await client.post(
            f"/simulation/{run_id}/rerun",
            json={
                "config_patch": [
                    {"op": "replace", "path": "/price", "value": listing["base_price"]},
                    {"op": "replace", "path": "/shipping/fee", "value": 0.0},
                ]
            },
        )
        assert rerun.status_code == 200
        treat_id = rerun.json()["run_id"]
        await wait_report(treat_id)

        res = await client.get(f"/simulation/{treat_id}/uplift")
        assert res.status_code == 200
        up = res.json()
        assert up["control_run_id"] == run_id and up["treatment_run_id"] == treat_id
        assert "delta" in up["buyer_uplift"]
        assert any(p["archetype"] == "budget" for p in up["per_persona"])
        assert any(r["field"] == "Price" for r in up["objection_resolution"])

