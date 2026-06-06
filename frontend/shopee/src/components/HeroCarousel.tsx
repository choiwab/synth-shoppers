import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { withSimSession } from '@/shopee/simSession'

interface Slide {
  eyebrow: string
  title: string
  sub: string
  bg: string
  text: string
}

const SLIDES: Slide[] = [
  {
    eyebrow: 'styled BY Shopee',
    title: 'OVER 100K\nTRENDING FITS FROM ASIA',
    sub: 'Shop the looks everyone is wearing',
    bg: 'linear-gradient(110deg, #efe6d9 0%, #e7d3c2 60%, #d9b9a3 100%)',
    text: '#3a2c22',
  },
  {
    eyebrow: '9.9 Super Shopping Day',
    title: 'SAVE MORE WITH\nEXCLUSIVE BANK VOUCHERS',
    sub: 'Up to 90% off + free shipping',
    bg: 'linear-gradient(110deg, #ff7a3c 0%, #ee4d2d 100%)',
    text: '#ffffff',
  },
  {
    eyebrow: 'Winter Knitwear Edit',
    title: 'BEANIES &\nKNIT HATS FROM S$3.50',
    sub: 'Cosy picks for year-end travel',
    bg: 'linear-gradient(110deg, #2f4a5a 0%, #46707f 100%)',
    text: '#ffffff',
  },
]

export function HeroCarousel() {
  const [i, setI] = useState(0)
  const n = SLIDES.length

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % n), 4500)
    return () => clearInterval(t)
  }, [n])

  const slide = SLIDES[i]
  return (
    <div className="group relative h-[235px] overflow-hidden rounded-sm">
      <Link
        to={withSimSession('/search?keyword=beanie')}
        className="flex h-full flex-col justify-center px-10"
        style={{ background: slide.bg, color: slide.text }}
      >
        <p className="text-sm uppercase tracking-[0.2em] opacity-90">{slide.eyebrow}</p>
        <h2 className="mt-2 whitespace-pre-line text-3xl font-bold leading-tight">{slide.title}</h2>
        <p className="mt-3 text-sm opacity-90">{slide.sub}</p>
        <span
          className="mt-4 w-fit rounded-sm bg-white/90 px-4 py-2 text-sm font-medium text-shopee"
          style={{ color: '#ee4d2d' }}
        >
          Shop Now ›
        </span>
      </Link>

      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => setI((p) => (p - 1 + n) % n)}
        className="absolute left-0 top-1/2 flex h-12 w-8 -translate-y-1/2 items-center justify-center bg-black/20 text-white opacity-0 transition group-hover:opacity-100"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => setI((p) => (p + 1) % n)}
        className="absolute right-0 top-1/2 flex h-12 w-8 -translate-y-1/2 items-center justify-center bg-black/20 text-white opacity-0 transition group-hover:opacity-100"
      >
        <ChevronRight size={22} />
      </button>

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            type="button"
            aria-label={`Go to slide ${idx + 1}`}
            onClick={() => setI(idx)}
            className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`}
          />
        ))}
      </div>
    </div>
  )
}
