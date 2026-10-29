"""The Vercel entrypoint: the FastAPI app, plus the SPA it serves.

One Vercel Function serves the whole product. The FastAPI app is the single
root handler, so the original request path reaches it untouched — ``/api/v1/*``
matches the versioned routers and ``/health`` matches the health router. The
built frontend is mounted inside the app at ``/`` with an ``index.html``
fallback so client-side routes deep-link correctly.

The backend keeps relative imports and lives under ``backend/``, so that
directory is put on ``sys.path`` before the app is imported. On Vercel the
working directory is the project root, which is what makes
``frontend/dist`` resolvable at runtime.
"""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT / "backend"))

from app.main import app  # noqa: E402  (import after the path is set)

# Serve the built SPA at "/". Every API route and the health router take
# priority over these static files regardless of declaration order, so this
# only handles what is not an API path. The directory is anchored to this
# file, not the current working directory, so the app resolves the same way
# no matter where it is imported from.
app.frontend("/", directory=str(_ROOT / "frontend" / "dist"), fallback="index.html")
