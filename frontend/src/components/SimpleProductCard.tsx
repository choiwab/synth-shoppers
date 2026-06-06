import { Link } from 'react-router-dom'
import type { DiscoverItem } from '@/shopee/data/discover'
import { ProductImage } from './ProductImage'
import { StarRating } from './StarRating'
import { sgd, compact } from '@/lib/utils'

/** Lightweight card for the Home Flash Deals / Daily Discover grids (decorative). */
export function SimpleProductCard({ item }: { item: DiscoverItem }) {
  const discount =
    item.basePrice && item.basePrice > item.price
      ? Math.round((1 - item.price / item.basePrice) * 100)
      : 0
  const to = `/search?keyword=${encodeURIComponent(item.title.split(' ').slice(0, 2).join(' '))}`

  return (
    <Link
      to={to}
      className="group flex flex-col border border-transparent bg-white transition hover:-translate-y-px hover:border-shopee hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-shopee-bg">
        <ProductImage src={item.image} alt={item.title} kind={item.kind} bg={item.tint} className="h-full w-full" />
        {discount > 0 && (
          <span className="absolute right-0 top-0 flex flex-col items-center bg-[#ffd400]/90 px-1 py-0.5 text-[10px] font-bold leading-tight text-shopee-mall">
            {discount}%<span>OFF</span>
          </span>
        )}
        {item.badge === 'Mall' && (
          <span className="absolute left-0 top-0 bg-shopee-mall px-1 py-0.5 text-[10px] font-bold text-white">Mall</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-2">
        <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-tight text-ink group-hover:text-shopee">
          {item.title}
        </p>
        <div className="mt-2 flex items-baseline gap-1">
          {discount > 0 && <span className="text-[11px] text-ink-faint line-through">{sgd(item.basePrice!)}</span>}
          <span className="text-base font-medium text-shopee">{sgd(item.price)}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-soft">
          <StarRating score={item.rating} size={11} />
          <span>{compact(item.sold)} sold</span>
        </div>
      </div>
    </Link>
  )
}
