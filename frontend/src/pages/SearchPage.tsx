import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Filter, Star, X } from 'lucide-react'
import type { ListingConfig } from '@/types/contracts'
import { ShopeeHeader } from '@/components/ShopeeHeader'
import { ShopeeFooter } from '@/components/ShopeeFooter'
import { ProductCard } from '@/components/ProductCard'
import { ShopsRelated } from '@/components/ShopsRelated'
import { useCatalog } from '@/shopee/config/useCatalog'
import { soldCount, sellerLocation } from '@/shopee/config/loadConfig'
import { cn } from '@/lib/utils'

type Sort = 'relevance' | 'latest' | 'topsales' | 'price'

const CATEGORY_FILTERS: { label: string; keywords: string[] }[] = [
  { label: 'Beanies', keywords: ['beanie'] },
  { label: 'Hats & Caps', keywords: ['hat', 'cap'] },
  { label: 'Winter Accessories', keywords: ['winter', 'wool', 'fleece', 'knit'] },
  { label: 'Scarves', keywords: ['scarf'] },
]
const SHOP_TYPES = ['Shopee Mall', 'Preferred Seller', 'Fulfilled by Shopee']
const SHIPPED_FROM = ['Singapore', 'Korea', 'Overseas']

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

export function SearchPage() {
  const [params] = useSearchParams()
  const keyword = params.get('keyword') ?? 'beanie'
  const { catalog, loading } = useCatalog()

  const [sort, setSort] = useState<Sort>('relevance')
  const [priceAsc, setPriceAsc] = useState(true)

  // filters
  const [categories, setCategories] = useState<Set<string>>(new Set())
  const [shopTypes, setShopTypes] = useState<Set<string>>(new Set())
  const [shipped, setShipped] = useState<Set<string>>(new Set())
  const [minRating, setMinRating] = useState<number | null>(null)
  const [priceMinInput, setPriceMinInput] = useState('')
  const [priceMaxInput, setPriceMaxInput] = useState('')
  const [price, setPrice] = useState<{ min?: number; max?: number }>({})

  const hasFilters =
    categories.size > 0 || shopTypes.size > 0 || shipped.size > 0 || minRating !== null || price.min !== undefined || price.max !== undefined

  function clearAll() {
    setCategories(new Set())
    setShopTypes(new Set())
    setShipped(new Set())
    setMinRating(null)
    setPriceMinInput('')
    setPriceMaxInput('')
    setPrice({})
  }

  // Catalog order keeps legit branded listings (real photos) on top; cheap
  // unbranded ones fall to the bottom. Sort tabs still re-order on demand.
  const shuffled = catalog

  const results = useMemo(() => {
    const passes = (c: ListingConfig) => {
      if (shopTypes.size > 0 && !c.seller.verified) return false
      if (shipped.size > 0 && !shipped.has(sellerLocation(c))) return false
      if (minRating !== null && c.rating.score < minRating) return false
      if (price.min !== undefined && c.price < price.min) return false
      if (price.max !== undefined && c.price > price.max) return false
      if (categories.size > 0) {
        const hay = `${c.title} ${c.category.join(' ')}`.toLowerCase()
        const ok = [...categories].some((label) => {
          const def = CATEGORY_FILTERS.find((d) => d.label === label)
          return def ? def.keywords.some((k) => hay.includes(k)) : false
        })
        if (!ok) return false
      }
      return true
    }

    let list = shuffled.filter(passes)
    if (sort === 'topsales') list = [...list].sort((a, b) => soldCount(b) - soldCount(a))
    else if (sort === 'price') list = [...list].sort((a, b) => (priceAsc ? a.price - b.price : b.price - a.price))
    else if (sort === 'latest') list = catalog.filter(passes).slice().reverse()
    return list
  }, [shuffled, catalog, sort, priceAsc, categories, shopTypes, shipped, minRating, price])

  return (
    <div className="min-h-screen bg-shopee-bg">
      <ShopeeHeader variant="full" defaultKeyword={keyword} />

      <main className="mx-auto flex w-full gap-4 px-4 py-4 xl:px-8">
        {/* filter sidebar */}
        <aside className="hidden w-[200px] shrink-0 lg:block">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase text-ink">
              <Filter size={16} /> Search Filter
            </h2>
            {hasFilters && (
              <button onClick={clearAll} className="flex items-center gap-0.5 text-xs text-shopee hover:underline">
                <X size={12} /> Clear
              </button>
            )}
          </div>

          <FilterGroup heading="By Category">
            {CATEGORY_FILTERS.map((c) => (
              <Check
                key={c.label}
                label={c.label}
                checked={categories.has(c.label)}
                onChange={() => setCategories((s) => toggle(s, c.label))}
              />
            ))}
          </FilterGroup>

          <FilterGroup heading="Shop Type">
            {SHOP_TYPES.map((s) => (
              <Check
                key={s}
                label={s}
                checked={shopTypes.has(s)}
                onChange={() => setShopTypes((set) => toggle(set, s))}
              />
            ))}
          </FilterGroup>

          <FilterGroup heading="Shipped From">
            {SHIPPED_FROM.map((s) => (
              <Check key={s} label={s} checked={shipped.has(s)} onChange={() => setShipped((set) => toggle(set, s))} />
            ))}
          </FilterGroup>

          <FilterGroup heading="Price Range">
            <div className="flex items-center gap-1">
              <input
                type="number"
                placeholder="$ Min"
                value={priceMinInput}
                onChange={(e) => setPriceMinInput(e.target.value)}
                className="w-full rounded-sm border border-line px-2 py-1 text-xs outline-none focus:border-shopee"
              />
              <span className="text-ink-faint">—</span>
              <input
                type="number"
                placeholder="$ Max"
                value={priceMaxInput}
                onChange={(e) => setPriceMaxInput(e.target.value)}
                className="w-full rounded-sm border border-line px-2 py-1 text-xs outline-none focus:border-shopee"
              />
            </div>
            <button
              onClick={() =>
                setPrice({
                  min: priceMinInput === '' ? undefined : Number(priceMinInput),
                  max: priceMaxInput === '' ? undefined : Number(priceMaxInput),
                })
              }
              className="mt-2 w-full rounded-sm bg-shopee py-1 text-xs font-medium text-white hover:bg-shopee-dark"
            >
              Apply
            </button>
          </FilterGroup>

          <FilterGroup heading="Rating">
            <div className="space-y-1">
              {[5, 4, 3].map((r) => (
                <button
                  key={r}
                  onClick={() => setMinRating((cur) => (cur === r ? null : r))}
                  className={cn(
                    'flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-sm',
                    minRating === r ? 'bg-shopee-light/50' : 'hover:bg-black/[0.03]',
                  )}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={13} className={i < r ? 'text-gold' : 'text-black/15'} fill="currentColor" />
                  ))}
                  <span className="ml-1 text-ink-soft">& Up</span>
                </button>
              ))}
            </div>
          </FilterGroup>
        </aside>

        {/* results */}
        <div className="min-w-0 flex-1">
          <ShopsRelated keyword={keyword} />

          <p className="mb-3 text-sm text-ink-soft">
            Search results for <span className="font-medium text-shopee">'{keyword}'</span>
            <span className="ml-2 text-ink-faint">· {results.length} items</span>
          </p>

          {/* sort bar */}
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-sm bg-black/[0.03] px-4 py-2.5 text-sm">
            <span className="text-ink-soft">Sort by</span>
            <SortTab label="Relevance" active={sort === 'relevance'} onClick={() => setSort('relevance')} />
            <SortTab label="Latest" active={sort === 'latest'} onClick={() => setSort('latest')} />
            <SortTab label="Top Sales" active={sort === 'topsales'} onClick={() => setSort('topsales')} />
            <button
              onClick={() => {
                if (sort === 'price') setPriceAsc((p) => !p)
                else setSort('price')
              }}
              className={cn(
                'flex items-center gap-1 rounded-sm border px-3 py-1.5',
                sort === 'price' ? 'border-shopee bg-white text-shopee' : 'border-line bg-white text-ink',
              )}
            >
              Price {sort === 'price' ? (priceAsc ? '↑' : '↓') : ''}
            </button>

            <div className="ml-auto flex items-center gap-2 text-ink-soft">
              <span>
                <span className="text-shopee">1</span>/1
              </span>
              <span className="flex">
                <button className="flex h-7 w-7 items-center justify-center rounded-l-sm border border-line bg-white text-ink-faint" disabled>
                  <ChevronLeft size={16} />
                </button>
                <button className="flex h-7 w-7 items-center justify-center rounded-r-sm border border-l-0 border-line bg-white text-ink-faint" disabled>
                  <ChevronRight size={16} />
                </button>
              </span>
            </div>
          </div>

          {/* grid */}
          {loading ? (
            <div className="py-20 text-center text-ink-soft">Loading…</div>
          ) : results.length === 0 ? (
            <div className="rounded-sm bg-white py-20 text-center text-ink-soft">
              No products match these filters.
              <button onClick={clearAll} className="ml-2 text-shopee hover:underline">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {results.map((c) => (
                <ProductCard key={c.id} config={c} highlightTarget />
              ))}
            </div>
          )}
        </div>
      </main>

      <ShopeeFooter />
    </div>
  )
}

function FilterGroup({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <fieldset className="border-b border-line py-3">
      <legend className="mb-2 text-sm font-medium text-ink">{heading}</legend>
      <div className="space-y-1.5">{children}</div>
    </fieldset>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-shopee" />
      {label}
    </label>
  )
}

function SortTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn('rounded-sm px-3 py-1.5', active ? 'bg-shopee text-white' : 'bg-white text-ink hover:text-shopee')}
    >
      {label}
    </button>
  )
}
