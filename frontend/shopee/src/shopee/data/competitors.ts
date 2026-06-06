import type { ListingConfig, ListingReview } from '@/types/contracts'

/**
 * The beanie listings shown alongside the Matin Kim target on /search.
 * Two tiers:
 *  - BRANDED: legit official-brand listings with REAL product photos (Supreme,
 *    Carhartt, Stüssy, Stray Kids, etc.), verified sellers, branded prices.
 *  - CHEAP: generic unbranded listings using the generated/colorized beanies,
 *    low prices, unverified sellers.
 * COMPETITORS = [...BRANDED, ...CHEAP] so the legit ones sort to the top.
 */

interface Mk {
  id: string
  title: string
  sellerName: string
  verified?: boolean
  price: number
  base_price: number
  colours: string[]
  score: number
  count: number
  respRate?: number
  description?: string
  reviews?: ListingReview[]
  /** image filenames in /assets/beanies (first = main, last = lifestyle). */
  images: string[]
  category?: string[]
  shippingFee?: number
}

function mk(c: Mk): ListingConfig {
  const photos: ListingConfig['photos'] = c.images.map((f, i) => ({
    url: `/assets/beanies/${f}`,
    type: i === c.images.length - 1 && c.images.length > 1 ? 'lifestyle' : 'product',
  }))
  return {
    id: c.id,
    title: c.title,
    seller: {
      name: c.sellerName,
      verified: c.verified ?? false,
      rating: Math.min(5, c.score + 0.1),
      response_rate: c.respRate ?? 85,
    },
    price: c.price,
    base_price: c.base_price,
    variants: [{ name: 'Colour', options: c.colours }],
    photos,
    description:
      c.description ??
      `${c.title}.\n\n• Soft, warm knit — true to size, unisex fit\n• Available in ${c.colours.length} colours: ${c.colours.join(', ')}\n\nShips from Singapore. Ready stock.`,
    rating: { score: c.score, count: c.count },
    reviews: c.reviews ?? [
      { author: 'happy***buyer', rating: 5, text: 'Authentic and good quality. Will buy again!', date: '2026-04-02' },
      { author: 'sg_shopper', rating: 5, text: 'Came with tags + receipt. Legit. Fast delivery.', date: '2026-03-19' },
    ],
    authenticity: { certificate: false, serial: false, unboxing: false },
    category: c.category ?? ['Jewellery & Accessories', 'Hats & Caps', 'Others'],
    shipping: { fee: c.shippingFee ?? 0, days: 'Get by 9–11 Jun' },
  }
}

