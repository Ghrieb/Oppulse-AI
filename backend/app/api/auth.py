"""Authentication.

Sign-up, sign-in, sign-out, the session, and the email verification. The
backend owns the whole identity lifecycle; the frontend's contract is
unchanged, because it was written for exactly this.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from pydantic import EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai.providers import build_email_provider
from ..ai.providers.base import ProviderError
from ..config import get_settings
from ..db.models import (
    AuditLog,
    EmailVerificationToken,
    PasswordResetToken,
    Profile,
    ProtectedProfile,
    User,
)
from ..db.session import get_session
from ..errors import ApiProblem, ErrorCode, conflict, unauthorized, validation
from ..security.session import CurrentUser, current_user
from ..security.tokens import (
    ACCESS_COOKIE_NAME,
    ACCESS_COOKIE_PATH,
    REFRESH_COOKIE_NAME,
    REFRESH_COOKIE_PATH,
    consume_refresh_token,
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_email_verification_token,
    new_password_reset_token,
    new_refresh_token,
    revoke_all,
    store_refresh_token,
)
from ..wire import WireModel, iso_utc

router = APIRouter(prefix="/auth", tags=["auth"])


class SessionUser(WireModel):
    """The user, as the frontend expects it."""

    id: str
    email: str
    full_name: str
    avatar_url: str | None = None
    headline: str | None = None
    email_verified: bool
    email_verified_at: str | None = None


class SessionResponse(WireModel):
    user: SessionUser
    expires_at: str


class SignInRequest(WireModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class SignUpRequest(WireModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    full_name: str = Field(min_length=1, max_length=120)


class SignUpResponse(WireModel):
    user: SessionUser
    signed_in: bool


class EmailVerificationLink(WireModel):
    token: str
    sent_to: EmailStr
    expires_at: str


class EmailVerificationResult(WireModel):
    user: SessionUser


class PasswordForgotRequest(WireModel):
    email: str


class PasswordForgotResponse(WireModel):
    """Always true, whether or not the address is known.

    The endpoint must never confirm who has an account, or it becomes a way
    of discovering who is using the product.
    """

    accepted: bool = True


class PasswordResetRequest(WireModel):
    token: str
    password: str = Field(min_length=8, max_length=200)


class PasswordResetResponse(WireModel):
    changed: bool = True


def _session_user(user: User) -> SessionUser:
    return SessionUser(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        avatar_url=None,
        headline=None,
        email_verified=user.email_verified,
        email_verified_at=iso_utc(user.email_verified_at),
    )


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        raw_token,
        max_age=settings.refresh_token_ttl_seconds,
        httponly=True,
        secure=not settings.is_local,
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
    )


def _set_access_cookie(response: Response, token: str) -> None:
    """The short-lived access token, in a cookie the browser cannot read.

    The frontend's contract carries no token — it calls `GET /auth/session`
    and reads the session. Keeping the access token in an `HttpOnly` cookie
    is what makes that safe: an injected script cannot read it.
    """
    settings = get_settings()
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        token,
        max_age=settings.access_token_ttl_seconds,
        httponly=True,
        secure=not settings.is_local,
        samesite="lax",
        path=ACCESS_COOKIE_PATH,
    )


async def _audit(
    session: AsyncSession, *, owner_id: str | None, actor: str, event: str, **detail: Any
) -> None:
    """Records what happened, without recording anything sensitive."""
    session.add(
        AuditLog(
            owner_id=owner_id,
            actor=actor,
            event=event,
            detail=detail,
        )
    )


@router.get("/session", response_model=SessionResponse)
async def read_session(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> SessionResponse:
    """The current session.

    When the access token has expired but the refresh token is still good,
    the session is renewed here — which is why the frontend's contract
    carries no token at all: it asks for the session and gets one.
    """
    settings = get_settings()

    user = await _resolve_user(request, session)
    if user is None:
        # A refresh cookie is the one chance to renew.
        raw_refresh = request.cookies.get(REFRESH_COOKIE_NAME)
        if raw_refresh:
            renewed, family_id, _ = await consume_refresh_token(session, raw_token=raw_refresh)
            if renewed is not None:
                replacement, _ = new_refresh_token()
                await store_refresh_token(
                    session,
                    user=renewed,
                    raw_token=replacement,
                    family_id=family_id or str(uuid.uuid4()),
                    settings=settings,
                )
                _set_access_cookie(response, create_access_token(renewed, settings=settings))
                _set_refresh_cookie(response, replacement)
                await session.commit()
                return SessionResponse(
                    user=_session_user(renewed),
                    expires_at=datetime.now(UTC).isoformat(),
                )

        raise unauthorized("You need to sign in to continue.")

    _set_access_cookie(response, create_access_token(user, settings=settings))
    return SessionResponse(
        user=_session_user(user),
        expires_at=datetime.now(UTC).isoformat(),
    )


async def _resolve_user(request: Request, session: AsyncSession) -> User | None:
    """The user the request is signed in as, if any."""
    from ..security.session import _claims_from, user_from_claims

    claims = _claims_from(request)
    if claims is None:
        return None

    return await user_from_claims(session, claims)


@router.post("/sign-in")
async def sign_in(
    body: SignInRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> SessionResponse:
    """Signs a student in.

    The failure message is the same whether the address is unknown or the
    password is wrong: the endpoint must not confirm which addresses have
    accounts.
    """
    settings = get_settings()

    result = await session.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()

    if user is None or not _verify(body.password, user.password_hash):
        await _audit(session, owner_id=None, actor="anonymous", event="auth.sign_in_failed")
        await session.commit()
        raise unauthorized("That email address and password do not match an account.")

    raw_token, _ = new_refresh_token()
    await store_refresh_token(
        session,
        user=user,
        raw_token=raw_token,
        family_id=str(uuid.uuid4()),
        settings=settings,
    )
    _set_refresh_cookie(response, raw_token)
    _set_access_cookie(response, create_access_token(user, settings=settings))
    await _audit(session, owner_id=user.id, actor=user.id, event="auth.signed_in")
    await session.commit()

    return SessionResponse(
        user=_session_user(user),
        expires_at=datetime.now(UTC).isoformat(),
    )


def _verify(password: str, hashed: str) -> bool:
    from ..security.tokens import verify_password

    return verify_password(password, hashed)


@router.post("/sign-up", response_model=SignUpResponse, status_code=201)
async def sign_up(
    body: SignUpRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> SignUpResponse:
    """Creates an account."""
    settings = get_settings()

    result = await session.execute(select(User).where(User.email == body.email.lower()))
    if result.scalar_one_or_none() is not None:
        raise conflict("There is already an account with that email address.")

    user = User(
        email=body.email.lower(),
        full_name=body.full_name,
        password_hash=hash_password(body.password, settings=settings),
        email_verified=False,
    )
    session.add(user)
    await session.flush()

    session.add(
        Profile(
            user_id=user.id,
            full_name=body.full_name,
            email=user.email,
            preferences={
                "guidedView": True,
                "email": {
                    "defaultCadence": "daily_digest",
                    "categories": {
                        "deadline": "daily_digest",
                        "source_change": "immediate",
                        "run_complete": "off",
                        "application_task": "weekly_digest",
                    },
                },
                "timezone": "UTC",
                "currency": "EUR",
            },
            consent={
                "externalModelProcessing": False,
                "allowProfileMatching": True,
                "emailNotifications": False,
                "retentionDays": None,
            },
        )
    )
    session.add(
        ProtectedProfile(
            owner_id=user.id,
            date_of_birth_status="not_provided",
            date_of_birth_updated_at=datetime.now(UTC),
        )
    )

    raw_token, _ = new_refresh_token()
    await store_refresh_token(
        session,
        user=user,
        raw_token=raw_token,
        family_id=str(uuid.uuid4()),
        settings=settings,
    )
    _set_refresh_cookie(response, raw_token)
    _set_access_cookie(response, create_access_token(user, settings=settings))
    await _audit(session, owner_id=user.id, actor=user.id, event="auth.signed_up")
    await session.commit()

    return SignUpResponse(user=_session_user(user), signed_in=True)


@router.post("/sign-out", status_code=204)
async def sign_out(
    request: Request,
    response: Response,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Signs the student out, everywhere."""
    await revoke_all(session, user_id=user.id)
    await _audit(session, owner_id=user.id, actor=user.id, event="auth.signed_out")
    await session.commit()

    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)
    response.delete_cookie(ACCESS_COOKIE_NAME, path=ACCESS_COOKIE_PATH)
    return Response(status_code=204)


