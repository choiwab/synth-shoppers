import { API_BASE } from "@/store/api";

/**
 * Resolve a thumbnail/screenshot URL coming from H3/H4 (OVERVIEW §5.3
 * `thumbnail_url`). H3 mounts screenshots on the backend at `/static/shots`
 * (04 §4.5) — but the frontend runs on a different origin. So a root-relative
 * path must be prefixed with the API base; absolute/data/blob URLs pass through.
 * This keeps the agent strip + spotlight robust to either URL convention.
 */
export function resolveAssetUrl(url?: string): string | undefined {
  if (!url) return url;
  if (/^(https?:|data:|blob:)/i.test(url)) return url; // already absolute
  if (url.startsWith("/")) return `${API_BASE}${url}`; // backend-relative asset
  return url;
}
