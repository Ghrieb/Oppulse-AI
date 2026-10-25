"""The next-best-action derivation.

The port of the frontend's ``lib/next-action.ts``. The workspace shows one
prioritised action at a time, tied to a real blocker, with the reason it
matters and a link to the place where it can be resolved.

The ladder is ordered by how much the action is actually blocking the
student, not by how easy it is to explain.
"""

from __future__ import annotations

from typing import Any

from .ids import deterministic_uuid

Profile = dict[str, Any]
Opportunity = dict[str, Any]
Application = dict[str, Any]
Draft = dict[str, Any]
Source = dict[str, Any]
Alert = dict[str, Any]
Document = dict[str, Any]
NextAction = dict[str, Any]


def _capitalise(value: str) -> str:
    """Capitalises the first character without lower-casing the rest."""
    if not value:
        return value
    return value[0].upper() + value[1:]


def derive_next_action(
    *,
    profile: Profile | None,
    opportunities: list[Opportunity],
    applications: list[Application],
    drafts: list[Draft],
    sources: list[Source],
    alerts: list[Alert],
    documents: list[Document] | None = None,
    now: str,
) -> NextAction | None:
    """Derives the single most useful next action."""
    # 1. An unconfirmed fact is blocking a requirement. Nothing else matters
    #    as much: the answer is wrong until this is settled.
    pending_facts = [
        fact
        for fact in (profile or {}).get("facts", [])
        if fact.get("status") == "proposed" and not fact.get("excluded")
    ]

    if pending_facts:
        # A fact blocks when a requirement that depends on it is unresolved.
        # This is a structural check, not a text match on the warning copy.
        blocking_fact = next(
            (
                fact
                for fact in pending_facts
                if any(
                    requirement.get("profileFactKey") == fact.get("key")
                    and requirement.get("status") == "unresolved"
                    for opportunity in opportunities
                    for requirement in opportunity.get("requirements", [])
                )
            ),
            None,
        )

        if blocking_fact is not None:
            return {
                "id": deterministic_uuid(f"confirm-fact:{blocking_fact.get('id')}"),
                "kind": "confirm_fact",
                "title": f"Confirm your {_capitalise(str(blocking_fact.get('label', '')))}",
                "rationale": (
                    "It is the one thing blocking an eligibility requirement, so every "
                    "assessment stays unresolved until you confirm it."
                ),
                "cta": "Review the fact",
                "route": f"/profile?fact={blocking_fact.get('id')}",
                "priority": 100,
                "blockerId": blocking_fact.get("id"),
                "createdAt": now,
            }

    # 1b. An age rule cannot be checked without the date of birth. It is a
    #     protected attribute rather than a fact, so it gets its own rung —
    #     and the student is told what it is for.
    age_opportunity = next(
        (
            opportunity
            for opportunity in opportunities
            if any(
                requirement.get("kind") == "age" and requirement.get("status") == "unresolved"
                for requirement in opportunity.get("requirements", [])
            )
        ),
        None,
    )

    if age_opportunity is not None:
        age_requirement = next(
            (
                requirement
                for requirement in age_opportunity.get("requirements", [])
                if requirement.get("kind") == "age" and requirement.get("status") == "unresolved"
            ),
            None,
        )

        return {
            "id": deterministic_uuid(
                f"age:{age_requirement.get('id') if age_requirement else age_opportunity.get('id')}"
            ),
            "kind": "confirm_fact",
            "title": "Add your date of birth",
            "rationale": (
                f"The {age_opportunity.get('title')} call has an age rule, and it cannot be "
                "checked without your date of birth. It stays private, and you can remove it "
                "at any time."
            ),
            "cta": "Add it in your passport",
            "route": "/profile?section=protected",
            "priority": 95,
            "blockerId": age_requirement.get("id") if age_requirement else None,
            "createdAt": now,
        }

    # 1c. A requirement depends on a fact the student has not provided. It
    #     stays unresolved until they add it, so it is a real blocker.
    known_fact_keys = {str(fact.get("key")) for fact in (profile or {}).get("facts", [])}

    def _missing_fact_requirement(opportunity: Opportunity) -> dict[str, Any] | None:
        return next(
            (
                requirement
                for requirement in opportunity.get("requirements", [])
                if requirement.get("profileFactKey")
                and requirement.get("status") == "unresolved"
                and str(requirement.get("profileFactKey")) not in known_fact_keys
            ),
            None,
        )

    missing_fact_opportunity = next(
        (
            opportunity
            for opportunity in opportunities
            if _missing_fact_requirement(opportunity) is not None
        ),
        None,
    )

    if missing_fact_opportunity is not None:
        missing_requirement = _missing_fact_requirement(missing_fact_opportunity)

        blocker_id = (
            missing_requirement.get("id")
            if missing_requirement
            else missing_fact_opportunity.get("id")
        )
        label = (
            missing_requirement.get("label", "missing detail")
            if missing_requirement
            else "missing detail"
        )

        return {
            "id": deterministic_uuid(f"missing-fact:{blocker_id}"),
            "kind": "confirm_fact",
            "title": f"Add your {label}",
            "rationale": (
                "This requirement is decided by something you have not told us yet, so it "
                "stays unresolved until you add it."
            ),
            "cta": "Add it in your passport",
            "route": "/profile",
            "priority": 92,
            "blockerId": missing_requirement.get("id") if missing_requirement else None,
            "createdAt": now,
        }

    # 1d. A document the agent could not read. The part that was unread is
    #     an unresolved requirement, not a gap in the student's profile.
    unread_document = next(
        (
            document
            for document in (documents or [])
            if document.get("status") in {"partial", "failed"}
        ),
        None,
    )

    if unread_document is not None:
        return {
            "id": deterministic_uuid(f"document-unread:{unread_document.get('id')}"),
            "kind": "complete_document",
            "title": f"Upload {unread_document.get('filename')} again",
            "rationale": (
                "Part of that document could not be read, so anything it says about you is "
                "still unknown."
            ),
            "cta": "Open your documents",
            "route": "/documents",
            "priority": 94,
            "blockerId": unread_document.get("id"),
            "createdAt": now,
        }

    # 2. A deadline conflict means the application date is not yet known.
    conflicting = next(
        (
            opportunity
            for opportunity in opportunities
            if opportunity.get("deadline", {}).get("status") == "conflict"
            and not opportunity.get("dismissed")
        ),
        None,
    )

    if conflicting is not None:
        return {
            "id": deterministic_uuid(f"conflict:{conflicting.get('id')}"),
            "kind": "resolve_conflict",
            "title": f"Two sources disagree on the {conflicting.get('title')} deadline",
            "rationale": (
                "Until the official date is confirmed, the application window cannot be "
                "planned around."
            ),
            "cta": "Review the conflict",
            "route": f"/opportunities/{conflicting.get('id')}",
            "priority": 90,
            "blockerId": conflicting.get("id"),
            "createdAt": now,
        }

    # 3. A source we could not reach means part of the assessment is missing.
    unreachable = next(
        (source for source in sources if source.get("status") == "unavailable"), None
    )
    unreachable_opportunity = (
        next(
            (
                opportunity
                for opportunity in opportunities
                if opportunity.get("sourceDomain") == unreachable.get("domain")
                and not opportunity.get("dismissed")
            ),
            None,
        )
        if unreachable
        else None
    )

    if unreachable is not None and unreachable_opportunity is not None:
        return {
            "id": deterministic_uuid(f"source:{unreachable.get('id')}"),
            "kind": "check_source",
            "title": f"We could not reach the source for {unreachable_opportunity.get('title')}",
            "rationale": (
                "Nothing from that page has been verified, so its deadline and funding are "
                "unknown rather than absent."
            ),
            "cta": "See what is missing",
            "route": f"/opportunities/{unreachable_opportunity.get('id')}",
            "priority": 70,
            "blockerId": unreachable.get("id"),
            "createdAt": now,
        }

    # 4. A document a live application still needs.
    application_with_missing = next(
        (
            application
            for application in applications
            if any(
                item.get("status") == "missing" and item.get("documentId") is None
                for item in application.get("checklist", [])
            )
        ),
        None,
    )

    if application_with_missing is not None:
        missing = next(
            (
                item
                for item in application_with_missing.get("checklist", [])
                if item.get("status") == "missing" and item.get("documentId") is None
            ),
            None,
        )
        missing_id = missing.get("id") if missing else "unknown"

        return {
            "id": deterministic_uuid(f"document:{application_with_missing.get('id')}:{missing_id}"),
            "kind": "complete_document",
            "title": (
                f"Upload the document {application_with_missing.get('opportunityTitle')} needs"
            ),
            "rationale": (missing.get("note") if missing else None)
            or "This requirement is on the checklist and still missing.",
            "cta": "Open the checklist",
            "route": f"/applications/{application_with_missing.get('id')}",
            "priority": 60,
            "blockerId": missing.get("id") if missing else None,
            "createdAt": now,
        }

    # 5. A draft the student has not reviewed yet.
    draft_with_proposal = next((draft for draft in drafts if draft.get("pendingProposal")), None)

    if draft_with_proposal is not None and draft_with_proposal.get("pendingProposal"):
        proposal = draft_with_proposal["pendingProposal"]
        return {
            "id": deterministic_uuid(f"proposal:{proposal.get('id')}"),
            "kind": "review_proposal",
            "title": (
                "Review the proposed revision to your "
                f"{str(draft_with_proposal.get('title', '')).lower()}"
            ),
            "rationale": (
                "The assistant has drafted a change but nothing has been applied to your "
                "document yet."
            ),
            "cta": "Review the diff",
            "route": f"/writing/{draft_with_proposal.get('id')}",
            "priority": 50,
            "blockerId": proposal.get("id"),
            "createdAt": now,
        }

    # 6. An application whose requirements are all ready.
    ready_application = next(
        (
            application
            for application in applications
            if application.get("completion", {}).get("total", 0) > 0
            and application.get("completion", {}).get("completed")
            == application.get("completion", {}).get("total")
            and application.get("status") == "preparing"
        ),
        None,
    )

    if ready_application is not None:
        return {
            "id": deterministic_uuid(f"submit:{ready_application.get('id')}"),
            "kind": "finish_draft",
            "title": (
                f"Every requirement for {ready_application.get('opportunityTitle')} is ready"
            ),
            "rationale": (
                "The checklist is complete, so this application is ready for a final read."
            ),
            "cta": "Open the application",
            "route": f"/applications/{ready_application.get('id')}",
            "priority": 40,
            "blockerId": ready_application.get("id"),
            "createdAt": now,
        }

    # 7. An unread alert.
    unread_alert = next((alert for alert in alerts if not alert.get("read")), None)

    if unread_alert is not None:
        return {
            "id": deterministic_uuid(f"alert:{unread_alert.get('id')}"),
            "kind": "check_source",
            "title": unread_alert.get("title"),
            "rationale": unread_alert.get("body"),
            "cta": "Read the alert",
            "route": "/monitoring",
            "priority": 30,
            "blockerId": unread_alert.get("id"),
            "createdAt": now,
        }

    return None
