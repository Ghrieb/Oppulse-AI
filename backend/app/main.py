"""The service.

The application factory, the middleware, and the error handling. Everything
else is a router.
"""

from __future__ import annotations

import asyncio
import contextlib
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import Settings, get_settings
from .errors import ApiProblem, ErrorCode
from .logging import configure_logging, get_logger
from .middleware import request_id_middleware

logger = get_logger("oppulse")

DESCRIPTION = """
The Oppulse AI backend: the versioned HTTP contract the frontend speaks, the
agent that researches opportunities and explains what it found, and the
deterministic services that decide what the agent may conclude.
"""


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Builds the application."""
    resolved = settings or get_settings()
    resolved.validate_runtime()
    configure_logging(resolved.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # The run worker: one loop that claims queued runs, walks their
        # stages and writes the timeline. Tests drive the worker directly
        # and never run this lifespan, so the switch is configuration.
        worker_task: asyncio.Task[None] | None = None
        stop = asyncio.Event()
        if resolved.worker_enabled:
            from .ai.worker import worker_loop

            worker_id = f"api-{uuid.uuid4().hex[:8]}"
            worker_task = asyncio.create_task(
                worker_loop(stop, settings=resolved, worker_id=worker_id)
            )

        logger.info(
            "startup",
            {
                "environment": resolved.environment,
                "api_prefix": resolved.api_prefix,
                "database": "sqlite" if resolved.uses_sqlite else "postgres",
                "worker": resolved.worker_enabled,
            },
        )
        yield

        stop.set()
        if worker_task is not None:
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(worker_task, timeout=5)
            if not worker_task.done():
                worker_task.cancel()
        logger.info("shutdown", {"environment": resolved.environment})

    app = FastAPI(
        title="Oppulse AI",
        version="0.1.0",
        description=DESCRIPTION,
        lifespan=lifespan,
        docs_url="/docs" if not resolved.is_production else None,
        openapi_url="/openapi.json" if not resolved.is_production else None,
    )

    # The CORS policy: the exact origins, never a wildcard. Credentials are
    # allowed because the refresh token lives in an HttpOnly cookie, and the
    # configuration refuses a wildcard at startup.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved.cors_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Accept",
            "Content-Type",
            "Authorization",
            "X-Request-ID",
            # The frontend names each write with an Idempotency-Key so a retry
            # cannot double-apply. Without it here, the browser's CORS
            # preflight for that header fails and every such mutation is
            # blocked cross-origin.
            "Idempotency-Key",
        ],
        expose_headers=["X-Request-ID"],
        max_age=600,
    )
    app.middleware("http")(request_id_middleware)

    # -- The error envelope ---------------------------------------------

    @app.exception_handler(ApiProblem)
    async def _api_problem(request: Request, exc: ApiProblem) -> JSONResponse:
        request_id = _request_id(request)
        logger.warning(
            "problem",
            {
                "request_id": request_id,
                "code": str(exc.code),
                "status": exc.status_code,
                "route": request.url.path,
            },
        )
        return exc.response(request_id)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        field_errors: dict[str, list[str]] = {}
        for error in exc.errors():
            location = [str(part) for part in error.get("loc", []) if part != "body"]
            field = ".".join(location) or "body"
            message = str(error.get("msg", "That value is not valid."))
            field_errors.setdefault(field, []).append(message)

        problem = ApiProblem(
            ErrorCode.VALIDATION,
            "Some of the values sent were not valid.",
            field_errors=field_errors,
        )
        return problem.response(_request_id(request))

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {
            401: ErrorCode.UNAUTHORIZED,
            403: ErrorCode.FORBIDDEN,
            404: ErrorCode.NOT_FOUND,
            409: ErrorCode.CONFLICT,
            422: ErrorCode.VALIDATION,
            429: ErrorCode.RATE_LIMITED,
        }.get(exc.status_code, ErrorCode.UNKNOWN)

        problem = ApiProblem(code, str(exc.detail), status_code=exc.status_code)
        return problem.response(_request_id(request))

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception) -> JSONResponse:
        # An unexpected failure is logged with its type only. The message
        # the client sees says nothing about what happened inside.
        request_id = _request_id(request)
        logger.error(
            "unhandled",
            {"request_id": request_id, "route": request.url.path, "error": type(exc).__name__},
        )
        problem = ApiProblem(
            ErrorCode.UNKNOWN,
            "Something went wrong on our side. Please try again.",
        )
        return problem.response(request_id)

    # -- The routers -----------------------------------------------------

    from .api import (
        assistant,
        auth,
        capabilities,
        documents,
        health,
        missions,
        monitoring,
        onboarding,
        profile,
        research,
        workspace,
    )

    app.include_router(health.router)
    app.include_router(capabilities.router, prefix=resolved.api_prefix)
    app.include_router(auth.router, prefix=resolved.api_prefix)
    app.include_router(profile.router, prefix=resolved.api_prefix)
    app.include_router(documents.router, prefix=resolved.api_prefix)
    app.include_router(research.router, prefix=resolved.api_prefix)
    app.include_router(assistant.router, prefix=resolved.api_prefix)
    app.include_router(workspace.router, prefix=resolved.api_prefix)
    app.include_router(missions.router, prefix=resolved.api_prefix)
    app.include_router(monitoring.router, prefix=resolved.api_prefix)
    app.include_router(onboarding.router, prefix=resolved.api_prefix)

    return app


app = create_app()
