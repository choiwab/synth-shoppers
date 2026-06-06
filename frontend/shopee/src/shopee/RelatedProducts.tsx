import { COMPETITORS } from '@/shopee/data/competitors'
import { ProductCard } from '@/components/ProductCard'

/**
 * "You May Also Like" rail at the bottom of the product page. Lets a browsing
 * agent hop product → product (compare competitors) without going back to search.
 * Each card is a real <a> → /shopee/:id.
 */
export function RelatedProducts({ currentId }: { currentId: string }) {
  const items = COMPETITORS.filter((c) => c.id !== currentId).slice(0, 6)
  if (items.length === 0) return null

  return (
    <section className="mt-3">
      <h2 className="mb-2 border-b-2 border-shopee py-3 text-center text-base font-medium uppercase tracking-wide text-shopee">
        You May Also Like
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((c) => (
          <ProductCard key={c.id} config={c} />
        ))}
      </div>
    </section>
  )
}
