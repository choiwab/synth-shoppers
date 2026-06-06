"""Thumbnail helper for H3's live browser previews.

A captured viewport screenshot (PNG/JPEG bytes) is cropped/resized to the
160x120 tile H1's agent strip renders, written under /tmp/shots, and returned as
a /static/shots/... URL.

`/static` is mounted onto /tmp by H4 (`main.py`), so a file written to
`/tmp/shots/<agent>/<gate>.jpg` is served at `/static/shots/<agent>/<gate>.jpg`.

This module is intentionally free of any browser/browser-use dependency so it can
be unit-tested without Chromium.
"""

from __future__ import annotations

import io
import os

from PIL import Image, ImageOps

THUMB_SIZE = (160, 120)
THUMB_QUALITY = 70
SHOTS_ROOT = "/tmp/shots"
STATIC_PREFIX = "/static/shots"


def thumbnail_paths(agent_id: str, gate: str) -> tuple[str, str]:
    """Return (filesystem_path, static_url) for an agent/gate thumbnail."""
    rel = f"{agent_id}/{gate}.jpg"
    return os.path.join(SHOTS_ROOT, rel), f"{STATIC_PREFIX}/{rel}"


def save_thumbnail(image_bytes: bytes, agent_id: str, gate: str) -> str:
    """Crop/resize ``image_bytes`` to a 160x120 JPEG tile and return its URL.

    Uses ImageOps.fit so the viewport screenshot is centre-cropped to the tile
    aspect ratio (no distortion) — effectively "cropped to the agent's scroll
    position", which is what the agent strip wants.
    """
    fs_path, url = thumbnail_paths(agent_id, gate)
    os.makedirs(os.path.dirname(fs_path), exist_ok=True)
    with Image.open(io.BytesIO(image_bytes)) as img:
        tile = ImageOps.fit(img.convert("RGB"), THUMB_SIZE, method=Image.Resampling.LANCZOS)
        tile.save(fs_path, format="JPEG", quality=THUMB_QUALITY)
    return url
