import type { ArchetypeRow } from '@/types/contracts'
import { PERSONA_META } from '@/types/contracts'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ArchetypeChip } from '@/components/ArchetypeChip'
import { cn } from '@/lib/utils'

interface ArchetypeTableProps {
  archetypes: ArchetypeRow[]
}

export function ArchetypeTable({ archetypes }: ArchetypeTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Archetype Breakdown</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-ink-faint">
              <th className="px-5 py-2.5 font-medium">Archetype</th>
              <th className="px-3 py-2.5 text-center font-medium">Agents</th>
              <th className="px-3 py-2.5 text-center font-medium">Bought</th>
              <th className="px-3 py-2.5 text-center font-medium">Bailed</th>
              <th className="px-3 py-2.5 font-medium">Buy Rate</th>
              <th className="px-3 py-2.5 text-center font-medium">Avg Retention</th>
              <th className="px-5 py-2.5 font-medium">Top Objection</th>
            </tr>
          </thead>
          <tbody>
            {archetypes.map((row) => (
              <tr key={row.archetype} className="border-b border-line last:border-b-0">
                <td className="px-5 py-3">
                  <div className="flex flex-col gap-0.5">
                    <ArchetypeChip id={row.archetype} />
                    <span className="pl-1 text-[11px] text-ink-faint">
                      {PERSONA_META[row.archetype]?.tag}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-center">{row.agents}</td>
                <td className="px-3 py-3 text-center text-success">{row.bought}</td>
                <td className="px-3 py-3 text-center text-shopee-mall">{row.bailed}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/[0.06]">
                      <div
                        className={cn('h-full rounded-full', row.buy_rate >= 0.5 ? 'bg-success' : 'bg-shopee')}
                        style={{ width: `${Math.round(row.buy_rate * 100)}%` }}
                      />
                    </div>
                    <span className="tabular-nums">{Math.round(row.buy_rate * 100)}%</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-center text-ink-soft">{row.avg_retention_s}s</td>
                <td className="px-5 py-3 text-ink-soft">
                  <span className="line-clamp-1 italic">"{row.top_objection}"</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
