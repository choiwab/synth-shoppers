from __future__ import annotations

import json
from pathlib import Path

import pytest

from contracts import ListingConfig
from sim.patching import PatchError, apply_config_patch


ROOT = Path(__file__).resolve().parents[2]


def load_listing() -> ListingConfig:
    return ListingConfig.model_validate(json.loads((ROOT / "fixtures/listing.sample.json").read_text()))


def test_json_patch_replace_and_add() -> None:
    listing = load_listing()
    patched = apply_config_patch(
        listing,
        [
            {"op": "replace", "path": "/price", "value": 29.9},
            {"op": "add", "path": "/photos/-", "value": {"url": "/mock/new.jpg", "type": "lifestyle"}},
        ],
    )
    assert patched.price == 29.9
    assert patched.photos[-1].type == "lifestyle"


def test_invalid_patch_op_fails() -> None:
    with pytest.raises(PatchError):
        apply_config_patch(load_listing(), [{"op": "remove", "path": "/price"}])