/* ── Tier 1: legit branded listings (real photos) ─────────────────────────── */
const BRANDED: ListingConfig[] = [
  mk({
    id: 'supreme-ribbed-beanie',
    title: 'Supreme New Era® Ribbed Beanie — FW Box Logo',
    sellerName: 'Supreme',
    verified: true,
    price: 58.0,
    base_price: 58.0,
    colours: ['Tan', 'Black', 'Navy', 'Forest'],
    score: 4.9,
    count: 1203,
    respRate: 98,
    images: ['supreme.jpg'],
    category: ['Men Clothes', 'Hats & Caps', 'Beanies'],
    reviews: [
      { author: 'boxlogo***', rating: 5, text: 'Authentic, came with tags and receipt. Embroidery is clean.', date: '2026-05-19' },
      { author: 'streetwearsg', rating: 4, text: 'Premium but pricey. Bought for the brand more than warmth.', date: '2026-05-04' },
      { author: 'capcollector', rating: 5, text: 'Looks legit and holds shape after washing.', date: '2026-04-22' },
    ],
  }),
  mk({
    id: 'carhartt-watch-beanie',
    title: 'Carhartt WIP Acrylic Watch Hat Beanie — Black',
    sellerName: 'Carhartt WIP Official Store',
    verified: true,
    price: 39.0,
    base_price: 45.0,
    colours: ['Black', 'Navy', 'Heather Grey', 'Brown'],
    score: 4.9,
    count: 5840,
    respRate: 97,
    images: ['carhartt.jpg'],
    category: ['Men Clothes', 'Hats & Caps', 'Beanies'],
    reviews: [
      { author: 'workwearfan', rating: 5, text: 'Thick acrylic, authentic label, no itch. Better value than most fashion beanies.', date: '2026-05-16' },
      { author: 'sg_commuter', rating: 5, text: 'Fast delivery and warm enough for travel. Carhartt logo is subtle.', date: '2026-04-30' },
      { author: 'min***', rating: 4, text: 'Black colour easy to match, but fit is tighter than Korean styles.', date: '2026-04-11' },
    ],
  }),
  mk({
    id: 'stussy-stock-cuff-beanie',
    title: 'Stüssy Stock Cuff Beanie — Embroidered Logo',
    sellerName: 'Stüssy Singapore',
    verified: true,
    price: 49.0,
    base_price: 49.0,
    colours: ['Black', 'Cream', 'Olive', 'Burgundy'],
    score: 4.8,
    count: 2010,
    respRate: 96,
    images: ['stussy.jpg'],
    category: ['Men Clothes', 'Hats & Caps', 'Beanies'],
    reviews: [
      { author: 'hypegirl', rating: 5, text: 'Embroidery looks clean and the cream colour photographs well.', date: '2026-05-12' },
      { author: 'skaterkid', rating: 4, text: 'Legit Stussy, but material is thinner than expected.', date: '2026-04-26' },
      { author: 'ootd_sg', rating: 5, text: 'More streetwear vibe than basic beanies. Got compliments.', date: '2026-04-03' },
    ],
  }),
  mk({
    id: 'straykids-loverboy-beanie',
    title: 'Stray Kids Official Loverboy Cat-Ear Knit Beanie',
    sellerName: 'JYP Official Shop',
    verified: true,
    price: 32.0,
    base_price: 38.0,
    colours: ['Cream', 'Black'],
    score: 4.9,
    count: 980,
    respRate: 95,
    images: ['stray-kids.jpg'],
    category: ['Hobbies & Collections', 'K-Pop Merch', 'Beanies'],
  }),
  mk({
    id: 'lesserafim-chaewon-beanie',
    title: 'LE SSERAFIM Chaewon Fluffy Bear-Ear Beanie (Official MD)',
    sellerName: 'Weverse Shop Official',
    verified: true,
    price: 28.0,
    base_price: 34.0,
    colours: ['White', 'Pink'],
    score: 4.8,
    count: 642,
    respRate: 94,
    images: ['chaewon.jpg'],
    category: ['Hobbies & Collections', 'K-Pop Merch', 'Beanies'],
    reviews: [
      { author: 'fearnot***', rating: 5, text: 'Official MD packaging, very cute for photos. Worth it for fans.', date: '2026-05-13' },
      { author: 'chaewonbias', rating: 5, text: 'Fluffy and trendy, but white needs careful washing.', date: '2026-04-21' },
      { author: 'kpopcart', rating: 4, text: 'Looks exactly like the listing. Delivery took a bit long.', date: '2026-04-02' },
    ],
  }),
  mk({
    id: 'chrome-cross-beanie',
    title: 'Chrome Cross Patch Knit Beanie — Y2K Streetwear',
    sellerName: 'MNML Official Store',
    verified: true,
    price: 24.9,
    base_price: 34.9,
    colours: ['Black', 'Charcoal'],
    score: 4.7,
    count: 1450,
    respRate: 92,
    images: ['kpop-cross.jpg'],
    category: ['Women Clothes', 'Hats & Caps', 'Beanies'],
  }),
  mk({
    id: 'he-edition-angora-beanie',
    title: 'HE EDITION Angora Wool Fuzzy Beanie — Korean',
    sellerName: 'HE Edition Official',
    verified: true,
    price: 26.9,
    base_price: 39.0,
    colours: ['Beige', 'Cream', 'Grey', 'Brown'],
    score: 4.8,
    count: 1188,
    respRate: 95,
    images: ['korean-angora.jpg'],
    category: ['Women Clothes', 'Hats & Caps', 'Beanies'],
  }),
  mk({
    id: 'convex-graphic-beanie',
    title: 'Convex Y2K Graphic Knit Beanie — Star Logo Streetwear',
    sellerName: 'Convex Official Store',
    verified: true,
    price: 22.9,
    base_price: 32.0,
    colours: ['Brown', 'Pink', 'Grey'],
    score: 4.7,
    count: 860,
    respRate: 93,
    images: ['trio.jpg', 'pink.jpg'],
    category: ['Women Clothes', 'Hats & Caps', 'Beanies'],
  }),
]

