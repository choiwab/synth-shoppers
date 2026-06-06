from __future__ import annotations

from collections import Counter, defaultdict

from contracts import (
    GATE_ORDER,
    SENTIMENT_SCORE,
    AgentTrace,
    StageTrace,
    PersonaId,
    Recommendation,
    ViabilityReport,
)
from sim.recommendations import FIELD_BY_STAGE, build_recommendations_from_counts


def build_report(
    run_id: str,
    agents: list[AgentTrace],
    recommended_price: float,
    parent_report: ViabilityReport | None = None,
) -> ViabilityReport:
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
        # Layer 2: per-gate sentiment arc for this persona — where it warms up / sours.
        sentiment_arc = []
        for stage in GATE_ORDER:
            scores = [
                SENTIMENT_SCORE[trace.sentiment]
                for agent in group
                for trace in agent.stage_trace
                if trace.stage == stage and trace.sentiment
            ]
            if scores:
                sentiment_arc.append(
                    {"stage": stage, "avg_sentiment": round(sum(scores) / len(scores), 3), "n": len(scores)}
                )
        archetypes.append(
            {
                "archetype": archetype,
                "agents": len(group),
                "bought": group_bought,
                "bailed": len(group) - group_bought,
                "buy_rate": round(rate, 3),
                "avg_retention_s": round(sum(agent.retention_time_s for agent in group) / len(group), 2),
                "top_objection": objections.most_common(1)[0][0] if objections else None,
                "sentiment_arc": sentiment_arc,
            }
        )

    stage_counts = Counter(agent.bail_stage for agent in agents if agent.bail_stage)
    heatmap_counts = Counter()
    for stage, count in stage_counts.items():
        heatmap_counts[FIELD_BY_STAGE[stage]] += count
    objection_heatmap = [{"field": field, "bail_count": count} for field, count in heatmap_counts.most_common()]

    recommendations: list[Recommendation] = build_recommendations_from_counts(stage_counts, Counter())
    market_fit_score = round(min(100, max(0, buy_rate * 70 + (len(by_arch) - len(risk_archetypes)) / max(len(by_arch), 1) * 30)))
    browsing_metrics = build_browsing_metrics(
        agents=agents,
        bought=bought,
        objection_heatmap=objection_heatmap,
        archetypes=archetypes,
        parent_report=parent_report,
    )

    # Layer 2: the "what they said" feed + why-bought, straight off the traces.
    comments: list[dict] = []
    purchase_reasons: list[dict] = []
    for agent in agents:
        head = {"agent_id": agent.agent_id, "name": agent.name, "archetype": agent.archetype}
        for trace in agent.stage_trace:
            if trace.comment:
                comments.append({**head, "stage": trace.stage, "sentiment": trace.sentiment, "comment": trace.comment})
        if agent.outcome == "bailed" and agent.objection:
            comments.append({**head, "stage": agent.bail_stage, "sentiment": "reject", "comment": agent.objection})
        if agent.outcome == "bought" and agent.purchase_reason:
            purchase_reasons.append({**head, "reason": agent.purchase_reason})
            comments.append({**head, "stage": "checkout", "sentiment": "love", "comment": agent.purchase_reason})

    # Relative diagnostics (read/engagement) off the funnel; click_rate needs the
    # Tier-2 impression stage so it stays None rather than a fake 1.0.
    entered_by_stage = {row["stage"]: row["entered"] for row in funnel}
    landed = entered_by_stage.get("land", 0) or total
    diagnostics = {
        "review_read_rate": round(entered_by_stage.get("reviews", 0) / landed, 3) if landed else 0.0,
        "engagement_rate": round(entered_by_stage.get("price", 0) / landed, 3) if landed else 0.0,
        "click_rate": None,
    }

    # Dropoff-reason distribution (share bailed per categorized reason).
    reason_counts = Counter(agent.bail_reason for agent in agents if agent.bail_reason)
    reasoned_bails = sum(reason_counts.values())
    dropoff_reasons = [
        {"reason": reason, "count": count, "share": round(count / reasoned_bails, 3) if reasoned_bails else 0.0}
        for reason, count in reason_counts.most_common()
    ]
    agent_trace_reports = build_agent_trace_reports(
        agents=agents,
        browsing_metrics=browsing_metrics,
        diagnostics=diagnostics,
        dropoff_reasons=dropoff_reasons,
    )

    return ViabilityReport(
        run_id=run_id,
        market_fit_score=market_fit_score,
        recommended_price=recommended_price,
        go_no_go={
            "decision": "go" if market_fit_score >= 55 else "no_go",
            "confidence": round(0.55 + min(total, 60) / 60 * 0.35, 2),
        },
        browsing_metrics=browsing_metrics,
        funnel=funnel,
        archetypes=archetypes,
        objection_heatmap=objection_heatmap,
        risk_archetypes=risk_archetypes,
        recommendations=recommendations,
        agents=agents,
        comments=comments,
        purchase_reasons=purchase_reasons,
        agent_trace_reports=agent_trace_reports,
        diagnostics=diagnostics,
        dropoff_reasons=dropoff_reasons,
    )