@router.post("/email/verification", response_model=EmailVerificationLink)
async def request_email_verification(
    request: Request,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> EmailVerificationLink:
    """Sends a verification link.

    The token comes back in the response because the prototype cannot
    deliver email yet. In the backend it only ever travels in the message.
    """
    settings = get_settings()
    token, token_hash = new_email_verification_token()
    if not settings.is_local:
        try:
            await build_email_provider(settings).send(
                to=user.email,
                subject="Verify your Oppulse email address",
                body=f"Your verification token is: {token}",
                idempotency_key=f"email-verification:{user.id}:{token_hash}",
            )
        except ProviderError as error:
            raise ApiProblem(
                ErrorCode.PROVIDER_UNAVAILABLE,
                "Email delivery is not available right now. Try again later.",
            ) from error
    session.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC)
            + timedelta(seconds=settings.verification_token_ttl_seconds),
        )
    )
    await _audit(session, owner_id=user.id, actor=user.id, event="auth.verification_requested")
    await session.commit()

    return EmailVerificationLink(
        token=token if settings.is_local else "",
        sent_to=user.email,
        expires_at=(
            datetime.now(UTC) + timedelta(seconds=settings.verification_token_ttl_seconds)
        ).isoformat(),
    )


@router.post("/email/verification/confirm", response_model=EmailVerificationResult)
async def confirm_email_verification(
    body: dict[str, Any],
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> EmailVerificationResult:
    """Confirms the address.

    Only the backend can set this. The client cannot ask for a verified
    address, and no sensitive alert is sent to an unverified one.
    """
    token = body.get("token")
    if not isinstance(token, str):
        raise validation(
            "That verification link is not valid or has expired.",
            {"token": ["The link is not valid."]},
        )

    result = await session.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.token_hash == hash_refresh_token(token),
        )
    )
    record = result.scalar_one_or_none()
    if (
        record is None
        or record.used_at is not None
        or record.expires_at.replace(tzinfo=record.expires_at.tzinfo or UTC) <= datetime.now(UTC)
    ):
        raise validation(
            "That verification link is not valid or has expired.",
            {"token": ["The link is not valid."]},
        )

    account_result = await session.execute(select(User).where(User.id == user.id))
    account = account_result.scalar_one()
    account.email_verified = True
    account.email_verified_at = datetime.now(UTC)
    record.used_at = datetime.now(UTC)
    await session.flush()

    await _audit(session, owner_id=user.id, actor=user.id, event="auth.email_verified")
    await session.commit()

    return EmailVerificationResult(user=_session_user(account))


