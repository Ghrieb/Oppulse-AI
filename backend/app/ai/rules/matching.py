"""The eligibility rule engine.

The port of the frontend's ``lib/matching.ts``. The agent proposes a
requirement; a deterministic check decides it. That split is what makes an
eligibility answer explainable and reproducible: the same confirmed facts
always produce the same verdict, and the verdict can always be traced to
the fact that produced it.

The functions here take and return the *contract shapes* — plain
dictionaries — so a database row can be passed straight in and the result
can be stored straight back.
"""

from __future__ import annotations

import re
from typing import Any

#: The facts the agent genuinely needs in order to assess an application.
REQUIRED_FACT_KEYS: tuple[str, ...] = (
    "degree_level",
    "field",
    "graduation_year",
    "nationality",
    "english_level",
    "skills",
)

#: What each required fact is for, in plain language.
REQUIRED_FACTS: tuple[dict[str, str], ...] = (
    {
        "key": "degree_level",
        "label": "Current degree level",
        "usedFor": "Decides which programme types you are eligible for.",
    },
    {
        "key": "field",
        "label": "Field of study",
        "usedFor": (
            "Matches you against each programme’s research area and technical requirements."
        ),
    },
    {
        "key": "graduation_year",
        "label": "Expected graduation",
        "usedFor": "Checks that your degree is complete in time for the programme start.",
    },
    {
        "key": "nationality",
        "label": "Nationality",
        "usedFor": "Checks the nationality and residency clauses in each call.",
    },
    {
        "key": "english_level",
        "label": "English proficiency",
        "usedFor": "Assesses the language requirement in each call.",
    },
    {
        "key": "skills",
        "label": "Technical skills",
        "usedFor": "Checks the software and method requirements a call lists.",
    },
)

Fact = dict[str, Any]
Requirement = dict[str, Any]
Profile = dict[str, Any]
ProtectedProfile = dict[str, Any]
Opportunity = dict[str, Any]
Match = dict[str, Any]


def _find_fact(profile: Profile | None, key: str) -> Fact | None:
    if not profile:
        return None
    facts: list[Fact] = profile.get("facts", [])
    for fact in facts:
        if fact.get("key") == key:
            return fact
    return None


def _source_name(fact: Fact) -> str | None:
    source = fact.get("source")
    if not isinstance(source, dict):
        return None
    name = source.get("documentName")
    return name if isinstance(name, str) else None


def _run_check(check: dict[str, Any], fact: Fact) -> str:
    """The three deterministic comparisons."""
    kind = check.get("kind")

    if kind == "present":
        return "met" if str(fact.get("value", "")).strip() else "not_met"

    if kind == "at_least":
        numeric = fact.get("numericValue")
        if numeric is None:
            return "not_met"
        return "met" if float(numeric) >= float(check.get("value", 0)) else "not_met"

    if kind == "in_list":
        code = fact.get("code")
        if not code:
            return "not_met"
        accepted = check.get("values") or []
        return "met" if code in accepted else "not_met"

    return "not_met"


# --------------------------------------------------------------------- #
# Age                                                                     #
# --------------------------------------------------------------------- #

DateParts = tuple[int, int, int]


def _parse_calendar_date(value: str) -> DateParts | None:
    """Parses ``YYYY-MM-DD`` as a plain calendar date.

    The parts are read as UTC so that a timezone never shifts a birthday by
    a day, and a round trip rejects 31 February.
    """
    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", value.strip())
    if not match:
        return None

    year, month, day = (int(part) for part in match.groups())
    if not 1 <= month <= 12 or not 1 <= day <= 31:
        return None

    import datetime

    try:
        date = datetime.date(year, month, day)
    except ValueError:
        return None

    if (date.year, date.month, date.day) != (year, month, day):
        return None

    return year, month, day


def age_on(date_of_birth: str, on_date: str) -> int | None:
    """The age of a person on a given date.

    It is not "this year minus the birth year": the birthday has to have
    happened. A student who turns 18 in September is 17 on 1 July.
    """
    birth = _parse_calendar_date(date_of_birth)
    on = _parse_calendar_date(on_date)
    if birth is None or on is None:
        return None

    age = on[0] - birth[0]
    if (on[1], on[2]) < (birth[1], birth[2]):
        age -= 1

    return None if age < 0 else age


