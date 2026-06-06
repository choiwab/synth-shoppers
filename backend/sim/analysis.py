"""Post-run 'product owner' analysis.

Reads a completed ViabilityReport (per-persona outcomes, objections, sentiment, and the
raw per-agent traces) and asks GPT-4o, role-played as the product owner about to launch
this listing on Shopee Singapore, to (a) explain why each archetype bought / bailed / was
enticed and (b) propose a concrete revised listing for the next run.

The proposal is returned as an *allowlisted* RFC-6902 patch plus a human-readable diff.
Edit scope is text/numeric levers only — no new images. If OPENAI_API_KEY is absent or the
call fails, a deterministic heuristic (derived from the report) is returned instead, so the
feature works offline / in mock mode and never hard-fails a demo.
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any

from contracts import (
    ListingAnalysis,
    ListingConfig,
    PersonaInsight,
    ProposedChange,
    ViabilityReport,
)
from sim.agents import PERSONAS
from sim.patching import apply_config_patch
from sim.recommendations import recommendations_for_report

DEFAULT_MODEL = os.environ.get("ANALYSIS_MODEL", "gpt-4o")

# Field label per top-level JSON-Pointer segment (for the diff view).
FIELD_LABELS: dict[str, str] = {
    "title": "Title",
    "price": "Price",
    "description": "Description",
    "shipping": "Shipping",
    "authenticity": "Authenticity",
    "seller": "Seller",
    "variants": "Variants",
}

# Exact JSON-Pointer paths the analysis is allowed to mutate (text/numeric levers only).
_ALLOWED_EXACT: set[str] = {
    "/title",
    "/price",
    "/description",
    "/shipping/fee",
    "/authenticity/certificate",
    "/authenticity/serial",
    "/authenticity/unboxing",
    "/seller/response_rate",
}
# Variant option labels, e.g. /variants/0/options/1 or /variants/0/options/-
_ALLOWED_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^/variants/\d+/options(/(\d+|-))?$"),
]


def path_allowed(path: str) -> bool:
    if path in _ALLOWED_EXACT:
        return True
    return any(p.match(path) for p in _ALLOWED_PATTERNS)


def _field_label(path: str) -> str:
    head = path.strip("/").split("/", 1)[0]
    return FIELD_LABELS.get(head, head.capitalize() or path)


def _read_pointer(data: Any, path: str) -> Any:
    cur = data
    for token in [t for t in path.strip("/").split("/") if t]:
        if token == "-":
            return None
        if isinstance(cur, list):
            try:
                cur = cur[int(token)]
            except (ValueError, IndexError):
                return None
        elif isinstance(cur, dict):
            cur = cur.get(token)
        else:
            return None
    return cur


def _sanitize_patch(raw_ops: list[dict[str, Any]], listing: ListingConfig | None = None) -> list[dict[str, Any]]:
    """Keep only well-formed, allowlisted replace/add ops; strip annotation fields.
    When `listing` is given, drop no-op `replace`s (proposed == current) so the diff
    only shows real changes."""
    base = listing.model_dump() if listing is not None else None
    clean: list[dict[str, Any]] = []
    for op in raw_ops or []:
        if not isinstance(op, dict):
            continue
        operation = op.get("op")
        path = op.get("path")
        if operation not in {"replace", "add"} or not isinstance(path, str):
            continue
        if not path_allowed(path):
            continue
        if base is not None and operation == "replace" and _read_pointer(base, path) == op.get("value"):
            continue  # no-op: proposed value equals the current value
        clean.append({"op": operation, "path": path, "value": op.get("value")})
    return clean


def _changes_from_patch(listing: ListingConfig, ops: list[dict[str, Any]], annotations: dict[str, dict[str, Any]]) -> list[ProposedChange]:
    base = listing.model_dump()
    changes: list[ProposedChange] = []
    for op in ops:
        path = op["path"]
        ann = annotations.get(path, {})
        changes.append(
            ProposedChange(
                field=ann.get("field") or _field_label(path),
                path=path,
                current=_read_pointer(base, path),
                proposed=op.get("value"),
                reason=ann.get("reason") or "Proposed to lift conversion.",
                affected_archetypes=ann.get("affected_archetypes") or [],
            )
        )
    return changes


# ── prompt brief ────────────────────────────────────────────────────────────


def _build_brief(report: ViabilityReport, listing: ListingConfig) -> dict[str, Any]:
    """Compact, LLM-friendly digest of the run + the current editable listing."""
    agents_digest = []
    for agent in report.agents:
        comments = [t.comment for t in agent.stage_trace if t.comment][:2]
        agents_digest.append(
            {
                "archetype": agent.archetype,
                "outcome": agent.outcome,
                "bail_stage": agent.bail_stage,
                "objection": agent.objection,
                "purchase_reason": agent.purchase_reason,
                "comments": comments,
            }
        )
    return {
        "buy_rate": round(sum(1 for a in report.agents if a.outcome == "bought") / max(len(report.agents), 1), 3),
        "market_fit_score": report.market_fit_score,
        "funnel": report.funnel,
        "archetypes": [
            {k: row.get(k) for k in ("archetype", "agents", "bought", "bailed", "buy_rate", "top_objection")}
            for row in report.archetypes
        ],
        "objection_heatmap": report.objection_heatmap,
        "dropoff_reasons": report.dropoff_reasons,
        "risk_archetypes": report.risk_archetypes,
        "agents": agents_digest,
        "current_listing": {
            "title": listing.title,
            "price": listing.price,
            "base_price": listing.base_price,
            "description": listing.description,
            "shipping": listing.shipping.model_dump(),
            "authenticity": listing.authenticity.model_dump(),
            "seller": listing.seller.model_dump(),
            "variants": [v.model_dump() for v in listing.variants],
        },
    }


def _persona_glossary() -> str:
    return "\n".join(f"- {p.id} ({p.display}, {p.tag}): {p.blurb}" for p in PERSONAS.values())


_SYSTEM_PROMPT = (
    "You are the product owner of a brand-new product about to launch on Shopee Singapore. "
    "A focus group of synthetic Singaporean shoppers (archetypes below) just browsed your "
    "listing. Your single goal is to maximize how many of them buy.\n\n"
    "The archetypes:\n{glossary}\n\n"
    "You are given the run results and the current listing. Read each shopper's trace and "
    "final decision. Diagnose WHY each archetype bought, bailed, or was enticed, then propose "
    "a concrete revised listing for the NEXT run.\n\n"
    "You may ONLY change these fields (everything else is fixed — do NOT touch photos or reviews):\n"
    "  /title, /price, /description, /shipping/fee,\n"
    "  /authenticity/certificate, /authenticity/serial, /authenticity/unboxing (booleans),\n"
    "  /seller/response_rate (0-100), /variants/<i>/options/<j> (option labels).\n\n"
    "Respond with ONLY a JSON object of this exact shape:\n"
    "{{\n"
    '  "narrative": "<2-4 sentence product-owner diagnosis>",\n'
    '  "per_persona": [{{"archetype": "<id>", "insight": "<why they did what they did>", "what_to_fix": "<lever>"}}],\n'
    '  "expected_impact": "<short estimate, e.g. \'+8-12% buy rate\'>",\n'
    '  "config_patch": [\n'
    '    {{"op": "replace", "path": "/price", "value": 32.9, "field": "Price", '
    '"reason": "<why>", "affected_archetypes": ["budget","auntie"]}}\n'
    "  ]\n"
    "}}\n\n"
    "Keep config_patch focused (1-5 ops). Use 'replace' for existing values. Make the title and "
    "description punchy and Singapore-appropriate. Prices are in SGD."
)


async def _call_openai(report: ViabilityReport, listing: ListingConfig, model: str) -> dict[str, Any]:
    from openai import AsyncOpenAI  # lazy: only needed for real LLM analysis

    client = AsyncOpenAI()
    brief = _build_brief(report, listing)
    completion = await client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        temperature=0.7,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT.format(glossary=_persona_glossary())},
            {"role": "user", "content": json.dumps(brief, ensure_ascii=False)},
        ],
    )
    content = completion.choices[0].message.content or "{}"
    return json.loads(content)


# ── heuristic fallback ──────────────────────────────────────────────────────


def _heuristic(report: ViabilityReport, listing: ListingConfig) -> dict[str, Any]:
    """Deterministic analysis from the report — used when the LLM is unavailable."""
    recs = recommendations_for_report(report)
    raw_ops: list[dict[str, Any]] = []
    annotations: dict[str, dict[str, Any]] = {}
    for rec in recs:
        for op in rec.config_patch:
            path = op.get("path", "")
            if not path_allowed(path):
                continue  # heuristic respects the same text/numeric scope (drops photo ops)
            raw_ops.append(op)
            annotations[path] = {"field": rec.field, "reason": rec.fix, "affected_archetypes": rec.affected_archetypes}

    per_persona = []
    for row in report.archetypes:
        arch = row.get("archetype")
        rate = row.get("buy_rate", 0)
        verb = "converted well" if rate >= 0.5 else "mostly bailed"
        per_persona.append(
            {
                "archetype": arch,
                "insight": f"{arch} {verb} (buy rate {rate}). Top objection: {row.get('top_objection') or 'none'}.",
                "what_to_fix": "Address the top objection above.",
            }
        )
    risk = ", ".join(report.risk_archetypes) or "no archetype"
    return {
        "narrative": (
            f"Buy rate {round(sum(1 for a in report.agents if a.outcome=='bought')/max(len(report.agents),1),3)}, "
            f"market-fit {report.market_fit_score}/100. Biggest drop-offs are concentrated where {risk} "
            "lose confidence; the changes below target those levers."
        ),
        "per_persona": per_persona,
        "expected_impact": "Est. +5-9% buy rate",
        "config_patch": raw_ops,
        "_annotations": annotations,
    }


# ── public entrypoint ───────────────────────────────────────────────────────


async def analyze_run(report: ViabilityReport, listing: ListingConfig, model: str | None = None) -> ListingAnalysis:
    model = model or DEFAULT_MODEL
    source = "llm"
    parsed: dict[str, Any]
    if not os.environ.get("OPENAI_API_KEY"):
        parsed = _heuristic(report, listing)
        source = "heuristic"
    else:
        try:
            parsed = await _call_openai(report, listing, model)
        except Exception:  # network/quota/parse — degrade gracefully, never crash the run
            parsed = _heuristic(report, listing)
            source = "heuristic"

    raw_ops = parsed.get("config_patch") or []
    annotations: dict[str, dict[str, Any]] = parsed.get("_annotations") or {}
    # carry per-op annotations from the LLM (field/reason/affected_archetypes live on each op)
    for op in raw_ops:
        if isinstance(op, dict) and isinstance(op.get("path"), str):
            annotations.setdefault(
                op["path"],
                {
                    "field": op.get("field"),
                    "reason": op.get("reason"),
                    "affected_archetypes": op.get("affected_archetypes") or [],
                },
            )

    clean_ops = _sanitize_patch(raw_ops, listing)
    try:
        proposed_listing = apply_config_patch(listing, clean_ops) if clean_ops else listing
    except Exception:
        clean_ops = []
        proposed_listing = listing

    per_persona = [
        PersonaInsight(archetype=p["archetype"], insight=p.get("insight", ""), what_to_fix=p.get("what_to_fix", ""))
        for p in (parsed.get("per_persona") or [])
        if isinstance(p, dict) and p.get("archetype") in PERSONAS
    ]

    return ListingAnalysis(
        run_id=report.run_id,
        narrative=parsed.get("narrative", ""),
        per_persona=per_persona,
        proposed_changes=_changes_from_patch(listing, clean_ops, annotations),
        config_patch=clean_ops,
        proposed_listing=proposed_listing,
        expected_impact=parsed.get("expected_impact", ""),
        model=model if source == "llm" else "heuristic",
        source=source,
        generated_at=int(time.time() * 1000),
    )
