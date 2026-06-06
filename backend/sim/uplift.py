"""Control-vs-treatment uplift engine.

A rerun reuses the parent's cohort AND seed (see ``runner.SimulationRegistry.rerun``),
so the same agents face both listings and we can match them 1:1 by ``agent_id``. That
makes buyer/order uplift, per-persona uplift, funnel deltas and objection-resolution
*exact* rather than estimated — the highest-value, sim-native numbers.
"""

from __future__ import annotations

from contracts import ReasonCategory, UpliftReport, ViabilityReport

# Recommendation.field (display label) -> the bail reason category it targets.
FIELD_TO_REASON: dict[str, ReasonCategory] = {
    "Photos": "visual_photos",
    "Price": "price_value",
    "Reviews": "social_proof_reviews",
    "Authenticity": "trust_authenticity",
    "Title": "other",
}


def _buyers(report: ViabilityReport) -> int:
    return sum(1 for agent in report.agents if agent.outcome == "bought")


def _rate_by_archetype(report: ViabilityReport) -> dict[str, float]:
    return {row["archetype"]: row.get("buy_rate", 0.0) for row in report.archetypes}


def _delta_block(control_n: int, treat_n: int, control_total: int, treat_total: int) -> dict[str, float]:
    control_rate = control_n / control_total if control_total else 0.0
    treat_rate = treat_n / treat_total if treat_total else 0.0
    return {
        "control": control_n,
        "treatment": treat_n,
        "delta": treat_n - control_n,
        "delta_pp": round((treat_rate - control_rate) * 100, 2),
    }


def compute_uplift(
    control: ViabilityReport,
    treatment: ViabilityReport,
    targeted_fields: list[str] | None = None,
) -> UpliftReport:
    """Compare a treatment run against its control (parent). Agents must come from the
    same cohort+seed for the 1:1 matching to be valid."""
    n_control, n_treat = len(control.agents), len(treatment.agents)

    # ── north stars ──────────────────────────────────────────────────────────
    buyer_uplift = _delta_block(_buyers(control), _buyers(treatment), n_control, n_treat)
    # Orders == buyers until carts hold multiples (Tier 3); kept separate for the contract.
    order_uplift = dict(buyer_uplift)

    # ── per-persona uplift (who a change wins vs loses) ──────────────────────
    rate_control, rate_treat = _rate_by_archetype(control), _rate_by_archetype(treatment)
    per_persona = []
    for archetype in sorted(set(rate_control) | set(rate_treat)):
        buy_c, buy_t = rate_control.get(archetype, 0.0), rate_treat.get(archetype, 0.0)
        delta_pp = round((buy_t - buy_c) * 100, 2)
        per_persona.append(
            {
                "archetype": archetype,
                "buy_rate_control": buy_c,
                "buy_rate_treatment": buy_t,
                "delta_pp": delta_pp,
                "verdict": "win" if delta_pp > 1 else "loss" if delta_pp < -1 else "flat",
            }
        )

    # ── funnel delta (where the uplift came from) ────────────────────────────
    funnel_control = {row["stage"]: row for row in control.funnel}
    funnel_treat = {row["stage"]: row for row in treatment.funnel}
    funnel_delta = []
    for stage in [row["stage"] for row in control.funnel]:
        ctrl, treat = funnel_control.get(stage, {}), funnel_treat.get(stage, {})
        funnel_delta.append(
            {
                "stage": stage,
                "entered_delta": treat.get("entered", 0) - ctrl.get("entered", 0),
                "bail_rate_delta": round(treat.get("bail_rate", 0.0) - ctrl.get("bail_rate", 0.0), 3),
            }
        )

    # ── objection resolution: did the tested fix kill its objection? ─────────
    treat_by_id = {agent.agent_id: agent for agent in treatment.agents}
    fields = targeted_fields if targeted_fields is not None else [rec.field for rec in control.recommendations]
    objection_resolution = []
    seen: set[str] = set()
    for field in fields:
        if field in seen:
            continue
        seen.add(field)
        reason = FIELD_TO_REASON.get(field, "other")
        targeted = [agent for agent in control.agents if agent.bail_reason == reason]
        resolved = sum(
            1
            for agent in targeted
            if (after := treat_by_id.get(agent.agent_id)) is not None and after.bail_reason != reason
        )
        objection_resolution.append(
            {
                "field": field,
                "targeted": len(targeted),
                "resolved": resolved,
                "rate": round(resolved / len(targeted), 3) if targeted else None,
            }
        )

    return UpliftReport(
        control_run_id=control.run_id,
        treatment_run_id=treatment.run_id,
        buyer_uplift=buyer_uplift,
        order_uplift=order_uplift,
        per_persona=per_persona,
        funnel_delta=funnel_delta,
        objection_resolution=objection_resolution,
        dropoff_reasons_control=control.dropoff_reasons,
        dropoff_reasons_treatment=treatment.dropoff_reasons,
    )
