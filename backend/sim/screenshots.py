"""Screenshot helper for H3's browser previews.

A captured viewport screenshot (PNG/JPEG bytes) is resized to a dashboard-sized
JPEG, written under /tmp/shots, and returned as a /static/shots/... URL.

`/static` is mounted onto /tmp by H4 (`main.py`), so a file written to
`/tmp/shots/<agent>/<gate>.jpg` is served at `/static/shots/<agent>/<gate>.jpg`.

This module is intentionally free of any browser/browser-use dependency so it can
be unit-tested without Chromium.
"""

from __future__ import annotations

import io
import os

from PIL import Image, ImageOps

# Keep enough pixels for the large featured card. The small tiles downscale this,
# which is much sharper than upscaling a 160x120 thumbnail.
THUMB_SIZE = (960, 675)
THUMB_QUALITY = 88
SHOTS_ROOT = "/tmp/shots"
STATIC_PREFIX = "/static/shots"


def thumbnail_paths(agent_id: str, gate: str) -> tuple[str, str]:
    """Return (filesystem_path, static_url) for an agent/gate thumbnail."""
    rel = f"{agent_id}/{gate}.jpg"
    return os.path.join(SHOTS_ROOT, rel), f"{STATIC_PREFIX}/{rel}"


def save_thumbnail(image_bytes: bytes, agent_id: str, gate: str) -> str:
    """Crop/resize ``image_bytes`` to a dashboard JPEG and return its URL.

    Uses ImageOps.fit so the viewport screenshot is centre-cropped to the target
    aspect ratio with no distortion.
    """
    fs_path, url = thumbnail_paths(agent_id, gate)
    os.makedirs(os.path.dirname(fs_path), exist_ok=True)
    with Image.open(io.BytesIO(image_bytes)) as img:
        tile = ImageOps.fit(img.convert("RGB"), THUMB_SIZE, method=Image.Resampling.LANCZOS)
        tile.save(fs_path, format="JPEG", quality=THUMB_QUALITY)
    return f"{url}?v={int(os.path.getmtime(fs_path) * 1000)}"
