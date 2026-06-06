import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { ARCHETYPE_HUE, PERSONA_IDS, type SimSpeed } from "@/types/contracts";
import { archetypeLabel } from "@/lib/archetype";
import { useControlStore } from "@/store/controlStore";

const SPEEDS: SimSpeed[] = [1, 2, 4];

export function TweaksPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const personas = useControlStore((s) => s.personas);
  const speed = useControlStore((s) => s.speed);
  const price = useControlStore((s) => s.price);
  const listing = useControlStore((s) => s.listing);
  const basePrice = listing.base_price;
  const {
    togglePersona,
    setSpeed,
    setPrice,
    setTitle,
    setDescription,
    setCategoryFromText,
    setVariantOptions,
    setShippingFee,
    setShippingDays,
    setRatingScore,
    setReviewCount,
    setSellerName,
    setSellerRating,
    setSellerVerified,
    setSellerResponseRate,
    setAuthenticitySignal,
  } = useControlStore.getState();
  const colourOptions = listing.variants[0]?.options.join(", ") ?? "";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="drawer-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 36 }}
          >
            <div className="drawer-head">
              <div>
                <div className="eyebrow">Tweaks</div>
                <div className="display" style={{ fontSize: 17 }}>
                  Run settings
                </div>
              </div>
              <button className="btn btn-icon" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="drawer-body">
              {/* persona mix */}
              <div>
                <div className="field-label">
                  <span className="name">Persona mix</span>
                  <span className="val" style={{ fontSize: 13 }}>
                    {personas.length}/7
                  </span>
                </div>
                <div className="persona-toggles">
                  {PERSONA_IDS.map((id) => {
                    const on = personas.includes(id);
                    return (
                      <button
                        key={id}
                        className={clsx("persona-toggle", !on && "off")}
                        onClick={() => {
                          togglePersona(id);
                        }}
                      >
                        <span
                          className="swatch"
                          style={{ ["--hue" as string]: ARCHETYPE_HUE[id] }}
                        />
                        <span className="pname">{archetypeLabel(id)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* speed */}
              <div>
                <div className="field-label">
                  <span className="name">Speed</span>
                  <span className="val">{speed}×</span>
                </div>
                <div className="segmented">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      className={clsx(speed === s && "on")}
                      onClick={() => {
                        setSpeed(s);
                      }}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
                <div className="hint">Applies to backend run metadata; screenshots stream at backend pace.</div>
              </div>

              {/* price */}
              <div>
                <div className="field-label">
                  <span className="name">Listing price</span>
                  <span className="val" style={{ color: price > basePrice ? "var(--red)" : undefined }}>
                    S${price.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={0.5}
                  value={price}
                  onChange={(e) => {
                    setPrice(Number(e.target.value));
                  }}
                />
                <div className="hint">Baseline S${basePrice.toFixed(2)} · above it tints the chip red.</div>
              </div>

              {/* copy */}
              <div>
                <div className="field-label">
                  <span className="name">Title</span>
                  <span className="val">{listing.title.length}/90</span>
                </div>
                <input
                  className="text-input"
                  value={listing.title}
                  maxLength={90}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <div className="hint">Affects first impression, search card, and land-stage objections.</div>
              </div>

              <div>
                <div className="field-label">
                  <span className="name">Description</span>
                  <span className="val">{listing.description.length}/420</span>
                </div>
                <textarea
                  className="text-input textarea"
                  value={listing.description}
                  maxLength={420}
                  rows={5}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <div className="hint">Moves read-rate and spec-sensitive personas.</div>
              </div>

              <div>
                <div className="field-label">
                  <span className="name">Category path</span>
                  <span className="val">{listing.category.length} levels</span>
                </div>
                <input
                  className="text-input"
                  value={listing.category.join(", ")}
                  onChange={(e) => setCategoryFromText(e.target.value)}
                />
                <div className="hint">Updates breadcrumb and product specifications.</div>
              </div>

              <div>
                <div className="field-label">
                  <span className="name">Colour variants</span>
                  <span className="val">{listing.variants[0]?.options.length ?? 0} options</span>
                </div>
                <textarea
                  className="text-input textarea short"
                  value={colourOptions}
                  rows={3}
                  onChange={(e) => setVariantOptions(e.target.value)}
                />
                <div className="hint">Comma or newline separated; updates the price-stage swatches.</div>
              </div>

              {/* fulfilment */}
              <div>
                <div className="field-label">
                  <span className="name">Shipping fee</span>
                  <span className="val">S${listing.shipping.fee.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={0.25}
                  value={listing.shipping.fee}
                  onChange={(e) => setShippingFee(Number(e.target.value))}
                />
                <input
                  className="text-input compact"
                  value={listing.shipping.days}
                  onChange={(e) => setShippingDays(e.target.value)}
                  aria-label="Shipping delivery window"
                />
                <div className="hint">Shipping cost/window hits price-value and checkout confidence.</div>
              </div>

              {/* social proof */}
              <div>
                <div className="field-label">
                  <span className="name">Rating & reviews</span>
                  <span className="val">
                    ★ {listing.rating.score.toFixed(1)} · {listing.rating.count}
                  </span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={5}
                  step={0.1}
                  value={listing.rating.score}
                  onChange={(e) => setRatingScore(Number(e.target.value))}
                />
                <input
                  className="text-input compact"
                  type="number"
                  min={0}
                  value={listing.rating.count}
                  onChange={(e) => setReviewCount(Number(e.target.value))}
                  aria-label="Review count"
                />
                <div className="hint">Review volume and rating drive social-proof objections.</div>
              </div>

              {/* trust */}
              <div>
                <div className="field-label">
                  <span className="name">Trust signals</span>
                  <span className="val">{listing.seller.verified ? "Verified" : "Unverified"}</span>
                </div>
                <input
                  className="text-input"
                  value={listing.seller.name}
                  onChange={(e) => setSellerName(e.target.value)}
                  aria-label="Seller name"
                />
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={listing.seller.verified}
                    onChange={(e) => setSellerVerified(e.target.checked)}
                  />
                  <span>Verified seller badge</span>
                </label>
                <div className="field-label sub">
                  <span className="name">Seller rating</span>
                  <span className="val">★ {listing.seller.rating.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={5}
                  step={0.1}
                  value={listing.seller.rating}
                  onChange={(e) => setSellerRating(Number(e.target.value))}
                />
                <div className="field-label sub">
                  <span className="name">Seller response</span>
                  <span className="val">{Math.round(listing.seller.response_rate)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={listing.seller.response_rate}
                  onChange={(e) => setSellerResponseRate(Number(e.target.value))}
                />
                <div className="check-grid">
                  {(["certificate", "serial", "unboxing"] as const).map((signal) => (
                    <label className="check-row" key={signal}>
                      <input
                        type="checkbox"
                        checked={listing.authenticity[signal]}
                        onChange={(e) => setAuthenticitySignal(signal, e.target.checked)}
                      />
                      <span>{signal}</span>
                    </label>
                  ))}
                </div>
                <div className="hint">Trust and authenticity controls target scam-wary buyers.</div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
