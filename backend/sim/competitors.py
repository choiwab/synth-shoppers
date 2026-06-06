from __future__ import annotations

from contracts import PersonaId

SEARCH_QUERY = "matin kim beanie"

COMPETITORS: tuple[dict[str, str], ...] = (
    {"id": "supreme-ribbed-beanie", "name": "Supreme New Era Ribbed Beanie"},
    {"id": "carhartt-watch-beanie", "name": "Carhartt WIP Acrylic Watch Hat"},
    {"id": "stussy-stock-cuff-beanie", "name": "Stussy Stock Cuff Beanie"},
    {"id": "straykids-loverboy-beanie", "name": "Stray Kids Official Loverboy Beanie"},
    {"id": "lesserafim-chaewon-beanie", "name": "LE SSERAFIM Chaewon Beanie"},
    {"id": "basic-acrylic-beanie", "name": "Plain Solid Colour Knitted Beanie"},
    {"id": "wool-blend-cuff-beanie", "name": "Wool Blend Cuffed Beanie"},
)

_BY_ID = {item["id"]: item for item in COMPETITORS}

COMPETITOR_ANALYSIS_BY_PERSONA: dict[PersonaId, tuple[str, ...]] = {
    "xmm": ("lesserafim-chaewon-beanie", "stussy-stock-cuff-beanie"),
    "auntie": ("carhartt-watch-beanie", "basic-acrylic-beanie"),
    "nerd": ("carhartt-watch-beanie", "wool-blend-cuff-beanie"),
    "geek": ("stussy-stock-cuff-beanie", "carhartt-watch-beanie"),
    "insecure": ("carhartt-watch-beanie", "supreme-ribbed-beanie"),
    "budget": ("basic-acrylic-beanie", "wool-blend-cuff-beanie"),
}


def competitors_for_persona(persona: PersonaId) -> tuple[dict[str, str], ...]:
    return tuple(_BY_ID[id_] for id_ in COMPETITOR_ANALYSIS_BY_PERSONA.get(persona, ()))


def _money(value: object) -> float | None:
    text = str(value or "")
    cleaned = "".join(ch for ch in text if ch.isdigit() or ch == ".")
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def _intish(value: object) -> int | None:
    text = str(value or "").lower().replace(",", "").strip()
    multiplier = 1
    if text.endswith("k"):
        multiplier = 1000
        text = text[:-1]
    cleaned = "".join(ch for ch in text if ch.isdigit() or ch == ".")
    try:
        return int(float(cleaned) * multiplier) if cleaned else None
    except ValueError:
        return None


def _comments(facts: dict[str, object]) -> list[str]:
    raw = facts.get("comments")
    if not isinstance(raw, list):
        return []
    return [str(item).strip() for item in raw if str(item).strip()][:4]


def analyze_competitor(
    persona: PersonaId,
    competitor: dict[str, str],
    facts: dict[str, object],
    *,
    target_price: float,
) -> dict[str, object]:
    """Turn scraped competitor page facts into a persona-specific read.

    The browser driver gathers objective page facts; this function adds the
    shopper lens so the dashboard can show a reasoned competitor takeaway.
    """

    price = _money(facts.get("price"))
    rating = str(facts.get("rating") or "").strip()
    review_count = _intish(facts.get("review_count"))
    seller = str(facts.get("seller") or "").strip()
    verified = str(facts.get("verified") or "").strip().lower() == "verified"
    comments = _comments(facts)

    strengths: list[str] = []
    weaknesses: list[str] = []

    if verified:
        strengths.append("verified/official-looking seller")
    else:
        weaknesses.append("seller is not verified")

    if rating and review_count:
        strengths.append(f"{rating} rating with {review_count:,} ratings")
    elif rating:
        strengths.append(f"{rating} rating")

    if price is not None:
        if price < target_price:
            strengths.append(f"S${target_price - price:.2f} cheaper than Matin Kim")
        elif price > target_price:
            weaknesses.append(f"S${price - target_price:.2f} more expensive than Matin Kim")
        else:
            strengths.append("same headline price as Matin Kim")

    joined_comments = " ".join(comments).lower()
    if any(word in joined_comments for word in ("authentic", "legit", "receipt", "tags")):
        strengths.append("review comments mention authenticity proof")
    if any(word in joined_comments for word in ("cheap", "price", "value")):
        strengths.append("review comments reinforce value")
    if any(word in joined_comments for word in ("thin", "itchy", "long", "slow")):
        weaknesses.append("review comments expose quality or delivery concerns")

    if not strengths:
        strengths.append("visible alternative in the same search journey")
    if not weaknesses:
        weaknesses.append("no obvious weakness from the quick review scan")

    persona_lens = {
        "budget": "price and value comments",
        "insecure": "seller trust, authenticity language and review volume",
        "auntie": "seller reliability, shipping clarity and whether reviews sound practical",
        "nerd": "rating count, price delta and evidence quality",
        "geek": "brand credibility, material cues and enthusiast social proof",
        "xmm": "trend fit, social proof and whether comments sound hype-worthy",
        "high_spender": "low-friction trust and premium confidence",
    }[persona]

    if persona == "budget" and price is not None and price < target_price:
        verdict = f"Tempting for a budget shopper: {competitor['name']} wins on price, but comments still need a quality check."
    elif persona == "insecure" and verified:
        verdict = f"Safer-looking alternative: {competitor['name']} has stronger trust signals than an unverified listing."
    elif persona == "xmm":
        verdict = f"Trend comparison: {competitor['name']} is judged on whether the reviews and branding feel more current than Matin Kim."
    elif persona == "auntie":
        verdict = f"Practical comparison: {competitor['name']} is attractive only if reviews sound reliable and the seller feels responsive."
    elif persona == "nerd":
        verdict = f"Evidence comparison: {competitor['name']} gives the agent more rating/comment data to benchmark against Matin Kim."
    elif persona == "geek":
        verdict = f"Brand comparison: {competitor['name']} is evaluated for stronger identity and enthusiast credibility."
    else:
        verdict = f"Competitor read: {competitor['name']} is compared on {persona_lens}."

    return {
        "competitor": competitor["id"],
        "competitor_name": competitor["name"],
        "seller": seller,
        "verified": verified,
        "price": price,
        "rating": rating or None,
        "review_count": review_count,
        "comments": comments,
        "strengths": strengths[:4],
        "weaknesses": weaknesses[:4],
        "verdict": verdict,
    }
