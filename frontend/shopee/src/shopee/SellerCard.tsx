import { MessageCircle, Store, BadgeCheck } from 'lucide-react'
import type { ListingSeller } from '@/types/contracts'
import { cn, pct } from '@/lib/utils'
import { useDemoAction } from '@/lib/demoAction'

interface SellerCardProps {
  seller: ListingSeller
}

export function SellerCard({ seller }: SellerCardProps) {
  const demo = useDemoAction()
  const responsePct = pct(seller.response_rate)
  const lowResponse = responsePct < 50
  const stats: { label: string; value: string; warn?: boolean }[] = [
    { label: 'Ratings', value: `${seller.rating.toFixed(1)}` },
    { label: 'Response Rate', value: `${responsePct}%`, warn: lowResponse },
    { label: 'Response Time', value: lowResponse ? 'within days' : 'within hours' },
    { label: 'Joined', value: '2 years ago' },
  ]

  return (
    <section
      data-field="seller-trust"
      data-seller-verified={seller.verified}
      className="rounded-sm border border-line bg-white p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-shopee text-xl font-bold text-white">
            {seller.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p data-field="seller-name-detail" className="flex items-center gap-1 font-medium">
              {seller.name}
              {seller.verified && (
                <BadgeCheck size={16} className="text-shopee" aria-label="Verified seller" />
              )}
            </p>
            <p className="text-xs text-ink-faint">Active 12 minutes ago</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => demo('Chat')}
                className="flex items-center gap-1 rounded-sm border border-shopee px-3 py-1 text-xs text-shopee hover:bg-shopee-light/50"
              >
                <MessageCircle size={13} /> Chat Now
              </button>
              <button
                onClick={() => demo('View Shop')}
                className="flex items-center gap-1 rounded-sm border border-line px-3 py-1 text-xs text-ink-soft hover:bg-black/[0.03]"
              >
                <Store size={13} /> View Shop
              </button>
            </div>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-2 border-line sm:grid-cols-4 sm:border-l sm:pl-6">
          {stats.map((s) => (
            <div
              key={s.label}
              data-field={`seller-${s.label.toLowerCase().replaceAll(' ', '-')}`}
              className="text-sm"
            >
              <span className="text-ink-soft">{s.label}: </span>
              <span className={cn('font-medium', s.warn ? 'text-shopee-mall' : 'text-shopee')}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
