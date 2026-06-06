import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Flag, ShoppingCart } from 'lucide-react'
import type { ListingConfig } from '@/types/contracts'
import { Gallery } from './Gallery'
import { BuyBox } from './BuyBox'
import { ReviewsSection } from './ReviewsSection'
import { SellerCard } from './SellerCard'
import { AuthenticityBlock } from './AuthenticityBlock'
import { ProductDescription } from './ProductDescription'
import { RelatedProducts } from './RelatedProducts'
import { StarRating } from '@/components/StarRating'
import { Button } from '@/components/ui/button'
import { soldCount } from '@/shopee/config/loadConfig'
import { useCart, selectCount } from '@/store/cart'
import { emitFunnelAction } from '@/shopee/funnel'
import { compact } from '@/lib/utils'

interface ShopeePageProps {
  config: ListingConfig
}

/**
 * The config-driven, funnel-gated Shopee product page. Renders EVERYTHING from
 * ListingConfig (no hardcoded product values) so mutating the config re-renders
 * the page — the mechanism behind "Test this fix". Gates land/photos/reviews/
 * price/cart are exposed as data-gate sections; checkout lives on /cart + /checkout.
 */
export function ShopeePage({ config }: ShopeePageProps) {
  const firstColour = config.variants[0]?.options[0] ?? 'oatmeal'
  const sold = soldCount(config)

  return (
    <div
      data-listing-id={config.id}
      className="mx-auto w-full px-4 py-4 xl:px-8"
    >
      {/* breadcrumb */}
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-ink-soft" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-shopee">
          Shopee
        </Link>
        {config.category.map((c) => (
          <span key={c} className="flex items-center gap-1">
            <ChevronRight size={12} />
            <Link to={`/search?keyword=${encodeURIComponent(c)}`} className="hover:text-shopee">
              {c}
            </Link>
          </span>
        ))}
        <ChevronRight size={12} />
        <span className="line-clamp-1 max-w-[280px] text-ink">{config.title}</span>
      </nav>

      {/* top card: gallery + buy column */}
      <div className="flex flex-col gap-6 rounded-sm bg-white p-4 shadow-sm md:flex-row md:p-6">
        <Gallery photos={config.photos} title={config.title} color={firstColour} listingId={config.id} />

        <div className="min-w-0 flex-1">
          {/* land gate */}
          <section data-gate="land">
            {config.seller.verified && (
              <span className="mr-2 inline-block rounded-sm bg-shopee px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">
                SG SELLER
              </span>
            )}
            <h1 data-field="title" className="inline align-middle text-xl font-medium leading-snug text-ink">
              {config.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="flex items-center gap-1 border-r border-line pr-4">
                <span data-field="rating" className="border-b border-shopee font-medium text-shopee">
                  {config.rating.score.toFixed(1)}
                </span>
                <StarRating score={config.rating.score} size={15} />
              </span>
              <span className="border-r border-line pr-4 text-ink-soft">
                <span data-field="review-count" className="font-medium text-ink">
                  {compact(config.rating.count)}
                </span>{' '}
                Ratings
              </span>
              <span className="border-r border-line pr-4 text-ink-soft">
                <span className="font-medium text-ink">{compact(sold)}</span> Sold
              </span>
              <span className="flex items-center gap-1 text-ink-faint">
                <Flag size={13} /> Report
              </span>
            </div>

            <p className="mt-2 text-sm text-ink-soft">
              Sold by <span data-field="seller-name" className="text-shopee">{config.seller.name}</span>{' '}
              · Shopee Singapore
            </p>
          </section>

          {/* price gate + cart gate */}
          <BuyBox config={config} />
        </div>
      </div>

      {/* below the fold */}
      <div className="mt-3 space-y-3">
        <AuthenticityBlock authenticity={config.authenticity} />
        <ProductDescription config={config} />
        <SellerCard seller={config.seller} />
        <ReviewsSection config={config} />
      </div>

      <RelatedProducts currentId={config.id} />

      <ProductCheckoutBar listingId={config.id} />
    </div>
  )
}

/**
 * Sticky checkout bar shown once the cart has items. Gives the browser-use agent
 * a reachable data-action="checkout" on the product page (its `checkout` gate
 * clicks this after add-to-cart) that goes straight to /checkout. Humans can
 * still use the cart → checkout path.
 */
function ProductCheckoutBar({ listingId }: { listingId: string }) {
  const count = useCart(selectCount)
  const navigate = useNavigate()
  if (count === 0) return null

  function checkout() {
    emitFunnelAction('checkout', 'checkout', listingId)
    navigate('/checkout')
  }

  return (
    <div className="sticky bottom-0 z-30 mt-3 flex items-center gap-3 rounded-sm border-t border-line bg-white px-4 py-3 shadow-[0_-1px_8px_rgba(0,0,0,0.08)]">
      <ShoppingCart size={18} className="text-shopee" />
      <span className="text-sm text-ink">{count} item(s) in your cart</span>
      <Link
        to="/cart"
        className="ml-auto rounded-sm border border-shopee px-4 py-2 text-sm text-shopee hover:bg-shopee-light/50"
      >
        View Cart
      </Link>
      <Button variant="shopee" data-action="checkout" onClick={checkout}>
        Check Out
      </Button>
    </div>
  )
}
