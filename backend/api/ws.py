from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from sim.runner import registry

router = APIRouter()


@router.websocket("/ws/simulation/{run_id}")
async def simulation_ws(websocket: WebSocket, run_id: str) -> None:
    await websocket.accept()
    run = registry.get(run_id)
    if not run:
        await websocket.send_json({"type": "error", "message": "run not found", "run_id": run_id})
        await websocket.close(code=1008)
        return

    queue = await run.subscribe()
    try:
        while True:
            event = await queue.get()
            if event is None:
                break
            await websocket.send_json(event)
    except WebSocketDisconnect:
        return

