/*
 * beanie.ts — local, deterministic beanie artwork.
 *
 * The user supplies real product photos under public/assets/products/<slug>/.
 * Until those exist (or if one 404s), ProductImage falls back to a generated knit
 * beanie SVG so screenshots stay clean and nothing renders as a broken image.
 * Variant swatches also use colorHex(). Zero network, fully deterministic.
 */

const NAMED_COLORS: Record<string, string> = {
  black: '#1f1f1f',
  charcoal: '#4a4a4a',
  grey: '#8a8a8a',
  gray: '#8a8a8a',
  'dark grey': '#3a3a3a',
  'light grey': '#bcbcbc',
  oatmeal: '#d8cdb8',
  cream: '#f0e8d6',
  beige: '#e3d6bd',
  camel: '#b88a55',
  tan: '#c89a64',
  brown: '#6f4a2f',
  mustard: '#d6a32a',
  forest: '#2f4a3a',
  olive: '#6b6c3a',
  green: '#3c7a52',
  sage: '#9bae8e',
  burgundy: '#6e2433',
  wine: '#5e2130',
  rust: '#a8472a',
  red: '#c0392b',
  navy: '#25324f',
  blue: '#2f5b8f',
  'sky blue': '#7fb3d5',
  teal: '#2a7d72',
  pink: '#dca0b4',
  lilac: '#b9a7d6',
  purple: '#6c4a8f',
  white: '#f3f3f3',
  mauve: '#a87f86',
}

/** Resolve a colour name to a hex value; deterministic hash fallback for unknowns. */
export function colorHex(name: string): string {
  const key = name.trim().toLowerCase()
  if (NAMED_COLORS[key]) return NAMED_COLORS[key]
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue} 38% 52%)`
}

/** Slightly darken a hex/hsl colour for the cuff shadow (overlay-based, robust). */
function isLight(hex: string): boolean {
  if (!hex.startsWith('#')) return false
  const v = hex.slice(1)
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 150
}

/** A neutral product-image placeholder (for non-beanie filler that has no photo). */
export function placeholderDataUri(bg = '#efefef'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="${bg}"/>
  <g fill="none" stroke="#c9c9c9" stroke-width="10" stroke-linejoin="round">
    <path d="M150 150 h100 a14 14 0 0 1 14 14 v96 a14 14 0 0 1 -14 14 h-100 a14 14 0 0 1 -14 -14 v-96 a14 14 0 0 1 14 -14 Z"/>
    <path d="M172 150 v-10 a28 28 0 0 1 56 0 v10"/>
  </g>
  <circle cx="200" cy="196" r="8" fill="#c9c9c9"/>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** A clean, recognizable knit-beanie SVG in `color`, as a data URI. */
export function beanieDataUri(color: string, bg = '#f6f6f6'): string {
  const light = isLight(color)
  const stroke = light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.12)'
  const ribs = Array.from({ length: 11 }, (_, i) => {
    const x = 104 + i * 18.4
    return `<line x1="${x}" y1="250" x2="${x}" y2="298" stroke="${stroke}" stroke-width="3" />`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="${bg}"/>
  <g>
    <path d="M104 256 C104 150 150 104 200 104 C250 104 296 150 296 256 Z" fill="${color}"/>
    <ellipse cx="168" cy="160" rx="40" ry="56" fill="rgba(255,255,255,0.16)"/>
    <path d="M104 256 C104 150 150 104 200 104 C250 104 296 150 296 256 Z" fill="rgba(0,0,0,0.06)" transform="translate(8 0)" clip-path="url(#c)"/>
    <rect x="92" y="248" width="216" height="56" rx="16" fill="${color}"/>
    <rect x="92" y="248" width="216" height="56" rx="16" fill="rgba(0,0,0,0.14)"/>
    ${ribs}
    <circle cx="200" cy="92" r="16" fill="${color}"/>
    <circle cx="200" cy="92" r="16" fill="rgba(255,255,255,0.10)"/>
  </g>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
