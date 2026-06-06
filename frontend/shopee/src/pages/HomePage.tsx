import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Shirt, Smartphone, Laptop, Refrigerator, Apple, Baby, Dumbbell, Camera,
  Briefcase, Gem, Footprints, Sofa, Sparkles, HeartPulse, ToyBrick, Gamepad2,
  BookOpen, PawPrint, ShoppingBag, Watch, Truck, Store, Cpu, Building2, CreditCard,
  Zap, ChevronRight,
} from 'lucide-react'
import { ShopeeHeader } from '@/components/ShopeeHeader'
import { ShopeeFooter } from '@/components/ShopeeFooter'
import { HeroCarousel } from '@/components/HeroCarousel'
import { SimpleProductCard } from '@/components/SimpleProductCard'
import { FLASH_DEALS, DISCOVER } from '@/shopee/data/discover'
import { shuffle } from '@/lib/utils'

const CATEGORIES: { label: string; icon: typeof Shirt }[] = [
  { label: "Women's Apparel", icon: Shirt },
  { label: 'Mobile & Gadgets', icon: Smartphone },
  { label: 'Computers & Peripherals', icon: Laptop },
  { label: 'Home Appliances', icon: Refrigerator },
  { label: 'Food & Beverages', icon: Apple },
  { label: 'Kids Fashion', icon: Baby },
  { label: 'Sports & Outdoors', icon: Dumbbell },
  { label: 'Cameras & Drones', icon: Camera },
  { label: "Women's Bags", icon: Briefcase },
  { label: 'Jewellery & Accessories', icon: Gem },
  { label: "Men's Wear", icon: Footprints },
  { label: 'Home & Living', icon: Sofa },
  { label: 'Beauty & Personal Care', icon: Sparkles },
  { label: 'Health & Wellness', icon: HeartPulse },
  { label: 'Toys, Kids & Babies', icon: ToyBrick },
  { label: 'Video Games', icon: Gamepad2 },
  { label: 'Hobbies & Books', icon: BookOpen },
  { label: 'Pet Supplies', icon: PawPrint },
  { label: "Men's Bags", icon: ShoppingBag },
  { label: 'Watches', icon: Watch },
]

const SERVICES: { label: string; icon: typeof Truck }[] = [
  { label: 'Fulfilled by Shopee', icon: Truck },
  { label: 'Shopee Supermarket', icon: Store },
  { label: 'Shopee Tech', icon: Cpu },
  { label: 'Shopee Mall', icon: Building2 },
  { label: 'Payment Promotions', icon: CreditCard },
]

export function HomePage() {
  // randomise the Daily Discover order on each load for variety
  const discover = useMemo(() => shuffle(DISCOVER), [])
  return (
    <div className="min-h-screen bg-shopee-bg">
      <ShopeeHeader variant="full" />

      <main className="mx-auto w-full px-4 py-4 xl:px-8">
        {/* hero */}
        <section className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr]">
          <HeroCarousel />
          <div className="grid grid-rows-2 gap-2">
            <Link
              to="/search?keyword=beanie"
              className="flex flex-col justify-center rounded-sm bg-gradient-to-br from-[#ff6f3c] to-[#ee4d2d] p-5 text-white"
            >
              <p className="text-lg font-bold">Buy Shopee E-Vouchers</p>
              <p className="text-xs opacity-90">Up to 20% off your next order</p>
            </Link>
            <Link
              to="/search?keyword=beanie"
              className="flex flex-col justify-center rounded-sm bg-gradient-to-br from-[#ffce3d] to-[#ff8a00] p-5 text-white"
            >
              <p className="text-lg font-bold">6.6 Great Shopee Sale</p>
              <p className="text-xs opacity-90">S$6 off $20 · free shipping</p>
            </Link>
          </div>
        </section>

        {/* service strip */}
        <section className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-sm bg-line sm:grid-cols-5">
          {SERVICES.map(({ label, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center gap-2 bg-white py-4 text-center">
              <Icon size={26} className="text-shopee" />
              <span className="text-xs text-ink-soft">{label}</span>
            </div>
          ))}
        </section>

        {/* categories */}
        <section className="mt-2 rounded-sm bg-white">
          <h2 className="border-b border-line px-4 py-3 text-sm uppercase tracking-wide text-ink-soft">
            Categories
          </h2>
          <div className="grid grid-cols-5 md:grid-cols-10">
            {CATEGORIES.map(({ label, icon: Icon }) => (
              <Link
                key={label}
                to={`/search?keyword=${encodeURIComponent(label)}`}
                className="flex flex-col items-center gap-2 border-b border-r border-line p-3 text-center transition hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-shopee-light/50">
                  <Icon size={22} className="text-shopee" strokeWidth={1.6} />
                </span>
                <span className="text-[11px] leading-tight text-ink-soft">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* flash deals */}
        <section className="mt-4 rounded-sm bg-white">
          <div className="flex items-center gap-4 border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-1 text-lg font-bold text-shopee">
              <Zap size={18} fill="currentColor" /> FLASH DEALS
            </h2>
            <div className="flex items-center gap-1 text-sm">
              {['02', '14', '36'].map((t) => (
                <span key={t} className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-white">
                  {t}
                </span>
              ))}
            </div>
            <Link to="/search?keyword=beanie" className="ml-auto flex items-center text-sm text-shopee hover:underline">
              See All <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6 2xl:grid-cols-8">
            {FLASH_DEALS.map((item) => (
              <SimpleProductCard key={item.id} item={item} />
            ))}
          </div>
        </section>

        {/* daily discover */}
        <section className="mt-4">
          <h2 className="mb-2 border-b-2 border-shopee py-3 text-center text-base font-medium uppercase tracking-wide text-shopee">
            Daily Discover
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 2xl:grid-cols-8">
            {discover.map((item) => (
              <SimpleProductCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      </main>

      <ShopeeFooter />
    </div>
  )
}
