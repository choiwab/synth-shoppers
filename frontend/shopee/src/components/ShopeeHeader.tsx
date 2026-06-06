import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, Search, ChevronDown, Bell, HelpCircle, Globe } from 'lucide-react'
import { useCart, selectCount } from '@/store/cart'
import { ProductImage } from './ProductImage'
import { SearchDropdown } from './SearchDropdown'
import { sgd } from '@/lib/utils'
import { useDemoAction } from '@/lib/demoAction'

interface ShopeeHeaderProps {
  /** 'full' = home/search/product (search bar + suggestions). 'minimal' = cart/checkout. */
  variant?: 'full' | 'minimal'
  /** Section title shown next to the logo in minimal mode (e.g. "Shopping Cart"). */
  title?: string
  /** Whether to render the search bar in minimal mode (cart page shows it). */
  showSearch?: boolean
  defaultKeyword?: string
}

const TRENDING = [
  'Matin Kim',
  'Winter Beanie',
  'Knitted Hat',
  'AirPods 4',
  'Keyboard Foam',
  'Blind Box',
  'iPhone Case',
  'Type C Cable',
]

export function ShopeeHeader({
  variant = 'full',
  title,
  showSearch = true,
  defaultKeyword = '',
}: ShopeeHeaderProps) {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState(defaultKeyword)
  const [focused, setFocused] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // close the autocomplete on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function submit(e: FormEvent) {
    e.preventDefault()
    go(keyword || 'beanie')
  }
  function go(kw: string) {
    setFocused(false)
    navigate(`/search?keyword=${encodeURIComponent(kw)}`)
  }

  const showSearchBar = variant === 'full' || showSearch

  return (
    <header className="text-white" style={{ background: 'var(--shopee-header-gradient)' }}>
      {variant === 'full' && <UtilityBar />}
      <div className="mx-auto flex w-full items-center gap-6 px-4 py-4 xl:px-8">
        <Link to="/" className="flex shrink-0 items-end gap-2" aria-label="Shopee home">
          <ShopeeLogo />
          {variant === 'minimal' && title && (
            <span className="mb-0.5 border-l border-white/40 pl-3 text-[22px] font-light">{title}</span>
          )}
        </Link>

        {showSearchBar && (
          <div ref={searchRef} className="relative flex-1">
            <form onSubmit={submit} role="search">
              <div className="flex items-center rounded-sm bg-white p-[3px]">
                <input
                  type="search"
                  name="keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onFocus={() => setFocused(true)}
                  placeholder="Xiaomi: 17T series new launch"
                  aria-label="Search Shopee"
                  autoComplete="off"
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint"
                />
                <button
                  type="submit"
                  aria-label="Search"
                  className="flex h-9 w-[60px] items-center justify-center rounded-sm bg-shopee hover:bg-shopee-dark"
                >
                  <Search size={18} />
                </button>
              </div>
            </form>

            {focused && <SearchDropdown keyword={keyword} onSelect={go} />}

            {variant === 'full' && !focused && (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/90">
                {TRENDING.map((s) => (
                  <Link key={s} to={`/search?keyword=${encodeURIComponent(s)}`} className="hover:underline">
                    {s}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <CartIcon />
      </div>

      {/* dim overlay behind the autocomplete */}
      {focused && <div className="fixed inset-0 z-40 bg-black/10" aria-hidden="true" />}
    </header>
  )
}

function UtilityBar() {
  const demo = useDemoAction()
  const links = ['Seller Centre', 'Start Selling', 'Download']
  return (
    <div className="border-b border-white/10">
      <div className="mx-auto flex w-full items-center justify-between px-4 py-1 text-xs xl:px-8">
        <div className="flex items-center gap-4">
          {links.map((l) => (
            <button key={l} onClick={() => demo(l)} className="hover:opacity-80">
              {l}
            </button>
          ))}
          <span className="opacity-90">Follow us on Social</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => demo('Notifications')} className="flex items-center gap-1 hover:opacity-80">
            <Bell size={14} /> Notifications
          </button>
          <button onClick={() => demo('Help Centre')} className="flex items-center gap-1 hover:opacity-80">
            <HelpCircle size={14} /> Help
          </button>
          <button onClick={() => demo('Language')} className="flex items-center gap-1 hover:opacity-80">
            <Globe size={14} /> English <ChevronDown size={12} />
          </button>
          <span className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-shopee">
              S
            </span>
            shaozhi21
          </span>
        </div>
      </div>
    </div>
  )
}

function ShopeeLogo() {
  return (
    <span className="flex items-center gap-1.5 text-[28px] font-bold leading-none tracking-tight">
      <ShoppingCart size={26} strokeWidth={2.5} className="-mb-1" />
      Shopee
    </span>
  )
}

function CartIcon() {
  const count = useCart(selectCount)
  const items = useCart((s) => s.items)
  const recent = items.slice(-5).reverse()

  return (
    <div className="group relative shrink-0">
      <Link to="/cart" aria-label={`Cart, ${count} items`} className="relative block p-1">
        <ShoppingCart size={28} />
        {count > 0 && (
          <span
            data-field="cart-count"
            className="absolute -right-2 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-shopee bg-white px-1 text-[11px] font-bold text-shopee"
          >
            {count}
          </span>
        )}
      </Link>

      {/* Mini cart dropdown (cart-dropdown.png) — appears on hover */}
      <div className="invisible absolute right-0 top-full z-50 w-[360px] pt-3 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
        <div className="relative rounded-sm bg-white text-ink shadow-[0_1px_8px_rgba(0,0,0,0.25)]">
          <span className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 bg-white" />
          {recent.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-ink-soft">No products yet</div>
          ) : (
            <>
              <p className="px-3 pt-3 text-xs text-ink-soft">Recently Added Products</p>
              <ul className="max-h-[280px] overflow-auto py-1">
                {recent.map((i) => (
                  <li
                    key={i.listingId + (i.variant ?? '')}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-black/[0.03]"
                  >
                    <ProductImage
                      src={i.image}
                      alt={i.title}
                      color={i.variant}
                      className="h-10 w-10 shrink-0 border border-line"
                    />
                    <span className="line-clamp-1 flex-1 text-xs">{i.title}</span>
                    <span className="shrink-0 text-xs text-shopee">{sgd(i.price)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between px-3 py-3">
                <span className="text-xs text-ink-soft">{count} item(s) in cart</span>
                <Link
                  to="/cart"
                  className="rounded-sm bg-shopee px-4 py-2 text-xs font-medium text-white hover:bg-shopee-dark"
                >
                  View My Shopping Cart
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
