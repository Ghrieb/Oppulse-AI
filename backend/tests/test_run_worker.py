"""The run worker's contract.

A run is claimed under a lease, walked stage by stage behind the replay
providers, and left in a terminal state with a factual timeline. Pause,
resume and retry re-enter at the checkpoint instead of starting over, and
the student's criteria decide both the queries and the candidates.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import worker
from app.ai.providers.base import ProviderError
from app.ai.stages import matching as matching_module
from app.ai.stages import mission as mission_module
from app.ai.worker import claim_run, run_once
from app.api.missions import pause_run, resume_run, retry_run
from app.config import Settings
from app.db.models import Mission, Opportunity, Run, RunEvent, User
from app.db.session import Base, engine, session_factory
from app.security.session import CurrentUser

#: The recorded query the fixture corpus answers for.
RECORDED_QUERY = "Fully funded research fellowships in Europe"
#: What the recorded mission-interpretation answer rephrases it into.
PLAN_OBJECTIVE = "Find fully funded research fellowships in Europe."


@pytest.fixture
async def database() -> Any:
    """A clean database, without the HTTP client."""
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)

    yield

    await engine.dispose()


def _replay_settings() -> Settings:
    return Settings(model_provider="replay", search_provider="replay")


def _alias_replay_search() -> None:
    """Answers the plan's rephrased objective from the recorded corpus.

    The replay search matches the query exactly, and the recorded plan
    words it slightly differently from the recorded corpus key. The alias
    keeps the walk on recorded data instead of a silent miss.
    """
    corpus = worker.run_corpus()
    corpus.search_results.setdefault(
        PLAN_OBJECTIVE,
        corpus.search_results[RECORDED_QUERY],
    )


async def _seed_run(
    session: AsyncSession,
    *,
    objective: str = RECORDED_QUERY,
    criteria: dict[str, Any] | None = None,
) -> tuple[CurrentUser, Run]:
    user = User(
        email=f"worker-{uuid4().hex[:12]}@test.example",
        full_name="Test Student",
        password_hash="not-a-real-hash",
    )
    session.add(user)
    await session.flush()

    mission = Mission(
        owner_id=user.id,
        title="Research mission",
        objective=objective,
        criteria=criteria or {},
    )
    session.add(mission)
    await session.flush()

    run = Run(mission_id=mission.id, owner_id=user.id, status="queued", phase="queued")
    session.add(run)
    await session.commit()

    owner = CurrentUser(
        id=user.id,
        email=user.email,
        email_verified=True,
        full_name=user.full_name,
    )
    return owner, run


async def _seed_opportunity(session: AsyncSession, *, iso2: str, name: str, url: str) -> str:
    opportunity = Opportunity(
        title=f"{name} research fellowship",
        institution="Test Institute",
        type="fellowship",
        country={"iso2": iso2, "name": name, "region": "test-region"},
        source_domain="programs.example",
        canonical_url=url,
        funding={"coverage": "fully_funded"},
        requirements=[],
    )
    session.add(opportunity)
    await session.flush()
    return opportunity.id


async def _event_types(session: AsyncSession, run_id: str) -> list[str]:
    rows = (
        (
            await session.execute(
                select(RunEvent).where(RunEvent.run_id == run_id).order_by(RunEvent.created_at)
            )
        )
        .scalars()
        .all()
    )
    return [row.type for row in rows]


async def _event_data(session: AsyncSession, run_id: str, event_type: str) -> dict[str, Any]:
    row = (
        (
            await session.execute(
                select(RunEvent)
                .where(RunEvent.run_id == run_id, RunEvent.type == event_type)
                .order_by(RunEvent.created_at)
            )
        )
        .scalars()
        .first()
    )
    assert row is not None, f"no {event_type} event on the timeline"
    return dict(row.data or {})


async def _settled(session: AsyncSession, run: Run) -> Run:
    """The run as the database has it, after a worker pass elsewhere."""
    await session.refresh(run)
    return run


# --------------------------------------------------------------------- #
# The walk                                                               #
# --------------------------------------------------------------------- #


async def test_a_queued_run_is_walked_to_completion(database: None) -> None:
    """One claim walks every stage and hands the lease back."""
    _alias_replay_search()
    async with session_factory() as session:
        owner, run = await _seed_run(session)

        worked = await run_once(worker_id="worker-a", settings=_replay_settings())
        assert worked is True

        run = await _settled(session, run)
        assert run.status == "completed"
        assert run.phase == "done"
        assert run.claimed_by is None
        assert run.lease_expires_at is None
        assert run.error is None
        assert run.finished_at is not None
        assert run.started_at is not None
        assert run.attempt == 1

        assert run.summary == {
            "sourcesReviewed": 1,
            "candidatesFound": 0,
            "needingVerification": 0,
            "unreachable": 0,
        }

        budget = dict(run.budget or {})
        assert budget["modelCalls"] == 3
        assert budget["searchCalls"] == 1
        assert budget["fetchedSources"] == 1
        assert int(budget.get("elapsedSeconds", -1)) >= 0

        checkpoint = dict(run.checkpoint or {})
        assert checkpoint.get("stage") == "done"
        assert checkpoint.get("queries") == [PLAN_OBJECTIVE]

        types = await _event_types(session, run.id)
        expected = [
            "run.started",
            "understanding.started",
            "understanding.completed",
            "search.started",
            "search.completed",
            "requirements.extracted",
            "eligibility.evaluated",
            "run.completed",
        ]
        for event_type in expected:
            assert types.count(event_type) == 1, types
        assert len([t for t in types if t.startswith("source.retrieved:")]) == 1
        assert len(types) == len(expected) + 1
        assert "profile.needs_confirmation" not in types
        assert "provider.warning" not in types

        first = {name: types.index(name) for name in expected}
        assert (
            first["run.started"]
            < first["understanding.completed"]
            < first["search.started"]
            < first["search.completed"]
            < first["requirements.extracted"]
            < first["eligibility.evaluated"]
            < first["run.completed"]
        )

        completed = await _event_data(session, run.id, "run.completed")
        assert completed["sourcesReviewed"] == 1

        # A finished run ignores the control endpoints and gains no events.
        before = len(types)
        paused = await pause_run(run.id, user=owner, session=session)
        resumed = await resume_run(run.id, user=owner, session=session)
        retried = await retry_run(run.id, user=owner, session=session)
        assert paused.status == "completed"
        assert resumed.status == "completed"
        assert retried.status == "completed"
        await session.commit()
        assert len(await _event_types(session, run.id)) == before


# --------------------------------------------------------------------- #
# Failure and retry                                                      #
# --------------------------------------------------------------------- #


async def test_a_failed_stage_becomes_partial_and_the_retry_finishes(
    database: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A typed provider failure stops the run, and the retry resumes."""
    _alias_replay_search()
    async with session_factory() as session:
        owner, run = await _seed_run(session)

        original = matching_module.ConfirmedProfileMatchingStage
        state = {"failed": False}

        class FailingOnce(original):  # type: ignore[misc, valid-type]
            async def run(self, payload: dict[str, Any]) -> dict[str, Any]:
                if not state["failed"]:
                    state["failed"] = True
                    raise ProviderError(
                        "The matching service timed out.",
                        code="UPSTREAM_TIMEOUT",
                        retryable=True,
                    )
                return await super().run(payload)

        monkeypatch.setattr(matching_module, "ConfirmedProfileMatchingStage", FailingOnce)

        assert await run_once(worker_id="worker-a", settings=_replay_settings())

        run = await _settled(session, run)
        assert run.status == "partial"
        assert run.error == {
            "code": "UPSTREAM_TIMEOUT",
            "message": "The matching service timed out.",
            "retryable": True,
        }
        assert run.claimed_by is None
        assert run.finished_at is not None
        assert dict(run.checkpoint or {}).get("stage") == "matching"
        assert run.attempt == 1

        types = await _event_types(session, run.id)
        assert "run.partial" in types
        assert "eligibility.evaluated" not in types
        assert "run.completed" not in types
        assert types.count("understanding.started") == 1
        assert types.count("search.started") == 1

        retried = await retry_run(run.id, user=owner, session=session)
        assert retried.status == "queued"
        assert retried.error is None
        await session.commit()
        run = await _settled(session, run)
        assert run.status == "queued"

        monkeypatch.setattr(matching_module, "ConfirmedProfileMatchingStage", original)
        assert await run_once(worker_id="worker-b", settings=_replay_settings())

        run = await _settled(session, run)
        assert run.status == "completed"
        assert run.phase == "done"
        assert run.error is None
        assert run.claimed_by is None
        assert run.attempt == 2
        assert dict(run.checkpoint or {}).get("stage") == "done"
        assert run.summary is not None
        assert run.summary.get("candidatesFound") == 0

        types = await _event_types(session, run.id)
        # The retry re-enters at the checkpoint: nothing already on the
        # timeline is written a second time.
        assert types.count("understanding.started") == 1
        assert types.count("understanding.completed") == 1
        assert types.count("search.started") == 1
        assert types.count("search.completed") == 1
        assert types.count("requirements.extracted") == 1
        assert types.count("run.partial") == 1
        assert types.count("run.retried") == 1
        assert types.count("run.completed") == 1
        assert types.count("eligibility.evaluated") == 1
        assert len([t for t in types if t.startswith("source.retrieved:")]) == 1


