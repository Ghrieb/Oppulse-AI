"""The assistant's answer, as the browser receives it.

The endpoint is where the block producers run together for the first time,
and four properties are worth proving here:

- **the block set is the contract's** — an opportunity turn emits the four
  kinds that were missing, and every block round-trips through the union;
- **media has provenance** — only what the fetcher saw on an official page
  becomes a media entry, and an entry whose asset was never opened stays
  `not_reviewed`;
- **the honest edge is honest** — `checked` names only the sources this
  turn attempted, a conflict appears only when the deadline record holds
  one, and a question that retrieved nothing says so;
- **the answer survives the round trip** — the stored history carries the
  same blocks, in the camelCase the frontend reads.
"""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

from app.ai.providers.base import ProviderError
from app.ai.types import AssistantBlockAdapter
from app.db.models import Application, Opportunity, User
from app.db.session import session_factory
from app.security.tokens import hash_password

PASSWORD = "PrototypePass1"
QUERY = "Fully funded research fellowships in Europe"


async def _make_student(email: str) -> str:
    async with session_factory() as session:
        user = User(
            email=email,
            full_name="Sara Benali",
            password_hash=hash_password(PASSWORD),
            email_verified=True,
        )
        session.add(user)
        await session.commit()
        return user.id


async def _sign_in(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/api/v1/auth/sign-in", json={"email": email, "password": PASSWORD}
    )
    assert response.status_code == 200


async def _seed_opportunity(*, deadline: dict[str, Any] | None = None) -> str:
    async with session_factory() as session:
        user = User(
            email="seed@example.com",
            full_name="Seed User",
            password_hash="hashed_seed_password",
            email_verified=True,
        )
        session.add(user)
        await session.flush()

        opportunity = Opportunity(
            owner_id=user.id,
            title="Helios Research Fellowship in Computational Biology",
            institution="Helios Institute for Applied Genomics",
            type="fellowship",
            country={"name": "Netherlands", "iso2": "NL", "region": "Europe"},
            source_domain="helios-fellowship.org",
            canonical_url="https://helios-fellowship.org/call",
            summary="A research fellowship for computational biologists.",
            deadline=deadline or {"value": "2026-11-20", "status": "verified", "conflicts": []},
            funding={"coverage": "fully_funded"},
            requirements=[
                {"id": "50000000-0000-4000-8000-000000000001", "label": "Enrolled in a Master's"},
                {"id": "50000000-0000-4000-8000-000000000002", "label": "English proficiency"},
            ],
        )
        session.add(opportunity)
        await session.commit()
        return opportunity.id


async def _seed_application(owner_id: str, opportunity_id: str) -> str:
    async with session_factory() as session:
        application = Application(
            owner_id=owner_id,
            opportunity_id=opportunity_id,
            opportunity_title="Helios Research Fellowship in Computational Biology",
            institution="Helios Institute for Applied Genomics",
        )
        session.add(application)
        await session.commit()
        return application.id


