import { ShopeeHeader } from '@/components/ShopeeHeader'
import { ShopeeFooter } from '@/components/ShopeeFooter'
import { CheckoutFlow } from '@/shopee/CheckoutFlow'

export function CheckoutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-shopee-bg">
      <ShopeeHeader variant="minimal" title="Checkout" showSearch={false} />
      <main className="flex-1">
        <CheckoutFlow />
      </main>
      <ShopeeFooter />
    </div>
  )
}
