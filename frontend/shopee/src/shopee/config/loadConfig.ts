import type { ListingConfig } from '@/types/contracts'
import { COMPETITORS } from '@/shopee/data/competitors'

// Canonical id from fixtures/listing.sample.json. The older 'matinkim-beanie'
// slug (used in early PRD examples / USER-JOURNEY) is accepted as an alias.
export const MATINKIM_ID = 'matin_kim_beanie_sg'
const MATINKIM_ALIASES = new Set([MATINKIM_ID, 'matinkim-beanie'])
const FIXTURE_URL = '/fixtures/listing.sample.json'
const OVERRIDE_PREFIX = 'shopee-listing-override:'

/**
 * Resolve a ListingConfig for a product page.
 *
 * Matin Kim (the canonical, mutatable listing) resolves with precedence:
 *   1. ?config=<base64 JSON>   — cross-context handoff (e.g. from the dashboard)
 *   2. sessionStorage override  — set by "Test this fix" (scenario flow)
 *   3. fixtures/listing.sample.json — the committed canonical sample
 * Competitors resolve from the static catalog.
 */
export async function loadListing(id: string): Promise<ListingConfig | null> {
  if (MATINKIM_ALIASES.has(id)) {
    const fromUrl = readConfigParam()
    if (fromUrl) return fromUrl
    const override = getListingOverride(MATINKIM_ID)
    if (override) return override
    return fetchFixture()
  }
  return COMPETITORS.find((c) => c.id === id) ?? null
}

/** All 10 listings for /search and home (Matin Kim first). */
export async function loadCatalog(): Promise<ListingConfig[]> {
  const matin = await fetchFixture()
  return matin ? [matin, ...COMPETITORS] : [...COMPETITORS]
}

async function fetchFixture(): Promise<ListingConfig | null> {
  try {
    const res = await fetch(FIXTURE_URL)
    if (!res.ok) return null
    return (await res.json()) as ListingConfig
  } catch {
    return null
  }
}

function readConfigParam(): ListingConfig | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('config')
    if (!raw) return null
    return JSON.parse(decodeURIComponent(escape(atob(raw)))) as ListingConfig
  } catch {
    return null
  }
}

/* ── scenario-flow overrides (sessionStorage) ────────────────────────────── */

export function setListingOverride(id: string, config: ListingConfig): void {
  try {
    sessionStorage.setItem(OVERRIDE_PREFIX + id, JSON.stringify(config))
  } catch {
    /* storage unavailable — ignore */
  }
}

export function getListingOverride(id: string): ListingConfig | null {
  try {
    const raw = sessionStorage.getItem(OVERRIDE_PREFIX + id)
    return raw ? (JSON.parse(raw) as ListingConfig) : null
  } catch {
    return null
  }
}

export function clearListingOverride(id: string): void {
  try {
    sessionStorage.removeItem(OVERRIDE_PREFIX + id)
  } catch {
    /* ignore */
  }
}

/* ── card display helpers (frontend-only, deterministic; not in the contract) ─ */

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/** A plausible "sold" count derived from ratings (Shopee cards show sold, not ratings). */
export function soldCount(c: ListingConfig): number {
  return Math.round(c.rating.count * 3.4 + 23)
}

const LOCATIONS = ['Singapore', 'Singapore', 'Singapore', 'Korea', 'Overseas']
export function sellerLocation(c: ListingConfig): string {
  return LOCATIONS[hash(c.id) % LOCATIONS.length]
}

export function discountPct(c: ListingConfig): number {
  if (c.base_price <= c.price) return 0
  return Math.round((1 - c.price / c.base_price) * 100)
}
