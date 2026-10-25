"""Profile completeness.

The port of the frontend's ``lib/completeness.ts``. Not "how much have you
filled in" — how much of what the agent actually needs in order to assess
an application is *confirmed*. A field the student has not confirmed is not
usable, so it does not count.
"""

from __future__ import annotations

from typing import Any

from .matching import REQUIRED_FACT_KEYS, REQUIRED_FACTS

Profile = dict[str, Any]


def compute_completeness(profile: Profile | None) -> dict[str, Any]:
    """What the agent can actually use."""
    facts = (profile or {}).get("facts", [])

    confirmed = sum(
        1
        for key in REQUIRED_FACT_KEYS
        for fact in facts
        if fact.get("key") == key and fact.get("status") == "confirmed" and not fact.get("excluded")
    )

    pending = [
        fact
        for fact in facts
        if fact.get("key") in REQUIRED_FACT_KEYS
        and fact.get("status") != "confirmed"
        and not fact.get("excluded")
    ]

    missing = [
        {
            "key": required["key"],
            "label": required["label"],
            "usedFor": required["usedFor"],
        }
        for required in REQUIRED_FACTS
        if not any(
            fact.get("key") == required["key"] and not fact.get("excluded") for fact in facts
        )
    ]

    required = len(REQUIRED_FACT_KEYS)
    percent = round((confirmed / required) * 100) if required else 0

    if confirmed == required:
        summary = "Everything Oppulse needs to assess an application is confirmed."
    elif pending and missing:
        summary = (
            f"{confirmed} of {required} confirmed. {len(pending)} waiting for you, "
            f"{len(missing)} still missing."
        )
    elif pending:
        summary = (
            f"{confirmed} of {required} confirmed. "
            f"{'one fact is' if len(pending) == 1 else 'facts are'} waiting for you."
        )
    else:
        summary = (
            f"{confirmed} of {required} confirmed. "
            f"{'one thing is' if len(missing) == 1 else 'things are'} still missing."
        )

    return {
        "confirmed": confirmed,
        "required": required,
        "percent": percent,
        "pending": pending,
        "missing": missing,
        "summary": summary,
    }
