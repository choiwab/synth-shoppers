import type { ListingVariant } from '@/types/contracts'
import { ProductImage } from '@/components/ProductImage'
import { cn } from '@/lib/utils'

interface VariantPickerProps {
  variants: ListingVariant[]
  selected: string
  onSelect: (option: string) => void
}

/**
 * Colour (and any other) variations as image swatches (product-listing.png).
 * Every option button carries data-action="select-variant" — clicking one is the
 * browser-use `check_price` action. Selecting it shows an orange border + check.
 */
export function VariantPicker({ variants, selected, onSelect }: VariantPickerProps) {
  return (
    <div className="space-y-3">
      {variants.map((variant) => (
        <div key={variant.name} className="flex items-start gap-3">
          <span className="w-20 shrink-0 pt-2 text-sm text-ink-soft">{variant.name}</span>
          <div className="flex flex-wrap gap-2">
            {variant.options.map((opt) => {
              const active = opt === selected
              return (
                <button
                  key={opt}
                  type="button"
                  data-action="select-variant"
                  data-variant={opt}
                  aria-pressed={active}
                  onClick={() => onSelect(opt)}
                  className={cn(
                    'relative flex items-center gap-2 rounded-sm border bg-white py-1 pl-1 pr-3 text-sm',
                    active ? 'border-shopee text-shopee' : 'border-line text-ink hover:border-shopee/60',
                  )}
                >
                  <span className="h-7 w-7 overflow-hidden rounded-[2px] border border-black/5">
                    <ProductImage src={undefined} alt={opt} color={opt} className="h-full w-full" />
                  </span>
                  {opt}
                  {active && (
                    <span className="absolute -right-px -top-px h-0 w-0 border-l-[16px] border-t-[16px] border-l-transparent border-t-shopee">
                      <svg
                        viewBox="0 0 12 12"
                        className="absolute -left-[15px] -top-[15px] h-3.5 w-3.5 text-white"
                        aria-hidden="true"
                      >
                        <path d="M3 6.5l2 2 4-4.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
                      </svg>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
