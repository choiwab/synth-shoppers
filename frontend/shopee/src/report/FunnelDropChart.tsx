import type { FunnelRow, PersonaId } from '@/types/contracts'
import { archetypeColor, personaDisplay } from '@/types/contracts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface FunnelDropChartProps {
  funnel: FunnelRow[]
}

const STAGE_LABEL: Record<string, string> = {
  land: 'Land',
  photos: 'Photos',
  reviews: 'Reviews',
  price: 'Price',
  cart: 'Add to Cart',
  checkout: 'Checkout',
}

export function FunnelDropChart({ funnel }: FunnelDropChartProps) {
  const maxEntered = funnel[0]?.entered ?? 1
  const last = funnel[funnel.length - 1]
  const bought = last ? last.entered - last.bailed : 0

  // archetypes appearing anywhere in the stacked bails (for the legend)
  const present = new Set<PersonaId>()
  funnel.forEach((r) => Object.keys(r.by_archetype ?? {}).forEach((k) => present.add(k as PersonaId)))

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Funnel Drop-off</CardTitle>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {[...present].map((id) => (
            <span key={id} className="flex items-center gap-1 text-[11px] text-ink-soft">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: archetypeColor(id) }} />
              {personaDisplay(id)}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {funnel.map((row) => {
          const widthPct = (row.entered / maxEntered) * 100
          const survived = row.entered - row.bailed
          const segs = Object.entries(row.by_archetype ?? {}) as [PersonaId, number][]
          return (
            <div key={row.stage} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-ink-soft">{STAGE_LABEL[row.stage] ?? row.stage}</span>
              <div className="flex-1">
                <div className="flex h-7 overflow-hidden rounded-sm" style={{ width: `${widthPct}%`, minWidth: 80 }}>
                  <div
                    className="flex items-center justify-end bg-success/25 pr-2 text-[11px] text-ink"
                    style={{ flexGrow: survived, flexBasis: 0 }}
                    title={`${survived} continued`}
                  >
                    {survived}
                  </div>
                  {segs.length > 0
                    ? segs.map(([id, count]) => (
                        <div
                          key={id}
                          style={{ flexGrow: count, flexBasis: 0, backgroundColor: archetypeColor(id) }}
                          title={`${personaDisplay(id)}: ${count} bailed`}
                        />
                      ))
                    : row.bailed > 0 && (
                        <div
                          style={{ flexGrow: row.bailed, flexBasis: 0 }}
                          className="bg-shopee-mall"
                          title={`${row.bailed} bailed`}
                        />
                      )}
                </div>
              </div>
              <span className="w-36 shrink-0 text-right text-xs text-ink-soft">
                {row.entered} in ·{' '}
                <span className="font-medium text-shopee-mall">
                  {row.bailed} bailed ({Math.round(row.bail_rate * 100)}%)
                </span>
              </span>
            </div>
          )
        })}

        <div className="flex items-center gap-3 border-t border-line pt-3 text-sm">
          <span className="w-24 shrink-0 font-medium text-success">Bought</span>
          <div className="flex-1">
            <div
              className="flex h-7 items-center justify-end rounded-sm bg-success pr-2 text-[11px] font-medium text-white"
              style={{ width: `${(bought / maxEntered) * 100}%`, minWidth: 60 }}
            >
              {bought}
            </div>
          </div>
          <span className="w-36 shrink-0 text-right text-xs text-ink-soft">
            {Math.round((bought / maxEntered) * 100)}% buy rate
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
