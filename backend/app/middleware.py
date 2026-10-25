"""The middleware.

Three things every request passes through: a request id, a structured log
line, and the CORS policy. The CORS policy is an exact allowlist, and it
is applied before anything else so that a preflight is answered the same
way in every environment.
"""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable

from starlette.requests import Request
from starlette.responses import Response

from .logging import get_logger

logger = get_logger("oppulse.request")

REQUEST_ID_HEADER = "X-Request-ID"


def request_id_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Awaitable[Response]:
    """Gives every request an id, and echoes it back.

    The id comes from the client when it sends one, so a browser's report
    and the server's log line can be tied together. It is never trusted
    beyond being a label: it is truncated, and it is used for nothing else.
    """

    async def middleware(request: Request) -> Response:
        incoming = request.headers.get(REQUEST_ID_HEADER, "")
        request_id = incoming[:64] if incoming else ""
        if not request_id:
            request_id = f"req_{int(time.time() * 1000):x}"

        request.state.request_id = request_id
        started = time.perf_counter()

        response = await call_next(request)

        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        response.headers[REQUEST_ID_HEADER] = request_id

        logger.info(
            "request",
            {
                "request_id": request_id,
                "method": request.method,
                "route": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response

    return middleware(request)
