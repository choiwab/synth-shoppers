import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { AgentTrace, AgentTraceReport, ViabilityReport } from '@/types/contracts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArchetypeChip } from '@/components/ArchetypeChip'
import { resolveAssetUrl } from '@/lib/api'
import { cn } from '@/lib/utils'

interface AgentTraceReportsProps {
  report: ViabilityReport
}

const STAGE_LABEL: Record<string, string> = {
  land: 'Land',
  photos: 'Photos',
  reviews: 'Reviews',
  price: 'Price',
  cart: 'Cart',
  checkout: 'Checkout',
  bought: 'Bought',
  bailed: 'Bailed',
}

export function AgentTraceReports({ report }: AgentTraceReportsProps) {
  const [query, setQuery] = useState('')
  const [outcome, setOutcome] = useState<'all' | 'bought' | 'bailed'>('all')
  const traceReports = useMemo(() => report.agent_trace_reports?.length ? report.agent_trace_reports : deriveTraceReports(report), [report])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return traceReports.filter((agent) => {
      if (outcome !== 'all' && agent.outcome !== outcome) return false
      if (!q) return true
      return [
        agent.name,
        agent.agent_id,
        agent.archetype,
        agent.outcome,
        agent.bail_stage,
        agent.bail_reason,
        agent.objection,
        agent.purchase_reason,
        agent.summary,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    })
  }, [traceReports, query, outcome])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Agent Trace Cards ({filtered.length})</CardTitle>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-sm border border-line text-xs">
            {(['all', 'bought', 'bailed'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setOutcome(item)}
                className={cn(
                  'px-3 py-1.5 capitalize',
                  outcome === item ? 'bg-shopee text-white' : 'text-ink-soft hover:text-shopee',
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5">
            <Search size={14} className="text-ink-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search traces..."
              className="w-44 bg-transparent text-xs outline-none"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-3">
        {filtered.map((agent) => (
          <TraceReportCard key={agent.agent_id} agent={agent} />
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-soft">No agent trace reports match your search.</p>
        )}
      </CardContent>
    </Card>
  )
}

function TraceReportCard({ agent }: { agent: AgentTraceReport }) {
  const converted = agent.outcome === 'bought'
  const metrics = agent.metrics ?? {}
  const heroShot = agent.screenshots.at(-1)

  return (
    <article className="grid gap-3 rounded-sm border border-line bg-white p-3 lg:grid-cols-[1fr_160px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-ink">{agent.name}</h3>
            <code className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[11px] text-ink-soft">{agent.agent_id}</code>
            <ArchetypeChip id={agent.archetype} />
          </div>
          </div>
          <span
            className={cn(
              'ml-auto rounded-full px-2.5 py-1 text-xs font-medium',
              converted ? 'bg-success/15 text-success' : 'bg-shopee-mall/10 text-shopee-mall',
            )}
          >
            {agent.status_label}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric label="Retention" value={`${agent.retention_time_s}s`} />
          <Metric label="Depth" value={`${agent.completed_gates}/${agent.total_gates}`} />
          <Metric label="Avg stage" value={`${displayNumber(metrics.avg_stage_time_s)}s`} />
          <Metric label="Reason" value={String(agent.bail_reason ?? (converted ? 'Converted' : 'Unknown'))} />
        </div>

        <StageRail agent={agent} converted={converted} />

        {agent.key_reason && (
          <p className="mt-3 line-clamp-2 rounded-sm bg-black/[0.03] px-3 py-2 text-sm text-ink-soft">
            <span className="font-medium text-ink">{converted ? 'Bought because' : 'Dropped because'}:</span>{' '}
            <span className="italic">"{agent.key_reason}"</span>
          </p>
        )}

        {(agent.comments.length > 0 || agent.screenshots.length > 1) && (
          <details className="mt-3 rounded-sm border border-line px-3 py-2 text-xs">
            <summary className="cursor-pointer text-ink-soft">
              Details · {agent.comments.length} comments · {agent.screenshots.length} screenshots
            </summary>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {agent.comments.slice(0, 6).map((comment, index) => (
                <div key={`${comment.stage}-${index}`} className="rounded-sm bg-black/[0.025] px-3 py-2">
                  <div className="mb-1 flex items-center gap-2 text-ink-faint">
                    <span>{STAGE_LABEL[comment.stage] ?? comment.stage}</span>
                    {comment.sentiment && <span className="rounded bg-black/[0.04] px-1.5 py-0.5">{comment.sentiment}</span>}
                    <span className="ml-auto">{comment.time_s}s</span>
                  </div>
                  <p className="line-clamp-2 text-ink-soft">"{comment.comment}"</p>
                </div>
              ))}
            </div>
            {agent.screenshots.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {agent.screenshots.slice(0, 5).map((shot, index) => (
                  <img
                    key={`${shot.stage}-${index}`}
                    src={resolveAssetUrl(shot.screenshot_url)}
                    alt={`${agent.name} at ${shot.stage}`}
                    className="h-16 w-24 shrink-0 rounded-sm border border-line object-cover"
                  />
                ))}
              </div>
            )}
          </details>
        )}
      </div>

      <div className="min-h-28 overflow-hidden rounded-sm border border-line bg-black/[0.02]">
        {heroShot ? (
          <img
            src={resolveAssetUrl(heroShot.screenshot_url)}
            alt={`${agent.name} final screenshot`}
            className="h-full min-h-28 w-full object-cover"
          />
        ) : (
          <div className="grid h-full min-h-28 place-items-center text-xs text-ink-faint">
            No screenshot
          </div>
        )}
      </div>
    </article>
  )
}

function StageRail({ agent, converted }: { agent: AgentTraceReport; converted: boolean }) {
  return (
    <div className="mt-3 grid grid-cols-6 gap-1">
      {agent.stage_trace.map((step, index) => {
        const isDrop = !converted && step.stage === agent.bail_stage && index === agent.stage_trace.length - 1
        return (
          <div key={`${step.stage}-${step.order}`}>
            <div
              className={cn(
                'h-2 rounded-full',
                isDrop
                  ? 'bg-shopee-mall'
                  : converted && index === agent.stage_trace.length - 1
                    ? 'bg-success'
                    : 'bg-shopee',
              )}
              title={`${STAGE_LABEL[step.stage] ?? step.stage} · ${step.time_s}s`}
            />
            <div className="mt-1 truncate text-[10px] text-ink-faint">{STAGE_LABEL[step.stage] ?? step.stage}</div>
          </div>
        )
      })}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-line bg-black/[0.015] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-ink" title={value}>{value}</p>
    </div>
  )
}

function deriveTraceReports(report: ViabilityReport): AgentTraceReport[] {
  return report.agents.map((agent) => deriveTraceReport(agent, report))
}

function deriveTraceReport(agent: AgentTrace, report: ViabilityReport): AgentTraceReport {
  const completed = new Set(agent.stage_trace.map((step) => step.stage)).size
  const total = 6
  const converted = agent.outcome === 'bought'
  const keyReason = converted ? agent.purchase_reason : agent.objection
  const comments = agent.stage_trace
    .filter((step) => step.comment)
    .map((step) => ({
      stage: step.stage,
      sentiment: step.sentiment,
      comment: step.comment ?? '',
      time_s: step.time_s,
    }))

  return {
    agent_id: agent.agent_id,
    name: agent.name,
    archetype: agent.archetype,
    outcome: agent.outcome,
    status_label: converted ? 'Bought' : `Bailed at ${agent.bail_stage ?? 'unknown'}`,
    summary: `${agent.name} spent ${agent.retention_time_s}s in the listing and ${converted ? 'bought' : `bailed at ${agent.bail_stage ?? 'unknown'}`}.`,
    retention_time_s: agent.retention_time_s,
    completed_gates: completed,
    total_gates: total,
    progress_pct: completed / total,
    stage_path: agent.stage_trace.map((step) => step.stage),
    last_stage: agent.stage_trace.at(-1)?.stage,
    bail_stage: agent.bail_stage,
    bail_reason: agent.bail_reason,
    objection: agent.objection,
    purchase_reason: agent.purchase_reason,
    key_reason: keyReason,
    metrics: {
      converted,
      dropped: !converted,
      engaged: agent.stage_trace.length >= 2,
      read_reviews: agent.stage_trace.some((step) => step.stage === 'reviews'),
      checked_price: agent.stage_trace.some((step) => step.stage === 'price'),
      added_to_cart: agent.stage_trace.some((step) => step.stage === 'cart'),
      checked_out: agent.stage_trace.some((step) => step.stage === 'checkout'),
      stage_count: agent.stage_trace.length,
      avg_stage_time_s: agent.stage_trace.length ? Math.round((agent.retention_time_s / agent.stage_trace.length) * 100) / 100 : agent.retention_time_s,
      retention_time_s: agent.retention_time_s,
      dropoff_stage: agent.bail_stage,
      dropoff_reason: agent.bail_reason,
    },
    run_metrics_context: {
      browsing_metrics: report.browsing_metrics,
      diagnostics: report.diagnostics,
      dropoff_reasons: report.dropoff_reasons,
    },
    comments,
    screenshots: agent.stage_trace
      .filter((step): step is typeof step & { screenshot_url: string } => Boolean(step.screenshot_url))
      .map((step) => ({ stage: step.stage, screenshot_url: step.screenshot_url, time_s: step.time_s })),
    stage_trace: agent.stage_trace.map((step, index, steps) => ({
      order: index + 1,
      stage: step.stage,
      time_s: step.time_s,
      delta_s: Math.max(0, Math.round((step.time_s - (steps[index - 1]?.time_s ?? 0)) * 100) / 100),
      screenshot_url: step.screenshot_url,
      sentiment: step.sentiment,
      comment: step.comment,
    })),
  }
}

function displayNumber(value: unknown): string {
  return typeof value === 'number' ? value.toFixed(2).replace(/\.00$/, '') : '0'
}