@router.post("/password/forgot", response_model=PasswordForgotResponse)
async def forgot_password(
    body: PasswordForgotRequest,
    session: AsyncSession = Depends(get_session),
) -> PasswordForgotResponse:
    """Asks for a password reset link.

    The answer is the same whether or not the address has an account: the
    endpoint must never confirm who has one, or it becomes a way of
    discovering who is using the product.
    """
    result = await session.execute(select(User).where(User.email == body.email.lower()))
    account = result.scalar_one_or_none()

    if account is not None:
        raw, token_hash = new_password_reset_token()
        settings = get_settings()
        if not settings.is_local:
            try:
                await build_email_provider(settings).send(
                    to=account.email,
                    subject="Reset your Oppulse password",
                    body=f"Your password reset token is: {raw}",
                    idempotency_key=f"password-reset:{account.id}:{token_hash}",
                )
            except ProviderError as error:
                raise ApiProblem(
                    ErrorCode.PROVIDER_UNAVAILABLE,
                    "Email delivery is not available right now. Try again later.",
                ) from error
        if settings.is_local:
            del raw
        session.add(
            PasswordResetToken(
                user_id=account.id,
                token_hash=token_hash,
                expires_at=datetime.now(UTC)
                + timedelta(seconds=get_settings().password_reset_token_ttl_seconds),
            )
        )
        await _audit(
            session,
            owner_id=account.id,
            actor=account.id,
            event="auth.password_reset_requested",
        )
        await session.commit()

    return PasswordForgotResponse(accepted=True)


@router.post("/password/reset", response_model=PasswordResetResponse)
async def reset_password(
    body: PasswordResetRequest,
    session: AsyncSession = Depends(get_session),
) -> PasswordResetResponse:
    """Sets a new password with a reset token.

    The token is single-use, and every session of that account is revoked:
    a password reset is how an account is recovered, so the old sessions
    must not survive it.
    """
    from ..security.tokens import hash_refresh_token

    result = await session.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == hash_refresh_token(body.token)
        )
    )
    record = result.scalar_one_or_none()

    if record is None or record.used_at is not None:
        raise validation(
            "That reset link is not valid or has expired.",
            {"token": ["The link is not valid."]},
        )

    if record.expires_at.replace(tzinfo=record.expires_at.tzinfo or UTC) <= datetime.now(UTC):
        raise validation(
            "That reset link is not valid or has expired.",
            {"token": ["The link has expired."]},
        )

    account_result = await session.execute(select(User).where(User.id == record.user_id))
    account = account_result.scalar_one()

    account.password_hash = hash_password(body.password, settings=get_settings())
    record.used_at = datetime.now(UTC)

    await revoke_all(session, user_id=account.id)
    await _audit(
        session,
        owner_id=account.id,
        actor=account.id,
        event="auth.password_reset",
    )
    await session.commit()

    return PasswordResetResponse(changed=True)


__all__ = ["ApiProblem", "ErrorCode", "router"]
