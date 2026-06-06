import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import type { ListingConfig } from '@/types/contracts'
import { ProductImage } from './ProductImage'
import { StarRating } from './StarRating'
import { emitFunnelAction } from '@/shopee/funnel'
import { soldCount, sellerLocation, discountPct, MATINKIM_ID } from '@/shopee/config/loadConfig'
import { sgd, compact, cn } from '@/lib/utils'

interface ProductCardProps {
  config: ListingConfig
  /** Subtle highlight for the Matin Kim target card (demo aid; off by default). */
  highlightTarget?: boolean
}

export function ProductCard({ config, highlightTarget = false }: ProductCardProps) {
  const discount = discountPct(config)
  const sold = soldCount(config)
  const colour = config.variants[0]?.options[0]
  const isTarget = config.id === MATINKIM_ID
  const freeShipping = config.shipping.fee === 0

  return (
    <Link
      to={`/shopee/${config.id}`}
      data-action="open-listing"
      data-listing-id={config.id}
      data-listing-card="search-result"
      onClick={() => emitFunnelAction('open_listing', 'land', config.id)}
      className={cn(
        'group relative flex flex-col overflow-hidden border border-transparent bg-white transition hover:-translate-y-px hover:border-shopee hover:shadow-md',
        highlightTarget && isTarget && 'ring-2 ring-shopee',
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-shopee-bg">
        <ProductImage src={config.photos[0]?.url} alt={config.title} color={colour} className="h-full w-full" />
        {discount > 0 && (
          <span className="absolute right-0 top-0 flex flex-col items-center bg-[#ffd400]/90 px-1 py-0.5 text-[10px] font-bold leading-tight text-shopee-mall">
            {discount}%<span>OFF</span>
          </span>
        )}
        {config.seller.verified && (
          <span className="absolute left-0 top-0 bg-shopee-mall px-1 py-0.5 text-[10px] font-bold text-white">
            Mall
          </span>
        )}
        {/* Find Similar on hover */}
        <span className="absolute inset-x-0 bottom-0 translate-y-full bg-shopee/90 py-1 text-center text-xs font-medium text-white transition-transform group-hover:translate-y-0">
          Find Similar
        </span>
      </div>

      <div className="flex flex-1 flex-col p-2">
        <p
          data-field="listing-card-title"
          className="line-clamp-2 min-h-[2.5rem] text-xs leading-tight text-ink group-hover:text-shopee"
        >
          {config.title}
        </p>

        {/* badge + tag row */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="rounded-[2px] bg-shopee px-1 text-[10px] font-bold text-white">6.6</span>
          {freeShipping && (
            <span className="rounded-[2px] border border-success/50 px-1 text-[10px] text-success">
              Free Shipping
            </span>
          )}
          <span className="rounded-[2px] border border-shopee/40 px-1 text-[10px] text-shopee">$1 off</span>
        </div>

        <div className="mt-1.5 flex items-baseline gap-1">
          {config.base_price > config.price && (
            <span data-field="listing-card-base-price" className="text-[11px] text-ink-faint line-through">
              {sgd(config.base_price)}
            </span>
          )}
          <span data-field="listing-card-price" className="text-base font-medium text-shopee">
            {sgd(config.price)}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-soft">
          <StarRating score={config.rating.score} size={11} />
          <span data-field="listing-card-sold">{compact(sold)} sold</span>
        </div>
        <div data-field="listing-card-location" className="mt-1 flex items-center gap-0.5 text-[11px] text-ink-faint">
          <MapPin size={10} /> {sellerLocation(config)}
        </div>
      </div>
    </Link>
  )
}
