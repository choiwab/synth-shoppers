import type { ListingConfig } from "@/types/contracts";

/**
 * STOPGAP listing config so the dashboard is fully demoable before H2 ships the
 * canonical `fixtures/listing.sample.json` (the Matin Kim beanie, OVERVIEW §5.4
 * / PRD 02 §6). Replace by loading H2's fixture once available — shape matches.
 */
export const SAMPLE_LISTING: ListingConfig = {
  id: "matinkim-beanie",
  title: "CozyKnit Ribbed Merino Beanie — Unisex, 8 Colours",
  seller: { name: "MatinKim Official", verified: true, rating: 4.7, response_rate: 0.12 },
  price: 24.9,
  base_price: 24.9,
  variants: [
    {
      name: "Colour",
      options: ["Black", "Cream", "Camel", "Grey", "Navy", "Olive", "Wine", "Pink"],
    },
  ],
  photos: [
    { url: "", type: "product" },
    { url: "", type: "product" },
    { url: "", type: "lifestyle" },
  ],
  description: "Soft ribbed merino-blend beanie. One size, unisex fit.",
  rating: { score: 4.8, count: 312 },
  reviews: [
    { author: "jq***", rating: 5, text: "Warm and not itchy leh, worth it.", date: "2026-05-02" },
    { author: "tan***", rating: 4, text: "Colour abit off from photo but ok.", date: "2026-04-28" },
    { author: "wx***", rating: 2, text: "Took 3 weeks to arrive, seller never reply.", date: "2026-04-19" },
  ],
  authenticity: { certificate: false, serial: false, unboxing: false },
  category: ["Fashion", "Accessories", "Hats & Caps"],
  shipping: { fee: 2.9, days: "3–5" },
};
