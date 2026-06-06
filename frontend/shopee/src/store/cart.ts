import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  listingId: string
  title: string
  price: number
  image: string
  seller: string
  variant?: string
  qty: number
  selected: boolean
}

export type CartInput = Omit<CartItem, 'qty' | 'selected'> & { qty?: number }

/** Stable key per cart line (same product + variant stacks). */
export function lineKey(i: { listingId: string; variant?: string }): string {
  return `${i.listingId}::${i.variant ?? ''}`
}

interface CartState {
  items: CartItem[]
  addItem: (input: CartInput) => void
  removeItem: (key: string) => void
  setQty: (key: string, qty: number) => void
  toggleSelected: (key: string) => void
  setAllSelected: (selected: boolean) => void
  clear: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (input) =>
        set((state) => {
          const key = lineKey(input)
          const existing = state.items.find((i) => lineKey(i) === key)
          const addQty = input.qty ?? 1
          if (existing) {
            return {
              items: state.items.map((i) =>
                lineKey(i) === key ? { ...i, qty: i.qty + addQty, selected: true } : i,
              ),
            }
          }
          return { items: [...state.items, { ...input, qty: addQty, selected: true }] }
        }),
      removeItem: (key) =>
        set((state) => ({ items: state.items.filter((i) => lineKey(i) !== key) })),
      setQty: (key, qty) =>
        set((state) => ({
          items: state.items.map((i) =>
            lineKey(i) === key ? { ...i, qty: Math.max(1, qty) } : i,
          ),
        })),
      toggleSelected: (key) =>
        set((state) => ({
          items: state.items.map((i) =>
            lineKey(i) === key ? { ...i, selected: !i.selected } : i,
          ),
        })),
      setAllSelected: (selected) =>
        set((state) => ({ items: state.items.map((i) => ({ ...i, selected })) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'shopee-cart' },
  ),
)

/* ── derived selectors (call with useCart(selector)) ─────────────────────── */

export const selectCount = (s: CartState): number =>
  s.items.reduce((n, i) => n + i.qty, 0)

export const selectSelected = (s: CartState): CartItem[] =>
  s.items.filter((i) => i.selected)

export const selectSelectedTotal = (s: CartState): number =>
  s.items.filter((i) => i.selected).reduce((sum, i) => sum + i.price * i.qty, 0)

export const selectSelectedCount = (s: CartState): number =>
  s.items.filter((i) => i.selected).reduce((n, i) => n + i.qty, 0)
