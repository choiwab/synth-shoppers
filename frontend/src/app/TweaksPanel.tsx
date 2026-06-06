import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { ARCHETYPE_HUE, PERSONA_IDS, type SimMode, type SimSpeed } from "@/types/contracts";
import { archetypeLabel } from "@/lib/archetype";
import { useControlStore } from "@/store/controlStore";
import { ImprovementSection } from "@/app/ImprovementSection";

const SPEEDS: SimSpeed[] = [1, 2, 4];
const PER_PERSONA: number[] = [1, 2, 3, 4];
const MODES: SimMode[] = ["real", "mock"];

export function TweaksPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const personas = useControlStore((s) => s.personas);
  const speed = useControlStore((s) => s.speed);
  const perPersona = useControlStore((s) => s.perPersona);
  const mode = useControlStore((s) => s.mode);
  const price = useControlStore((s) => s.price);
  const basePrice = useControlStore((s) => s.listing.base_price);
  const { togglePersona, setSpeed, setPerPersona, setMode, setPrice } = useControlStore.getState();

  const total = personas.length * perPersona;
  const waves = Math.ceil(total / 10);

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

              {/* crowd size — agents per persona */}
              <div>
                <div className="field-label">
                  <span className="name">Agents per persona</span>
                  <span className="val">
                    {perPersona} × {personas.length} = {total}
                  </span>
                </div>
                <div className="segmented">
                  {PER_PERSONA.map((n) => (
                    <button key={n} className={clsx(perPersona === n && "on")} onClick={() => setPerPersona(n)}>
                      {n}×
                    </button>
                  ))}
                </div>
                <div className="hint">
                  {total} agents · ~{waves} wave{waves === 1 ? "" : "s"} (~{waves * 6}s). More instances per archetype
                  → buy/bail rates move visibly when you improve the listing.
                </div>
              </div>

              {/* mode */}
              <div>
                <div className="field-label">
                  <span className="name">Mode</span>
                  <span className="val">{mode === "real" ? "Real" : "Mock"}</span>
                </div>
                <div className="segmented">
                  {MODES.map((m) => (
                    <button key={m} className={clsx(mode === m && "on")} onClick={() => setMode(m)}>
                      {m === "real" ? "Real" : "Mock"}
                    </button>
                  ))}
                </div>
                <div className="hint">
                  Real = clicks real Chromium for screenshots (~{waves * 6}s). Mock = instant, no browser. Both decide
                  deterministically, so every improvement moves the numbers.
                </div>
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

              {/* self-improvement: git-history of iterations + next proposal */}
              <ImprovementSection />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
