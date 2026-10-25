"""The capability status.

The frontend's capability strip tells the student, per service, whether it
is **live**, **simulated** or **unavailable**. The rule is strict: a
capability is ``live`` only when the service that provides it is actually
configured and reachable. A schema existing is not a capability, and a
successful API connection does not make the AI live.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import Field

from ..config import get_settings
from ..wire import WireModel

router = APIRouter(tags=["capabilities"])

CapabilityKey = Literal[
    "data",
    "ai",
    "search",
    "extraction",
    "monitoring",
    "in_app",
    "email",
]
CapabilityMode = Literal["live", "mocked", "unavailable"]


class Capability(WireModel):
    """One service, and what the student can actually do with it."""

    key: CapabilityKey
    label: str
    mode: CapabilityMode
    detail: str


class CapabilityStatus(WireModel):
    """The whole strip."""

    capabilities: list[Capability] = Field(default_factory=list)
    is_prototype: bool = True


def build_capabilities() -> CapabilityStatus:
    """The current state of every capability.

    Two things decide a mode: whether the provider is configured, and
    whether the *live* switch for it has been turned on — which only
    happens after the provider smoke test has passed.
    """
    settings = get_settings()

    ai_mode: CapabilityMode = (
        "live" if settings.live_model_provider and settings.model_provider_key else "mocked"
    )

    search_mode: CapabilityMode = (
        "live" if settings.live_search_provider and settings.search_provider_key else "mocked"
    )

    email_mode: CapabilityMode = "live" if settings.live_email_provider else "unavailable"

    capabilities = [
        Capability(
            key="data",
            label="Profile and opportunities",
            mode="live",
            detail="Your own profile, opportunities and evidence.",
        ),
        Capability(
            key="ai",
            label="AI reasoning",
            mode=ai_mode,
            detail=(
                "The agent interprets your goal, extracts requirements and explains its reasoning."
                if ai_mode == "live"
                else "The agent's analysis is replayed from recorded fixtures, not generated."
            ),
        ),
        Capability(
            key="search",
            label="Web research",
            mode=search_mode,
            detail=(
                "Live search across official pages and directories."
                if search_mode == "live"
                else "Search results are recorded fixtures, not live queries."
            ),
        ),
        Capability(
            key="extraction",
            label="Document understanding",
            mode="mocked",
            detail="Real extraction runs on the server; today it is replayed from fixtures.",
        ),
        Capability(
            key="monitoring",
            label="Change monitoring",
            mode="unavailable",
            detail=(
                "The scheduled worker is not running yet, so nothing is checked in the background."
            ),
        ),
        Capability(
            key="in_app",
            label="In-app alerts",
            mode="live",
            detail="Alerts always appear in the product, whether or not email is set up.",
        ),
        Capability(
            key="email",
            label="Email notifications",
            mode=email_mode,
            detail=(
                "Digests and deadline reminders, sent only to a verified address."
                if email_mode == "live"
                else "Not connected yet, and not part of the first student-testing release."
            ),
        ),
    ]

    is_prototype = ai_mode != "live" or search_mode != "live"
    return CapabilityStatus(capabilities=capabilities, is_prototype=is_prototype)


@router.get("/capabilities", response_model=CapabilityStatus)
async def capabilities() -> CapabilityStatus:
    """What is connected, per service."""
    return build_capabilities()
