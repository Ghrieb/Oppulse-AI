"""The error envelope.

The frontend has one rule for failures: it branches on a stable ``code``,
never on a message or an HTTP status. This module is the other half of that
contract — the same twelve codes, in the same envelope, with the same
meaning.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from fastapi import status
from fastapi.responses import JSONResponse


class ErrorCode(StrEnum):
    """The twelve codes the frontend knows."""

    NETWORK = "NETWORK"
    TIMEOUT = "TIMEOUT"
    CANCELLED = "CANCELLED"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION = "VALIDATION"
    CONFLICT = "CONFLICT"
    RATE_LIMITED = "RATE_LIMITED"
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
    CONTRACT_MISMATCH = "CONTRACT_MISMATCH"
    UNKNOWN = "UNKNOWN"


#: The status each code is returned with.
STATUS_FOR_CODE: dict[ErrorCode, int] = {
    ErrorCode.UNAUTHORIZED: status.HTTP_401_UNAUTHORIZED,
    ErrorCode.FORBIDDEN: status.HTTP_403_FORBIDDEN,
    ErrorCode.NOT_FOUND: status.HTTP_404_NOT_FOUND,
    ErrorCode.VALIDATION: status.HTTP_422_UNPROCESSABLE_CONTENT,
    ErrorCode.CONFLICT: status.HTTP_409_CONFLICT,
    ErrorCode.RATE_LIMITED: status.HTTP_429_TOO_MANY_REQUESTS,
    ErrorCode.PROVIDER_UNAVAILABLE: status.HTTP_503_SERVICE_UNAVAILABLE,
    ErrorCode.CONTRACT_MISMATCH: status.HTTP_502_BAD_GATEWAY,
    ErrorCode.TIMEOUT: status.HTTP_504_GATEWAY_TIMEOUT,
    ErrorCode.NETWORK: status.HTTP_502_BAD_GATEWAY,
    ErrorCode.CANCELLED: 499,
    ErrorCode.UNKNOWN: status.HTTP_500_INTERNAL_SERVER_ERROR,
}


class ApiProblem(Exception):
    """A failure the client is allowed to see.

    Every raised problem carries a code, a plain message and, where it
    helps, per-field messages. It never carries a stack trace, a provider
    response or anything about the student's data.
    """

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        *,
        field_errors: dict[str, list[str]] | None = None,
        details: Any = None,
        status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.field_errors = field_errors
        self.details = details
        self.status_code = status_code or STATUS_FOR_CODE.get(code, 500)

    def envelope(self, request_id: str | None) -> dict[str, Any]:
        """The body, in the shape the frontend parses."""
        error: dict[str, Any] = {
            "code": str(self.code),
            "message": self.message,
        }
        if request_id:
            error["request_id"] = request_id
        if self.field_errors:
            error["field_errors"] = {
                field: list(messages) for field, messages in self.field_errors.items()
            }
        if self.details is not None:
            error["details"] = self.details
        return {"error": error}

    def response(self, request_id: str | None = None) -> JSONResponse:
        """The HTTP response."""
        return JSONResponse(
            status_code=self.status_code,
            content=self.envelope(request_id),
            headers={"X-Request-ID": request_id} if request_id else None,
        )


def not_found(what: str) -> ApiProblem:
    """A resource that does not exist, or that the caller may not see.

    The message is deliberately the same either way: a caller must not be
    able to learn that someone else's resource exists.
    """
    return ApiProblem(ErrorCode.NOT_FOUND, f"{what} was not found.")


def validation(message: str, field_errors: dict[str, list[str]] | None = None) -> ApiProblem:
    """A request the service refuses to act on."""
    return ApiProblem(ErrorCode.VALIDATION, message, field_errors=field_errors)


def unauthorized(message: str = "You need to sign in to continue.") -> ApiProblem:
    """No session, or an expired one."""
    return ApiProblem(ErrorCode.UNAUTHORIZED, message)


def forbidden(message: str = "You do not have access to that.") -> ApiProblem:
    """A session that exists but may not do this."""
    return ApiProblem(ErrorCode.FORBIDDEN, message)


def conflict(message: str) -> ApiProblem:
    """A request that contradicts the current state."""
    return ApiProblem(ErrorCode.CONFLICT, message)


def provider_unavailable(message: str) -> ApiProblem:
    """A provider that could not be reached or refused the request."""
    return ApiProblem(ErrorCode.PROVIDER_UNAVAILABLE, message)


def provider_failure(code: str, message: str) -> ApiProblem:
    """A provider failure, reported with the status the student can act on.

    A rate limit is not an outage: it is a ``429`` the interface already
    knows how to offer a retry for. An unusable answer is a contract
    failure, not a service that is down. Only the remaining failures are a
    ``503``. The message is the caller's plain text - never the provider's.
    """
    mapped = {
        "RATE_LIMITED": ErrorCode.RATE_LIMITED,
        "CONTRACT_MISMATCH": ErrorCode.CONTRACT_MISMATCH,
    }.get(code, ErrorCode.PROVIDER_UNAVAILABLE)
    return ApiProblem(mapped, message)
