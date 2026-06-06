from __future__ import annotations

from collections import Counter

from contracts import GateStage, Recommendation, ViabilityReport


FIELD_BY_STAGE: dict[GateStage, str] = {
    "land": "Title",
    "photos": "Photos",
    "reviews": "Reviews",
    "price": "Price",
    "cart": "Price",
    "checkout": "Authenticity",
}


def build_recommendations_from_counts(stage_counts: Counter[str], archetype_counts: Counter[str]) -> list[Recommendation]:
    recommendations: list[Recommendation] = []

    if stage_counts["photos"] or not recommendations:
        recommendations.append(
            Recommendation(
                id="rec_photos_lifestyle",
                field="Photos",
                issue=f"{stage_counts['photos']} agents bailed at Photos; XMM/Geek agents need stronger visual proof.",
                fix="Add lifestyle model shots and close-up knit/detail photos before the product-only gallery.",
                impact_estimate="Est. +6-9% buy rate",
                affected_archetypes=["xmm", "geek", "nerd"],
                config_patch=[
                    {"op": "add", "path": "/photos/-", "value": {"url": "/mock/lifestyle-1.jpg", "type": "lifestyle"}},
                    {"op": "add", "path": "/photos/-", "value": {"url": "/mock/closeup-1.jpg", "type": "closeup"}},
                ],
            )
        )

    if stage_counts["price"] or stage_counts["cart"] or len(recommendations) < 2:
        recommendations.append(
            Recommendation(
                id="rec_price_promo",
                field="Price",
                issue=f"{stage_counts['price'] + stage_counts['cart']} agents objected around price/cart total.",
                fix="Test a launch promo price closer to baseline and absorb part of shipping into the displayed price.",
                impact_estimate="Est. +5-8% buy rate",
                affected_archetypes=["budget", "auntie", "nerd"],
                config_patch=[
                    {"op": "replace", "path": "/price", "value": 29.9},
                    {"op": "replace", "path": "/shipping/fee", "value": 0.0},
                ],
            )
        )

    if stage_counts["reviews"] or stage_counts["checkout"] or len(recommendations) < 3:
        recommendations.append(
            Recommendation(
                id="rec_trust_authenticity",
                field="Authenticity",
                issue=(
                    f"{stage_counts['reviews'] + stage_counts['checkout']} agents bailed at trust-sensitive stages; "
                    "Auntie/Insecure personas need clearer proof."
                ),
                fix="Add authenticity certificate/unboxing proof and seller responses to the top reviews.",
                impact_estimate="Est. +4-7% buy rate",
                affected_archetypes=["auntie", "insecure"],
                config_patch=[
                    {"op": "replace", "path": "/authenticity/certificate", "value": True},
                    {"op": "replace", "path": "/authenticity/unboxing", "value": True},
                    {"op": "replace", "path": "/seller/response_rate", "value": 92},
                ],
            )
        )

    # Keep the cards stable and distinct for the UI.
    return recommendations[:3]


def recommendations_for_report(report: ViabilityReport) -> list[Recommendation]:
    stage_counts = Counter()
    archetype_counts = Counter()
    for agent in report.agents:
        if agent.bail_stage:
            stage_counts[agent.bail_stage] += 1
            archetype_counts[agent.archetype] += 1
    return build_recommendations_from_counts(stage_counts, archetype_counts)

