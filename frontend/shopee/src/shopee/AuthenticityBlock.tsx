import { ShieldCheck, ShieldAlert, FileCheck2, Hash, Video } from 'lucide-react'
import type { ListingAuthenticity } from '@/types/contracts'
import { cn } from '@/lib/utils'

interface AuthenticityBlockProps {
  authenticity: ListingAuthenticity
}

const SIGNALS: { key: keyof ListingAuthenticity; label: string; icon: typeof FileCheck2 }[] = [
  { key: 'certificate', label: 'Brand Authenticity Certificate', icon: FileCheck2 },
  { key: 'serial', label: 'Per-unit Serial Number', icon: Hash },
  { key: 'unboxing', label: 'Unboxing Verification Video', icon: Video },
]

/**
 * Authenticity lever — driven by config.authenticity. All false → a muted
 * "not verified" notice (a real trust gap the scam-wary archetype bails on).
 * Toggling any true (via a recommendation) flips it to green verified badges.
 */
export function AuthenticityBlock({ authenticity }: AuthenticityBlockProps) {
  const verifiedCount = SIGNALS.filter((s) => authenticity[s.key]).length
  const allUnverified = verifiedCount === 0

  return (
    <section
      className={cn(
        'rounded-sm border bg-white p-5',
        allUnverified ? 'border-line' : 'border-success/40',
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        {allUnverified ? (
          <ShieldAlert size={18} className="text-ink-faint" />
        ) : (
          <ShieldCheck size={18} className="text-success" />
        )}
        <h2 className="text-base font-medium text-ink">Authenticity</h2>
        {!allUnverified && (
          <span className="rounded-sm bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            {verifiedCount}/3 verified
          </span>
        )}
      </div>

      {allUnverified ? (
        <p className="text-sm text-ink-soft">
          This listing has <strong>no authenticity proof</strong> — no brand certificate, serial
          number, or unboxing video. Buy at your own discretion.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3">
          {SIGNALS.map(({ key, label, icon: Icon }) => {
            const on = authenticity[key]
            return (
              <li
                key={key}
                className={cn(
                  'flex items-center gap-2 rounded-sm border p-3 text-sm',
                  on ? 'border-success/40 bg-success/5 text-ink' : 'border-line text-ink-faint',
                )}
              >
                <Icon size={18} className={on ? 'text-success' : 'text-ink-faint'} />
                <span>{label}</span>
                {on && <ShieldCheck size={14} className="ml-auto text-success" />}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
