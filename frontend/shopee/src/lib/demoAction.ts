import { useToast } from '@/store/toast'

/**
 * Feedback for cosmetic controls that have no real backend in this demo. Returns
 * a handler that shows an observable toast, so a browsing agent never hits a
 * silent dead-end when it clicks (e.g. "Change", "Claim", "Chat").
 */
export function useDemoAction() {
  const show = useToast((s) => s.show)
  return (label: string) => show(`${label} isn't available in this demo`)
}
