from __future__ import annotations

import random
from dataclasses import dataclass

from contracts import GATE_ORDER, GateStage, PersonaId, PersonaProfile


@dataclass(frozen=True)
class Persona:
    id: PersonaId
    display: str
    tag: str
    names: tuple[str, ...]
    blurb: str
    bail_prob: dict[GateStage, float]
    objections: dict[GateStage, tuple[str, ...]]


DEFAULT_OBJECTIONS: dict[GateStage, tuple[str, ...]] = {
    "land": ("Hmm, not feeling this shop page.",),
    "photos": ("Photos not convincing enough.",),
    "reviews": ("Reviews not enough for me to trust.",),
    "price": ("Price feels a bit hard to justify.",),
    "cart": ("Maybe later lah.",),
    "checkout": ("I don't feel safe checking out.",),
}


def _obj(**kwargs: tuple[str, ...]) -> dict[GateStage, tuple[str, ...]]:
    merged = dict(DEFAULT_OBJECTIONS)
    merged.update(kwargs)
    return merged


PERSONAS: dict[PersonaId, Persona] = {
    "xmm": Persona(
        id="xmm",
        display="XMM",
        tag="Trend-led",
        names=("Jia En", "Chloe", "Mei Qi", "Shermin"),
        blurb="You follow TikTok fashion trends and care deeply about vibe, photos, and social proof.",
        bail_prob={"land": 0.03, "photos": 0.42, "reviews": 0.22, "price": 0.14, "cart": 0.07, "checkout": 0.04},
        objections=_obj(
            photos=("Photos damn ugly leh, vibe not there.", "Cannot see how it looks on a real person."),
            reviews=("No one trendy reviewing this meh?", "Social proof a bit weak leh."),
            price=("Cute, but this price must really look premium."),
        ),
    ),
    "auntie": Persona(
        id="auntie",
        display="Auntie",
        tag="Value & trust",
        names=("Auntie May", "Mdm Tan", "Auntie Lee", "Mdm Goh"),
        blurb="You look for value, seller trust, reviews, and practical proof before buying.",
        bail_prob={"land": 0.03, "photos": 0.10, "reviews": 0.22, "price": 0.44, "cart": 0.10, "checkout": 0.10},
        objections=_obj(
            reviews=("Never hear of this brand one.", "Seller never reply reviews, not safe."),
            price=("This kind of beanie so expensive ah?", "Price not value for money."),
            checkout=("Later fake then very troublesome.",),
        ),
    ),
    "nerd": Persona(
        id="nerd",
        display="Nerd",
        tag="Spec-rational",
        names=("Wei Jie", "Daryl", "Jun Hao", "Marcus"),
        blurb="You compare specs, materials, ratings, and price-performance before buying.",
        bail_prob={"land": 0.02, "photos": 0.12, "reviews": 0.18, "price": 0.42, "cart": 0.08, "checkout": 0.07},
        objections=_obj(
            reviews=("Not enough evidence this is legit quality.", "Review sample size too small."),
            price=("Price not justified by the specs.", "Material details not enough for this price."),
            photos=("Can't inspect the fabric properly from these photos.",),
        ),
    ),
    "geek": Persona(
        id="geek",
        display="Geek",
        tag="Enthusiast",
        names=("Kai", "Zach", "Ryan", "Ben"),
        blurb="You care about product details, variants, authenticity, and close-up shots.",
        bail_prob={"land": 0.02, "photos": 0.32, "reviews": 0.16, "price": 0.25, "cart": 0.08, "checkout": 0.06},
        objections=_obj(
            photos=("Can't tell the knit gauge from these.", "Need close-up shots before I buy."),
            price=("Premium price but details not premium enough.",),
            reviews=("Nobody talks about fit or material.",),
        ),
    ),
    "insecure": Persona(
        id="insecure",
        display="Insecure",
        tag="Scam-wary",
        names=("Siti", "Nadia", "Rachel", "Yun Xuan"),
        blurb="You are cautious about scams, fakes, checkout risk, and seller trust signals.",
        bail_prob={"land": 0.03, "photos": 0.12, "reviews": 0.24, "price": 0.18, "cart": 0.14, "checkout": 0.36},
        objections=_obj(
            reviews=("So many scams nowadays... what if fake?", "Reviews don't make me feel safe."),
            checkout=("Checkout still feels risky.", "No authenticity proof, I scared kena fake."),
            price=("If this price and fake then how?",),
        ),
    ),
    "budget": Persona(
        id="budget",
        display="Budget-tight",
        tag="Price-first",
        names=("Farhan", "Xin Yi", "Aqil", "Hui Min"),
        blurb="You scrutinize every dollar; shipping fees and price spikes make you bounce quickly.",
        bail_prob={"land": 0.01, "photos": 0.04, "reviews": 0.05, "price": 0.68, "cart": 0.22, "checkout": 0.15},
        objections=_obj(
            price=("Add shipping also? Forget it.", "Over budget liao, next.", "Can get cheaper elsewhere."),
            cart=("Cart total painful sia.",),
            checkout=("Shipping fee makes it not worth already.",),
        ),
    ),
    "high_spender": Persona(
        id="high_spender",
        display="High-spender",
        tag="Convenience",
        names=("Ethan", "Valerie", "Brandon", "Isabelle"),
        blurb="You value convenience and style; you rarely bail unless trust is obviously bad.",
        bail_prob={"land": 0.01, "photos": 0.05, "reviews": 0.08, "price": 0.06, "cart": 0.03, "checkout": 0.04},
        objections=_obj(
            reviews=("Even I need some trust signal lah.",),
            checkout=("Checkout trust looks a bit off.",),
            price=("Fine if premium, but this page doesn't show it.",),
        ),
    ),
}


