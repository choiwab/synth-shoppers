import type { ViabilityReport } from '@/types/contracts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface CompetitionPanelProps {
  competition: ViabilityReport['competition']
}

const STAGE_LABEL: Record<string, string> = {
  land: 'Landing',
  photos: 'Photos',
  reviews: 'Reviews',
  price: 'Price',
  cart: 'Cart',
  checkout: 'Checkout',
}

/**
 * Where the tracked Matin Kim listing loses shoppers to other beanies. Real mode
 * only — `report.competition` is empty for mock runs, so this renders nothing then.
 */
export function CompetitionPanel({ competition }: CompetitionPanelProps) {
  const breakdown = competition?.competitor_breakdown ?? []
  const lost = competition?.lost_to_competitors ?? 0
  if (!competition || (!breakdown.length && !lost)) return null

  const maxWins = Math.max(1, ...breakdown.map((c) => c.wins))
  const landedPct = competition.landed_rate != null ? Math.round(competition.landed_rate * 100) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lost to Competitors</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {landedPct != null && <Stat label="Reached our listing" value={`${landedPct}%`} />}
          <Stat label="Bought a competitor" value={lost} />
          <Stat label="Left without buying" value={competition.left_without_buying ?? 0} />
        </div>

        {breakdown.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Who won them</p>
            {breakdown.map((c) => {
              const pct = (c.wins / maxWins) * 100
              return (
                <div key={c.competitor_id} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 truncate text-ink-soft" title={c.title ?? c.competitor_id}>
                    {c.title ?? c.competitor_id}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded-sm bg-black/[0.04]">
                    <div className="h-full rounded-sm bg-shopee" style={{ width: `${pct}%`, minWidth: 6 }} />
                  </div>
                  <span className="w-16 shrink-0 text-right font-medium text-ink">
                    {c.wins} <span className="text-ink-faint">({Math.round(c.share * 100)}%)</span>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {competition.divert_by_stage && competition.divert_by_stage.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Where they peeled off</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {competition.divert_by_stage.map((d) => (
                <span key={d.stage} className="rounded-sm bg-black/[0.04] px-2 py-1 text-ink-soft">
                  {STAGE_LABEL[d.stage] ?? d.stage}: <strong className="text-ink">{d.count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span className="text-ink-faint">{label}: </span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  )
}
