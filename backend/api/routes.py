from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from contracts import (
    ListingAnalysis,
    RerunSimulationRequest,
    RunResponse,
    StartSimulationRequest,
    UpliftReport,
    ViabilityReport,
)
from sim.analysis import analyze_run
from sim.patching import PatchError, apply_config_patch
from sim.runner import registry
from sim.uplift import compute_uplift

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


@router.post("/simulation/{run_id}/analyze", response_model=ListingAnalysis)
async def analyze_simulation(run_id: str) -> ListingAnalysis:
    """Role-play the product owner: read the finished run and propose a revised listing
    (title/price/description/etc.) for the next iteration. Cached per run. Falls back to a
    deterministic heuristic when no OPENAI_API_KEY is configured."""
    run = registry.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    if not run.report:
        raise HTTPException(status_code=202, detail="report is not ready")
    if run.analysis is None:
        run.analysis = await analyze_run(run.report, run.listing)
    return run.analysis


@router.get("/simulation/{run_id}/uplift", response_model=UpliftReport)
async def get_uplift(run_id: str) -> UpliftReport:
    """Compare a (treatment) run against its parent (control). Only meaningful for a
    rerun, which reuses the parent's cohort+seed so agents match 1:1."""
    run = registry.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    if not run.parent_run_id:
        raise HTTPException(status_code=400, detail="run has no parent to compare against")
    parent = registry.get(run.parent_run_id)
    if not parent:
        raise HTTPException(status_code=404, detail="parent run not found")
    if not run.report or not parent.report:
        raise HTTPException(status_code=202, detail="reports are not ready")
    return compute_uplift(parent.report, run.report)


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
