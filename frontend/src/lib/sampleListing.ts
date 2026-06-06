import type { ListingConfig } from "@/types/contracts";

/**
 * STOPGAP listing config so the dashboard is fully demoable before H2 ships the
 * canonical `fixtures/listing.sample.json` (the Matin Kim beanie, OVERVIEW §5.4
 * / PRD 02 §6). Replace by loading H2's fixture once available — shape matches.
 */
export const SAMPLE_LISTING: ListingConfig = {
  id: "matinkim-beanie",
  title: "Matin Kim Logo Beanie — Official Korean Knit Hat (Unisex)",
  seller: { name: "MatinKim Official", verified: true, rating: 4.7, response_rate: 0.12 },
  price: 24.9,
  base_price: 24.9,
  variants: [
    {
      name: "Colour",
      options: ["Black", "Ivory", "Charcoal", "Cream"],
    },
  ],
  photos: [
    { url: "/assets/beanies/matin-kim-black.jpg", type: "product" },
    { url: "/assets/beanies/matin-kim-cream.jpg", type: "product" },
  ],
  description: "Matin Kim logo beanie with a soft Korean streetwear knit. One size, unisex fit.",
  rating: { score: 4.8, count: 312 },
  reviews: [
    { author: "jiae***ng", rating: 5, text: "100% authentic! Came with the brand tag and dust bag.", date: "2026-05-18" },
    { author: "sgfashion", rating: 5, text: "Quality knit, logo is clean. Worth the price for the real thing.", date: "2026-05-22" },
    { author: "weeklyhaul", rating: 4, text: "Lovely beanie, delivery took a few days but legit product.", date: "2026-05-09" },
  ],
  authenticity: { certificate: true, serial: true, unboxing: true },
  category: ["Women Clothes", "Hats & Caps", "Beanies"],
  shipping: { fee: 0, days: "Get by 9–11 Jun" },
};
