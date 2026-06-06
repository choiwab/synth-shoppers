import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { SearchPage } from '@/pages/SearchPage'
import { ProductPageRoute } from '@/pages/ProductPageRoute'
import { CartPage } from '@/pages/CartPage'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { OrderConfirmedPage } from '@/pages/OrderConfirmedPage'
import { ReportPage } from '@/pages/ReportPage'
import { ToastHost } from '@/components/ToastHost'
import { withSimSession } from '@/shopee/simSession'
import { bootstrapListingOverrideFromUrl } from '@/shopee/config/loadConfig'

// Runs before React renders: if the browser-use runtime entered at `/?…&mk_config=…`,
// stash the tracked listing into the sessionStorage override so it survives the
// home → search → product navigation (links don't carry the config param).
bootstrapListingOverrideFromUrl()

/**
 * Root route. The browser-use runtime (H3) deep-links to `/?listing=<slug>`
 * (sim/browser_use_driver.py builds `{base}/?listing={id}`), so honour that by
 * redirecting straight to the product page; otherwise show the storefront home.
 */
function RootRoute() {
  const [params] = useSearchParams()
  const listing = params.get('listing')
  if (listing) return <Navigate to={withSimSession(`/shopee/${encodeURIComponent(listing)}`)} replace />
  return <HomePage />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/shopee/:listingId" element={<ProductPageRoute />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-confirmed" element={<OrderConfirmedPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/report/:runId" element={<ReportPage />} />
        <Route path="*" element={<Navigate to={withSimSession('/')} replace />} />
      </Routes>
      <ToastHost />
    </BrowserRouter>
  )
}

export default App
