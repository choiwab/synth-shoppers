import { useSimStore } from "@/store/simStore";
import { useControlStore } from "@/store/controlStore";
import { pauseRun, rerun, resumeRun, startRun } from "@/store/runController";
import { PriceChip } from "@/components/PriceChip";

/**
 * Left rail (was the top header). Vertical to reclaim vertical space for the
 * strip + funnel. Listing identity → price → run controls → status.
 */
export function Sidebar({ onOpenTweaks }: { onOpenTweaks: () => void }) {
  const status = useSimStore((s) => s.status);
  const evListing = useSimStore((s) => s.listing);

  const price = useControlStore((s) => s.price);
  const baseListing = useControlStore((s) => s.listing);

  const title = evListing?.title ?? baseListing.title;
  const seller = evListing?.seller ?? baseListing.seller.name;
  const rating = baseListing.rating.score;

  const paused = status === "paused";
  const running = status === "running" || status === "paused";
  const canRun = status === "idle" || status === "complete" || status === "error";

  return (
    <aside className="panel sidebar">
      <div className="sidebar-listing">
        <img className="listing-thumb-img" src="/beanie2.png" alt={title} />
        <div className="listing-title-side" title={title}>
          {title}
        </div>
        <div className="listing-sub">
          <span>{seller}</span>
          <span>·</span>
          <span>SG</span>
          <span>·</span>
          <span>★ {rating.toFixed(1)}</span>
        </div>
      </div>

      <PriceChip price={price} basePrice={baseListing.base_price} />

      <div className="sidebar-controls">
        <button
          className="btn sidebar-btn"
          disabled={!canRun}
          onClick={() => void startRun()}
        >
          ▶ Run agents
        </button>
        <div className="sidebar-btn-row">
          <button
            className="btn sidebar-btn"
            disabled={!running}
            onClick={() => (paused ? resumeRun() : pauseRun())}
          >
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button className="btn sidebar-btn" disabled={!running} onClick={() => void rerun()}>
            ↻ Re-run
          </button>
        </div>

        <button className="btn sidebar-btn" onClick={onOpenTweaks}>
          ⚙ Tweaks
        </button>
      </div>
    </aside>
  );
}