# --------------------------------------------------------------------- #
# Pause and resume                                                       #
# --------------------------------------------------------------------- #


async def test_a_pause_stops_the_walk_and_a_resume_finishes_it(
    database: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The worker releases the lease at the checkpoint and resumes there."""
    _alias_replay_search()
    async with session_factory() as session:
        owner, run = await _seed_run(session)

        original = mission_module.MissionInterpretationStage

        class PausingDuringPlanning(original):  # type: ignore[misc, valid-type]
            async def run(self, payload: dict[str, Any]) -> Any:
                outcome = await super().run(payload)
                async with session_factory() as control:
                    paused = await pause_run(run.id, user=owner, session=control)
                    assert paused.status == "paused"
                return outcome

        monkeypatch.setattr(mission_module, "MissionInterpretationStage", PausingDuringPlanning)

        assert await run_once(worker_id="worker-a", settings=_replay_settings())

        run = await _settled(session, run)
        assert run.status == "paused"
        assert run.claimed_by is None
        assert run.lease_expires_at is None
        checkpoint = dict(run.checkpoint or {})
        assert checkpoint.get("stage") == "searching"
        assert "understanding.completed" in checkpoint.get("emitted", [])

        types = await _event_types(session, run.id)
        # The pause lands while the plan is still being interpreted, so
        # `run.paused` is written before the plan-built event — that is
        # the order things actually happened in.
        assert sorted(types) == sorted(
            [
                "run.started",
                "understanding.started",
                "understanding.completed",
                "run.paused",
            ]
        )
        assert types.index("run.paused") > types.index("understanding.started")
        assert "search.started" not in types
        assert "run.completed" not in types

        resumed = await resume_run(run.id, user=owner, session=session)
        assert resumed.status == "queued"
        await session.commit()

        monkeypatch.setattr(mission_module, "MissionInterpretationStage", original)
        assert await run_once(worker_id="worker-b", settings=_replay_settings())

        run = await _settled(session, run)
        assert run.status == "completed"
        assert run.phase == "done"
        assert run.claimed_by is None
        assert run.attempt == 2

        types = await _event_types(session, run.id)
        expected = [
            "run.started",
            "understanding.started",
            "understanding.completed",
            "run.paused",
            "run.resumed",
            "search.started",
            "search.completed",
            "requirements.extracted",
            "eligibility.evaluated",
            "run.completed",
        ]
        for event_type in expected:
            assert types.count(event_type) == 1, types
        assert len([t for t in types if t.startswith("source.retrieved:")]) == 1
        assert len(types) == len(expected) + 1

        # The paused checkpoint decides the resume: no stage before
        # searching runs again, so its events stay single.
        assert types.index("run.resumed") > types.index("run.paused")
        assert types.index("search.started") > types.index("run.resumed")
        assert types.index("run.completed") == len(types) - 1


# --------------------------------------------------------------------- #
# The lease                                                              #
# --------------------------------------------------------------------- #


async def test_the_claim_is_an_exclusive_lease(database: None) -> None:
    """One worker at a time; an expired lease can be taken back."""
    async with session_factory() as session:
        _, _run = await _seed_run(session)

        first = await claim_run_for(session, worker_id="worker-a")
        assert first is not None
        assert first.claimed_by == "worker-a"
        assert first.started_at is not None
        first_started_at = first.started_at

        # A live lease belongs to the worker holding it.
        assert await claim_run_for(session, worker_id="worker-b") is None

        # A worker that died leaves an expired lease: claimable again.
        first.lease_expires_at = datetime.now(UTC) - timedelta(seconds=120)
        await session.commit()
        second = await claim_run_for(session, worker_id="worker-b")
        assert second is not None
        assert second.claimed_by == "worker-b"
        assert second.attempt == 2
        # The start time is the *first* claim, not every reclaim.
        assert second.started_at == first_started_at

        # A paused run, a cancelled run and a finished run are not claimable.
        second.status = "paused"
        await session.commit()
        assert await claim_run_for(session, worker_id="worker-a") is None

        second.status = "cancelled"
        await session.commit()
        assert await claim_run_for(session, worker_id="worker-a") is None

        second.status = "completed"
        await session.commit()
        assert await claim_run_for(session, worker_id="worker-a") is None


async def claim_run_for(session: AsyncSession, *, worker_id: str) -> Run | None:
    return await claim_run(session, worker_id=worker_id, lease_seconds=60)


# --------------------------------------------------------------------- #
# §11.5 — the criteria decide                                            #
# --------------------------------------------------------------------- #


def test_the_countries_change_the_query() -> None:
    canada = worker.build_search_queries("Research fellowships", {"destinationCountries": ["CA"]})
    germany = worker.build_search_queries("Research fellowships", {"destinationCountries": ["DE"]})

    assert canada != germany
    assert "Canada" in canada[0]
    assert "Germany" in germany[0]

    # One query per country, in the student's order.
    both = worker.build_search_queries(
        "Research fellowships", {"destinationCountries": ["DE", "CA"]}
    )
    assert len(both) == 2
    assert "Germany" in both[0]
    assert "Canada" in both[1]

    # Regions rather than countries: one scoped query.
    regional = worker.build_search_queries("Research fellowships", {"destinations": ["Europe"]})
    assert len(regional) == 1
    assert "Europe" in regional[0]


def test_the_criteria_decide_which_opportunities_are_candidates() -> None:
    canada = {
        "type": "fellowship",
        "country": {"iso2": "CA", "name": "Canada"},
        "funding": {"coverage": "fully_funded"},
    }
    germany = {
        "type": "fellowship",
        "country": {"iso2": "DE", "name": "Germany"},
        "funding": {"coverage": "fully_funded"},
    }
    partial = {
        "type": "fellowship",
        "country": {"iso2": "CA", "name": "Canada"},
        "funding": {"coverage": "partial"},
    }

    criteria = {"destinationCountries": ["CA"], "fundingPreference": "fully_funded"}
    assert worker.in_scope(canada, criteria)
    assert not worker.in_scope(germany, criteria)
    assert not worker.in_scope(partial, criteria)

    # With no criteria nothing is filtered out silently.
    assert worker.in_scope(germany, {})


async def test_the_criteria_narrow_the_run_s_candidates(database: None) -> None:
    """The country list decides which opportunities reach the assessment."""
    async with session_factory() as session:
        canada_id = await _seed_opportunity(
            session, iso2="CA", name="Canada", url="https://ca.example/call"
        )
        germany_id = await _seed_opportunity(
            session, iso2="DE", name="Germany", url="https://de.example/call"
        )

        _, canada_run = await _seed_run(
            session,
            criteria={
                "destinationCountries": ["CA"],
                "opportunityTypes": ["fellowship"],
                "fundingPreference": "fully_funded",
            },
        )
        _, germany_run = await _seed_run(
            session,
            criteria={
                "destinationCountries": ["DE"],
                "opportunityTypes": ["fellowship"],
                "fundingPreference": "fully_funded",
            },
        )

        assert await run_once(worker_id="worker-a", settings=_replay_settings())
        assert await run_once(worker_id="worker-a", settings=_replay_settings())

        canada_run = await _settled(session, canada_run)
        germany_run = await _settled(session, germany_run)
        assert canada_run.status == "completed"
        assert germany_run.status == "completed"

        canada_ids = dict(canada_run.checkpoint or {}).get("assessment", {}).get("candidateIds")
        germany_ids = dict(germany_run.checkpoint or {}).get("assessment", {}).get("candidateIds")

        assert canada_ids == [canada_id]
        assert germany_ids == [germany_id]
        assert canada_ids != germany_ids

        # The queries carry the country too — one per country, so a
        # different set searches differently.
        canada_queries = dict(canada_run.checkpoint or {}).get("queries", [])
        germany_queries = dict(germany_run.checkpoint or {}).get("queries", [])
        assert canada_queries != germany_queries
        assert any("Canada" in query for query in canada_queries)
        assert any("Germany" in query for query in germany_queries)
