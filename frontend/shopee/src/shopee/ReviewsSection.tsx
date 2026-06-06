import { useState } from 'react'
import type { ListingConfig } from '@/types/contracts'
import { StarRating } from '@/components/StarRating'
import { emitFunnelAction } from '@/shopee/funnel'
import { cn, pct } from '@/lib/utils'

interface ReviewsSectionProps {
  config: ListingConfig
}

/** Reviews gate — data-gate="reviews", reveal list via data-action="open-reviews". */
export function ReviewsSection({ config }: ReviewsSectionProps) {
  const [open, setOpen] = useState(false)
  const responsePct = pct(config.seller.response_rate)
  const lowResponse = responsePct < 50

  function toggle() {
    setOpen((o) => !o)
    emitFunnelAction('read_reviews', 'reviews', config.id)
  }

  return (
    <section data-gate="reviews" className="rounded-sm border border-line bg-white p-5">
      <h2 className="mb-4 text-base font-medium uppercase tracking-wide text-ink">Product Ratings</h2>

      <div className="flex flex-col gap-4 rounded-sm bg-shopee-light/30 p-5 sm:flex-row sm:items-center">
        <div className="flex items-baseline gap-2 text-shopee">
          <span className="text-4xl font-medium">{config.rating.score.toFixed(1)}</span>
          <span className="text-lg">out of 5</span>
        </div>
        <div className="flex flex-col gap-1">
          <StarRating score={config.rating.score} size={18} />
          <span className="text-sm text-ink-soft">{config.rating.count} ratings</span>
        </div>
        <div className="sm:ml-auto sm:text-right">
          <p className="text-xs text-ink-soft">Seller response rate</p>
          <p
            data-field="response-rate"
            className={cn('text-lg font-semibold', lowResponse ? 'text-shopee-mall' : 'text-success')}
          >
            {responsePct}%
          </p>
          {lowResponse && <p className="text-xs text-shopee-mall">Low — seller rarely replies</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {['All', '5 Star', '4 Star', '3 Star', '2 Star', '1 Star', 'With Comments'].map((chip, i) => (
          <span
            key={chip}
            className={cn(
              'rounded-sm border px-3 py-1 text-xs',
              i === 0 ? 'border-shopee text-shopee' : 'border-line text-ink-soft',
            )}
          >
            {chip}
          </span>
        ))}
      </div>

      {/* Reviews are visible by default (first 3) so the content is readable
          without a click; the open-reviews hook expands/collapses the rest. */}
      <ul data-reviews-body className="mt-4 divide-y divide-line">
        {(open ? config.reviews : config.reviews.slice(0, 3)).map((r, i) => (
            <li key={i} className="py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-shopee-light text-xs font-semibold text-shopee">
                  {r.author.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium">{r.author}</p>
                  <StarRating score={r.rating} size={11} />
                </div>
                <span className="ml-auto text-xs text-ink-faint">{r.date}</span>
              </div>
              <p data-field="review-text" className="mt-2 text-sm text-ink">{r.text}</p>
              {r.seller_response ? (
                <div className="mt-2 border-l-2 border-shopee bg-shopee-bg p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold text-shopee">Seller&apos;s Response</p>
                  <p data-field="seller-response" className="text-ink-soft">{r.seller_response}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

      <button
        type="button"
        data-action="open-reviews"
        aria-expanded={open}
        onClick={toggle}
        className="mt-3 rounded-sm border border-shopee bg-shopee-light/40 px-4 py-2 text-sm text-shopee hover:bg-shopee-light"
      >
        {open ? 'Show less' : `See all ${config.reviews.length} reviews`}
      </button>
    </section>
  )
}
