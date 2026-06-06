import { useNavigate } from 'react-router-dom'
import { useDemoAction } from '@/lib/demoAction'
import { withSimSession } from '@/shopee/simSession'

const FOOTER_ROUTES: Record<string, string> = {
  'Flash Deals': '/',
  'Shopee Mall': '/search?keyword=beanie',
  Payment: '/checkout',
  'Order Tracking': '/cart',
}

const COLUMNS: { heading: string; links: string[] }[] = [
  { heading: 'Customer Service', links: ['Help Centre', 'Shopee Mall', 'Payment', 'Shopee Coins', 'Order Tracking'] },
  { heading: 'About Shopee', links: ['About Us', 'Shopee Careers', 'Shopee Policies', 'Privacy Policy', 'Flash Deals'] },
  { heading: 'Payment', links: ['Visa', 'Mastercard', 'PayNow', 'ShopeePay'] },
  { heading: 'Follow Us', links: ['Facebook', 'Instagram', 'TikTok', 'LinkedIn'] },
]

export function ShopeeFooter() {
  const navigate = useNavigate()
  const demo = useDemoAction()
  return (
    <footer className="mt-10 border-t-4 border-shopee bg-[#fbfbfb] text-ink-soft">
      <div className="mx-auto grid w-full grid-cols-2 gap-8 px-4 py-10 md:grid-cols-4 xl:px-8">
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink">{col.heading}</h3>
            <ul className="space-y-2 text-xs">
              {col.links.map((l) => (
                <li key={l}>
                  <button
                    onClick={() => (FOOTER_ROUTES[l] ? navigate(withSimSession(FOOTER_ROUTES[l])) : demo(l))}
                    className="hover:text-shopee"
                  >
                    {l}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto w-full px-4 py-5 text-center text-xs text-ink-faint xl:px-8">
          © 2026 Shopee Singapore — local recreation for synthetic-shopper simulation. Not affiliated
          with Shopee. No real transactions are processed.
        </p>
      </div>
    </footer>
  )
}
