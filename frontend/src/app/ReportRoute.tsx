import { Link, useParams } from "react-router-dom";

/**
 * HANDOFF PLACEHOLDER. The post-run report/analytics/recommendations/viability
 * surfaces are owned by H2 (PRD 02 §4.4–4.6). H1's dashboard routes here on
 * `run_complete` via the "View Report" affordance. H2 replaces this component
 * with the real AnalyticsView/RecommendationsPanel/ViabilityReport, fetching
 * GET /simulation/{runId}/report (OVERVIEW §5.7).
 */
export function ReportRoute() {
  const { runId } = useParams();
  return (
    <div className="center-route">
      <div className="eyebrow">Viability report</div>
      <h1 className="display" style={{ fontSize: 28 }}>
        Report for <span style={{ color: "var(--accent)" }}>{runId}</span>
      </h1>
      <p className="muted" style={{ maxWidth: 440 }}>
        Owned by H2 — analytics, recommendations, and the viability report render
        here from <code>GET /simulation/{runId}/report</code>.
      </p>
      <Link className="btn" to="/">
        ← Back to live monitor
      </Link>
    </div>
  );
}
