import type { ViabilityReport } from '@/types/contracts'
import { FunnelDropChart } from './FunnelDropChart'
import { ObjectionHeatmap } from './ObjectionHeatmap'
import { ArchetypeTable } from './ArchetypeTable'
import { AgentJourneyLog } from './AgentJourneyLog'

interface AnalyticsViewProps {
  report: ViabilityReport
}

/** Read-only analytics rendered from the ViabilityReport (PRD §6.3). */
export function AnalyticsView({ report }: AnalyticsViewProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <FunnelDropChart funnel={report.funnel} />
        <ObjectionHeatmap heatmap={report.objection_heatmap} />
      </div>
      <ArchetypeTable archetypes={report.archetypes} />
      <AgentJourneyLog agents={report.agents} />
    </div>
  )
}
