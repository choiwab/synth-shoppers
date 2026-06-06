const DEFAULT_API_BASE = 'http://localhost:8000'
const DEFAULT_DASHBOARD_BASE = 'http://localhost:5173'

export const API_BASE = (import.meta.env.VITE_API_BASE ?? DEFAULT_API_BASE).replace(/\/$/, '')
export const DASHBOARD_BASE = (import.meta.env.VITE_DASHBOARD_BASE ?? DEFAULT_DASHBOARD_BASE).replace(/\/$/, '')

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

export function resolveAssetUrl(url?: string): string | undefined {
  if (!url) return url
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  if (url.startsWith('/')) return apiUrl(url)
  return url
}
