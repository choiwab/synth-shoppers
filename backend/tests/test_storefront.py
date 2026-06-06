from __future__ import annotations

from contracts import AgentTrace, StageTrace
from sim.report import build_competition
from sim.storefront import (
    CandidateListing,
    cheaper_alternative,
    choose_listing,
    competitor_objection,
)

TARGET = "matin_kim_beanie_sg"


def cands(target_price: float = 45.9) -> list[CandidateListing]:
    return [
        CandidateListing(TARGET, "Matin Kim Logo Beanie", target_price, True),
        CandidateListing("supreme-ribbed-beanie", "Supreme Beanie", 58.0, False),
        CandidateListing("he-edition-angora-beanie", "HE Edition Angora", 26.9, False),
        CandidateListing("basic-acrylic-beanie", "Basic Acrylic Beanie", 3.5, False),
    ]


def test_choose_listing_is_deterministic() -> None:
    c = cands()
    assert choose_listing(7, "budget_1", "budget", c) == choose_listing(7, "budget_1", "budget", c)


def test_choose_listing_returns_none_without_candidates() -> None:
    assert choose_listing(7, "geek_1", "geek", []) is None


def test_brand_seekers_usually_pick_the_target_and_never_the_fake() -> None:
    c = cands()
    picks = [choose_listing(7, f"geek_{i}", "geek", c) for i in range(20)]
    assert sum(1 for p in picks if p == TARGET) >= 12  # strong target bias
    assert all(p != "basic-acrylic-beanie" for p in picks)  # avoids the suspiciously cheap


def test_budget_defects_to_cheaper_when_target_is_pricey() -> None:
    picks = [choose_listing(7, f"budget_{i}", "budget", cands(target_price=60.0)) for i in range(20)]
    assert any(p != TARGET for p in picks)  # some budget shoppers leave for a cheaper card


def test_insecure_avoids_ultra_cheap_listings() -> None:
    picks = [choose_listing(3, f"insecure_{i}", "insecure", cands()) for i in range(20)]
    assert all(p != "basic-acrylic-beanie" for p in picks)


def test_cheaper_alternative_skips_price_insensitive_personas() -> None:
    assert cheaper_alternative(1, "hs_1", "high_spender", 45.9, cands()) is None
    assert cheaper_alternative(1, "geek_1", "geek", 45.9, cands()) is None


def test_competitor_objection_names_product_and_price() -> None:
    line = competitor_objection("nerd", CandidateListing("supreme-ribbed-beanie", "Supreme Beanie", 58.0, False))
    assert "Supreme Beanie" in line and "58" in line


# ── report competition aggregation ───────────────────────────────────────────


def _lost_to(competitor_id: str, title: str, *, stage="land", landed=False) -> AgentTrace:
    return AgentTrace(
        agent_id=f"a_{competitor_id}_{stage}_{landed}",
        name="x",
        archetype="budget",
        outcome="bailed",
        retention_time_s=1.0,
        stage_trace=[StageTrace(stage="land", time_s=1.0)] if landed else [],
        bail_reason="chose_competitor",
        landed_on_target=landed,
        divert_stage=stage,
        competitor_id=competitor_id,
        competitor_title=title,
        chosen_listing_id=competitor_id,
    )


def test_build_competition_attributes_losses_and_landing() -> None:
    bought = AgentTrace(
        agent_id="b", name="y", archetype="geek", outcome="bought", retention_time_s=1.0,
        stage_trace=[StageTrace(stage="land", time_s=1.0)], landed_on_target=True, chosen_listing_id=TARGET,
    )
    left = AgentTrace(
        agent_id="c", name="z", archetype="auntie", outcome="bailed", retention_time_s=1.0,
        stage_trace=[StageTrace(stage="price", time_s=1.0)], bail_stage="price", landed_on_target=True,
    )
    agents = [
        bought,
        left,
        _lost_to("basic-acrylic-beanie", "Basic Acrylic Beanie"),
        _lost_to("basic-acrylic-beanie", "Basic Acrylic Beanie"),
        _lost_to("supreme-ribbed-beanie", "Supreme Beanie", stage="price", landed=True),
    ]
    comp = build_competition(agents)

    assert comp["lost_to_competitors"] == 3
    assert comp["left_without_buying"] == 1
    top = comp["competitor_breakdown"][0]
    assert top["competitor_id"] == "basic-acrylic-beanie" and top["wins"] == 2
    assert comp["landed_rate"] == round(3 / 5, 3)  # bought + left + the price-stage divert
    assert {row["stage"] for row in comp["divert_by_stage"]} == {"land", "price"}


def test_build_competition_empty_without_competitive_signal() -> None:
    agents = [
        AgentTrace(
            agent_id="a", name="x", archetype="budget", outcome="bought", retention_time_s=1.0,
            stage_trace=[StageTrace(stage="land", time_s=1.0)],
        )
    ]
    assert build_competition(agents) == {}