def build_browsing_metrics(
    agents: list[AgentTrace],
    bought: int,
    objection_heatmap: list[dict],
    archetypes: list[dict],
    parent_report: ViabilityReport | None = None,
) -> dict:
    total = len(agents)
    orders = bought
    entered = lambda stage: sum(1 for agent in agents if any(trace.stage == stage for trace in agent.stage_trace))
    engaged = sum(1 for agent in agents if len(agent.stage_trace) >= 2)
    dropoff_total = sum(item["bail_count"] for item in objection_heatmap)

    metrics = {
        "unique_buyers": bought,
        "orders": orders,
        "buyer_uplift": None,
        "order_uplift": None,
        "click_rate": round(entered("photos") / total, 3) if total else 0,
        "read_rate": round(entered("reviews") / total, 3) if total else 0,
        "engagement_rate": round(engaged / total, 3) if total else 0,
        "average_basket_cost": None,
        "dropoff_reason_distribution": [
            {
                "reason": item["field"],
                "count": item["bail_count"],
                "share": round(item["bail_count"] / dropoff_total, 3) if dropoff_total else 0,
            }
            for item in objection_heatmap
        ],
        "objection_resolution_rate": None,
        "per_persona_uplift": None,
    }

    if not parent_report:
        return metrics

    parent_metrics = parent_report.browsing_metrics or {}
    parent_buyers = parent_metrics.get("unique_buyers", sum(1 for agent in parent_report.agents if agent.outcome == "bought"))
    parent_orders = parent_metrics.get("orders", parent_buyers)
    metrics["buyer_uplift"] = bought - parent_buyers
    metrics["order_uplift"] = orders - parent_orders

    parent_by_persona = {row["archetype"]: row for row in parent_report.archetypes}
    metrics["per_persona_uplift"] = [
        {
            "archetype": row["archetype"],
            "buy_rate_delta": round(row["buy_rate"] - parent_by_persona.get(row["archetype"], {}).get("buy_rate", 0), 3),
            "buyers_delta": row["bought"] - parent_by_persona.get(row["archetype"], {}).get("bought", 0),
        }
        for row in archetypes
    ]

    if parent_report.objection_heatmap:
        parent_top = parent_report.objection_heatmap[0]
        current_top_count = next((item["bail_count"] for item in objection_heatmap if item["field"] == parent_top["field"]), 0)
        parent_count = parent_top["bail_count"]
        metrics["objection_resolution_rate"] = round(max(parent_count - current_top_count, 0) / parent_count, 3) if parent_count else None

    return metrics


def build_agent_trace_reports(
    agents: list[AgentTrace],
    browsing_metrics: dict,
    diagnostics: dict,
    dropoff_reasons: list[dict],
) -> list[dict]:
    total_gates = len(GATE_ORDER)
    return [
        build_agent_trace_report(
            agent=agent,
            total_gates=total_gates,
            browsing_metrics=browsing_metrics,
            diagnostics=diagnostics,
            dropoff_reasons=dropoff_reasons,
        )
        for agent in agents
    ]


