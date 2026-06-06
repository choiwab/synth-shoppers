// Human-readable formatting for the before→after diff in the iteration tracker.
// (Ported from the shopee app's applyRecommendation.ts so the dashboard has no
// cross-app import; the backend already produces the patched listing, so the
// dashboard only needs to *display* changes, not apply them.)

/** Human label for a changed value (used in the before/after delta view). */
export function formatChangeValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? "" : "s"}`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("type" in o && "url" in o) return `${String(o.type)} photo`;
    return JSON.stringify(v);
  }
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}
