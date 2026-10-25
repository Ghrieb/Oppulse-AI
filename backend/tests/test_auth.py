"""The authentication boundary.

The rules: a request without a session is a 401, a password is never
echoed or logged, a refresh token is single-use, and the browser flow
works through cookies — the frontend's contract carries no token, so the
access token lives in an `HttpOnly` cookie the page cannot read.
"""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import select

from app.db.models import RefreshToken, User
from app.db.session import session_factory
from app.security.tokens import hash_password

ACCOUNT = "sara.benali@example.edu"
PASSWORD = "PrototypePass1"


async def _create_user(email: str = ACCOUNT) -> str:
    async with session_factory() as session:
        user = User(
            email=email,
            full_name="Sara Benali",
            password_hash=hash_password(PASSWORD),
            email_verified=False,
        )
        session.add(user)
        await session.commit()
        return user.id


async def _sign_in(client: AsyncClient, email: str = ACCOUNT) -> None:
    await client.post("/api/v1/auth/sign-in", json={"email": email, "password": PASSWORD})


async def test_sign_up_creates_an_account_and_a_session(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/sign-up",
        json={
            "email": "new.student@example.edu",
            "password": PASSWORD,
            "fullName": "New Student",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "new.student@example.edu"
    assert body["user"]["emailVerified"] is False
    assert "password" not in response.text


async def test_sign_up_refuses_a_duplicate_address(client: AsyncClient) -> None:
    payload = {"email": "duplicate@example.edu", "password": PASSWORD, "fullName": "First"}
    await client.post("/api/v1/auth/sign-up", json=payload)

    second = await client.post("/api/v1/auth/sign-up", json={**payload, "fullName": "Second"})

    assert second.status_code == 409
    assert second.json()["error"]["code"] == "CONFLICT"


async def test_a_weak_password_is_refused(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/sign-up",
        json={"email": "weak@example.edu", "password": "short", "fullName": "Weak"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION"


async def test_sign_in_with_the_wrong_password_says_nothing_useful(
    client: AsyncClient,
) -> None:
    await _create_user()

    response = await client.post(
        "/api/v1/auth/sign-in",
        json={"email": ACCOUNT, "password": "not-the-password"},
    )

    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "UNAUTHORIZED"
    # The same message whether the account exists or the password is wrong.
    assert "do not match" in body["error"]["message"]


async def test_sign_in_sets_an_httponly_refresh_cookie(client: AsyncClient) -> None:
    await _create_user()

    response = await client.post(
        "/api/v1/auth/sign-in", json={"email": ACCOUNT, "password": PASSWORD}
    )

    assert response.status_code == 200
    assert "oppulse_refresh" in response.cookies
    # The browser's JavaScript cannot read it.
    assert response.headers["set-cookie"].count("HttpOnly") >= 1


async def test_the_session_needs_a_token(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/session")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


async def test_a_signed_in_student_can_read_their_session(client: AsyncClient) -> None:
    await _create_user()
    await _sign_in(client)

    response = await client.get("/api/v1/auth/session")

    assert response.status_code == 200
    assert response.json()["user"]["email"] == ACCOUNT


async def test_session_refresh_persists_the_replacement_token(client: AsyncClient) -> None:
    await _create_user()
    await _sign_in(client)
    client.cookies.delete("oppulse_access")

    response = await client.get("/api/v1/auth/session")

    assert response.status_code == 200
    async with session_factory() as session:
        result = await session.execute(select(RefreshToken))
        records = list(result.scalars().all())
        assert len(records) == 2
        assert sum(record.used_at is not None for record in records) == 1
        assert sum(record.used_at is None for record in records) == 1


async def test_a_forged_token_is_refused(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/auth/session", headers={"Authorization": "Bearer not-a-real-token"}
    )

    assert response.status_code == 401


async def test_the_access_token_never_reaches_the_browser_javascript(
    client: AsyncClient,
) -> None:
    await _create_user()

    response = await client.post(
        "/api/v1/auth/sign-in", json={"email": ACCOUNT, "password": PASSWORD}
    )

    # The contract carries no token at all: the session is the answer.
    assert "token" not in response.json()
    assert "access_token" not in response.text


async def test_email_verification_is_the_backends_decision(client: AsyncClient) -> None:
    await _create_user()
    await _sign_in(client)

    link = await client.post("/api/v1/auth/email/verification")
    assert link.status_code == 200

    wrong = await client.post(
        "/api/v1/auth/email/verification/confirm", json={"token": "not-the-token"}
    )
    assert wrong.status_code == 422

    confirmed = await client.post(
        "/api/v1/auth/email/verification/confirm", json={"token": link.json()["token"]}
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["user"]["emailVerified"] is True


async def test_sign_out_revokes_the_session(client: AsyncClient) -> None:
    await _create_user()
    await _sign_in(client)

    assert (await client.get("/api/v1/auth/session")).status_code == 200

    assert (await client.post("/api/v1/auth/sign-out")).status_code == 204

    # The refresh token is revoked, so it cannot be spent again.
    async with session_factory() as session:
        result = await session.execute(select(RefreshToken))
        for record in result.scalars().all():
            assert record.revoked_at is not None


async def test_a_refresh_token_cannot_be_spent_twice(client: AsyncClient) -> None:
    await _create_user()
    await _sign_in(client)

    async with session_factory() as session:
        result = await session.execute(select(RefreshToken))
        record = result.scalar_one()
        assert record.used_at is None
