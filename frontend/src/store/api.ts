// REST client for H4's run-control API (OVERVIEW §5.7). In mock mode we never
// hit the network — the fixture player fabricates a run_id.
import type {
  RerunSimulationBody,
  StartSimulationBody,
  StartSimulationResponse,
} from "@/types/contracts";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
export const WS_BASE = import.meta.env.VITE_WS_BASE ?? "ws://localhost:8000";
export const MOCK = (import.meta.env.VITE_MOCK ?? "0") === "1";

let mockCounter = 0;
function mockRunId(): string {
  mockCounter += 1;
  return `run_mock${mockCounter}`;
}

export async function startSimulation(
  body: StartSimulationBody,
): Promise<StartSimulationResponse> {
  if (MOCK) return { run_id: mockRunId() };
  const res = await fetch(`${API_BASE}/simulation/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`start failed: ${res.status}`);
  return res.json();
}

export async function rerunSimulation(
  runId: string,
  body: RerunSimulationBody,
): Promise<StartSimulationResponse> {
  if (MOCK) return { run_id: mockRunId() };
  const res = await fetch(`${API_BASE}/simulation/${runId}/rerun`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`rerun failed: ${res.status}`);
  return res.json();
}
