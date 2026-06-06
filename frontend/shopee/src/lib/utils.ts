import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** shadcn-style className combiner: merges Tailwind classes, dedupes conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number as Singapore dollars, Shopee-style ("S$24.90"). */
export function sgd(amount: number): string {
  return `S$${amount.toFixed(2)}`
}

/** Normalise a response/percentage value to 0..100, accepting either a 0..1
 *  fraction or an already-percent value (the canonical fixture uses percents). */
export function pct(n: number): number {
  return Math.round(n <= 1 ? n * 100 : n)
}

/** Compact sold/rating counts the Shopee way: 1.2k, 12.3k, 1.1m. */
export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

/** Deterministic Fisher–Yates shuffle when a seed is given; random otherwise.
 *  Used by the search page (randomised result order) — seedable so screenshots
 *  can be reproduced when needed. */
export function shuffle<T>(arr: readonly T[], seed?: number): T[] {
  const out = arr.slice()
  let s = seed ?? Math.floor(Math.random() * 2 ** 31)
  const rand = () => {
    // mulberry32
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
