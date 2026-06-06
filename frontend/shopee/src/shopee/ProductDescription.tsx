import type { ListingConfig } from '@/types/contracts'
import { emitFunnelAction } from '@/shopee/funnel'

interface ProductDescriptionProps {
  config: ListingConfig
}

export function ProductDescription({ config }: ProductDescriptionProps) {
  const specs: { label: string; value: string }[] = [
    { label: 'Category', value: config.category.join(' › ') },
    { label: 'Stock', value: '562' },
    { label: 'Ships From', value: 'Singapore' },
    { label: 'Colours', value: config.variants[0]?.options.join(', ') ?? '—' },
  ]

  return (
    <section
      data-action="read-description"
      data-field="description-section"
      onClick={() => emitFunnelAction('read_description', 'reviews', config.id)}
      className="rounded-sm border border-line bg-white p-5"
    >
      <h2 className="mb-4 text-base font-medium uppercase tracking-wide text-ink">
        Product Specifications
      </h2>
      <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {specs.map((s) => (
          <div
            key={s.label}
            data-field={`spec-${s.label.toLowerCase().replaceAll(' ', '-')}`}
            className="flex gap-3 text-sm"
          >
            <dt className="w-28 shrink-0 text-ink-soft">{s.label}</dt>
            <dd className="text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mb-3 mt-6 text-base font-medium uppercase tracking-wide text-ink">
        Product Description
      </h2>
      <p data-field="description" className="whitespace-pre-line text-sm leading-relaxed text-ink">
        {config.description}
      </p>
    </section>
  )
}
