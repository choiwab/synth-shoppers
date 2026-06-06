import clsx from "clsx";

/** Live price chip. Turns red when price > base_price (PRD 01 §4.5). */
export function PriceChip({ price, basePrice }: { price: number; basePrice: number }) {
  const over = price > basePrice + 1e-6;
  return (
    <div className={clsx("price-chip", over && "over")} title={over ? "Above baseline" : undefined}>
      <span className="cur">S$</span>
      {price.toFixed(2)}
    </div>
  );
}
