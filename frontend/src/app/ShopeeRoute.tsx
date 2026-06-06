import { Link, useParams } from "react-router-dom";

/**
 * HANDOFF PLACEHOLDER. The config-driven Shopee listing page is owned by H2
 * (PRD 02 §4.2). It lives at this route inside the shared frontend app. H1 only
 * reserves the path so routing is wired; H2 replaces this with <ShopeePage/>.
 */
export function ShopeeRoute() {
  const { listingId } = useParams();
  return (
    <div className="center-route">
      <div className="eyebrow">Shopee listing</div>
      <h1 className="display" style={{ fontSize: 28 }}>
        {listingId}
      </h1>
      <p className="muted" style={{ maxWidth: 440 }}>
        Owned by H2 — the config-driven, funnel-gated Shopee page renders here.
      </p>
      <Link className="btn" to="/">
        ← Back to live monitor
      </Link>
    </div>
  );
}
