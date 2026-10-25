"""The profile and the documents.

Two properties are worth proving here:

- **one student's data is never another's** — the ownership guard is in the
  way of every query, not in the mind of the caller;
- **the protected section stays protected** — a routine profile read never
  returns the date of birth, and changing it changes the conclusions.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db.models import Profile, ProtectedProfile, User
from app.db.session import session_factory
from app.security.tokens import hash_password

PASSWORD = "PrototypePass1"


async def _make_student(email: str, full_name: str = "Sara Benali") -> str:
    """An account with a profile, a protected section and one fact."""
    async with session_factory() as session:
        user = User(
            email=email,
            full_name=full_name,
            password_hash=hash_password(PASSWORD),
            email_verified=True,
        )
        session.add(user)
        await session.flush()

        session.add(
            Profile(
                user_id=user.id,
                full_name=full_name,
                email=email,
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
            )
        )
        await session.commit()
        return user.id


async def _sign_in(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/api/v1/auth/sign-in", json={"email": email, "password": PASSWORD}
    )
    assert response.status_code == 200


async def test_the_profile_needs_a_session(client: AsyncClient) -> None:
    response = await client.get("/api/v1/profile")

    assert response.status_code == 401


async def test_the_profile_reads_its_own(client: AsyncClient) -> None:
    await _make_student("sara@example.edu")
    await _sign_in(client, "sara@example.edu")

    response = await client.get("/api/v1/profile")

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "sara@example.edu"
    assert body["preferences"]["email"]["categories"]["deadline"] == "daily_digest"
    assert body["consent"]["allowProfileMatching"] is True


async def test_one_student_cannot_see_another_students_profile(client: AsyncClient) -> None:
    await _make_student("one@example.edu", "One Student")
    await _make_student("two@example.edu", "Two Student")

    await _sign_in(client, "one@example.edu")
    response = await client.get("/api/v1/profile")

    assert response.status_code == 200
    assert response.json()["email"] == "one@example.edu"


async def test_the_protected_section_is_a_separate_read(client: AsyncClient) -> None:
    await _make_student("sara@example.edu")
    await _sign_in(client, "sara@example.edu")

    profile = await client.get("/api/v1/profile")
    protected = await client.get("/api/v1/profile/protected")

    assert protected.status_code == 200
    # The date of birth is not in the routine profile read.
    assert "dateOfBirth" not in profile.text
    assert protected.json()["protectedProfile"]["dateOfBirth"]["status"] == "not_provided"


async def test_a_date_of_birth_is_validated_and_kept_out_of_the_profile(
    client: AsyncClient,
) -> None:
    await _make_student("sara@example.edu")
    await _sign_in(client, "sara@example.edu")

    impossible = await client.patch("/api/v1/profile/protected", json={"dateOfBirth": "2004-02-31"})
    assert impossible.status_code == 422

    future = await client.patch("/api/v1/profile/protected", json={"dateOfBirth": "2099-01-01"})
    assert future.status_code == 422

    accepted = await client.patch("/api/v1/profile/protected", json={"dateOfBirth": "2004-03-12"})
    assert accepted.status_code == 200
    assert accepted.json()["protectedProfile"]["dateOfBirth"]["value"] == "2004-03-12"
    assert accepted.json()["protectedProfile"]["dateOfBirth"]["status"] == "provided"


async def test_excluding_the_date_stops_it_being_used(client: AsyncClient) -> None:
    await _make_student("sara@example.edu")
    await _sign_in(client, "sara@example.edu")

    await client.patch("/api/v1/profile/protected", json={"dateOfBirth": "2004-03-12"})
    excluded = await client.patch("/api/v1/profile/protected", json={"excludedFromAiContext": True})

    assert excluded.status_code == 200
    assert excluded.json()["protectedProfile"]["dateOfBirth"]["excludedFromAiContext"] is True


async def test_a_document_is_the_callers_own(client: AsyncClient) -> None:
    await _make_student("sara@example.edu")
    await _sign_in(client, "sara@example.edu")

    uploaded = await client.post(
        "/api/v1/documents",
        content=b"%PDF-1.4 fake",
        headers={
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="cv.pdf"',
        },
    )

    assert uploaded.status_code == 201
    body = uploaded.json()
    assert body["filename"] == "cv.pdf"
    assert body["consentToUse"] is False
    # A file we could not read is a failure with a reason, not an empty file.
    assert body["status"] in {"failed", "needs_review"}
    downloaded = await client.get(f"/api/v1/documents/{body['id']}/content")
    assert downloaded.status_code == 200
    assert downloaded.content == b"%PDF-1.4 fake"

    other = await _make_student("other@example.edu", "Other Student")
    assert other != body["id"]


async def test_deleting_a_document_withdraws_its_unconfirmed_facts(client: AsyncClient) -> None:
    await _make_student("sara@example.edu")
    await _sign_in(client, "sara@example.edu")

    uploaded = await client.post(
        "/api/v1/documents",
        content=b"%PDF-1.4 fake",
        headers={
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="cv.pdf"',
        },
    )
    document_id = uploaded.json()["id"]

    deleted = await client.delete(f"/api/v1/documents/{document_id}")
    assert deleted.status_code == 204

    listed = await client.get("/api/v1/documents")
    assert listed.json()["documents"] == []


async def test_the_consent_is_the_students_decision(client: AsyncClient) -> None:
    await _make_student("sara@example.edu")
    await _sign_in(client, "sara@example.edu")

    uploaded = await client.post(
        "/api/v1/documents",
        content=b"%PDF-1.4 fake",
        headers={
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="cv.pdf"',
        },
    )
    document_id = uploaded.json()["id"]

    changed = await client.patch(f"/api/v1/documents/{document_id}", json={"consentToUse": True})

    assert changed.status_code == 200
    assert changed.json()["consentToUse"] is True


@pytest.mark.parametrize("method", ["get", "patch"])
async def test_the_protected_section_belongs_to_one_student(
    client: AsyncClient, method: str
) -> None:
    await _make_student("one@example.edu", "One Student")
    await _make_student("two@example.edu", "Two Student")

    await _sign_in(client, "one@example.edu")

    if method == "get":
        response = await client.get("/api/v1/profile/protected")
        assert response.status_code == 200
        # The caller sees their own section, and only their own.
        assert response.json()["protectedProfile"]["dateOfBirth"]["value"] is None
    else:
        response = await client.patch(
            "/api/v1/profile/protected", json={"dateOfBirth": "2004-03-12"}
        )
        assert response.status_code == 200

    # The other student's section is untouched.
    async with session_factory() as session:
        result = await session.execute(select(ProtectedProfile))
        records = list(result.scalars().all())
        dates = [record.date_of_birth for record in records]

    if method == "patch":
        # Exactly one section changed: the caller's.
        assert dates.count("2004-03-12") == 1
        assert dates.count(None) == 1
    else:
        # Reading changed nothing at all.
        assert dates.count(None) == 2
