"""Health and readiness.

``/health`` says the process is alive and nothing else — it must never
disclose a version, a host, a key or a dependency's state. ``/health/ready``
says whether the service can actually do its work: the database is reachable
and the providers that are configured are reachable.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Response, status

from ..config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness.

    It says "alive" and nothing more. A health check that leaks a version or
    a dependency's state is a reconnaissance gift.
    """
    return {"status": "ok"}


@router.get("/health/ready")
async def ready(response: Response) -> dict[str, Any]:
    """Readiness.

    The body states which dependencies are ready, so a deployment can be
    debugged without a log dive. It never states *why* one is not ready in
    terms that could leak a connection string or a key.
    """
    settings = get_settings()
    checks: dict[str, bool] = {}

    try:
        from ..db.session import check_database

        checks["database"] = await check_database()
    except Exception:
        checks["database"] = False

    # The providers are optional in the offline replay mode: a missing key
    # is not a failure, it is a capability that is unavailable.
    checks["model_provider"] = settings.model_provider == "replay" or (
        settings.live_model_provider and settings.model_is_live
    )
    checks["search_provider"] = settings.search_provider == "replay" or (
        settings.live_search_provider and settings.search_is_live
    )

    ready_now = checks["database"]
    if not ready_now:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {"status": "ready" if ready_now else "not_ready", "checks": checks}
