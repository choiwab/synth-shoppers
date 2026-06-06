import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, Ticket, Truck, MessageSquare, Wallet, Lock, ArrowLeft } from 'lucide-react'
import { ProductImage } from '@/components/ProductImage'
import { useDemoAction } from '@/lib/demoAction'
import { Button } from '@/components/ui/button'
import { useCart, lineKey, type CartItem } from '@/store/cart'
import { emitFunnelAction } from '@/shopee/funnel'
import { scopedStorageKey, withSimSession } from '@/shopee/simSession'
import { sgd, cn } from '@/lib/utils'

const SHIPPING_FEE = 1.99
const SHOP_VOUCHER = 0.57

/** Checkout — pre-filled address + summary, confirm via data-action="confirm-order". */
export function CheckoutFlow() {
  const navigate = useNavigate()
  const items = useCart((s) => s.items)
  const removeItem = useCart((s) => s.removeItem)
  const [doorstep, setDoorstep] = useState(true)
  const demo = useDemoAction()

  const ordered: CartItem[] = items.some((i) => i.selected)
    ? items.filter((i) => i.selected)
    : items

  const merchandise = ordered.reduce((sum, i) => sum + i.price * i.qty, 0)
  const itemCount = ordered.reduce((n, i) => n + i.qty, 0)
  const shipping = ordered.length > 0 ? SHIPPING_FEE : 0
  const voucher = ordered.length > 0 ? SHOP_VOUCHER : 0
  const orderTotal = Math.max(0, merchandise + shipping - voucher)

  function placeOrder() {
    if (ordered.length === 0) return
    const target = ordered[0]
    emitFunnelAction('confirm_purchase', 'bought', target.listingId)
    const orderNo = makeOrderNo()
    try {
      sessionStorage.setItem(scopedStorageKey('shopee-last-order'), JSON.stringify({ orderNo, total: orderTotal, itemCount }))
    } catch {
      /* ignore */
    }
    ordered.forEach((i) => removeItem(lineKey(i)))
    navigate(withSimSession('/order-confirmed'))
  }

  return (
    <div data-gate="checkout" className="mx-auto w-full max-w-[1000px] space-y-3 px-4 py-4">
      <Link to={withSimSession('/cart')} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-shopee">
        <ArrowLeft size={15} /> Back to Cart
      </Link>

      {/* dashed progress bar */}
      <div
        className="h-1 w-full opacity-80"
        style={{
          background:
            'repeating-linear-gradient(90deg,#ee4d2d 0 14px,transparent 14px 22px,#2673dd 22px 36px,transparent 36px 44px)',
        }}
      />

      {/* delivery address */}
      <section data-field="delivery-address" className="rounded-sm bg-white p-5">
        <h2 className="mb-3 flex items-center gap-1 text-base font-medium text-shopee">
          <MapPin size={18} /> Delivery Address
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-medium">Soong Shao Zhi (+65) 8616 8813</span>
          <span className="text-ink-soft">
            BLOCK 480, JURONG WEST STREET 41, #03-308, Singapore 640480
          </span>
          <span className="rounded-sm border border-shopee px-1.5 py-0.5 text-xs text-shopee">Default</span>
          <button onClick={() => demo('Change address')} className="ml-auto text-sm text-[#2673dd] hover:underline">
            Change
          </button>
        </div>
      </section>

      {/* products ordered */}
      <section data-field="checkout-items" className="rounded-sm bg-white">
        <div className="grid grid-cols-[2fr_1fr_auto_1fr] gap-3 border-b border-line px-5 py-3 text-sm text-ink-soft">
          <span>Products Ordered</span>
          <span className="text-center">Unit Price</span>
          <span className="text-center">Amount</span>
          <span className="text-right">Item Subtotal</span>
        </div>
        {ordered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-soft">No items selected for checkout.</p>
        ) : (
          ordered.map((i) => (
            <div
              key={lineKey(i)}
              className="grid grid-cols-[2fr_1fr_auto_1fr] items-center gap-3 border-b border-line px-5 py-4 text-sm last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <ProductImage src={i.image} alt={i.title} color={i.variant} className="h-12 w-12 border border-line" />
                <div className="min-w-0">
                  <p className="line-clamp-1">{i.title}</p>
                  {i.variant && <p className="text-xs text-ink-faint">Variation: {i.variant}</p>}
                </div>
              </div>
              <span className="text-center text-ink-soft">{sgd(i.price)}</span>
              <span className="text-center">{i.qty}</span>
              <span className="text-right">{sgd(i.price * i.qty)}</span>
            </div>
          ))
        )}

        {/* shop voucher + message + shipping + lockers */}
        <div className="flex items-center gap-2 border-b border-line px-5 py-3 text-sm">
          <Ticket size={16} className="text-shopee" />
          <span className="text-ink-soft">Shop Voucher</span>
          {ordered.length > 0 && (
            <span className="rounded-sm bg-shopee-light px-1.5 py-0.5 text-xs text-shopee">−{sgd(voucher)}</span>
          )}
          <button onClick={() => demo('Change voucher')} className="ml-auto text-[#2673dd] hover:underline">
            Change Voucher
          </button>
        </div>
        <div className="flex items-center gap-3 border-b border-line px-5 py-3 text-sm">
          <MessageSquare size={16} className="text-ink-soft" />
          <span className="text-ink-soft">Message for Seller:</span>
          <input
            placeholder="Please leave a message…"
            className="flex-1 rounded-sm border border-line px-3 py-1.5 outline-none"
          />
        </div>
        <div className="flex items-center gap-3 border-b border-line px-5 py-3 text-sm">
          <Truck size={16} className="text-success" />
          <div>
            <p className="font-medium">Shipping Option</p>
            <p className="text-ink-soft">Get by 12 Jun · Express Doorstep Delivery (International)</p>
            <p className="text-xs text-ink-faint">Get up to $2 if order arrives late.</p>
          </div>
          <button onClick={() => demo('Change')} className="ml-auto text-[#2673dd] hover:underline">
            Change
          </button>
          <span className="w-16 text-right">{sgd(SHIPPING_FEE)}</span>
        </div>
        <div className="flex items-center gap-3 px-5 py-3 text-sm">
          <Lock size={16} className="text-success" />
          <span className="text-ink-soft">Pick Lockers · Get by 10 Jun – 12 Jun</span>
          <label className="ml-auto flex items-center gap-2 text-xs text-ink-soft">
            Allow to leave at doorstep
            <span className="rounded-sm bg-success/15 px-1 text-[10px] text-success">New</span>
            <Toggle on={doorstep} onChange={() => setDoorstep((d) => !d)} />
          </label>
        </div>
      </section>

      {/* payment */}
      <section className="rounded-sm bg-white p-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Wallet size={16} className="text-shopee" />
          <span className="font-medium">Payment Method</span>
          <span className="ml-3 rounded-sm border border-shopee px-2 py-0.5 text-xs text-shopee">ShopeePay</span>
          <span className="rounded-sm border border-line px-2 py-0.5 text-xs text-ink-soft">Credit/Debit Card</span>
          <button onClick={() => demo('Change')} className="ml-auto text-[#2673dd] hover:underline">
            Change
          </button>
        </div>
      </section>

      {/* totals + place order */}
      <section className="rounded-sm bg-white">
        <div className="space-y-1 border-b border-line px-5 py-4 text-sm">
          <Row label="Merchandise Subtotal" value={sgd(merchandise)} field="checkout-merchandise-subtotal" />
          <Row label="Shipping Subtotal" value={sgd(shipping)} field="checkout-shipping-subtotal" />
          <Row label="Shop Voucher" value={`−${sgd(voucher)}`} field="checkout-voucher" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-4 px-5 py-4">
          <span className="text-sm text-ink-soft">
            Order Total ({itemCount} item{itemCount === 1 ? '' : 's'}):
          </span>
          <span data-field="order-total" className="text-2xl font-medium text-shopee">{sgd(orderTotal)}</span>
          <Button
            variant="shopee"
            size="lg"
            data-action="confirm-order"
            disabled={ordered.length === 0}
            onClick={placeOrder}
            className="min-w-[200px]"
          >
            Place Order
          </Button>
        </div>
      </section>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={cn('relative h-5 w-9 rounded-full transition-colors', on ? 'bg-success' : 'bg-black/20')}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
          on ? 'left-0.5 translate-x-4' : 'left-0.5',
        )}
      />
    </button>
  )
}

function Row({ label, value, field }: { label: string; value: string; field: string }) {
  return (
    <div className="flex justify-end gap-12">
      <span className="text-ink-soft">{label}</span>
      <span data-field={field} className="w-24 text-right">{value}</span>
    </div>
  )
}

function makeOrderNo(): string {
  const n = Math.floor(Math.random() * 1e12)
    .toString()
    .padStart(12, '0')
  return `2406${n.slice(0, 10)}`
}