def build_agent_trace_report(
    agent: AgentTrace,
    total_gates: int,
    browsing_metrics: dict,
    diagnostics: dict,
    dropoff_reasons: list[dict],
) -> dict:
    stages = list(agent.stage_trace)
    completed_gates = len({trace.stage for trace in stages if trace.stage in GATE_ORDER})
    stage_path = [trace.stage for trace in stages]
    last_stage = stage_path[-1] if stage_path else agent.bail_stage
    comments = [
        {
            "stage": trace.stage,
            "sentiment": trace.sentiment,
            "comment": trace.comment,
            "time_s": trace.time_s,
        }
        for trace in stages
        if trace.comment
    ]
    screenshots = [
        {"stage": trace.stage, "screenshot_url": trace.screenshot_url, "time_s": trace.time_s}
        for trace in stages
        if trace.screenshot_url
    ]
    stage_rows = [_stage_row(trace, index, stages) for index, trace in enumerate(stages)]
    avg_stage_time = round(agent.retention_time_s / max(len(stages), 1), 2) if stages else agent.retention_time_s
    key_reason = agent.purchase_reason if agent.outcome == "bought" else agent.objection
    converted = agent.outcome == "bought"

    return {
        "agent_id": agent.agent_id,
        "name": agent.name,
        "archetype": agent.archetype,
        "outcome": agent.outcome,
        "status_label": "Bought" if converted else f"Bailed at {agent.bail_stage or last_stage or 'unknown'}",
        "summary": _agent_summary(agent, completed_gates, total_gates, key_reason),
        "retention_time_s": agent.retention_time_s,
        "completed_gates": completed_gates,
        "total_gates": total_gates,
        "progress_pct": round(completed_gates / total_gates, 3) if total_gates else 0.0,
        "stage_path": stage_path,
        "last_stage": last_stage,
        "bail_stage": agent.bail_stage,
        "bail_reason": agent.bail_reason,
        "objection": agent.objection,
        "purchase_reason": agent.purchase_reason,
        "key_reason": key_reason,
        "metrics": {
            "converted": converted,
            "dropped": not converted,
            "engaged": len(stages) >= 2,
            "read_reviews": _entered(stages, "reviews"),
            "checked_price": _entered(stages, "price"),
            "added_to_cart": _entered(stages, "cart"),
            "checked_out": _entered(stages, "checkout"),
            "stage_count": len(stages),
            "avg_stage_time_s": avg_stage_time,
            "retention_time_s": agent.retention_time_s,
            "dropoff_stage": agent.bail_stage,
            "dropoff_reason": agent.bail_reason,
        },
        "run_metrics_context": {
            "unique_buyers": browsing_metrics.get("unique_buyers"),
            "orders": browsing_metrics.get("orders"),
            "click_rate": browsing_metrics.get("click_rate"),
            "read_rate": browsing_metrics.get("read_rate"),
            "engagement_rate": browsing_metrics.get("engagement_rate"),
            "diagnostics": diagnostics,
            "dropoff_reasons": dropoff_reasons,
        },
        "comments": comments,
        "screenshots": screenshots,
        "stage_trace": stage_rows,
    }


def _stage_row(trace: StageTrace, index: int, stages: list[StageTrace]) -> dict:
    prev_time = stages[index - 1].time_s if index > 0 else 0.0
    return {
        "order": index + 1,
        "stage": trace.stage,
        "time_s": trace.time_s,
        "delta_s": round(max(trace.time_s - prev_time, 0), 2),
        "screenshot_url": trace.screenshot_url,
        "sentiment": trace.sentiment,
        "comment": trace.comment,
    }


def _entered(stages: list[StageTrace], stage: str) -> bool:
    return any(trace.stage == stage for trace in stages)


def _agent_summary(agent: AgentTrace, completed_gates: int, total_gates: int, key_reason: str | None) -> str:
    persona = agent.archetype.replace("_", " ")
    if agent.outcome == "bought":
        tail = f" Bought after reaching {completed_gates}/{total_gates} gates."
    else:
        tail = f" Dropped at {agent.bail_stage or 'unknown'} after {completed_gates}/{total_gates} gates."
    reason = f" Reason: {key_reason}" if key_reason else ""
    return f"{agent.name} ({persona}) spent {agent.retention_time_s}s in the listing.{tail}{reason}"
