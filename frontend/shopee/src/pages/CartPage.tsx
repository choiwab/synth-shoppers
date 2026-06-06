import { Link, useNavigate } from 'react-router-dom'
import { Ticket, ChevronRight, MessageCircle, ChevronDown, Coins, ArrowLeft } from 'lucide-react'
import { useDemoAction } from '@/lib/demoAction'
import { ShopeeHeader } from '@/components/ShopeeHeader'
import { ShopeeFooter } from '@/components/ShopeeFooter'
import { ProductImage } from '@/components/ProductImage'
import { Button } from '@/components/ui/button'
import {
  useCart,
  lineKey,
  selectSelectedTotal,
  selectSelectedCount,
  type CartItem,
} from '@/store/cart'
import { emitFunnelAction } from '@/shopee/funnel'
import { withSimSession } from '@/shopee/simSession'
import { sgd } from '@/lib/utils'

export function CartPage() {
  const navigate = useNavigate()
  const items = useCart((s) => s.items)
  const setQty = useCart((s) => s.setQty)
  const removeItem = useCart((s) => s.removeItem)
  const toggleSelected = useCart((s) => s.toggleSelected)
  const setAllSelected = useCart((s) => s.setAllSelected)
  const total = useCart(selectSelectedTotal)
  const selectedCount = useCart(selectSelectedCount)
  const demo = useDemoAction()

  const allSelected = items.length > 0 && items.every((i) => i.selected)

  const shops = items.reduce<Record<string, CartItem[]>>((acc, i) => {
    ;(acc[i.seller] ??= []).push(i)
    return acc
  }, {})

  function checkout() {
    if (selectedCount === 0) return
    const target = items.find((i) => i.selected)
    emitFunnelAction('checkout', 'checkout', target?.listingId ?? '')
    navigate(withSimSession('/checkout'))
  }

  return (
    <div className="flex min-h-screen flex-col bg-shopee-bg">
      <ShopeeHeader variant="minimal" title="Shopping Cart" showSearch />

      <main className="mx-auto w-full flex-1 px-4 py-4 xl:px-8">
        {items.length === 0 ? (
          <div className="rounded-sm bg-white py-24 text-center">
            <p className="text-lg text-ink-soft">Your shopping cart is empty</p>
            <Link
              to={withSimSession('/search?keyword=beanie')}
              className="mt-4 inline-block rounded-sm bg-shopee px-8 py-2.5 text-sm font-medium text-white hover:bg-shopee-dark"
            >
              Shop Now
            </Link>
          </div>
        ) : (
          <>
            <Link
              to={withSimSession('/search?keyword=beanie')}
              className="mb-2 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-shopee"
            >
              <ArrowLeft size={15} /> Continue Shopping
            </Link>

            {/* column header */}
            <div className="mb-3 grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] items-center gap-3 rounded-sm bg-white px-4 py-3 text-sm text-ink-soft">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allSelected}
                onChange={(e) => setAllSelected(e.target.checked)}
                className="accent-shopee"
              />
              <span>Product</span>
              <span className="text-center">Unit Price</span>
              <span className="text-center">Quantity</span>
              <span className="text-center">Total Price</span>
              <span>Actions</span>
            </div>

            {Object.entries(shops).map(([seller, shopItems]) => (
              <div key={seller} className="mb-3 rounded-sm bg-white">
                {/* shop header */}
                <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm">
                  <span className="rounded-sm bg-shopee-mall px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Preferred
                  </span>
                  <span className="font-medium">{seller}</span>
                  <button
                    onClick={() => demo('Chat')}
                    className="flex items-center gap-1 rounded-sm bg-shopee px-1.5 py-0.5 text-[11px] text-white"
                  >
                    <MessageCircle size={12} /> chat
                  </button>
                </div>

                {/* bundle banner */}
                <div className="flex items-center gap-2 bg-shopee-light/40 px-4 py-2 text-xs text-ink">
                  <span className="rounded-sm border border-shopee px-1 text-[10px] text-shopee">Bundle</span>
                  Add 3 more for $1.30 off
                  <ChevronRight size={13} className="text-ink-faint" />
                </div>

                {shopItems.map((i) => {
                  const key = lineKey(i)
                  return (
                    <div
                      key={key}
                      className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] items-center gap-3 border-b border-line px-4 py-4 text-sm last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${i.title}`}
                        checked={i.selected}
                        onChange={() => toggleSelected(key)}
                        className="accent-shopee"
                      />
                      <div className="flex items-center gap-3">
                        <ProductImage
                          src={i.image}
                          alt={i.title}
                          color={i.variant}
                          className="h-16 w-16 shrink-0 border border-line"
                        />
                        <div className="min-w-0">
                          <Link to={withSimSession(`/shopee/${i.listingId}`)} className="line-clamp-2 hover:text-shopee">
                            {i.title}
                          </Link>
                          {i.variant && (
                            <Link
                              to={withSimSession(`/shopee/${i.listingId}`)}
                              className="mt-1 flex w-fit items-center gap-1 rounded-sm bg-black/[0.03] px-2 py-0.5 text-xs text-ink-soft hover:text-shopee"
                            >
                              Variations: {i.variant} <ChevronDown size={12} />
                            </Link>
                          )}
                        </div>
                      </div>
                      <span className="text-center text-ink-soft">{sgd(i.price)}</span>
                      <div className="flex items-center justify-center">
                        <button
                          aria-label="Decrease"
                          data-action="decrease-quantity"
                          onClick={() => {
                            setQty(key, i.qty - 1)
                            emitFunnelAction('change_quantity', 'cart', i.listingId)
                          }}
                          className="flex h-7 w-7 items-center justify-center border border-line"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={i.qty}
                          data-field="cart-item-quantity"
                          onChange={(e) => {
                            setQty(key, Number(e.target.value) || 1)
                            emitFunnelAction('change_quantity', 'cart', i.listingId)
                          }}
                          aria-label="Quantity"
                          className="h-7 w-12 border-y border-line text-center outline-none"
                        />
                        <button
                          aria-label="Increase"
                          data-action="increase-quantity"
                          onClick={() => {
                            setQty(key, i.qty + 1)
                            emitFunnelAction('change_quantity', 'cart', i.listingId)
                          }}
                          className="flex h-7 w-7 items-center justify-center border border-line"
                        >
                          +
                        </button>
                      </div>
                      <span data-field="cart-line-total" className="text-center font-medium text-shopee">
                        {sgd(i.price * i.qty)}
                      </span>
                      <div className="flex flex-col items-start gap-1 text-xs">
                        <button
                          onClick={() => removeItem(key)}
                          className="text-ink hover:text-shopee"
                          aria-label="Delete item"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() =>
                            navigate(
                              withSimSession(
                                `/search?keyword=${encodeURIComponent(i.title.split(' ').slice(0, 2).join(' '))}`,
                              ),
                            )
                          }
                          className="flex items-center gap-1 text-shopee"
                        >
                          Find Similar <ChevronDown size={11} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-sm">
                  <Ticket size={16} className="text-shopee" />
                  <span className="text-ink-soft">Up to 50% off voucher available</span>
                  <button onClick={() => demo('More vouchers')} className="text-[#2673dd] hover:underline">
                    More Vouchers
                  </button>
                </div>
              </div>
            ))}

            {/* platform voucher + coins */}
            <div className="mb-3 rounded-sm bg-white">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm">
                <Ticket size={16} className="text-shopee" />
                <span className="text-ink-soft">Platform Voucher</span>
                <button onClick={() => demo('Voucher code')} className="ml-auto text-[#2673dd] hover:underline">
                  Select or enter code
                </button>
              </div>
              <div className="flex items-center gap-2 px-4 py-3 text-sm">
                <Coins size={16} className="text-gold" />
                <span className="text-ink-soft">Shopee Coins</span>
                <span className="ml-auto text-ink-faint">No item selected · −$0.00</span>
              </div>
            </div>

            {/* sticky checkout bar */}
            <div className="sticky bottom-0 flex flex-wrap items-center gap-4 rounded-sm border-t border-line bg-white px-4 py-4 shadow-[0_-1px_6px_rgba(0,0,0,0.06)]">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setAllSelected(e.target.checked)}
                  className="accent-shopee"
                />
                Select All ({items.length})
              </label>
              <button
                onClick={() => items.filter((i) => i.selected).forEach((i) => removeItem(lineKey(i)))}
                className="text-sm text-ink-soft hover:text-shopee"
              >
                Delete
              </button>
              <button onClick={() => demo('Move to My Likes')} className="text-sm text-ink-soft hover:text-shopee">
                Move to My Likes
              </button>
              <div className="ml-auto flex items-center gap-4">
                <span className="text-sm">
                  Total ({selectedCount} item{selectedCount === 1 ? '' : 's'}):{' '}
                  <span data-field="cart-total" className="text-2xl font-medium text-shopee">{sgd(total)}</span>
                </span>
                <Button
                  variant="shopee"
                  size="lg"
                  data-action="checkout"
                  disabled={selectedCount === 0}
                  onClick={checkout}
                  className="min-w-[180px]"
                >
                  Check Out
                </Button>
              </div>
            </div>
          </>
        )}
      </main>

      <ShopeeFooter />
    </div>
  )
}
