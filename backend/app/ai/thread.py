"""The server-owned conversation.

The backend owns the thread. The frontend keeps a copy so a refresh is
instant, but the server's copy is the one that decides what a turn may
use — and the one the harness inspects to check that an excluded document
stayed excluded and a corrected fact replaced the old value.

A turn records the context it ran with, so the record says not only what
was said but what was allowed to be said.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Thread, ThreadTurn
from ..wire import iso_utc
from .context import TurnContext

TurnRecord = dict[str, Any]


async def create_thread(
    session: AsyncSession, *, owner_id: str, mission_id: str | None = None
) -> Thread:
    """Starts a thread."""
    thread = Thread(owner_id=owner_id, mission_id=mission_id)
    session.add(thread)
    await session.flush()
    return thread


async def find_thread(session: AsyncSession, *, owner_id: str, thread_id: str) -> Thread | None:
    """A thread, if it is the caller's."""
    result = await session.execute(
        select(Thread).where(Thread.id == thread_id, Thread.owner_id == owner_id)
    )
    return result.scalar_one_or_none()


async def record_turn(
    session: AsyncSession,
    *,
    thread: Thread,
    role: str,
    content: str,
    context: TurnContext,
    blocks: list[dict[str, Any]] | None = None,
    run_id: str | None = None,
) -> ThreadTurn:
    """Records one turn, with the context it ran under."""
    turn = ThreadTurn(
        thread_id=thread.id,
        owner_id=thread.owner_id,
        mission_id=thread.mission_id,
        role=role,
        content=content,
        blocks=blocks or [],
        context=context.to_record(),
        selected_fact_ids=list(context.fact_ids),
        selected_document_ids=list(context.document_ids),
        consent_state=dict(context.consent),
        run_id=run_id,
    )
    session.add(turn)
    await session.flush()
    return turn


async def history(
    session: AsyncSession, *, owner_id: str, thread_id: str | None = None
) -> list[ThreadTurn]:
    """The turns of a thread, oldest first."""
    statement = select(ThreadTurn).where(ThreadTurn.owner_id == owner_id)
    if thread_id:
        statement = statement.where(ThreadTurn.thread_id == thread_id)
    statement = statement.order_by(ThreadTurn.created_at, ThreadTurn.id)

    result = await session.execute(statement)
    return list(result.scalars().all())


def turn_to_message(turn: ThreadTurn) -> dict[str, Any]:
    """A stored turn, in the shape the frontend parses."""
    return {
        "id": turn.id,
        "role": turn.role,
        "content": turn.content,
        "createdAt": iso_utc(turn.created_at),
        "blocks": list(turn.blocks or []),
        "context": dict(turn.context or {}),
    }