/* ── Tier 2: cheap unbranded listings (generated beanies) ─────────────────── */
const CHEAP: ListingConfig[] = [
  mk({
    id: 'basic-acrylic-beanie',
    title: '[SG SELLER] Plain Solid Colour Knitted Beanie Unisex Winter',
    sellerName: 'sgmega.deals',
    price: 3.5,
    base_price: 5.0,
    colours: ['Black', 'White', 'Grey', 'Red', 'Navy'],
    score: 4.3,
    count: 12044,
    respRate: 71,
    images: ['black.jpg'],
    reviews: [
      { author: 'value***hunter', rating: 5, text: 'Cheap and does the job. Cannot complain at this price.', date: '2026-04-08' },
      { author: 'mrs_tan', rating: 3, text: 'A bit thin and itchy leh. Ok for the price lor.', date: '2026-03-11' },
      { author: 'deal_chaser', rating: 4, text: 'Colour is accurate, but no brand tag. Good spare beanie only.', date: '2026-02-28' },
    ],
  }),
  mk({
    id: 'wool-blend-cuff-beanie',
    title: 'Wool Blend Cuffed Beanie Couple Winter Warm Hat',
    sellerName: 'winterwarm.sg',
    price: 5.9,
    base_price: 9.9,
    colours: ['Navy', 'Camel', 'Black', 'Burgundy'],
    score: 4.4,
    count: 2103,
    respRate: 80,
    images: ['navy.jpg'],
    reviews: [
      { author: 'coldoffice', rating: 4, text: 'Warmer than the $3 ones and not too scratchy.', date: '2026-04-15' },
      { author: 'budgettravels', rating: 5, text: 'Good value for winter trip. Wool blend feels thicker.', date: '2026-03-24' },
      { author: 'lim***', rating: 3, text: 'Shape is okay but shipping took longer than stated.', date: '2026-03-03' },
    ],
  }),
  mk({
    id: 'korean-solid-knit-beanie',
    title: 'Korean Solid Colour Knit Beanie Skullcap Unisex',
    sellerName: 'seoulcloset.sg',
    price: 4.2,
    base_price: 7.9,
    colours: ['Forest', 'Camel', 'Cream', 'Grey'],
    score: 4.5,
    count: 678,
    respRate: 76,
    images: ['forest.jpg'],
  }),
  mk({
    id: 'ribbed-warm-beanie',
    title: 'Unisex Ribbed Knit Beanie Hat Cheap Winter Cap',
    sellerName: 'budgetfinds.sg',
    price: 3.9,
    base_price: 6.5,
    colours: ['Burgundy', 'Black', 'Grey', 'Camel'],
    score: 4.2,
    count: 9810,
    respRate: 68,
    images: ['burgundy.jpg'],
  }),
  mk({
    id: 'cute-ear-beanie',
    title: 'Cute Cat-Ear Knitted Beanie Korean Ladies Winter',
    sellerName: 'littleones.sg',
    price: 6.9,
    base_price: 11.9,
    colours: ['Beige', 'Black', 'Pink'],
    score: 4.6,
    count: 540,
    respRate: 82,
    images: ['ear.jpg'],
    category: ['Women Clothes', 'Hats & Caps', 'Beanies'],
  }),
  mk({
    id: 'marled-slouchy-beanie',
    title: 'Slouchy Marled Knit Beanie Oversized Unisex Winter',
    sellerName: 'urbanthreads.sg',
    price: 8.9,
    base_price: 14.9,
    colours: ['Grey Mix', 'Navy Mix', 'Black'],
    score: 4.4,
    count: 980,
    respRate: 79,
    images: ['marled.jpg'],
  }),
]

export const COMPETITORS: ListingConfig[] = [...BRANDED, ...CHEAP]