async def _ask(client: AsyncClient, *, message: str, opportunity_id: str) -> dict[str, Any]:
    response = await client.post(
        "/api/v1/assistant/messages",
        json={"message": message, "context": {"opportunityId": opportunity_id}},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _blocks_of(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {block["kind"]: block for block in payload["blocks"]}


async def test_an_opportunity_turn_emits_the_four_new_block_kinds(client: AsyncClient) -> None:
    email = "blocks@example.edu"
    await _make_student(email)
    await _sign_in(client, email)
    opportunity_id = await _seed_opportunity()

    payload = await _ask(client, message=QUERY, opportunity_id=opportunity_id)

    assert [block["kind"] for block in payload["blocks"]] == [
        "text",
        "evidence",
        "checklist",
        "opportunity_reference",
        "institution",
        "media_context",
        "unknown_or_conflict",
        "action",
    ]
    for block in payload["blocks"]:
        AssistantBlockAdapter.validate_python(block)

    blocks = _blocks_of(payload)

    reference = blocks["opportunity_reference"]
    assert reference["opportunityId"] == opportunity_id
    assert reference["institution"] == "Helios Institute for Applied Genomics"
    assert reference["country"] == "Netherlands"
    assert "based on" in reference["reason"]

    institution = blocks["institution"]
    assert "Helios Institute for Applied Genomics" in institution["description"]
    assert institution["location"] == "Helios Institute for Applied Genomics"
    assert institution["country"] == "Netherlands"
    assert institution["programmeContext"] == "A research fellowship for computational biologists."
    assert institution["unverified"], "what the sources do not state must be named"
    assert institution["evidence"][0]["sourceType"] == "official"
    assert institution["action"]


async def test_media_comes_only_from_official_pages_the_fetcher_opened(
    client: AsyncClient,
) -> None:
    email = "media@example.edu"
    await _make_student(email)
    await _sign_in(client, email)
    opportunity_id = await _seed_opportunity()

    payload = await _ask(client, message=QUERY, opportunity_id=opportunity_id)
    blocks = _blocks_of(payload)

    media_block = blocks["media_context"]
    assert media_block["subject"] == (
        "What the official page for Helios Research Fellowship in Computational Biology shows"
    )
    urls = [item["url"] for item in media_block["media"]]
    assert "https://helios-fellowship.org/media/campus" in urls
    assert all(item["sourceType"] == "official" for item in media_block["media"])

    video = next(item for item in media_block["media"] if item["kind"] == "video")
    # The tag was read; the asset itself was never opened.
    assert video["status"] == "not_reviewed"

    institution_media = {item["url"] for item in blocks["institution"]["media"]}
    assert institution_media == set(urls)


async def test_a_question_that_retrieved_nothing_pretends_nothing(
    client: AsyncClient,
) -> None:
    email = "gap@example.edu"
    await _make_student(email)
    await _sign_in(client, email)
    opportunity_id = await _seed_opportunity()

    payload = await _ask(
        client, message="What is the weather on Mars today?", opportunity_id=opportunity_id
    )
    blocks = _blocks_of(payload)

    assert "media_context" not in blocks, "no page was opened, so there is no media"
    assert blocks["institution"]["evidence"] == []
    assert blocks["institution"]["media"] == []

    unknown = blocks["unknown_or_conflict"]
    assert unknown["conflict"] is False
    assert unknown["checked"] == [], "nothing was attempted, so nothing may claim to be checked"
    assert unknown["nextAction"]


async def test_a_recorded_deadline_disagreement_is_the_conflict(
    client: AsyncClient,
) -> None:
    email = "conflict@example.edu"
    await _make_student(email)
    await _sign_in(client, email)
    opportunity_id = await _seed_opportunity(
        deadline={
            "value": "2026-11-20",
            "status": "conflict",
            "conflicts": [
                {
                    "value": "2026-12-08",
                    "url": "https://verdant-partners.org/programmes/climate-data-fellowship",
                    "sourceId": "e5000000-0000-4000-8000-000000000008",
                }
            ],
        }
    )

    payload = await _ask(client, message=QUERY, opportunity_id=opportunity_id)
    unknown = _blocks_of(payload)["unknown_or_conflict"]

    assert unknown["conflict"] is True
    assert "different closing dates" in unknown["question"]
    assert "check the date" in unknown["nextAction"]
    assert unknown["checked"], "the conflict still names what this turn looked at"


async def test_an_application_turn_keeps_the_answer_in_that_workspace(
    client: AsyncClient,
) -> None:
    email = "workspace@example.edu"
    user_id = await _make_student(email)
    await _sign_in(client, email)
    opportunity_id = await _seed_opportunity()
    application_id = await _seed_application(user_id, opportunity_id)

    response = await client.post(
        "/api/v1/assistant/messages",
        json={
            "message": "What should I do next for this application?",
            "context": {"opportunityId": opportunity_id, "applicationId": application_id},
        },
    )
    assert response.status_code == 200, response.text
    blocks = response.json()["blocks"]

    kinds = [block["kind"] for block in blocks]
    assert "action" in kinds, "an application turn must offer a way back to the workspace"

    action = next(block for block in blocks if block["kind"] == "action")
    assert action["action"] == "open_route"
    assert action["payload"]["route"] == f"/applications/{application_id}"
    assert action["effect"] == "prepares"
    assert "Helios" in action["label"], "the label names the opportunity the workspace is for"


async def test_another_students_application_id_is_not_answered_from(
    client: AsyncClient,
) -> None:
    owner_email = "owner@example.edu"
    owner_id = await _make_student(owner_email)
    await _sign_in(client, owner_email)
    opportunity_id = await _seed_opportunity()
    application_id = await _seed_application(owner_id, opportunity_id)

    # Sign out and sign in as a different student; the application must not leak.
    await client.post("/api/v1/auth/sign-out")
    other_email = "other@example.edu"
    await _make_student(other_email)
    await _sign_in(client, other_email)

    response = await client.post(
        "/api/v1/assistant/messages",
        json={
            "message": "What should I do next?",
            "context": {"applicationId": application_id},
        },
    )
    assert response.status_code == 200, response.text

    for block in response.json()["blocks"]:
        if block["kind"] == "action":
            assert f"/applications/{application_id}" not in str(block)


async def test_the_stored_history_carries_the_same_blocks(client: AsyncClient) -> None:
    email = "history@example.edu"
    await _make_student(email)
    await _sign_in(client, email)
    opportunity_id = await _seed_opportunity()

    payload = await _ask(client, message=QUERY, opportunity_id=opportunity_id)

    response = await client.get("/api/v1/assistant/history")
    assert response.status_code == 200
    messages = response.json()["messages"]

    stored_kinds = [
        [block["kind"] for block in message["blocks"]]
        for message in messages
        if message["role"] == "assistant"
    ]
    assert stored_kinds == [[block["kind"] for block in payload["blocks"]]]

    stored_blocks = [
        block
        for message in messages
        if message["role"] == "assistant"
        for block in message["blocks"]
    ]
    assert stored_blocks, "the assistant turn is recorded with its blocks"
    for block in stored_blocks:
        AssistantBlockAdapter.validate_python(block)


async def test_a_rate_limit_is_reported_as_a_rate_limit(client: AsyncClient, monkeypatch) -> None:
    """A spent quota is a 429 the student can retry - not a 503 outage.

    The provider's own text is never forwarded: only the plain message the
    service wrote is allowed to reach the browser.
    """
    email = "ratelimit@example.edu"
    await _make_student(email)
    await _sign_in(client, email)
    opportunity_id = await _seed_opportunity()

    async def limited(*args: Any, **kwargs: Any) -> Any:
        raise ProviderError("provider body that must not leak", code="RATE_LIMITED")

    monkeypatch.setattr("app.api.assistant._answer_funding_question", limited)

    response = await client.post(
        "/api/v1/assistant/messages",
        json={"message": QUERY, "context": {}},
    )

    assert response.status_code == 429
    error = response.json()["error"]
    assert error["code"] == "RATE_LIMITED"
    assert "rate limit" in error["message"].lower()
    assert "provider body that must not leak" not in response.text
