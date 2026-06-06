import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BarChart3, Lightbulb, FileCheck, ArrowLeft } from 'lucide-react'
import type { ListingConfig, ViabilityReport as Report } from '@/types/contracts'
import { loadReport } from '@/report/loadReport'
import { loadListing, MATINKIM_ID } from '@/shopee/config/loadConfig'
import { AnalyticsView } from '@/report/AnalyticsView'
import { RecommendationsPanel } from '@/report/RecommendationsPanel'
import { ViabilityReport } from '@/report/ViabilityReport'
import { DASHBOARD_BASE } from '@/lib/api'
import { cn } from '@/lib/utils'

type Tab = 'viability' | 'analytics' | 'recommendations'

const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'viability', label: 'Viability', icon: FileCheck },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
]

export function ReportPage() {
  const { runId } = useParams()
  const [report, setReport] = useState<Report | null>(null)
  const [config, setConfig] = useState<ListingConfig | null>(null)
  const [tab, setTab] = useState<Tab>('viability')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([loadReport(runId), loadListing(MATINKIM_ID)]).then(([r, c]) => {
      if (!alive) return
      setReport(r)
      setConfig(c)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [runId])

  return (
    <div className="min-h-screen bg-shopee-bg">
      {/* internal analytics header (not the storefront chrome) */}
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-3 px-4 py-3">
          <a href={DASHBOARD_BASE} className="flex items-center gap-1 text-sm font-medium text-shopee hover:underline">
            <ArrowLeft size={16} /> Dashboard
          </a>
          <span className="text-line">|</span>
          <Link to="/" className="text-sm text-ink-soft hover:text-shopee">
            Storefront
          </Link>
          <span className="text-line">|</span>
          <h1 className="text-base font-semibold text-ink">
            Synthetic Shoppers <span className="text-shopee">· Viability Report</span>
          </h1>
          {report && (
            <span className="ml-auto text-xs text-ink-faint">
              run <code className="rounded bg-black/5 px-1">{report.run_id}</code>
            </span>
          )}
        </div>
        <div className="mx-auto flex max-w-[1100px] gap-1 px-4">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm',
                tab === id
                  ? 'border-shopee font-medium text-shopee'
                  : 'border-transparent text-ink-soft hover:text-ink',
              )}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-5">
        {loading && <p className="py-20 text-center text-ink-soft">Loading report…</p>}
        {!loading && !report && (
          <p className="py-20 text-center text-ink-soft">No report data available.</p>
        )}
        {!loading && report && (
          <>
            {tab === 'viability' && <ViabilityReport report={report} />}
            {tab === 'analytics' && <AnalyticsView report={report} />}
            {tab === 'recommendations' && <RecommendationsPanel report={report} config={config} />}
          </>
        )}
      </main>
    </div>
  )
}
