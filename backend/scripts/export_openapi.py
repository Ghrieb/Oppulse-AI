"""Exports the OpenAPI document.

The document is committed as ``contracts/openapi.json``, so a change to a
route, a body or a response shows up as a diff a reviewer can read — the
path list one level down. The contract test compares this file with the
service's live document, and CI fails when they differ.

Run it after an intended API change::

    python scripts/export_openapi.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
OPENAPI_PATH = ROOT / "contracts" / "openapi.json"


def build_document() -> dict[str, Any]:
    """The service's OpenAPI document, exactly as a client would fetch it."""
    from app.main import create_app

    return create_app().openapi()


def main() -> int:
    document = build_document()
    OPENAPI_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(document, indent=2, sort_keys=True, ensure_ascii=False)
    OPENAPI_PATH.write_text(f"{payload}\n", encoding="utf-8")
    print(f"Wrote {len(document.get('paths', {}))} paths to {OPENAPI_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
