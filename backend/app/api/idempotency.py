"""The `Idempotency-Key` header on the mutations.

The client names one action with a key. The first *successful* response
for that (owner, scope, key) is remembered, and a repeat answers with it
instead of doing the work a second time — so a retry after a lost
connection cannot start a second run, write a second revision, or accept
a proposal that was already accepted.

Two properties keep this honest:

- The record is written only **after** the mutation committed. A failed
  attempt remembers nothing, so the retry simply runs again; there is no
  stuck "in progress" record to clear.
- The scope carries the row the action addressed (``runs.retry:{id}``),
  so the same key on two different resources is two different actions.

Two requests in flight at the same instant can both run — the client's
own double-click guard, and the natural keys (the run's unique
idempotency key) cover the cases where a collision would hurt.
"""

from __future__ import annotations

from typing import Any

from fastapi import Header
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import IdempotencyRecord
from ..errors import validation

#: The longest key we store. It must fit every column a key reaches —
#: the header validator, the record, and ``runs.idempotency_key``.
MAX_KEY_LENGTH = 120


def idempotency_key(
    value: str | None = Header(default=None, alias="Idempotency-Key"),
) -> str | None:
    """The request's key, normalised. No header means no deduplication."""
    if value is None:
        return None
    key = value.strip()
    if not key:
        return None
    if len(key) > MAX_KEY_LENGTH:
        raise validation(
            "That Idempotency-Key is too long.",
            {"Idempotency-Key": [f"Use at most {MAX_KEY_LENGTH} characters."]},
        )
    return key


def as_key(key: object) -> str | None:
    """The key as a string, or ``None``.

    A route called as a plain Python function (the worker tests do this)
    receives the raw `Depends` marker instead of the header — there was
    no request to read it from. That, like an absent header, means no
    deduplication.
    """
    if isinstance(key, str) and key.strip():
        return key
    return None


async def replay_if_seen(
    session: AsyncSession, *, owner_id: str, scope: str, key: object
) -> dict[str, Any] | None:
    """The first response stored for this key, or ``None`` to proceed.

    Called at the top of the route, before anything is written: a
    repeated key never reaches the mutation.
    """
    key = as_key(key)
    if key is None:
        return None

    record = (
        await session.execute(
            select(IdempotencyRecord).where(
                IdempotencyRecord.owner_id == owner_id,
                IdempotencyRecord.scope == scope,
                IdempotencyRecord.key == key,
            )
        )
    ).scalar_one_or_none()
    if record is None:
        return None
    return dict(record.response_body or {})


async def remember(
    session: AsyncSession, *, owner_id: str, scope: str, key: object, body: dict[str, Any]
) -> None:
    """Stores this response as *the* answer for the key.

    Called after the mutation committed. If a concurrent twin with the
    same key stored first, the twin's response wins and this one is
    dropped — a repeat must always see one answer, not either of two.
    """
    key = as_key(key)
    if key is None:
        return

    session.add(
        IdempotencyRecord(
            owner_id=owner_id,
            scope=scope,
            key=key,
            response_body=body,
        )
    )
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        return
    await session.commit()
