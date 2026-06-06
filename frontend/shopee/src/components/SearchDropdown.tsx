import { Search } from 'lucide-react'
import { suggestFor } from '@/shopee/data/searchTerms'

interface SearchDropdownProps {
  keyword: string
  onSelect: (kw: string) => void
}

/**
 * Shopee search autocomplete (search-dropdown.png). Filters a fashion-term
 * library by what's typed (falling back to suffix expansion), plus a
 * "Search '<kw>' Shops" row. Items use onMouseDown so the click lands before
 * the input blurs. The header owns open/close state.
 */
export function SearchDropdown({ keyword, onSelect }: SearchDropdownProps) {
  const kw = keyword.trim()
  const suggestions = suggestFor(kw)

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-0.5 overflow-hidden rounded-sm bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
      {kw && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(kw)
          }}
          className="flex w-full items-center gap-2 border-b border-line px-4 py-2.5 text-left text-sm hover:bg-shopee-light/40"
        >
          <Search size={15} className="text-ink-faint" />
          Search '<span className="font-medium text-shopee">{kw}</span>' Shops
        </button>
      )}
      <ul className="max-h-[320px] overflow-auto py-1">
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(s)
              }}
              className="block w-full px-4 py-2 text-left text-sm text-ink-soft hover:bg-shopee-light/40 hover:text-ink"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
