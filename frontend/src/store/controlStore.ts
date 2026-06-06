import { create } from "zustand";
import { PERSONA_IDS, type ListingConfig, type PersonaId, type SimMode, type SimSpeed } from "@/types/contracts";
import { SAMPLE_LISTING } from "@/lib/sampleListing";

export interface ControlStore {
  personas: PersonaId[]; // enabled archetypes
  speed: SimSpeed; // 1 | 2 | 4
  perPersona: number; // agents spawned per enabled archetype (crowd_size = personas × perPersona)
  mode: SimMode; // "real" (guided Chromium) | "mock" (instant, no browser)
  price: number; // S$, mirrored into listing_config.price for legacy selectors
  listing: ListingConfig;

  togglePersona(id: PersonaId): void;
  setSpeed(s: SimSpeed): void;
  setPerPersona(n: number): void;
  setMode(m: SimMode): void;
  setPrice(p: number): void;
  setTitle(title: string): void;
  setDescription(description: string): void;
  setCategoryFromText(text: string): void;
  setVariantOptions(text: string): void;
  setShippingFee(fee: number): void;
  setShippingDays(days: string): void;
  setRatingScore(score: number): void;
  setReviewCount(count: number): void;
  setSellerName(name: string): void;
  setSellerRating(rating: number): void;
  setSellerVerified(verified: boolean): void;
  setSellerResponseRate(rate: number): void;
  setAuthenticitySignal(signal: keyof ListingConfig["authenticity"], enabled: boolean): void;
  setListing(c: ListingConfig): void;
}

function finiteNumber(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function splitList(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export const useControlStore = create<ControlStore>((set) => ({
  personas: [...PERSONA_IDS],
  speed: 1,
  perPersona: 4, // 4 × 7 = 28 agents — the ~20s / 3-wave sweet spot in real mode
  mode: "real",
  price: SAMPLE_LISTING.price,
  listing: SAMPLE_LISTING,

  togglePersona: (id) =>
    set((s) => {
      const has = s.personas.includes(id);
      // keep at least one persona enabled
      if (has && s.personas.length === 1) return s;
      return {
        personas: has ? s.personas.filter((p) => p !== id) : [...s.personas, id],
      };
    }),
  setSpeed: (s) => set({ speed: s }),
  setPerPersona: (n) => set({ perPersona: Math.max(1, Math.min(8, Math.round(n))) }),
  setMode: (m) => set({ mode: m }),
  setPrice: (p) =>
    set((s) => {
      const price = Math.round(finiteNumber(p, s.price) * 10) / 10;
      return { price, listing: { ...s.listing, price } };
    }),
  setTitle: (title) =>
    set((s) => ({ listing: { ...s.listing, title } })),
  setDescription: (description) =>
    set((s) => ({ listing: { ...s.listing, description } })),
  setCategoryFromText: (text) =>
    set((s) => ({ listing: { ...s.listing, category: splitList(text) } })),
  setVariantOptions: (text) =>
    set((s) => {
      const options = splitList(text);
      const [firstVariant, ...rest] = s.listing.variants;
      const nextVariant = { name: firstVariant?.name ?? "Colour", options };
      return { listing: { ...s.listing, variants: [nextVariant, ...rest] } };
    }),
  setShippingFee: (fee) =>
    set((s) => ({
      listing: {
        ...s.listing,
        shipping: {
          ...s.listing.shipping,
          fee: Math.max(0, Math.round(finiteNumber(fee, s.listing.shipping.fee) * 100) / 100),
        },
      },
    })),
  setShippingDays: (days) =>
    set((s) => ({ listing: { ...s.listing, shipping: { ...s.listing.shipping, days } } })),
  setRatingScore: (score) =>
    set((s) => ({
      listing: {
        ...s.listing,
        rating: {
          ...s.listing.rating,
          score: clamp(Math.round(finiteNumber(score, s.listing.rating.score) * 10) / 10, 0, 5),
        },
      },
    })),
  setReviewCount: (count) =>
    set((s) => ({
      listing: {
        ...s.listing,
        rating: { ...s.listing.rating, count: Math.max(0, Math.round(finiteNumber(count, s.listing.rating.count))) },
      },
    })),
  setSellerName: (name) =>
    set((s) => ({ listing: { ...s.listing, seller: { ...s.listing.seller, name } } })),
  setSellerRating: (rating) =>
    set((s) => ({
      listing: {
        ...s.listing,
        seller: {
          ...s.listing.seller,
          rating: clamp(Math.round(finiteNumber(rating, s.listing.seller.rating) * 10) / 10, 0, 5),
        },
      },
    })),
  setSellerVerified: (verified) =>
    set((s) => ({ listing: { ...s.listing, seller: { ...s.listing.seller, verified } } })),
  setSellerResponseRate: (rate) =>
    set((s) => ({
      listing: {
        ...s.listing,
        seller: {
          ...s.listing.seller,
          response_rate: clamp(Math.round(finiteNumber(rate, s.listing.seller.response_rate)), 0, 100),
        },
      },
    })),
  setAuthenticitySignal: (signal, enabled) =>
    set((s) => ({
      listing: {
        ...s.listing,
        authenticity: { ...s.listing.authenticity, [signal]: enabled },
      },
    })),
  setListing: (c) => set({ listing: c, price: c.price }),
}));

/** Effective listing config for a run and monitor iframe. */
export function currentListingConfig(s: ControlStore): ListingConfig {
  return { ...s.listing, price: s.price };
}
