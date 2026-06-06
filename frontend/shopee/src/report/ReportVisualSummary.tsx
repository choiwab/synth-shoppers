import type { ViabilityReport } from '@/types/contracts'
import { archetypeColor, personaDisplay } from '@/types/contracts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ReportVisualSummaryProps {
  report: ViabilityReport
}

const RATE_KEYS = [
  ['click_rate', 'Click'],
  ['read_rate', 'Read'],
  ['engagement_rate', 'Engage'],
] as const

export function ReportVisualSummary({ report }: ReportVisualSummaryProps) {
  const agents = report.agents.length
  const bought = report.agents.filter((agent) => agent.outcome === 'bought').length
  const bailed = Math.max(agents - bought, 0)
  const buyPct = agents ? bought / agents : 0
  const metrics = report.browsing_metrics ?? {}
  const dropoffs = report.dropoff_reasons?.length
    ? report.dropoff_reasons
    : metrics.dropoff_reason_distribution instanceof Array
      ? metrics.dropoff_reason_distribution
      : []
  const maxDrop = Math.max(1, ...dropoffs.map((row) => numberValue(row.count)))

  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Run Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <div className="flex flex-col items-center gap-2">
            <div
              className="grid h-32 w-32 place-items-center rounded-full"
              style={{
                background: `conic-gradient(var(--color-success) ${buyPct * 360}deg, var(--color-shopee-mall) 0deg)`,
              }}
            >
              <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center">
                <span className="text-2xl font-bold text-ink">{Math.round(buyPct * 100)}%</span>
                <span className="-mt-5 text-[11px] text-ink-faint">buy rate</span>
              </div>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="text-success">{bought} bought</span>
              <span className="text-shopee-mall">{bailed} bailed</span>
            </div>
          </div>

          <div className="space-y-3">
            {RATE_KEYS.map(([key, label]) => {
              const value = numberValue(metrics[key])
              return <RateBar key={key} label={label} value={value} />
            })}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Stat label="Agents" value={String(agents)} />
              <Stat label="Orders" value={String(numberValue(metrics.orders, bought))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Persona Conversion</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {report.archetypes.map((row) => (
            <div key={row.archetype} className="rounded-sm border border-line p-2">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-ink">{personaDisplay(row.archetype)}</span>
                <span className="tabular-nums text-ink-soft">{Math.round(row.buy_rate * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.round(row.buy_rate * 100)}%`, backgroundColor: archetypeColor(row.archetype) }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Drop-off Reasons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dropoffs.slice(0, 6).map((row, index) => {
            const count = numberValue(row.count)
            const width = Math.max(4, (count / maxDrop) * 100)
            return (
              <div key={`${String(row.reason)}-${index}`} className="grid grid-cols-[120px_1fr_42px] items-center gap-2 text-xs">
                <span className="truncate text-ink-soft" title={String(row.reason)}>{String(row.reason)}</span>
                <div className="h-4 overflow-hidden rounded-sm bg-black/[0.05]">
                  <div className="h-full rounded-sm bg-shopee-mall" style={{ width: `${width}%` }} />
                </div>
                <span className="text-right font-medium text-ink">{count}</span>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trace Coverage</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <Stat label="Trace reports" value={String(report.agent_trace_reports?.length ?? report.agents.length)} />
          <Stat label="Screenshots" value={String((report.agent_trace_reports ?? []).reduce((sum, agent) => sum + agent.screenshots.length, 0))} />
          <Stat label="Comments" value={String(report.comments?.length ?? 0)} />
          <Stat label="Objections" value={String(report.objection_heatmap.reduce((sum, row) => sum + row.bail_count, 0))} />
        </CardContent>
      </Card>
    </div>
  )
}

function RateBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-ink-soft">{label}</span>
        <span className="font-medium text-ink">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
        <div className="h-full rounded-full bg-shopee" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-line bg-black/[0.015] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  )
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
