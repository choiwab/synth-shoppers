from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from contracts import RerunSimulationRequest, RunResponse, StartSimulationRequest, ViabilityReport
from sim.patching import PatchError, apply_config_patch
from sim.runner import registry

router = APIRouter()


@router.post("/simulation/start", response_model=RunResponse)
async def start_simulation(request: StartSimulationRequest) -> RunResponse:
    if request.mode == "real" and not registry.real_driver_factory:
        raise HTTPException(status_code=501, detail="real mode needs H3 to register a Browser Use driver factory")
    return await registry.start(request.listing_config, request.crowd, request.mode)


@router.get("/simulation/{run_id}/report", response_model=ViabilityReport)
async def get_report(run_id: str) -> ViabilityReport:
    run = registry.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    if not run.report:
        raise HTTPException(status_code=202, detail="report is not ready")
    return run.report


@router.post("/simulation/{run_id}/rerun", response_model=RunResponse)
async def rerun_simulation(run_id: str, request: RerunSimulationRequest) -> RunResponse:
    parent = registry.get(run_id)
    if not parent:
        raise HTTPException(status_code=404, detail="run not found")

    if request.listing_config and request.config_patch:
        raise HTTPException(status_code=400, detail="provide either listing_config or config_patch, not both")

    try:
        listing = request.listing_config or (
            apply_config_patch(parent.listing, request.config_patch) if request.config_patch else parent.listing
        )
    except (PatchError, ValidationError, ValueError, IndexError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=f"invalid config patch: {exc}") from exc

    return await registry.rerun(parent, listing)
