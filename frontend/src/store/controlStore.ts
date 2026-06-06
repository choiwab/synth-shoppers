import { create } from "zustand";
import { PERSONA_IDS, type ListingConfig, type PersonaId, type SimSpeed } from "@/types/contracts";
import { SAMPLE_LISTING } from "@/lib/sampleListing";

export interface ControlStore {
  personas: PersonaId[]; // enabled archetypes
  speed: SimSpeed; // 1 | 2 | 4
  price: number; // S$, drives header chip + listing_config.price
  listing: ListingConfig; // base listing config (price is overlaid from `price`)

  togglePersona(id: PersonaId): void;
  setSpeed(s: SimSpeed): void;
  setPrice(p: number): void;
  setListing(c: ListingConfig): void;
}

export const useControlStore = create<ControlStore>((set) => ({
  personas: [...PERSONA_IDS],
  speed: 1,
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
  setPrice: (p) => set({ price: Math.round(p * 10) / 10 }),
  setListing: (c) => set({ listing: c, price: c.price }),
}));

/** Effective listing config for a run: base config with the live price overlaid. */
export function currentListingConfig(s: ControlStore): ListingConfig {
  return { ...s.listing, price: s.price };
}
