"""Minimal .env loader (no dependency on python-dotenv).

Reads KEY=VALUE lines from backend/.env into os.environ without overriding
variables already set in the real environment. Called by main.py and the demo so
`OPENAI_API_KEY` / `LISTING_BASE_URL` in .env are picked up automatically.
"""

from __future__ import annotations

import os
from pathlib import Path

DEFAULT_ENV = Path(__file__).resolve().parent / ".env"


def load_env(path: Path | None = None) -> None:
    env_path = path or DEFAULT_ENV
    if not env_path.exists():
        return
    for raw in env_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
