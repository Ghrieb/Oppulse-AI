"""The answer blocks.

The union is checked on both sides: the service validates every block it
produces, and the interface renders every kind the contract can produce.
A test here says so, because the ``institution`` block once existed in the
contract and in the service while the interface quietly dropped it into its
"format I do not display yet" fallback.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.ai.types import (
    AssistantBlockAdapter,
    EvidenceBlock,
    InstitutionBlock,
    MediaContextBlock,
    UnknownOrConflictBlock,
)


def test_every_kind_of_the_union_is_accepted() -> None:
    cases = [
        {"kind": "text", "text": "Here is the answer."},
        {
            "kind": "evidence",
            "title": "The call",
            "summary": "It says so.",
            "sources": [
                {
                    "title": "The call",
                    "url": "https://example.edu/call",
                    "quote": "It says so.",
                    "quality": "official",
                }
            ],
            "requirementId": None,
        },
        {
            "kind": "checklist",
            "title": "What it requires",
            "items": [{"label": "A degree", "status": "ready", "detail": None, "route": None}],
        },
        {
            "kind": "draft_action",
            "title": "Start your motivation letter",
            "description": "From your confirmed facts.",
            "draftType": "motivation_letter",
            "applicationId": None,
            "effect": "prepares",
        },
        {
            "kind": "run",
            "runId": "2c000000-0000-4000-8000-000000000001",
            "status": "queued",
            "message": "The run is queued.",
        },
        {
            "kind": "institution",
            "description": "A research institute.",
            "location": "Helios Institute",
            "country": "Netherlands",
            "institutionType": None,
            "programmeContext": None,
            "evidence": [],
            "media": [],
            "unverified": ["How competitive it is."],
            "action": None,
        },
        {
            "kind": "media_context",
            "subject": "What the page shows",
            "media": [
                {
                    "kind": "image",
                    "url": "https://example.edu/media/a.png",
                    "title": "The campus",
                    "publisher": "Example",
                    "publishedAt": None,
                    "sourceType": "official",
                    "attribution": None,
                    "summary": None,
                    "status": "available",
                }
            ],
        },
        {
            "kind": "opportunity_reference",
            "opportunityId": "d4000000-0000-4000-8000-000000000001",
            "title": "A fellowship",
            "institution": "Example",
            "country": "Netherlands",
            "reason": "It is the call the answer is based on.",
        },
        {
            "kind": "unknown_or_conflict",
            "question": "Two sources disagree.",
            "checked": ["The official page"],
            "nextAction": "Check the call.",
            "conflict": True,
        },
        {
            "kind": "action",
            "label": "Open the opportunity",
            "description": None,
            "action": "open_opportunity",
            "payload": {"opportunityId": "d4000000-0000-4000-8000-000000000001"},
            "effect": "prepares",
        },
    ]

    for case in cases:
        block = AssistantBlockAdapter.validate_python(case)
        assert block.kind == case["kind"]


def test_a_malformed_block_is_refused() -> None:
    with pytest.raises(ValidationError):
        AssistantBlockAdapter.validate_python({"kind": "institution"})


def test_an_unknown_kind_is_refused_rather_than_guessed_at() -> None:
    with pytest.raises(ValidationError):
        AssistantBlockAdapter.validate_python({"kind": "something_new", "text": "Hello."})


def test_the_blocks_serialise_in_the_wire_shape() -> None:
    block = AssistantBlockAdapter.validate_python(
        {
            "kind": "opportunity_reference",
            "opportunityId": "d4000000-0000-4000-8000-000000000001",
            "title": "A fellowship",
            "institution": "Example",
            "country": "Netherlands",
            "reason": "It is the call the answer is based on.",
        }
    )

    dumped = block.model_dump(by_alias=True, mode="json")

    assert "opportunityId" in dumped
    assert "opportunity_id" not in dumped


def test_the_media_context_is_secondary_by_default() -> None:
    block = MediaContextBlock(
        subject="What the page shows",
        media=[
            {
                "kind": "image",
                "url": "https://example.edu/a.png",
                "title": "A picture",
                "publisher": "Example",
            }
        ],
    )

    assert block.media[0].source_type == "secondary"
    assert block.media[0].status == "not_reviewed"


def test_an_unknown_block_says_what_was_checked() -> None:
    block = UnknownOrConflictBlock(
        question="Two sources disagree.",
        checked=["The official page", "The directory listing"],
        next_action="Open the call.",
        conflict=True,
    )

    assert block.checked == ["The official page", "The directory listing"]
    assert block.conflict is True


def test_the_institution_block_separates_what_was_stated_from_what_was_not() -> None:
    block = InstitutionBlock(
        description="A research institute.",
        location="Helios Institute",
        country="Netherlands",
        unverified=["How competitive it is."],
    )

    assert block.unverified == ["How competitive it is."]
    assert block.evidence == []


def test_the_evidence_block_keeps_its_sources() -> None:
    block = EvidenceBlock(
        title="The call",
        summary="It says so.",
        sources=[
            {
                "title": "The call",
                "url": "https://example.edu/call",
                "quote": "It says so.",
                "quality": "official",
            }
        ],
    )

    assert block.sources[0].quality == "official"