def evaluate_age_rule(age: int, rule: dict[str, Any]) -> str:
    """Compares an age against an official rule.

    The rule is always expressed in years, and always measured on the date
    the source states.
    """
    kind = rule.get("kind")
    minimum = rule.get("minAge")
    maximum = rule.get("maxAge")

    if kind == "min_age":
        return "satisfied" if minimum is not None and age >= minimum else "not_satisfied"

    if kind == "max_age":
        return "satisfied" if maximum is not None and age <= maximum else "not_satisfied"

    if kind == "age_range":
        above_minimum = minimum is None or age >= minimum
        below_maximum = maximum is None or age <= maximum
        return "satisfied" if above_minimum and below_maximum else "not_satisfied"

    return "not_satisfied"


def evaluate_age_requirement(
    date_of_birth: str | None, rule: dict[str, Any] | None
) -> dict[str, Any]:
    """Resolves an age requirement.

    The date of birth is only used here, and only when the student allowed
    it. The result is an outcome — "appears satisfied", "unresolved" — never
    the date itself, so the answer can be shown anywhere without leaking it.
    """
    if not rule:
        return {
            "status": "unresolved",
            "age": None,
            "summary": "This call states an age condition, but the rule has not been read yet.",
        }

    if rule.get("verification") == "conflicting":
        return {
            "status": "conflicting",
            "age": None,
            "summary": (
                "Two sources state different age rules, so this one needs your review. "
                f"The rule from {rule.get('sourceTitle', 'the official call')} is shown here."
            ),
        }

    if not date_of_birth:
        return {
            "status": "unresolved",
            "age": None,
            "summary": (
                "Your date of birth is not available, so this age requirement stays unresolved. "
                "You can add it in your passport."
            ),
        }

    age = age_on(date_of_birth, str(rule.get("eligibilityDate", "")))
    if age is None:
        return {
            "status": "unresolved",
            "age": None,
            "summary": (
                "Your date of birth could not be read, so this age requirement stays unresolved."
            ),
        }

    verdict = evaluate_age_rule(age, rule)

    if rule.get("verification") == "needs_verification":
        return {
            "status": "unresolved",
            "age": age,
            "summary": (
                f"The official cutoff in {rule.get('sourceTitle', 'the official call')} "
                "still needs verification, so this age requirement stays unresolved."
            ),
        }

    source = rule.get("sourceTitle", "the official call")
    measured_on = rule.get("eligibilityDate", "the eligibility date")

    if verdict == "satisfied":
        summary = (
            "The age requirement appears satisfied. "
            f"The rule is from {source}, measured on {measured_on}."
        )
    else:
        summary = (
            "The age requirement is not satisfied by the rule in "
            f"{source}, measured on {measured_on}."
        )

    return {
        "status": "satisfied" if verdict == "satisfied" else "not_satisfied",
        "age": age,
        "summary": summary,
    }


# --------------------------------------------------------------------- #
# Requirements                                                            #
# --------------------------------------------------------------------- #


def evaluate_requirement(
    requirement: Requirement,
    profile: Profile | None,
    protected_profile: ProtectedProfile | None = None,
) -> Requirement:
    """Decides one requirement against the confirmed profile.

    A requirement with no check keeps the status the agent recorded — some
    conditions (visa sponsorship, supervisor contact) are reasoned, not
    computed. An age requirement is decided by the typed age service, never
    by a fact and never by the model.
    """
    if requirement.get("kind") == "age":
        date_of_birth: str | None = None
        if protected_profile:
            excluded = bool(
                protected_profile.get("dateOfBirth", {}).get("excludedFromAiContext", False)
            )
            if not excluded:
                raw = protected_profile.get("dateOfBirth", {}).get("value")
                date_of_birth = raw if isinstance(raw, str) else None

        result = evaluate_age_requirement(date_of_birth, requirement.get("ageRule"))
        status = result["status"]

        return {
            **requirement,
            "status": (
                "likely"
                if status == "satisfied"
                else "ineligible"
                if status == "not_satisfied"
                else "unresolved"
            ),
            "explanation": result["summary"],
        }

    check = requirement.get("check")
    if not check:
        return requirement

    fact = _find_fact(profile, str(check.get("factKey", "")))

    if fact is None:
        return {
            **requirement,
            "status": "unresolved",
            "explanation": (
                f"Oppulse has no {str(requirement.get('label', '')).lower()} for you yet, "
                "so it cannot check this requirement."
            ),
        }

    if fact.get("excluded"):
        return {
            **requirement,
            "status": "unresolved",
            "explanation": (
                f"You excluded your {str(fact.get('label', '')).lower()} from AI use, "
                "so this requirement is not being checked."
            ),
        }

    if fact.get("status") != "confirmed":
        from_source = _source_name(fact)
        label = str(fact.get("label", "")).lower()
        explanation = (
            f"Your {label} was extracted from {from_source} but you have not confirmed it, "
            "so this requirement stays unresolved."
            if from_source
            else f"Your {label} has not been confirmed, so this requirement stays unresolved."
        )
        return {**requirement, "status": "unresolved", "explanation": explanation}

    verdict = _run_check(check, fact)
    label = str(fact.get("label", "")).lower()
    value = str(fact.get("value", ""))

    if verdict == "met":
        return {
            **requirement,
            "status": "likely",
            "explanation": f"Your confirmed {label} — {value} — satisfies this requirement.",
        }

    return {
        **requirement,
        "status": "ineligible",
        "explanation": f"Your confirmed {label} — {value} — does not meet this requirement.",
    }


