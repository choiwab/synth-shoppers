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
  const basePrice = useControlStore((s) => s.listing.base_price);
  const { togglePersona, setSpeed, setPrice } = useControlStore.getState();

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
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
