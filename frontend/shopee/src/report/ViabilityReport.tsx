import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Tag, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { ViabilityReport as Report } from '@/types/contracts'
import { personaDisplay } from '@/types/contracts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ArchetypeChip } from '@/components/ArchetypeChip'
import { sgd, cn } from '@/lib/utils'

interface ViabilityReportProps {
  report: Report
}

export function ViabilityReport({ report }: ViabilityReportProps) {
  const go = report.go_no_go.decision === 'go'
  const confidence = Math.round(report.go_no_go.confidence * 100)
  const top3 = report.recommendations.slice(0, 3)

  return (
    <div className="space-y-4">
      {/* hero */}
      <Card>
        <CardContent className="flex flex-col items-center gap-8 p-8 sm:flex-row sm:items-stretch">
          <ScoreRing score={report.market_fit_score} />

          <div className="flex flex-1 flex-col justify-center gap-4">
            <div
              className={cn(
                'flex items-center gap-2 self-start rounded-full px-4 py-1.5 text-base font-bold',
                go ? 'bg-success/15 text-success' : 'bg-shopee-mall/10 text-shopee-mall',
              )}
            >
              {go ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              {go ? 'GO' : 'NO-GO'}
              <span className="text-sm font-normal text-ink-soft">· {confidence}% confidence</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Metric icon={<TrendingUp size={16} />} label="Market-fit score">
                {report.market_fit_score}/100
              </Metric>
              <Metric icon={<Tag size={16} />} label="Recommended launch price">
                {sgd(report.recommended_price)}
              </Metric>
            </div>

            <p className="text-sm text-ink-soft">
              {go
                ? 'Viable with fixes — address the top objections below to lift the buy rate before launch.'
                : 'Not launch-ready as listed. The drop-offs below are fixable; re-run after applying the top fixes.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* top fixes */}
        <Card>
          <CardHeader>
            <CardTitle>Top {top3.length} Fixes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {top3.map((rec, i) => (
              <div key={rec.id} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-shopee text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {rec.field} <span className="text-success">· {rec.impact_estimate}</span>
                  </p>
                  <p className="text-sm text-ink-soft">{rec.fix}</p>
                </div>
              </div>
            ))}
            <Link to="#recommendations" className="text-xs text-shopee hover:underline">
              See full recommendations →
            </Link>
          </CardContent>
        </Card>

        {/* risk archetypes */}
        <Card>
          <CardHeader className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-shopee-mall" />
            <CardTitle>Risk Archetypes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.risk_archetypes.length === 0 && (
              <p className="text-sm text-ink-soft">No never-convert segments — healthy spread.</p>
            )}
            {report.risk_archetypes.map((id) => {
              const row = report.archetypes.find((a) => a.archetype === id)
              return (
                <div key={id} className="flex items-start gap-3 rounded-sm bg-shopee-mall/[0.04] p-3">
                  <ArchetypeChip id={id} />
                  <div className="min-w-0 text-sm">
                    <p className="text-shopee-mall">
                      {row ? `${Math.round(row.buy_rate * 100)}% buy rate` : 'never converts'}
                    </p>
                    {row?.top_objection && (
                      <p className="text-ink-soft">
                        Why: <span className="italic">"{row.top_objection}"</span>
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
            <p className="text-xs text-ink-faint">
              {report.risk_archetypes.map(personaDisplay).join(', ') || '—'} are least likely to convert
              even after fixes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  const dash = (pct / 100) * c
  const tone = pct >= 70 ? 'var(--color-success)' : pct >= 45 ? 'var(--color-shopee)' : 'var(--color-shopee-mall)'
  return (
    <div className="relative flex h-[140px] w-[140px] shrink-0 items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold" style={{ color: tone }}>
          {score}
        </span>
        <span className="text-xs text-ink-faint">/ 100</span>
      </div>
    </div>
  )
}

function Metric({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-ink-soft">
        {icon} {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold text-ink">{children}</p>
    </div>
  )
}
