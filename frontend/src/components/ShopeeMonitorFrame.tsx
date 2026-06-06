import { currentListingConfig, useControlStore } from "@/store/controlStore";
import { useSimStore } from "@/store/simStore";
import type { PersonaId } from "@/types/contracts";

const DEFAULT_SHOPEE_BASE = "http://localhost:5174";

function encodeConfig(config: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(config))));
}

function buildShopeeUrl(agentId: string, persona: PersonaId, runId: string | undefined): string {
  const controls = useControlStore.getState();
  const config = currentListingConfig(controls);
  const base = (import.meta.env.VITE_SHOPEE_BASE ?? DEFAULT_SHOPEE_BASE).replace(/\/$/, "");
  const params = new URLSearchParams({
    agent_id: agentId,
    persona,
    config: encodeConfig(config),
  });
  if (runId) params.set("run_id", runId);
  return `${base}/shopee/${encodeURIComponent(config.id)}?${params.toString()}`;
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
  const listing = useControlStore((s) => currentListingConfig(s));
  const url = buildShopeeUrl(agentId, persona, runId);

  return (
    <div className="shopee-monitor">
      <iframe
        key={`${agentId}:${runId ?? "draft"}:${JSON.stringify(listing)}`}
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
