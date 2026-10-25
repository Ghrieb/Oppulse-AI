"""Passwords, tokens and sessions.

The backend owns the identity lifecycle: Argon2id for passwords, a short
lived access token, and a rotating single-use refresh token that is stored
hashed and lives in an ``HttpOnly`` cookie.

The decision, and what it costs, is written down in
``docs/auth-decision-record.md``.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import Settings
from ..db.models import RefreshToken, User

#: The Argon2id parameters. OWASP's baseline: 64 MiB, three passes, four lanes.
_hasher = PasswordHasher(time_cost=3, memory_cost=64 * 1024, parallelism=4)

ACCESS_TOKEN_TYPE = "access"  # noqa: S105 - a token *type*, not a secret
REFRESH_TOKEN_TYPE = "refresh"  # noqa: S105 - a token *type*, not a secret

#: The cookie the refresh token lives in.
REFRESH_COOKIE_NAME = "oppulse_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"

#: The cookie the short-lived access token lives in.
ACCESS_COOKIE_NAME = "oppulse_access"
ACCESS_COOKIE_PATH = "/api/v1"


def hash_password(password: str, *, settings: Settings | None = None) -> str:
    """Hashes a password with Argon2id."""
    if settings is not None:
        global _hasher
        _hasher = PasswordHasher(
            time_cost=settings.argon2_time_cost,
            memory_cost=settings.argon2_memory_cost,
            parallelism=settings.argon2_parallelism,
        )
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Whether a password matches its hash."""
    try:
        _hasher.verify(hashed, password)
    except (VerifyMismatchError, InvalidHashError):
        return False
    return True


def needs_rehash(hashed: str) -> bool:
    """Whether a stored hash was made with weaker parameters."""
    try:
        return _hasher.check_needs_rehash(hashed)
    except InvalidHashError:
        return True


def _now() -> datetime:
    return datetime.now(UTC)


def _as_utc(value: datetime) -> datetime:
    """A datetime that is certainly UTC.

    SQLite hands the timestamps back without a timezone, so every comparison
    has to be explicit about which zone it is in.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def create_access_token(user: User, *, settings: Settings) -> str:
    """A short-lived access token."""
    issued_at = _now()
    payload = {
        "sub": user.id,
        "email": user.email,
        "type": ACCESS_TOKEN_TYPE,
        "iat": int(issued_at.timestamp()),
        "exp": int((issued_at + timedelta(seconds=settings.access_token_ttl_seconds)).timestamp()),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str, *, settings: Settings) -> dict[str, Any] | None:
    """The token's claims, or None when it is not usable."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None

    if payload.get("type") != ACCESS_TOKEN_TYPE:
        return None

    return payload


def new_refresh_token() -> tuple[str, str]:
    """A refresh token and its hash.

    Only the hash is stored. A stolen database therefore does not hand over
    anybody's sessions.
    """
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    """The stored form of a refresh token."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def new_password_reset_token() -> tuple[str, str]:
    """A password reset token and its hash."""
    raw = secrets.token_urlsafe(32)
    return raw, hashlib.sha256(raw.encode("utf-8")).hexdigest()


def new_email_verification_token() -> tuple[str, str]:
    """A random verification token and its stored hash."""
    raw = secrets.token_urlsafe(32)
    return raw, hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def store_refresh_token(
    session: AsyncSession,
    *,
    user: User,
    raw_token: str,
    family_id: str,
    settings: Settings,
) -> RefreshToken:
    """Stores a refresh token's hash."""
    record = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_token),
        family_id=family_id,
        expires_at=_now() + timedelta(seconds=settings.refresh_token_ttl_seconds),
    )
    session.add(record)
    await session.flush()
    return record


async def consume_refresh_token(
    session: AsyncSession, *, raw_token: str
) -> tuple[User | None, str | None, str | None]:
    """Spends a refresh token.

    Returns the user, the family id and the reason it failed. A token that
    was already spent revokes its whole family: that is what a stolen and
    replayed token looks like.
    """
    token_hash = hash_refresh_token(raw_token)

    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    record = result.scalar_one_or_none()
    if record is None:
        return None, None, "The session could not be renewed."

    if record.used_at is not None or record.revoked_at is not None:
        await revoke_family(session, family_id=record.family_id)
        return None, record.family_id, "That session has already been used. Please sign in again."

    if _as_utc(record.expires_at) <= _now():
        return None, record.family_id, "The session has expired. Please sign in again."

    user_result = await session.execute(select(User).where(User.id == record.user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        return None, record.family_id, "The session could not be renewed."

    record.used_at = _now()
    await session.flush()
    return user, record.family_id, None


async def revoke_family(session: AsyncSession, *, family_id: str) -> None:
    """Revokes every token in a family."""
    result = await session.execute(select(RefreshToken).where(RefreshToken.family_id == family_id))
    for record in result.scalars().all():
        record.revoked_at = _now()
    await session.flush()


async def revoke_all(session: AsyncSession, *, user_id: str) -> None:
    """Revokes every token of one account."""
    result = await session.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)
        )
    )
    for record in result.scalars().all():
        record.revoked_at = _now()
    await session.flush()
