import { Link } from 'react-router-dom'
import { BadgeCheck, ChevronRight } from 'lucide-react'
import { ProductImage } from './ProductImage'
import { sgd } from '@/lib/utils'
import { useDemoAction } from '@/lib/demoAction'
import { withSimSession } from '@/shopee/simSession'

const SHOP_PRODUCTS = [
  { title: 'Converse Cam Day 1 Chuck Bucket Hat', price: 20.0, color: 'Cream', sold: 7 },
  { title: 'Converse All Star Patch Beanie Unisex', price: 39.0, color: 'Black', sold: 15 },
  { title: 'Converse Opal Unisex Cap - Grey', price: 29.0, color: 'Grey', sold: 6 },
]

/** "SHOPS RELATED TO '<kw>'" card shown atop search results (product-search.png). */
export function ShopsRelated({ keyword }: { keyword: string }) {
  const demo = useDemoAction()
  return (
    <div className="mb-3 rounded-sm bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm text-ink-soft">
          SHOPS RELATED TO '<span className="font-medium text-ink">{keyword.toUpperCase()}</span>'
        </h3>
        <Link
          to={withSimSession('/search?keyword=converse')}
          className="flex items-center text-xs text-shopee hover:underline"
        >
          More Shops <ChevronRight size={13} />
        </Link>
      </div>

      <div className="flex flex-wrap items-stretch gap-4">
        {/* shop block */}
        <div className="flex w-[200px] shrink-0 flex-col items-center justify-center gap-2 border-r border-line pr-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-lg font-bold text-white">
            C
          </span>
          <p className="flex items-center gap-1 text-sm font-medium">
            Converse Official Store <BadgeCheck size={14} className="text-shopee-mall" />
          </p>
          <Link
            to={withSimSession('/search?keyword=converse')}
            className="rounded-sm border border-shopee px-4 py-1 text-xs text-shopee hover:bg-shopee-light/50"
          >
            Visit Shop
          </Link>
          <p className="text-[11px] text-ink-faint">4 Products · 5.0 Ratings</p>
        </div>

        {/* shop products */}
        <div className="grid flex-1 grid-cols-3 gap-3">
          {SHOP_PRODUCTS.map((p) => (
            <Link key={p.title} to={withSimSession('/search?keyword=converse')} className="group text-center">
              <div className="aspect-square overflow-hidden border border-line bg-shopee-bg">
                <ProductImage src={undefined} alt={p.title} color={p.color} className="h-full w-full" />
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-ink group-hover:text-shopee">{p.title}</p>
              <p className="text-sm text-shopee">{sgd(p.price)}</p>
            </Link>
          ))}
        </div>

        {/* voucher claim */}
        <div className="flex w-[150px] shrink-0 flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-shopee/40 bg-shopee-light/30 p-3 text-center">
          <p className="text-2xl font-bold text-shopee">10% Off</p>
          <p className="text-[11px] text-ink-soft">Min. Spend $100</p>
          <button
            onClick={() => demo('Voucher claim')}
            className="rounded-sm border border-shopee px-5 py-1 text-xs text-shopee hover:bg-shopee-light"
          >
            Claim
          </button>
        </div>
      </div>
    </div>
  )
}
