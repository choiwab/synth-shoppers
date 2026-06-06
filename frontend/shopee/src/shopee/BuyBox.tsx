import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Minus, Plus, ShoppingCart, Truck, ShieldCheck, Tag } from 'lucide-react'
import type { ListingConfig } from '@/types/contracts'
import { VariantPicker } from './VariantPicker'
import { emitFunnelAction } from '@/shopee/funnel'
import { useCart } from '@/store/cart'
import { useToast } from '@/store/toast'
import { Button } from '@/components/ui/button'
import { sgd, cn } from '@/lib/utils'

interface BuyBoxProps {
  config: ListingConfig
}

const SHOP_VOUCHERS = ['10% Off', '8% Off', '5% Off', '3% Off']
const MORE_VOUCHERS = ['Free Shipping', '$2 Cart Coupon', 'Bank 15% Off', 'New Buyer $5']

/** Owns the price gate (price + vouchers + variants) and the cart gate (qty + ATC). */
export function BuyBox({ config }: BuyBoxProps) {
  const navigate = useNavigate()
  const addItem = useCart((s) => s.addItem)
  const showToast = useToast((s) => s.show)

  const firstColour = config.variants[0]?.options[0] ?? ''
  const [variant, setVariant] = useState(firstColour)
  const [qty, setQty] = useState(1)
  const [showAllVouchers, setShowAllVouchers] = useState(false)

  const discounted = config.base_price > config.price
  const overBase = config.price > config.base_price

  function selectVariant(opt: string) {
    setVariant(opt)
    emitFunnelAction('check_price', 'price', config.id)
  }

  function addToCart() {
    addItem({
      listingId: config.id,
      title: config.title,
      price: config.price,
      image: config.photos[0]?.url ?? '',
      seller: config.seller.name,
      variant,
      qty,
    })
    showToast('Item has been added to your shopping cart')
    emitFunnelAction('add_to_cart', 'cart', config.id)
  }

  function buyNow() {
    addToCart()
    navigate('/cart')
  }

  function changeQty(nextQty: number) {
    setQty(Math.max(1, nextQty))
    emitFunnelAction('change_quantity', 'cart', config.id)
  }

  return (
    <>
      {/* ── price gate ─────────────────────────────────────────────────── */}
      <section data-gate="price" className="mt-4">
        <div className="flex flex-wrap items-center gap-3 rounded-sm bg-shopee-bg px-4 py-3">
          {discounted && (
            <span data-field="base-price" className="text-base text-ink-faint line-through">
              {sgd(config.base_price)}
            </span>
          )}
          <span
            data-field="price"
            className={cn('text-[34px] font-medium leading-none', overBase ? 'text-shopee-mall' : 'text-shopee')}
          >
            {sgd(config.price)}
          </span>
          {discounted && (
            <span data-field="discount-pct" className="rounded-sm bg-shopee px-1.5 py-1 text-xs font-bold text-white">
              {Math.round((1 - config.price / config.base_price) * 100)}% OFF
            </span>
          )}
          <span className="text-xs text-ink-soft">After Voucher</span>
          {overBase && (
            <span className="text-xs text-shopee-mall">↑ above launch price {sgd(config.base_price)}</span>
          )}
        </div>

        {/* shop vouchers */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-soft">Shop Vouchers</span>
          {(showAllVouchers ? [...SHOP_VOUCHERS, ...MORE_VOUCHERS] : SHOP_VOUCHERS).map((v) => (
            <span key={v} className="rounded-sm border border-shopee/40 bg-shopee-light/40 px-1.5 py-0.5 text-shopee">
              {v}
            </span>
          ))}
          <button type="button" onClick={() => setShowAllVouchers((s) => !s)} className="text-shopee hover:underline">
            {showAllVouchers ? 'Show Less' : 'Show All'}
          </button>
        </div>

        {/* bundle deals */}
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span className="w-20 shrink-0 text-ink-soft">Bundle Deals</span>
          <span className="flex items-center gap-1 rounded-sm border border-line px-2 py-1 text-xs">
            <Tag size={13} className="text-shopee" /> Any 3 enjoy $1–30 off
          </span>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-ink-soft">
            <Truck size={16} className="text-success" />
            <span>
              {config.shipping.fee === 0 ? (
                <strong data-field="shipping-fee" className="text-success">
                  Free Shipping
                </strong>
              ) : (
                <>
                  Shipping fee <span data-field="shipping-fee">{sgd(config.shipping.fee)}</span>
                </>
              )}{' '}
              · <span data-field="shipping-days">{config.shipping.days}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-ink-soft">
            <ShieldCheck size={16} className="text-success" />
            <span data-field="checkout-guarantee">Shopee Guarantee · 15-Day Free Returns</span>
          </div>
        </div>

        <div className="mt-5">
          <VariantPicker variants={config.variants} selected={variant} onSelect={selectVariant} />
        </div>
      </section>

      {/* ── cart gate ──────────────────────────────────────────────────── */}
      <section data-gate="cart" className="mt-6">
        <div className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-sm text-ink-soft">Quantity</span>
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Decrease quantity"
              data-action="decrease-quantity"
              onClick={() => changeQty(qty - 1)}
              className="flex h-8 w-8 items-center justify-center border border-line text-ink-soft hover:bg-black/[0.03]"
            >
              <Minus size={14} />
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              data-field="quantity"
              onChange={(e) => changeQty(Number(e.target.value) || 1)}
              aria-label="Quantity"
              className="h-8 w-14 border-y border-line text-center text-sm outline-none"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              data-action="increase-quantity"
              onClick={() => changeQty(qty + 1)}
              className="flex h-8 w-8 items-center justify-center border border-line text-ink-soft hover:bg-black/[0.03]"
            >
              <Plus size={14} />
            </button>
          </div>
          <span className="text-xs text-ink-faint">
            <span data-field="stock-count">{28757 - qty}</span> pieces available ·{' '}
            <span data-field="stock-status">IN STOCK</span>
          </span>
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
          <Button variant="outline" size="lg" data-action="add-to-cart" onClick={addToCart}>
            <ShoppingCart size={18} /> Add To Cart
          </Button>
          <Button
            variant="shopee"
            size="lg"
            data-action="add-to-cart"
            data-intent="buy-now"
            onClick={buyNow}
          >
            Buy Now
          </Button>
        </div>
      </section>
    </>
  )
}
