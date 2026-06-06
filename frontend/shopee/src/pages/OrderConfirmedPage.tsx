import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { ShopeeHeader } from '@/components/ShopeeHeader'
import { ShopeeFooter } from '@/components/ShopeeFooter'
import { sgd } from '@/lib/utils'

function readLastOrder(): { orderNo: string; total: number; itemCount: number } | null {
  try {
    const raw = sessionStorage.getItem('shopee-last-order')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function OrderConfirmedPage() {
  const order = readLastOrder()

  return (
    <div className="flex min-h-screen flex-col bg-shopee-bg">
      <ShopeeHeader variant="minimal" title="Order Confirmed" showSearch={false} />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-[460px] rounded-sm bg-white p-10 text-center shadow-sm" data-order-status>
          <CheckCircle2 size={64} className="mx-auto text-success" />
          <h1 className="mt-4 text-2xl font-medium text-ink">Order Placed Successfully!</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Thank you for shopping with Shopee. Your order is being prepared.
          </p>

          {order && (
            <div className="mt-6 space-y-1 rounded-sm bg-shopee-bg px-5 py-4 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-ink-soft">Order Number</span>
                <span className="font-medium">#{order.orderNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Items</span>
                <span>{order.itemCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Total Paid</span>
                <span className="font-medium text-shopee">{sgd(order.total)}</span>
              </div>
            </div>
          )}

          <Link
            to="/"
            className="mt-6 inline-block rounded-sm bg-shopee px-8 py-2.5 text-sm font-medium text-white hover:bg-shopee-dark"
          >
            Continue Shopping
          </Link>
        </div>
      </main>
      <ShopeeFooter />
    </div>
  )
}
