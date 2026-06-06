import { useIterationStore, latestReadyIteration, type Iteration } from "@/store/iterationStore";
import { useSimStore } from "@/store/simStore";
import { applyProposedAndRerun, autoImprove } from "@/store/runController";
import { archetypeColor, archetypeLabel } from "@/lib/archetype";
import { formatChangeValue } from "@/lib/configDiff";
import type { ProposedChange } from "@/types/contracts";

const AUTO_RUNS = 3;

/**
 * Self-improvement section (lives in the Tweaks drawer). A git-history-style
 * timeline of iterations — each run is a "commit" showing what changed and the
 * resulting buy rate — plus the pending proposal for the next listing.
 */
export function ImprovementSection() {
  const iterations = useIterationStore((s) => s.iterations);
  const ready = useIterationStore(latestReadyIteration);
  const status = useSimStore((s) => s.status);
  const busy = status === "running" || status === "paused";
  const canApply = !busy && !!ready?.analysis && ready.analysis.proposed_changes.length > 0;

  return (
    <div className="improve-section">
      <div className="field-label">
        <span className="name">Self-improvement</span>
        {iterations.length > 0 && <span className="val" style={{ fontSize: 13 }}>{iterations.length} run{iterations.length === 1 ? "" : "s"}</span>}
      </div>

      <div className="improve-actions">
        <button className="btn improve-btn primary" disabled={busy} onClick={() => void autoImprove(AUTO_RUNS)}>
          ✦ Auto-improve ×{AUTO_RUNS}
        </button>
        <button className="btn improve-btn" disabled={!canApply} onClick={() => void applyProposedAndRerun()}>
          ▶ Apply &amp; run next
        </button>
      </div>

      {iterations.length === 0 ? (
        <div className="hint">Run agents, then a proposed improvement appears here. Auto-improve runs {AUTO_RUNS} rounds back-to-back.</div>
      ) : (
        <div className="git-log">
          {iterations.map((it, i) => (
            <CommitNode key={it.runId} it={it} prev={iterations[i - 1]} />
          ))}
          {ready?.analysis && ready.analysis.proposed_changes.length > 0 && (
            <ProposedNode it={ready} canApply={canApply} onApply={() => void applyProposedAndRerun()} />
          )}
        </div>
      )}
    </div>
  );
}

function DeltaBadge({ buyRate, prevBuyRate }: { buyRate?: number; prevBuyRate?: number }) {
  if (buyRate == null) return null;
  const pct = `${Math.round(buyRate * 100)}%`;
  if (prevBuyRate == null) return <span className="commit-buy">buy {pct}</span>;
  const dpp = Math.round((buyRate - prevBuyRate) * 100);
  const tone = dpp > 0 ? "up" : dpp < 0 ? "down" : "flat";
  const sign = dpp > 0 ? "+" : "";
  return (
    <span className="commit-buy">
      buy {pct} <span className={`commit-delta ${tone}`}>{dpp === 0 ? "±0" : `${sign}${dpp}`}pp</span>
    </span>
  );
}

function CommitNode({ it, prev }: { it: Iteration; prev?: Iteration }) {
  const statusDot: Record<Iteration["status"], string> = {
    running: "dot-running",
    analyzing: "dot-running",
    ready: "dot-ready",
    error: "dot-error",
  };
  return (
    <div className="commit">
      <span className={`commit-dot ${statusDot[it.status]}`} />
      <div className="commit-body">
        <div className="commit-head">
          <span className="commit-idx">Iteration {it.index}</span>
          <DeltaBadge buyRate={it.buyRate} prevBuyRate={prev?.buyRate} />
          {(it.status === "running" || it.status === "analyzing") && (
            <span className="commit-pending">{it.status === "running" ? "running…" : "analyzing…"}</span>
          )}
        </div>
        {it.appliedChanges && it.appliedChanges.length > 0 ? (
          <ChangeList changes={it.appliedChanges} />
        ) : (
          <div className="commit-base">{it.index === 1 ? "baseline listing" : "no changes"}</div>
        )}
      </div>
    </div>
  );
}

function ProposedNode({ it, canApply, onApply }: { it: Iteration; canApply: boolean; onApply: () => void }) {
  const a = it.analysis!;
  return (
    <div className="commit proposed">
      <span className="commit-dot dot-proposed" />
      <div className="commit-body">
        <div className="commit-head">
          <span className="commit-idx">Iteration {it.index + 1} · proposed</span>
          <span className={`ac-source ac-source-${a.source}`}>{a.source === "llm" ? "AI" : "auto"}</span>
        </div>
        {a.narrative && <p className="ac-narrative">{a.narrative}</p>}
        <ChangeList changes={a.proposed_changes} />
        {a.per_persona.length > 0 && (
          <div className="ac-personas">
            {a.per_persona.map((p) => (
              <span
                key={p.archetype}
                className="ac-persona-chip"
                title={`${p.insight} → ${p.what_to_fix}`}
                style={{ borderColor: archetypeColor(p.archetype) }}
              >
                {archetypeLabel(p.archetype)}
              </span>
            ))}
          </div>
        )}
        {a.expected_impact && <div className="ac-impact">{a.expected_impact}</div>}
        <button className="btn improve-btn primary commit-apply" disabled={!canApply} onClick={onApply}>
          ▶ Apply &amp; run iteration {it.index + 1}
        </button>
      </div>
    </div>
  );
}

function ChangeList({ changes }: { changes: ProposedChange[] }) {
  if (changes.length === 0) return <div className="commit-base">no changes</div>;
  return (
    <div className="ac-changes">
      {changes.map((c, i) => (
        <div className="change-row" key={`${c.path}-${i}`} title={c.reason}>
          <span className="cr-field">{c.field}</span>
          <span className="cr-values">
            <span className="cr-before">{formatChangeValue(c.current)}</span>
            <span className="cr-arrow">→</span>
            <span className="cr-after">{formatChangeValue(c.proposed)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
