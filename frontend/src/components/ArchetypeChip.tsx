import type { PersonaId } from '@/types/contracts'
import { archetypeColor, personaDisplay } from '@/types/contracts'
import { cn } from '@/lib/utils'

interface ArchetypeChipProps {
  id: PersonaId
  className?: string
  dotOnly?: boolean
}

/** Colored persona chip — colour from OVERVIEW §5.2 (archetypeColor). */
export function ArchetypeChip({ id, className, dotOnly = false }: ArchetypeChipProps) {
  const color = archetypeColor(id)
  if (dotOnly) {
    return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
  }
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', className)}
      style={{ backgroundColor: `${color}22`, color: 'var(--color-ink)' }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {personaDisplay(id)}
    </span>
  )
}
