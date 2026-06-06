import type { FunnelStage } from '@/types/contracts'

/**
 * Funnel signal — emitted on every browser-use funnel action so H3 can confirm +
 * time a step and H1 can hook thumbnails. Identical contract to shopee-stub.html
 * and /funnel-actions.json. Advisory: the authoritative success signal is still
 * the observable DOM change.
 */
export type FunnelActionName =
  | 'open_listing'
  | 'look_at_photos'
  | 'read_description'
  | 'read_reviews'
  | 'check_price'
  | 'add_to_cart'
  | 'change_quantity'
  | 'checkout'
  | 'confirm_purchase'

export interface FunnelActionDetail {
  action: FunnelActionName
  stage: FunnelStage
  listingId: string
}

export const FUNNEL_DOM_EVENT = 'funnel:action'

export function emitFunnelAction(
  action: FunnelActionName,
  stage: FunnelStage,
  listingId: string,
): void {
  const detail: FunnelActionDetail = { action, stage, listingId }
  window.dispatchEvent(new CustomEvent<FunnelActionDetail>(FUNNEL_DOM_EVENT, { detail }))
  try {
    window.parent.postMessage({ source: 'shopee', type: 'funnel', ...detail }, '*')
  } catch {
    /* cross-origin parent — ignore */
  }
}
