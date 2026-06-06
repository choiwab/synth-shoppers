import { useState } from 'react'
import { beanieDataUri, colorHex, placeholderDataUri } from '@/lib/beanie'
import { cn } from '@/lib/utils'

interface ProductImageProps {
  src?: string
  alt: string
  /** Colour name/hex used for the generated fallback beanie when src is missing. */
  color?: string
  /** 'beanie' → knit-beanie SVG fallback; 'generic' → neutral product placeholder. */
  kind?: 'beanie' | 'generic'
  className?: string
  /** Background of the generated fallback. */
  bg?: string
}

/**
 * Renders the configured product photo. If it 404s (no real photo dropped in
 * yet), it swaps to a generated fallback — a knit-beanie SVG in the product's
 * colour, or a neutral placeholder for non-beanie filler — so the page never
 * shows a broken image in screenshots.
 */
export function ProductImage({ src, alt, color = 'oatmeal', kind = 'beanie', className, bg }: ProductImageProps) {
  const fallback =
    kind === 'generic'
      ? placeholderDataUri(bg)
      : beanieDataUri(color.startsWith('#') ? color : colorHex(color), bg)
  const [current, setCurrent] = useState(src || fallback)
  return (
    <img
      src={current}
      alt={alt}
      loading="lazy"
      draggable={false}
      className={cn('object-cover', className)}
      onError={() => {
        if (current !== fallback) setCurrent(fallback)
      }}
    />
  )
}
