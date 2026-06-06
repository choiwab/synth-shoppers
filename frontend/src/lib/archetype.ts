import { ARCHETYPE_HUE, PERSONA_META, type PersonaId } from "@/types/contracts";

/**
 * Canonical archetype color. Single source of truth = OVERVIEW §5.2 hues.
 * `oklch(0.74 0.135 <hue>)`. H2 should use this helper too (no second palette).
 */
export function archetypeColor(id: PersonaId, opts?: { l?: number; c?: number }): string {
  const hue = ARCHETYPE_HUE[id] ?? 0;
  const l = opts?.l ?? 0.74;
  const c = opts?.c ?? 0.135;
  return `oklch(${l} ${c} ${hue})`;
}

/** A translucent variant, handy for fills/backgrounds. */
export function archetypeColorAlpha(id: PersonaId, alpha: number): string {
  const hue = ARCHETYPE_HUE[id] ?? 0;
  return `oklch(0.74 0.135 ${hue} / ${alpha})`;
}

export function archetypeLabel(id: PersonaId): string {
  return PERSONA_META[id]?.display ?? id;
}

export function archetypeTag(id: PersonaId): string {
  return PERSONA_META[id]?.tag ?? "";
}

/** Two-letter avatar initials for the persona dot. */
export function archetypeInitials(id: PersonaId): string {
  const label = archetypeLabel(id);
  const parts = label.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}
