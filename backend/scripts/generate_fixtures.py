from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from contracts import CrowdConfig, ListingConfig
from sim.runner import RunState, build_cohort, run_simulation


ROOT = Path(__file__).resolve().parents[2]


async def main() -> None:
    listing = ListingConfig.model_validate(json.loads((ROOT / "fixtures/listing.sample.json").read_text()))
    crowd = CrowdConfig(
        personas=["xmm", "auntie", "nerd", "geek", "insecure", "budget", "high_spender"],
        crowd_size=28,
        speed=4,
        seed=20260603,
    )
    run = RunState(
        run_id="run_sample",
        seed=crowd.seed or 20260603,
        listing=listing,
        crowd=crowd,
        mode="mock",
        cohort=build_cohort(crowd.personas, crowd.crowd_size, crowd.seed or 20260606),
    )
    await run_simulation(run)

    events_path = ROOT / "fixtures/events.sample.jsonl"
    report_path = ROOT / "fixtures/report.sample.json"
    events_path.write_text("\n".join(json.dumps(event, separators=(",", ":")) for event in run.events) + "\n")
    if not run.report:
        raise RuntimeError("fixture run did not produce a report")
    report_path.write_text(run.report.model_dump_json(indent=2) + "\n")
    print(f"wrote {events_path}")
    print(f"wrote {report_path}")


if __name__ == "__main__":
    asyncio.run(main())
