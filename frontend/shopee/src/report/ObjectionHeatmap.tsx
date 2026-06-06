import type { ObjectionRow } from '@/types/contracts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface ObjectionHeatmapProps {
  heatmap: ObjectionRow[]
}

/** Which listing element triggered the most bails. */
export function ObjectionHeatmap({ heatmap }: ObjectionHeatmapProps) {
  const max = Math.max(1, ...heatmap.map((h) => h.bail_count))
  const sorted = [...heatmap].sort((a, b) => b.bail_count - a.bail_count)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Objection Heatmap</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {sorted.map((row) => {
          const pct = (row.bail_count / max) * 100
          return (
            <div key={row.field} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 text-ink-soft">{row.field}</span>
              <div className="h-5 flex-1 overflow-hidden rounded-sm bg-black/[0.04]">
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${pct}%`,
                    minWidth: 6,
                    backgroundColor: `oklch(0.62 0.2 ${28 - (pct / 100) * 18})`,
                  }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-medium text-ink">{row.bail_count}</span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
