import { SAMPLE_LISTING } from "@/lib/sampleListing";
import { useSimStore } from "@/store/simStore";
import type { PersonaId } from "@/types/contracts";

const DEFAULT_SHOPEE_BASE = "http://localhost:5174";

function shopeeUrl(agentId: string, runId: string | undefined, persona: PersonaId): string {
  const base = (import.meta.env.VITE_SHOPEE_BASE ?? DEFAULT_SHOPEE_BASE).replace(/\/$/, "");
  const listingId = import.meta.env.VITE_SHOPEE_LISTING_ID ?? SAMPLE_LISTING.id;
  const params = new URLSearchParams({
    agent_id: agentId,
    persona,
  });
  if (runId) params.set("run_id", runId);
  return `${base}/shopee/${encodeURIComponent(listingId)}?${params.toString()}`;
}

export function ShopeeMonitorFrame({
  agentId,
  persona,
  label,
}: {
  agentId: string;
  persona: PersonaId;
  label: string;
}) {
  const runId = useSimStore((s) => s.runId);
  const url = shopeeUrl(agentId, runId, persona);

  return (
    <div className="shopee-monitor">
      <iframe
        className="shopee-monitor-frame"
        title={`Shopee interface preview — ${agentId}`}
        src={url}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
      <div className="shopee-monitor-chip">{label}</div>
    </div>
  );
}
