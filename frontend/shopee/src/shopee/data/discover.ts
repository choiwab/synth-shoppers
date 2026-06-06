/**
 * Decorative filler for the Home Flash Deals + Daily Discover grids. Simulates a
 * busy Shopee home with variety across categories (tech / cosmetics / clothes /
 * sports / home / toys). Beanie items show the real beanie photos; everything
 * else uses a category-tinted placeholder (we only have beanie photos locally).
 * Every card is clickable and routes into search — which always returns beanies.
 */

export interface DiscoverItem {
  id: string
  title: string
  price: number
  basePrice?: number
  rating: number
  sold: number
  kind: 'beanie' | 'generic'
  /** real beanie image (beanie items) */
  image?: string
  /** placeholder tint (generic items) */
  tint?: string
  badge?: 'Mall' | 'Preferred'
}

const TINT = {
  tech: '#dce8f5',
  cosmetics: '#f7dde7',
  clothes: '#ece5da',
  sports: '#dcefe1',
  home: '#efe8db',
  toys: '#ece0f4',
  food: '#f4edd9',
}

export const DISCOVER: DiscoverItem[] = [
  // ── beanies (real photos) ────────────────────────────────────────────────
  { id: 'd1', title: 'Men Women Thin Hats Korean Version Trendy Beanie Cap', price: 7.76, basePrice: 12.9, rating: 4.7, sold: 149, kind: 'beanie', image: '/assets/beanies/black.jpg' },
  { id: 'd2', title: '[SG SELLER] Unisex Solid Color Warm Knitted Beanie', price: 6.02, basePrice: 9.9, rating: 4.8, sold: 982, kind: 'beanie', image: '/assets/beanies/camel.jpg' },
  { id: 'd3', title: 'Korean Y2K Star Graphic Knitted Beanie Streetwear', price: 8.9, basePrice: 14.9, rating: 4.7, sold: 712, kind: 'beanie', image: '/assets/beanies/pink.jpg' },
  { id: 'd4', title: 'Wool Blend Cuffed Fisherman Beanie Solid Colours', price: 5.9, basePrice: 8.9, rating: 4.8, sold: 2103, kind: 'beanie', image: '/assets/beanies/navy.jpg' },
  { id: 'd5', title: 'Slouchy Oversized Ribbed Beanie Baggy Knit Unisex', price: 6.9, basePrice: 11.9, rating: 4.4, sold: 980, kind: 'beanie', image: '/assets/beanies/grey.jpg' },
  { id: 'd6', title: 'Chunky Cable Knit Beanie Thick Winter Warm', price: 12.9, basePrice: 18.0, rating: 4.6, sold: 845, kind: 'beanie', image: '/assets/beanies/burgundy.jpg' },

  // ── tech ─────────────────────────────────────────────────────────────────
  { id: 'd7', title: 'AirPods 4 Active Noise Cancellation Wireless Earbuds', price: 199.0, rating: 4.9, sold: 5601, kind: 'generic', tint: TINT.tech, badge: 'Mall' },
  { id: 'd8', title: 'Apple iPad 11-inch, Wi-Fi, A16 chip, 128GB', price: 632.0, rating: 4.9, sold: 1320, kind: 'generic', tint: TINT.tech, badge: 'Mall' },
  { id: 'd9', title: '[SG] MADLIONS MAD 68 HE RGB Pro Gaming Keyboard', price: 45.79, basePrice: 89.0, rating: 4.6, sold: 308, kind: 'generic', tint: TINT.tech },
  { id: 'd10', title: 'Baseus PicoGo Magnetic Power Bank 10000mAh', price: 19.82, basePrice: 39.9, rating: 4.7, sold: 6712, kind: 'generic', tint: TINT.tech },
  { id: 'd11', title: 'Type C Fast Charging Cable 100W 1m Braided', price: 2.5, basePrice: 6.0, rating: 4.8, sold: 23001, kind: 'generic', tint: TINT.tech },
  { id: 'd12', title: 'Tempered Glass Screen Protector for iPhone', price: 13.32, basePrice: 25.0, rating: 4.8, sold: 12044, kind: 'generic', tint: TINT.tech },

  // ── cosmetics ──────────────────────────────────────────────────────────────
  { id: 'd13', title: 'Cosrx Advanced Snail 96 Mucin Power Essence 100ml', price: 16.9, basePrice: 28.0, rating: 4.9, sold: 9087, kind: 'generic', tint: TINT.cosmetics, badge: 'Mall' },
  { id: 'd14', title: 'Rom&nd Juicy Lasting Lip Tint Korean Makeup', price: 8.5, basePrice: 13.0, rating: 4.8, sold: 4410, kind: 'generic', tint: TINT.cosmetics },
  { id: 'd15', title: 'Anessa Perfect UV Sunscreen SPF50+ PA++++', price: 22.4, basePrice: 32.0, rating: 4.9, sold: 3380, kind: 'generic', tint: TINT.cosmetics },

  // ── clothes / fashion ───────────────────────────────────────────────────────
  { id: 'd16', title: 'Oversized Washed Cotton Tee Unisex Streetwear', price: 9.9, basePrice: 19.9, rating: 4.6, sold: 1870, kind: 'generic', tint: TINT.clothes },
  { id: 'd17', title: 'Baggy Wide-Leg Cargo Pants Y2K Korean', price: 18.5, basePrice: 29.9, rating: 4.5, sold: 990, kind: 'generic', tint: TINT.clothes },
  { id: 'd18', title: 'Vintage Washed Denim Jacket Oversized Unisex', price: 27.9, basePrice: 45.0, rating: 4.7, sold: 612, kind: 'generic', tint: TINT.clothes },

  // ── sports ───────────────────────────────────────────────────────────────
  { id: 'd19', title: 'Non-Slip TPE Yoga Mat 6mm Eco Workout', price: 14.9, basePrice: 26.0, rating: 4.7, sold: 2240, kind: 'generic', tint: TINT.sports },
  { id: 'd20', title: 'Adjustable Dumbbell Set 20kg Home Gym', price: 49.0, basePrice: 79.0, rating: 4.8, sold: 540, kind: 'generic', tint: TINT.sports },
  { id: 'd21', title: 'Protein Shaker Bottle 700ml BPA-Free', price: 4.9, basePrice: 9.0, rating: 4.6, sold: 8120, kind: 'generic', tint: TINT.sports },

  // ── home / toys / food ─────────────────────────────────────────────────────
  { id: 'd22', title: 'Soy Wax Scented Candle Lavender 200g', price: 11.9, basePrice: 19.9, rating: 4.7, sold: 1530, kind: 'generic', tint: TINT.home },
  { id: 'd23', title: 'Cute Bubu Dudu Busy Panda Blind Box Figure', price: 2.71, basePrice: 5.0, rating: 4.5, sold: 8801, kind: 'generic', tint: TINT.toys },
  { id: 'd24', title: 'Korean Honey Butter Almonds Snack 250g', price: 6.4, basePrice: 9.5, rating: 4.8, sold: 3960, kind: 'generic', tint: TINT.food },
]

export const FLASH_DEALS: DiscoverItem[] = DISCOVER.slice(0, 6)
