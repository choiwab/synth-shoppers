import { useSimStore } from "@/store/simStore";
import { useIterationStore, latestReadyIteration } from "@/store/iterationStore";
import { applyProposedAndRerun } from "@/store/runController";

/**
 * Slim status bar above the live monitor. Surfaces run/auto-improve progress and
 * the "proposal ready" CTA that otherwise hides inside the Tweaks drawer.
 */
export function RunBanner() {
  const status = useSimStore((s) => s.status);
  const counts = useSimStore((s) => s.counts);
  const buyRate = useSimStore((s) => s.buyRate);
  const autoActive = useIterationStore((s) => s.autoActive);
  const autoTarget = useIterationStore((s) => s.autoTarget);
  const iterCount = useIterationStore((s) => s.iterations.length);
  const ready = useIterationStore(latestReadyIteration);

  if (status === "idle") return null;

  let tone: "run" | "done" | "error" = "run";
  let label: React.ReactNode;

  if (status === "error") {
    tone = "error";
    label = "Run failed — check the backend.";
  } else if (autoActive && (status === "running" || status === "paused")) {
    label = (
      <>
        <Spinner /> Auto-improving — run {Math.min(iterCount, autoTarget)} of {autoTarget}…
      </>
    );
  } else if (status === "running" || status === "paused") {
    label = (
      <>
        <Spinner /> Running {counts.total} agents · {counts.bought} bought · {counts.bailed} bailed
      </>
    );
  } else {
    tone = "done";
    const pct = buyRate != null ? `${Math.round(buyRate * 100)}%` : "—";
    label = `Run complete · buy ${pct} · ${counts.bought}/${counts.total} bought`;
  }

  const showApply = tone === "done" && !autoActive && !!ready?.analysis && ready.analysis.proposed_changes.length > 0;

  return (
    <div className={`run-banner run-banner-${tone}`}>
      <span className="rb-label">{label}</span>
      {showApply && (
        <button className="rb-apply" onClick={() => void applyProposedAndRerun()}>
          ▶ Apply improvement &amp; re-run
        </button>
      )}
    </div>
  );
}

function Spinner() {
  return <span className="rb-spinner" aria-hidden />;
}
