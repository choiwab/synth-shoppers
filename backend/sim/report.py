from __future__ import annotations

from collections import Counter, defaultdict

from contracts import GATE_ORDER, AgentTrace, PersonaId, Recommendation, ViabilityReport
from sim.recommendations import FIELD_BY_STAGE, build_recommendations_from_counts


def build_report(run_id: str, agents: list[AgentTrace], recommended_price: float) -> ViabilityReport:
    total = len(agents)
    bought = sum(1 for agent in agents if agent.outcome == "bought")
    buy_rate = bought / total if total else 0.0

    funnel = []
    for stage in GATE_ORDER:
        entered = sum(1 for agent in agents if any(trace.stage == stage for trace in agent.stage_trace))
        bailed = sum(1 for agent in agents if agent.bail_stage == stage)
        funnel.append(
            {
                "stage": stage,
                "entered": entered,
                "bailed": bailed,
                "bail_rate": round(bailed / entered, 3) if entered else 0,
            }
        )

    by_arch: dict[str, list[AgentTrace]] = defaultdict(list)
    for agent in agents:
        by_arch[agent.archetype].append(agent)

    archetypes = []
    risk_archetypes: list[PersonaId] = []
    for archetype, group in sorted(by_arch.items()):
        group_bought = sum(1 for agent in group if agent.outcome == "bought")
        objections = Counter(agent.objection for agent in group if agent.objection)
        rate = group_bought / len(group)
        if rate < 0.25:
            risk_archetypes.append(archetype)  # type: ignore[arg-type]
        archetypes.append(
            {
                "archetype": archetype,
                "agents": len(group),
                "bought": group_bought,
                "bailed": len(group) - group_bought,
                "buy_rate": round(rate, 3),
                "avg_retention_s": round(sum(agent.retention_time_s for agent in group) / len(group), 2),
                "top_objection": objections.most_common(1)[0][0] if objections else None,
            }
        )

    stage_counts = Counter(agent.bail_stage for agent in agents if agent.bail_stage)
    heatmap_counts = Counter()
    for stage, count in stage_counts.items():
        heatmap_counts[FIELD_BY_STAGE[stage]] += count
    objection_heatmap = [{"field": field, "bail_count": count} for field, count in heatmap_counts.most_common()]

    recommendations: list[Recommendation] = build_recommendations_from_counts(stage_counts, Counter())
    market_fit_score = round(min(100, max(0, buy_rate * 70 + (len(by_arch) - len(risk_archetypes)) / max(len(by_arch), 1) * 30)))

    return ViabilityReport(
        run_id=run_id,
        market_fit_score=market_fit_score,
        recommended_price=recommended_price,
        go_no_go={
            "decision": "go" if market_fit_score >= 55 else "no_go",
            "confidence": round(0.55 + min(total, 60) / 60 * 0.35, 2),
        },
        funnel=funnel,
        archetypes=archetypes,
        objection_heatmap=objection_heatmap,
        risk_archetypes=risk_archetypes,
        recommendations=recommendations,
        agents=agents,
    )

