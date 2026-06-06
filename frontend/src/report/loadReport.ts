import type { ListingConfig, ViabilityReport } from '@/types/contracts'

const REPORT_FIXTURE_URL = '/fixtures/report.sample.json'

/**
 * Load a ViabilityReport. Tries H4's REST API (GET /simulation/{run_id}/report)
 * when a run_id is given; falls back to the committed stopgap fixture so the
 * report surfaces are buildable before the backend exists (replace at M5).
 */
export async function loadReport(runId?: string): Promise<ViabilityReport | null> {
  if (runId && runId !== 'sample') {
    try {
      const res = await fetch(`/api/simulation/${runId}/report`)
      if (res.ok) return (await res.json()) as ViabilityReport
    } catch {
      /* fall through to fixture */
    }
  }
  try {
    const res = await fetch(REPORT_FIXTURE_URL)
    if (!res.ok) return null
    return (await res.json()) as ViabilityReport
  } catch {
    return null
  }
}

/**
 * Scenario flow — "Test this fix" (PRD §6.4). POSTs the mutated config to
 * /simulation/{run_id}/rerun and returns the new run_id. Stubbed to a fake id
 * until H4 wires the endpoint.
 */
export async function rerunSimulation(
  runId: string,
  config: ListingConfig,
  fromRecommendation?: string,
): Promise<{ run_id: string; stubbed: boolean }> {
  try {
    const res = await fetch(`/api/simulation/${runId}/rerun`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_config: config, from_recommendation: fromRecommendation }),
    })
    if (res.ok) {
      const data = (await res.json()) as { run_id: string }
      return { run_id: data.run_id, stubbed: false }
    }
  } catch {
    /* backend not ready — stub */
  }
  const fake = `run_${Math.random().toString(36).slice(2, 10)}`
  return { run_id: fake, stubbed: true }
}
