/** A small library of common fashion/clothing search terms for the autocomplete. */
export const SEARCH_LIBRARY: string[] = [
  // headwear (the demo focus)
  'beanie',
  'beanie hat',
  'knitted beanie',
  'wool beanie',
  'y2k beanie',
  'korean beanie',
  'bucket hat',
  'baseball cap',
  'snapback cap',
  'winter hat',
  'balaclava',
  // tops
  'hoodie',
  'oversized hoodie',
  'sweatshirt',
  'knit sweater',
  'cardigan',
  't-shirt',
  'oversized tee',
  'polo shirt',
  'long sleeve top',
  'crop top',
  // bottoms
  'jeans',
  'baggy jeans',
  'cargo pants',
  'jogger pants',
  'sweatpants',
  'shorts',
  'pleated skirt',
  // outerwear
  'denim jacket',
  'puffer jacket',
  'windbreaker',
  'coat',
  'blazer',
  // dresses
  'dress',
  'midi dress',
  'knit dress',
  // accessories
  'scarf',
  'gloves',
  'socks',
  'tote bag',
  'crossbody bag',
  'backpack',
  'sunglasses',
  'watch',
  'belt',
  'earrings',
  // footwear
  'sneakers',
  'loafers',
  'boots',
  'sandals',
]

/** Suggestions for a typed query: library matches first, else suffix expansion. */
export function suggestFor(keyword: string, limit = 9): string[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) {
    return ['beanie', 'winter hat', 'hoodie', 'knit sweater', 'baggy jeans', 'tote bag', 'sneakers', 'y2k beanie']
  }
  const matches = SEARCH_LIBRARY.filter((t) => t.includes(kw))
  if (matches.length >= 3) return matches.slice(0, limit)
  // not enough library hits — expand the typed term so something always shows
  const suffixes = ['', ' men', ' women', ' unisex', ' korean', ' winter', ' oversized', ' sale']
  const expanded = suffixes.map((s) => `${kw}${s}`)
  return [...new Set([...matches, ...expanded])].slice(0, limit)
}
