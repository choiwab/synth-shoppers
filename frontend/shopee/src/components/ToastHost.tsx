import { useToast } from '@/store/toast'

/** Centre-screen Shopee toast stack ("Item has been added to your shopping cart"). */
export function ToastHost() {
  const toasts = useToast((s) => s.toasts)
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded bg-black/80 px-7 py-4 text-white shadow-lg"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-sm">{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
