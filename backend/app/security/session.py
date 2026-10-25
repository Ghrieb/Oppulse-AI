"""The session boundary.

Every protected endpoint resolves the caller through this dependency, and
every resource query goes through the ownership guard. A bug in a query
therefore cannot return another student's row: the guard is in the way.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db.models import User
from ..db.session import get_session
from ..errors import ApiProblem, ErrorCode, forbidden, unauthorized
from .tokens import ACCESS_COOKIE_NAME, decode_access_token


@dataclass
class CurrentUser:
    """The caller."""

    id: str
    email: str
    email_verified: bool
    full_name: str


async def current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> CurrentUser:
    """The signed-in user.

    A request without a usable token is a 401 — never a 403, and never a
    silent anonymous session.
    """
    claims = _claims_from(request)
    if claims is None:
        raise unauthorized()

    user_id = claims.get("sub")
    if not isinstance(user_id, str):
        raise unauthorized()

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise unauthorized("Your session is no longer valid. Please sign in again.")

    return CurrentUser(
        id=user.id,
        email=user.email,
        email_verified=user.email_verified,
        full_name=user.full_name,
    )


def _claims_from(request: Request) -> dict[str, Any] | None:
    """The claims of the request's access token.

    The token comes from the `Authorization` header when there is one, and
    from the `HttpOnly` cookie otherwise. The browser never holds the
    access token in JavaScript, so an injected script cannot read it.
    """
    settings = get_settings()

    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        token = header.split(" ", 1)[1].strip()
        return decode_access_token(token, settings=settings)

    cookie = request.cookies.get(ACCESS_COOKIE_NAME)
    if cookie:
        return decode_access_token(cookie, settings=settings)

    return None


async def optional_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> CurrentUser | None:
    """The caller, if there is one.

    Used by the endpoints that are readable while signed out — the landing
    page's capability strip, for instance.
    """
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None

    token = header.split(" ", 1)[1].strip()
    claims = decode_access_token(token, settings=get_settings())
    if claims is None:
        return None

    user_id = claims.get("sub")
    if not isinstance(user_id, str):
        return None

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return None

    return CurrentUser(
        id=user.id,
        email=user.email,
        email_verified=user.email_verified,
        full_name=user.full_name,
    )


def owned(row: Any, owner_id: str, *, what: str = "That resource") -> Any:
    """The row, if it belongs to the caller.

    A row that does not belong is reported as *not found*, not as
    *forbidden*: a caller must not be able to learn that someone else's
    resource exists.
    """
    owner = getattr(row, "owner_id", None)
    if owner is None:
        owner = getattr(row, "profile_id", None)
    if owner is None:
        owner = getattr(row, "user_id", None)

    if owner != owner_id:
        raise ApiProblem(ErrorCode.NOT_FOUND, f"{what} was not found.")

    return row


def require_ownership(row: Any, owner_id: str, *, what: str = "That resource") -> Any:
    """Alias for :func:`owned`, named for the call site."""
    return owned(row, owner_id, what=what)


__all__ = [
    "CurrentUser",
    "current_user",
    "forbidden",
    "optional_user",
    "owned",
    "require_ownership",
]
