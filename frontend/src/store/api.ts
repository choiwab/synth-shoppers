// REST client for H4's run-control API (OVERVIEW §5.7).
import type {
  ListingAnalysis,
  RerunSimulationBody,
  StartSimulationBody,
  StartSimulationResponse,
  ViabilityReport,
} from "@/types/contracts";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
export const WS_BASE = import.meta.env.VITE_WS_BASE ?? "ws://localhost:8000";

export async function startSimulation(
  body: StartSimulationBody,
): Promise<StartSimulationResponse> {
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
  const res = await fetch(`${API_BASE}/simulation/${runId}/rerun`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`rerun failed: ${res.status}`);
  return res.json();
}

export async function fetchReport(runId: string): Promise<ViabilityReport> {
  const res = await fetch(`${API_BASE}/simulation/${runId}/report`);
  if (!res.ok) throw new Error(`report failed: ${res.status}`);
  return res.json();
}

/** Run the post-run "product owner" analysis → proposed listing for the next iteration. */
export async function analyzeRun(runId: string): Promise<ListingAnalysis> {
  const res = await fetch(`${API_BASE}/simulation/${runId}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
  return res.json();
}
