"""The wire shape.

The frontend's contract is camelCase — ``emailVerified``, ``uploadedDocumentId``,
``expiresAt`` — because that is what the browser's contract has always been.
Python is snake_case, and that is what the models should look like inside
the service.

One base class bridges the two, so no endpoint has to think about it: the
alias generator turns ``email_verified`` into ``emailVerified`` on the wire,
and the model still accepts the snake_case name when it is built in code.
"""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


def iso_utc(value: datetime | None) -> str | None:
    """A timestamp, always in UTC and always with an offset.

    SQLite hands the timestamps back without a timezone, and a datetime
    without one is not a valid ISO datetime for the contract: the frontend
    rejects it. Every timestamp the service emits goes through here.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC).isoformat()
    return value.astimezone(UTC).isoformat()


class WireModel(BaseModel):
    """The base of every model that crosses the wire."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
