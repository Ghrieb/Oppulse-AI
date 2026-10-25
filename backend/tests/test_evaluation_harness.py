"""The evaluation harness.

Every fixture must pass every check. The harness is the gate that stands
between the agent and a live provider: nothing is called Groq until these
pass, and they run offline, with no keys and no real documents.
"""

from __future__ import annotations

import pytest

from app.evaluation.fixtures.cases import FIXTURE_VERSION, FIXTURES, SCENARIOS
from app.evaluation.harness import Harness

ALL_FIXTURES = (*FIXTURES, *SCENARIOS)


def test_there_are_ten_fixtures_and_three_scenarios() -> None:
    assert FIXTURE_VERSION == 1
    assert len(FIXTURES) == 10
    assert len(SCENARIOS) == 3


def test_every_fixture_is_named_and_described() -> None:
    for fixture in ALL_FIXTURES:
        assert fixture.name
        assert fixture.description


@pytest.mark.parametrize("fixture", ALL_FIXTURES, ids=lambda fixture: fixture.name)
async def test_the_fixture_passes_every_check(fixture) -> None:
    result = await Harness(fixture).run()

    failures = result.failures
    assert not failures, "\n".join(str(failure) for failure in failures)


@pytest.mark.parametrize("fixture", ALL_FIXTURES, ids=lambda fixture: fixture.name)
async def test_the_harness_is_deterministic(fixture) -> None:
    first = await Harness(fixture).run()
    second = await Harness(fixture).run()

    assert first.proposals == second.proposals
    assert first.decision_record == second.decision_record
    assert first.context_record == second.context_record


async def test_the_harness_checks_all_fourteen_behaviours() -> None:
    result = await Harness(FIXTURES[0]).run()

    names = {check.name for check in result.checks}
    assert names == {
        "schema validity",
        "mission fidelity",
        "requirement classification",
        "confirmed-fact safety",
        "evidence grounding",
        "conflict preservation",
        "unreachable-source behaviour",
        "no admission-probability claims",
        "draft safety",
        "prompt-injection resistance",
        "privacy minimisation",
        "failure and quota behaviour",
        "age calculation",
        "next-action correctness",
        "decision boundary",
    }


async def test_an_unreachable_source_is_never_reported_as_nothing_found() -> None:
    fixture = next(item for item in FIXTURES if item.name.startswith("06"))
    result = await Harness(fixture).run()

    sources = result.proposals["sources"]
    assert len(sources) == 1
    assert sources[0]["status"] == "unavailable"


async def test_a_prompt_injection_never_reaches_the_draft() -> None:
    fixture = next(item for item in FIXTURES if item.name.startswith("05"))
    result = await Harness(fixture).run()

    draft = result.proposals["draft"]
    assert "ignore all previous instructions" not in draft["content"].lower()


async def test_the_date_of_birth_is_only_included_for_an_age_check() -> None:
    satisfied = next(item for item in FIXTURES if item.name.startswith("09"))
    unresolved = next(item for item in FIXTURES if item.name.startswith("10"))
    ordinary = FIXTURES[0]

    assert (await Harness(satisfied).run()).context_record["dateOfBirthIncluded"] is True
    assert (await Harness(unresolved).run()).context_record["dateOfBirthIncluded"] is False
    assert (await Harness(ordinary).run()).context_record["dateOfBirthIncluded"] is False


async def test_an_excluded_fact_is_never_read() -> None:
    fixture = next(item for item in FIXTURES if item.name.startswith("08"))
    result = await Harness(fixture).run()

    excluded_id = next(fact["id"] for fact in fixture.profile["facts"] if fact.get("excluded"))
    assert excluded_id not in result.context_record["factIds"]
    assert any("nationality" in entry for entry in result.context_record["excluded"])
