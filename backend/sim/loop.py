from __future__ import annotations

from contracts import ListingConfig
from sim.patching import apply_config_patch
from sim.runner import RunState, registry


async def run_improvement_loop(parent: RunState, max_iterations: int = 3) -> list[str]:
    run_ids: list[str] = []
    current_listing: ListingConfig = parent.listing
    current_parent = parent
    for _ in range(min(max_iterations, 3)):
        if not current_parent.report or not current_parent.report.recommendations:
            break
        patch = current_parent.report.recommendations[0].config_patch
        current_listing = apply_config_patch(current_listing, patch)
        response = await registry.rerun(current_parent, current_listing)
        run_ids.append(response.run_id)
        next_run = registry.get(response.run_id)
        if not next_run:
            break
        current_parent = next_run
    return run_ids

