import { cn } from '@/lib/utils'

interface StarRatingProps {
  score: number
  /** pixel size of each star */
  size?: number
  className?: string
}

/** Shopee-style gold star row with partial fill for fractional scores. */
export function StarRating({ score, size = 14, className }: StarRatingProps) {
  return (
    <span
      className={cn('inline-flex items-center', className)}
      role="img"
      aria-label={`${score} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, score - i))
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="text-black/15" fill="currentColor" />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star size={size} className="text-shopee" fill="currentColor" />
            </span>
          </span>
        )
      })}
    </span>
  )
}

function Star({ size, className, fill }: { size: number; className?: string; fill: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill={fill}
      aria-hidden="true"
    >
      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.785 1.402 8.172L12 18.896l-7.336 3.871 1.402-8.172L.132 9.21l8.2-1.192z" />
    </svg>
  )
}
