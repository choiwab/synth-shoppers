from __future__ import annotations

import json
from pathlib import Path

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