def recompute_opportunity(
    opportunity: Opportunity,
    profile: Profile | None,
    protected_profile: ProtectedProfile | None = None,
) -> Opportunity:
    """Re-evaluates every requirement of an opportunity."""
    return {
        **opportunity,
        "requirements": [
            evaluate_requirement(requirement, profile, protected_profile)
            for requirement in opportunity.get("requirements", [])
        ],
    }


def recompute_match(match: Match, opportunity: Opportunity) -> Match:
    """Recomputes the assessment of one opportunity.

    The reasons the agent gives are kept — they are the narrative — while
    the warnings are rebuilt from the requirements, so a card can never
    claim "eligible" while a requirement is still unresolved.
    """
    requirements = opportunity.get("requirements", [])

    unresolved = [
        requirement
        for requirement in requirements
        if requirement.get("status") == "unresolved" and requirement.get("blocking")
    ]
    non_blocking_unresolved = [
        requirement
        for requirement in requirements
        if requirement.get("status") == "unresolved" and not requirement.get("blocking")
    ]
    ineligible = [
        requirement for requirement in requirements if requirement.get("status") == "ineligible"
    ]

    decided = len(requirements) - len(unresolved) - len(ineligible)

    if ineligible:
        eligibility = "ineligible"
    elif unresolved:
        eligibility = "unresolved"
    else:
        eligibility = "likely"

    warnings = [
        f"{requirement.get('label')}: {requirement.get('explanation')}"
        for requirement in [*unresolved, *non_blocking_unresolved, *ineligible]
    ]

    ratio = decided / len(requirements) if requirements else 1.0
    confidence = "high" if ratio >= 0.8 else "medium" if ratio >= 0.5 else "low"

    return {
        **match,
        "eligibility": eligibility,
        "warnings": warnings,
        "confidence": confidence,
    }


def recompute_all(
    opportunities: list[Opportunity],
    matches: list[Match],
    profile: Profile | None,
    protected_profile: ProtectedProfile | None = None,
) -> dict[str, list[Any]]:
    """Recomputes every opportunity and assessment against the profile."""
    next_opportunities = [
        recompute_opportunity(opportunity, profile, protected_profile)
        for opportunity in opportunities
    ]

    by_id = {opportunity["id"]: opportunity for opportunity in next_opportunities}
    next_matches = [
        recompute_match(match, by_id[match["opportunityId"]])
        if match.get("opportunityId") in by_id
        else match
        for match in matches
    ]

    return {"opportunities": next_opportunities, "matches": next_matches}


def build_impact(opportunities: list[Opportunity]) -> list[dict[str, Any]]:
    """Which eligibility requirements are waiting on each fact.

    Only requirements that are still *blocking* are reported. A requirement
    that the confirmed fact already settles is no longer holding anything
    up, and listing it would tell the student they are still blocked when
    they are not.
    """
    by_fact: dict[str, list[dict[str, Any]]] = {}

    for opportunity in opportunities:
        for requirement in opportunity.get("requirements", []):
            fact_key = requirement.get("profileFactKey")
            if not fact_key:
                continue
            if requirement.get("status") != "unresolved":
                continue

            by_fact.setdefault(fact_key, []).append(
                {
                    "opportunityId": opportunity.get("id"),
                    "opportunityTitle": opportunity.get("title"),
                    "requirementId": requirement.get("id"),
                    "requirementLabel": requirement.get("label"),
                    "status": requirement.get("status"),
                }
            )

    return [{"factKey": key, "requirements": value} for key, value in by_fact.items()]
