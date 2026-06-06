import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { AgentTrace } from '@/types/contracts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ArchetypeChip } from '@/components/ArchetypeChip'
import { resolveAssetUrl } from '@/lib/api'
import { cn } from '@/lib/utils'

interface AgentJourneyLogProps {
  agents: AgentTrace[]
}

const STAGE_SHORT: Record<string, string> = {
  land: 'Land',
  photos: 'Photos',
  reviews: 'Reviews',
  price: 'Price',
  cart: 'Cart',
  checkout: 'Checkout',
  bought: 'Bought',
  bailed: 'Bailed',
}

export function AgentJourneyLog({ agents }: AgentJourneyLogProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'bought' | 'bailed'>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return agents.filter((a) => {
      if (filter !== 'all' && a.outcome !== filter) return false
      if (!q) return true
      return (
        a.name.toLowerCase().includes(q) ||
        a.archetype.toLowerCase().includes(q) ||
        (a.objection ?? '').toLowerCase().includes(q) ||
        (a.bail_stage ?? '').toLowerCase().includes(q)
      )
    })
  }, [agents, query, filter])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Agent Journey Log ({filtered.length})</CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex rounded-sm border border-line text-xs">
            {(['all', 'bought', 'bailed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 capitalize',
                  filter === f ? 'bg-shopee text-white' : 'text-ink-soft hover:text-shopee',
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5">
            <Search size={14} className="text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agents, objections…"
              className="w-44 bg-transparent text-xs outline-none"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="max-h-[460px] space-y-2 overflow-auto p-3">
        {filtered.map((a) => (
          <div key={a.agent_id} className="rounded-sm border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{a.name}</span>
              <ArchetypeChip id={a.archetype} />
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  a.outcome === 'bought'
                    ? 'bg-success/15 text-success'
                    : 'bg-shopee-mall/10 text-shopee-mall',
                )}
              >
                {a.outcome === 'bought' ? 'Bought' : `Bailed @ ${STAGE_SHORT[a.bail_stage ?? ''] ?? ''}`}
              </span>
              <span className="ml-auto text-xs text-ink-faint">{a.retention_time_s}s on page</span>
            </div>

            {/* stage sequence */}
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {a.stage_trace.map((step, i) => {
                const isBail = a.outcome === 'bailed' && step.stage === a.bail_stage && i === a.stage_trace.length - 1
                const isBought = step.stage === 'bought'
                return (
                  <span key={i} className="flex items-center gap-1">
                    <span
                      className={cn(
                        'rounded-sm px-2 py-0.5 text-[11px]',
                        isBought
                          ? 'bg-success text-white'
                          : isBail
                            ? 'bg-shopee-mall text-white'
                            : 'bg-black/[0.05] text-ink-soft',
                      )}
                    >
                      {STAGE_SHORT[step.stage] ?? step.stage}
                      {step.time_s > 0 && <span className="ml-1 opacity-70">{step.time_s}s</span>}
                    </span>
                    {i < a.stage_trace.length - 1 && <span className="text-ink-faint">›</span>}
                  </span>
                )
              })}
            </div>

            {a.objection && (
              <p className="mt-2 text-xs italic text-ink-soft">"{a.objection}"</p>
            )}
            <DropOffShot agent={a} />
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-soft">No agents match your search.</p>
        )}
      </CardContent>
    </Card>
  )
}

/** Drop-off (final stage) screenshot if H3 captured one — hides if it 404s. */
function DropOffShot({ agent }: { agent: AgentTrace }) {
  const last = agent.stage_trace[agent.stage_trace.length - 1]
  const [ok, setOk] = useState(true)
  if (!ok || !last?.screenshot_url) return null
  return (
    <img
      src={resolveAssetUrl(last.screenshot_url)}
      alt={`${agent.name} drop-off at ${last.stage}`}
      onError={() => setOk(false)}
      className="mt-2 h-16 w-24 rounded-sm border border-line object-cover"
    />
  )
}
