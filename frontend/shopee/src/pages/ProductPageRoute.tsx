import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ListingConfig } from '@/types/contracts'
import { ShopeeHeader } from '@/components/ShopeeHeader'
import { ShopeeFooter } from '@/components/ShopeeFooter'
import { ShopeePage } from '@/shopee/ShopeePage'
import { loadListing } from '@/shopee/config/loadConfig'
import { withSimSession } from '@/shopee/simSession'

export function ProductPageRoute() {
  const { listingId = '' } = useParams()
  // key on listingId so the loader remounts (fresh "loading" state) per product
  return (
    <div className="min-h-screen bg-shopee-bg">
      <ShopeeHeader variant="full" />
      <ProductLoader key={listingId} listingId={listingId} />
      <ShopeeFooter />
    </div>
  )
}

function ProductLoader({ listingId }: { listingId: string }) {
  const [config, setConfig] = useState<ListingConfig | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading')

  useEffect(() => {
    let alive = true
    loadListing(listingId).then((c) => {
      if (!alive) return
      setConfig(c)
      setState(c ? 'ready' : 'notfound')
    })
    return () => {
      alive = false
    }
  }, [listingId])

  if (state === 'loading') return <div className="py-24 text-center text-ink-soft">Loading product…</div>
  if (state === 'notfound' || !config) {
    return (
      <div className="py-24 text-center">
        <p className="text-lg text-ink">Product not found.</p>
        <Link to={withSimSession('/')} className="mt-3 inline-block text-shopee hover:underline">
          ← Back to Shopee
        </Link>
      </div>
    )
  }
  return <ShopeePage config={config} />
}