def all_persona_ids() -> list[PersonaId]:
    return list(PERSONAS.keys())


def stage_objections(persona: Persona, stage: GateStage) -> tuple[str, ...]:
    return persona.objections.get(stage) or DEFAULT_OBJECTIONS[stage]


def validate_personas() -> None:
    for persona in PERSONAS.values():
        missing = set(GATE_ORDER) - set(persona.bail_prob)
        if missing:
            raise ValueError(f"{persona.id} missing bail probabilities for {sorted(missing)}")


# ── Singaporean life-profiles ────────────────────────────────────────────────
# A randomized profile layered on top of an archetype, so each spawned agent is a
# distinct person. Attributes nudge the per-gate bail thresholds (see
# `profile_bail_multiplier`), which spreads a persona's agents across thresholds —
# that spread is what makes a listing improvement convert *some* of them and move
# the numbers (instead of all clones flipping together).

_HOBBIES: tuple[str, ...] = (
    "K-drama & fashion",
    "gym & sports",
    "gaming & tech",
    "hiking & outdoors",
    "cafe-hopping & food",
    "thrift & deals",
    "travel & lifestyle",
    "parenting & home",
)
_INCOME_BY_HOUSING: dict[str, tuple[str, ...]] = {
    "HDB": ("tight", "tight", "comfortable"),
    "condo": ("comfortable", "comfortable", "affluent"),
    "landed": ("affluent",),
}


def generate_profile(rng: random.Random) -> PersonaProfile:
    """Sample a Singaporean life-profile. Deterministic for a given seeded ``rng``."""
    age = rng.randint(18, 62)
    sex = rng.choice(["F", "M"])
    housing = rng.choice(["HDB", "HDB", "condo", "condo", "landed"])
    income = rng.choice(_INCOME_BY_HOUSING[housing])
    if age < 26:
        marital = rng.choice(["single", "single", "married"])
    else:
        marital = rng.choice(["single", "married", "married_kids", "married_kids"])
    hobby = rng.choice(_HOBBIES)

    marital_label = {"single": "single", "married": "married", "married_kids": "married w/ kids"}[marital]
    blurb = f"{age}{sex}, {marital_label}, {housing}, {income} income, into {hobby}"
    return PersonaProfile(age=age, sex=sex, marital=marital, income=income, housing=housing, hobby=hobby, blurb=blurb)


def profile_bail_multiplier(profile: PersonaProfile | None, persona_id: PersonaId, stage: GateStage) -> float:
    """Multiplicative nudge (around 1.0) applied AFTER the archetype calibration in
    `effective_bail_probability`. Returns 1.0 for unaffected (profile, stage) pairs."""
    if profile is None:
        return 1.0
    m = 1.0

    # income / wealth — the biggest lever, on price + cart
    if stage in ("price", "cart"):
        m *= {"tight": 1.4, "comfortable": 1.0, "affluent": 0.55}[profile.income]
        if profile.housing in ("condo", "landed"):
            m *= 0.85  # wealth proxy stacks lightly with income
        if profile.marital == "married_kids":
            m *= 1.15  # household budget pressure
        if profile.hobby == "thrift & deals":
            m *= 1.3

    # age — older shoppers weigh trust; younger weigh vibe/social-proof
    if profile.age >= 45:
        if stage in ("checkout", "reviews"):
            m *= 1.3
        if stage == "photos":
            m *= 0.85
    elif profile.age <= 24:
        if stage == "photos":
            m *= 1.25
        if stage == "reviews":
            m *= 1.2

    # hobby affinity — fashion-led shoppers are more forgiving of so-so photos
    if stage == "photos" and profile.hobby == "K-drama & fashion":
        m *= 0.8

    return m
