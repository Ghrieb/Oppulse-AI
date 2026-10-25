"""The `Idempotency-Key` on the mutations.

Three properties are worth proving here:

- **one key, one answer** — a repeat of a successful call returns the
  first response and does not do the work again (no second run, no
  second event, no second write);
- **the scope is the row** — the same key naming two different rows is
  two actions, because the scope carries the row's id;
- **without a header, nothing changes** — no key means no record and
  the ordinary behaviour of the endpoint.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.api.idempotency import MAX_KEY_LENGTH
from app.db.models import Mission, Run, RunEvent, User
from app.db.session import session_factory
from app.security.tokens import hash_password

PASSWORD = "PrototypePass1"


async def _make_student(email: str) -> str:
    """An account, with nothing else — the tests seed what they need."""
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


async def _seed_mission(owner_id: str) -> str:
    async with session_factory() as session:
        mission = Mission(
            owner_id=owner_id,
            title="Research mission",
            objective="Find the fellowships Sara can apply to.",
        )
        session.add(mission)
        await session.commit()
        return mission.id


async def _seed_run(owner_id: str, mission_id: str, *, status: str = "queued") -> str:
    async with session_factory() as session:
        run = Run(
            mission_id=mission_id,
            owner_id=owner_id,
            status=status,
            phase="queued" if status == "queued" else status,
            budget={},
            started_at=datetime.now(UTC),
        )
        session.add(run)
        await session.commit()
        return run.id


async def _sign_in(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/api/v1/auth/sign-in", json={"email": email, "password": PASSWORD}
    )
    assert response.status_code == 200


async def _run_count(owner_id: str) -> int:
    async with session_factory() as session:
        return int(
            (
                await session.execute(
                    select(func.count()).select_from(Run).where(Run.owner_id == owner_id)
                )
            ).scalar_one()
        )


async def _event_count(run_id: str, event_type: str) -> int:
    async with session_factory() as session:
        return int(
            (
                await session.execute(
                    select(func.count())
                    .select_from(RunEvent)
                    .where(RunEvent.run_id == run_id, RunEvent.type == event_type)
                )
            ).scalar_one()
        )


TERMINAL_RUN_STATUSES = {"completed", "failed", "cancelled", "partial"}


async def _set_run_status(run_id: str, status: str) -> None:
    async with session_factory() as session:
        run = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one()
        run.status = status
        run.finished_at = None
        if status in TERMINAL_RUN_STATUSES:
            run.finished_at = datetime.now(UTC)
        await session.commit()


# --------------------------------------------------------------------- #
# Starting a run                                                         #
# --------------------------------------------------------------------- #


async def test_the_same_key_starts_one_run(client: AsyncClient) -> None:
    owner = await _make_student("key-run@example.edu")
    mission = await _seed_mission(owner)
    await _sign_in(client, "key-run@example.edu")
    headers = {"Idempotency-Key": "start-once-1"}

    first = await client.post(f"/api/v1/missions/{mission}/runs", headers=headers)
    second = await client.post(f"/api/v1/missions/{mission}/runs", headers=headers)

    assert first.status_code == 202
    assert second.status_code == 202
    assert first.json()["runId"] == second.json()["runId"]
    assert await _run_count(owner) == 1


async def test_the_key_still_names_the_same_run_after_it_finishes(
    client: AsyncClient,
) -> None:
    """A retry after the run completed must not start a second one."""
    owner = await _make_student("key-finished@example.edu")
    mission = await _seed_mission(owner)
    await _sign_in(client, "key-finished@example.edu")
    headers = {"Idempotency-Key": "start-once-2"}

    first = await client.post(f"/api/v1/missions/{mission}/runs", headers=headers)
    run_id = first.json()["runId"]
    await _set_run_status(run_id, "completed")

    again = await client.post(f"/api/v1/missions/{mission}/runs", headers=headers)

    assert again.json()["runId"] == run_id
    assert await _run_count(owner) == 1


async def test_without_a_header_a_finished_run_does_not_hide_the_next_one(
    client: AsyncClient,
) -> None:
    """No key, no deduplication: the ordinary behaviour is unchanged."""
    owner = await _make_student("no-key@example.edu")
    mission = await _seed_mission(owner)
    await _sign_in(client, "no-key@example.edu")

    first = await client.post(f"/api/v1/missions/{mission}/runs")
    run_id = first.json()["runId"]
    await _set_run_status(run_id, "completed")

    second = await client.post(f"/api/v1/missions/{mission}/runs")

    assert second.json()["runId"] != run_id
    assert await _run_count(owner) == 2


async def test_a_key_attaches_to_a_run_that_started_without_one(
    client: AsyncClient,
) -> None:
    """The first call predates the key; later repeats still find its run."""
    owner = await _make_student("attach@example.edu")
    mission = await _seed_mission(owner)
    await _sign_in(client, "attach@example.edu")

    first = await client.post(f"/api/v1/missions/{mission}/runs")
    run_id = first.json()["runId"]

    headers = {"Idempotency-Key": "attach-1"}
    attached = await client.post(f"/api/v1/missions/{mission}/runs", headers=headers)
    assert attached.json()["runId"] == run_id

    await _set_run_status(run_id, "completed")
    repeated = await client.post(f"/api/v1/missions/{mission}/runs", headers=headers)

    assert repeated.json()["runId"] == run_id
    assert await _run_count(owner) == 1


async def test_a_long_key_is_refused(client: AsyncClient) -> None:
    owner = await _make_student("long-key@example.edu")
    mission = await _seed_mission(owner)
    await _sign_in(client, "long-key@example.edu")

    response = await client.post(
        f"/api/v1/missions/{mission}/runs",
        headers={"Idempotency-Key": "k" * (MAX_KEY_LENGTH + 1)},
    )

    assert response.status_code == 422


# --------------------------------------------------------------------- #
# Cancelling and retrying                                                #
# --------------------------------------------------------------------- #


async def test_a_repeated_cancel_answers_twice_but_writes_once(
    client: AsyncClient,
) -> None:
    owner = await _make_student("cancel-once@example.edu")
    mission = await _seed_mission(owner)
    run_id = await _seed_run(owner, mission)
    await _sign_in(client, "cancel-once@example.edu")
    headers = {"Idempotency-Key": "cancel-1"}

    first = await client.post(f"/api/v1/runs/{run_id}/cancel", headers=headers)
    second = await client.post(f"/api/v1/runs/{run_id}/cancel", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()
    assert await _event_count(run_id, "run.cancelled") == 1


async def test_a_key_naming_two_rows_is_two_actions(client: AsyncClient) -> None:
    """The scope carries the row: one key, two cancels, both real."""
    owner = await _make_student("two-rows@example.edu")
    mission = await _seed_mission(owner)
    run_one = await _seed_run(owner, mission)
    run_two = await _seed_run(owner, mission)
    await _sign_in(client, "two-rows@example.edu")
    headers = {"Idempotency-Key": "same-key-both"}

    first = await client.post(f"/api/v1/runs/{run_one}/cancel", headers=headers)
    second = await client.post(f"/api/v1/runs/{run_two}/cancel", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert await _event_count(run_one, "run.cancelled") == 1
    assert await _event_count(run_two, "run.cancelled") == 1


async def test_a_repeated_retry_returns_the_first_answer(client: AsyncClient) -> None:
    owner = await _make_student("retry-once@example.edu")
    mission = await _seed_mission(owner)
    run_id = await _seed_run(owner, mission, status="failed")
    await _sign_in(client, "retry-once@example.edu")
    headers = {"Idempotency-Key": "retry-1"}

    first = await client.post(f"/api/v1/runs/{run_id}/retry", headers=headers)
    await _set_run_status(run_id, "failed")
    second = await client.post(f"/api/v1/runs/{run_id}/retry", headers=headers)

    assert first.status_code == 200
    assert second.json() == first.json()
    assert await _event_count(run_id, "run.retried") == 1


# --------------------------------------------------------------------- #
# The record itself                                                      #
# --------------------------------------------------------------------- #


async def test_a_failed_attempt_remembers_nothing(client: AsyncClient) -> None:
    """The record is written after the mutation, so a rejected call
    leaves no key behind and the retry simply runs."""
    owner = await _make_student("failed-attempt@example.edu")
    mission = await _seed_mission(owner)
    await _sign_in(client, "failed-attempt@example.edu")
    headers = {"Idempotency-Key": "bad-then-good"}

    refused = await client.post("/api/v1/missions/does-not-exist/runs", headers=headers)
    accepted = await client.post(f"/api/v1/missions/{mission}/runs", headers=headers)

    assert refused.status_code == 404
    assert accepted.status_code == 202
    assert await _run_count(owner) == 1


async def test_the_session_carries_a_stored_body_that_survives_by_alias(
    client: AsyncClient,
) -> None:
    """The stored body is what went over the wire, and validating it by
    alias gives back the same response."""
    owner = await _make_student("alias@example.edu")
    mission = await _seed_mission(owner)
    await _sign_in(client, "alias@example.edu")
    headers = {"Idempotency-Key": "alias-1"}

    first = await client.post(f"/api/v1/missions/{mission}/runs", headers=headers)
    second = await client.post(f"/api/v1/missions/{mission}/runs", headers=headers)

    assert set(second.json()) == set(first.json())
    assert second.json()["runId"] == first.json()["runId"]
    assert second.json()["status"] == first.json()["status"]


@pytest.mark.parametrize("key", ["", "   "])
async def test_a_blank_key_is_no_key(client: AsyncClient, key: str) -> None:
    owner = await _make_student("blank@example.edu")
    mission = await _seed_mission(owner)
    await _sign_in(client, "blank@example.edu")

    first = await client.post(f"/api/v1/missions/{mission}/runs", headers={"Idempotency-Key": key})
    await _set_run_status(first.json()["runId"], "completed")
    second = await client.post(f"/api/v1/missions/{mission}/runs", headers={"Idempotency-Key": key})

    assert first.json()["runId"] != second.json()["runId"]
