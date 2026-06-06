import { useState } from 'react'
import { Heart, Share2, ChevronRight } from 'lucide-react'
import type { ListingPhoto } from '@/types/contracts'
import { ProductImage } from '@/components/ProductImage'
import { emitFunnelAction } from '@/shopee/funnel'
import { useDemoAction } from '@/lib/demoAction'
import { cn } from '@/lib/utils'

interface GalleryProps {
  photos: ListingPhoto[]
  title: string
  color: string
  listingId: string
}

const TYPE_LABEL: Record<ListingPhoto['type'], string> = {
  product: 'Product',
  lifestyle: 'Lifestyle',
  closeup: 'Close-up',
}

/** Photos gate — data-gate="photos", advance via data-action="scroll-gallery". */
export function Gallery({ photos, title, color, listingId }: GalleryProps) {
  const [index, setIndex] = useState(0)
  const [favourited, setFavourited] = useState(false)
  const demo = useDemoAction()
  const safe = photos.length > 0 ? photos : [{ url: '', type: 'product' as const }]
  const active = safe[Math.min(index, safe.length - 1)]

  function go(next: number) {
    setIndex(((next % safe.length) + safe.length) % safe.length)
    emitFunnelAction('look_at_photos', 'photos', listingId)
  }

  return (
    <section data-gate="photos" className="w-full shrink-0 md:w-[420px]">
      <div className="relative aspect-square w-full overflow-hidden border border-line bg-white">
        <ProductImage src={active.url} alt={`${title} — photo ${index + 1}`} color={color} className="h-full w-full" />

        {/* decorative promo ribbon (matches product-listing.png overlays) */}
        <div className="absolute left-0 top-3 flex flex-col gap-1">
          <span className="bg-shopee px-2 py-0.5 text-xs font-bold text-white shadow">6.6</span>
          <span className="bg-[#ffce3d] px-2 py-0.5 text-[11px] font-bold text-shopee-mall shadow">20% OFF</span>
          <span className="bg-success px-2 py-0.5 text-[11px] font-semibold text-white shadow">FREE SHIPPING</span>
        </div>

        <span
          data-field="gallery-type"
          className="absolute bottom-2 left-2 rounded-sm bg-black/55 px-2 py-0.5 text-xs text-white"
        >
          {TYPE_LABEL[active.type]}
        </span>
        <span className="absolute bottom-2 right-2 rounded-sm bg-black/55 px-2 py-0.5 text-xs text-white">
          <span data-field="gallery-index">{index + 1}</span> /{' '}
          <span data-field="gallery-total">{safe.length}</span>
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2" data-gallery-thumbs>
        {safe.map((p, i) => (
          <button
            key={i}
            type="button"
            aria-selected={i === index}
            onClick={() => go(i)}
            className={cn(
              'h-[54px] w-[54px] shrink-0 overflow-hidden border bg-white',
              i === index ? 'border-2 border-shopee' : 'border-line',
            )}
          >
            <ProductImage src={p.url} alt={`thumbnail ${i + 1}`} color={color} className="h-full w-full" />
          </button>
        ))}
        <button
          type="button"
          data-action="scroll-gallery"
          onClick={() => go(index + 1)}
          aria-label="View next photo"
          className="ml-auto flex h-[54px] w-9 items-center justify-center border border-line bg-white text-ink-soft hover:text-shopee"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-line pt-3 text-sm text-ink-soft">
        <span className="text-ink-faint">Share:</span>
        <button
          type="button"
          aria-label="Share on Facebook"
          onClick={() => demo('Share to Facebook')}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3b5998] text-[10px] font-bold text-white"
        >
          f
        </button>
        <button
          type="button"
          aria-label="Share on Instagram"
          onClick={() => demo('Share to Instagram')}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#f09433] to-[#bc1888] text-[9px] font-bold text-white"
        >
          IG
        </button>
        <button type="button" aria-label="Share" onClick={() => demo('Share')}>
          <Share2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => setFavourited((f) => !f)}
          aria-pressed={favourited}
          className="ml-auto flex items-center gap-1 border-l border-line pl-4 hover:text-shopee"
        >
          <Heart size={16} className="text-shopee" fill={favourited ? 'currentColor' : 'none'} />
          Favourite ({285 + (favourited ? 1 : 0)})
        </button>
      </div>
    </section>
  )
}
