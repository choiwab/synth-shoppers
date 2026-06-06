import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Lightbulb, ArrowRight, FlaskConical, ExternalLink, Check } from 'lucide-react'
import type { ListingConfig, Recommendation, ViabilityReport } from '@/types/contracts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArchetypeChip } from '@/components/ArchetypeChip'
import {
  applyRecommendation,
  formatChangeValue,
  type ConfigChange,
} from '@/shopee/applyRecommendation'
import { setListingOverride, MATINKIM_ID } from '@/shopee/config/loadConfig'
import { rerunSimulation } from './loadReport'

interface RecommendationsPanelProps {
  report: ViabilityReport
  /** The current Matin Kim config — required to apply a fix. */
  config: ListingConfig | null
}

interface TestResult {
  changes: ConfigChange[]
  runId: string
  stubbed: boolean
}

export function RecommendationsPanel({ report, config }: RecommendationsPanelProps) {
  const [results, setResults] = useState<Record<string, TestResult>>({})
  const [busy, setBusy] = useState<string | null>(null)

  async function testFix(rec: Recommendation) {
    if (!config) return
    setBusy(rec.id)
    const { config: mutated, changes } = applyRecommendation(config, rec)
    // 1) persist the mutated config so the Shopee page re-renders from it
    setListingOverride(MATINKIM_ID, mutated)
    // 2) ask H4 to re-run (stubbed until the endpoint exists)
    const { run_id, stubbed } = await rerunSimulation(report.run_id, mutated, rec.id)
    setResults((r) => ({ ...r, [rec.id]: { changes, runId: run_id, stubbed } }))
    setBusy(null)
  }

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <Lightbulb size={18} className="text-shopee" />
        <CardTitle>AI Recommendations ({report.recommendations.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {report.recommendations.map((rec, i) => {
          const result = results[rec.id]
          return (
            <div key={rec.id} className="rounded-md border border-line p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-shopee text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-sm bg-shopee-light px-2 py-0.5 text-xs font-semibold text-shopee">
                      {rec.field}
                    </span>
                    <span className="text-sm font-medium text-success">{rec.impact_estimate}</span>
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">
                    <span className="font-medium text-ink">Issue: </span>
                    {rec.issue}
                  </p>
                  <p className="mt-1 flex items-start gap-1.5 text-sm">
                    <ArrowRight size={15} className="mt-0.5 shrink-0 text-shopee" />
                    <span>
                      <span className="font-medium">Fix: </span>
                      {rec.fix}
                    </span>
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-ink-faint">Affects:</span>
                    {rec.affected_archetypes.map((a) => (
                      <ArchetypeChip key={a} id={a} />
                    ))}
                  </div>

                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!config || busy === rec.id}
                      onClick={() => testFix(rec)}
                    >
                      <FlaskConical size={15} />
                      {busy === rec.id ? 'Applying…' : result ? 'Re-test this fix' : 'Test this fix'}
                    </Button>
                  </div>

                  {result && <TestResultView result={result} />}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function TestResultView({ result }: { result: TestResult }) {
  return (
    <div className="mt-3 rounded-sm border border-success/40 bg-success/5 p-3 text-sm">
      <p className="mb-2 flex items-center gap-1.5 font-medium text-success">
        <Check size={15} /> Fix applied · new run{' '}
        <code className="rounded bg-black/5 px-1 text-xs text-ink">{result.runId}</code>
        {result.stubbed && <span className="text-xs font-normal text-ink-faint">(stubbed — H4 endpoint pending)</span>}
      </p>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-ink-faint">
            <th className="py-1 font-medium">Field</th>
            <th className="py-1 font-medium">Before</th>
            <th className="py-1 font-medium">After</th>
          </tr>
        </thead>
        <tbody>
          {result.changes.map((c, i) => (
            <tr key={i} className="border-t border-success/20">
              <td className="py-1 pr-3 font-mono text-ink">{c.path}</td>
              <td className="py-1 pr-3 text-ink-soft line-through">{formatChangeValue(c.before)}</td>
              <td className="py-1 font-medium text-ink">{formatChangeValue(c.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Link
        to={`/shopee/${MATINKIM_ID}`}
        className="mt-2 inline-flex items-center gap-1 text-xs text-shopee hover:underline"
      >
        <ExternalLink size={13} /> Open mutated listing
      </Link>
    </div>
  )
}
