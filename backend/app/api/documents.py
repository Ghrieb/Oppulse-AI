"""The documents.

A student's CV and certificates. The file itself is stored privately by us
and is **never** sent to a model provider; only the text of the pages we
could read is.

Reading a document is honest about what it could not read: the pages that
had no text layer and no OCR engine are named, and the document's state
says "partly read" rather than pretending it was understood.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai.providers import build_document_extractor
from ..config import get_settings
from ..db.models import AuditLog, Document, ProfileFact
from ..db.session import get_session
from ..errors import not_found, validation
from ..security.session import CurrentUser, current_user
from ..storage import DocumentStorage, document_storage_key
from ..wire import WireModel, iso_utc
from .idempotency import idempotency_key, remember, replay_if_seen

router = APIRouter(prefix="/documents", tags=["documents"])


# --------------------------------------------------------------------- #
# The wire shapes                                                      #
# --------------------------------------------------------------------- #


class FactSourceOut(WireModel):
    document_id: str
    document_name: str
    excerpt: str
    page_reference: str | None = None
    section: str | None = None


class ProposedFactOut(WireModel):
    id: str
    key: str
    label: str
    value: str
    numeric_value: float | None = None
    code: str | None = None
    status: str
    excluded: bool
    corrected: bool
    conflicting: bool
    source: FactSourceOut | None = None
    section: str
    used_for: str | None = None
    confidence: str
    #: The conflicting value, when there is one. Never resolved silently.
    conflict: dict[str, Any] | None = None
    created_at: str
    updated_at: str | None = None


class ExtractionOut(WireModel):
    proposed_fact_ids: list[str] = Field(default_factory=list)
    unread_sections: list[str] = Field(default_factory=list)
    method: str = "none"
    completed_at: str | None = None


class DocumentOut(WireModel):
    id: str
    filename: str
    mime_type: str
    size_bytes: int
    category: str
    status: str
    proposed_facts: list[ProposedFactOut] = Field(default_factory=list)
    extraction: ExtractionOut
    consent_to_use: bool
    created_at: str
    updated_at: str
    error_message: str | None = None
    download_url: str | None = None


class DocumentListOut(WireModel):
    documents: list[DocumentOut]


class UpdateDocumentRequest(WireModel):
    consent_to_use: bool | None = None
    category: str | None = None


# --------------------------------------------------------------------- #
# Helpers                                                              #
# --------------------------------------------------------------------- #


def _iso(value: datetime | None) -> str:
    if value is None:
        return datetime.now(UTC).isoformat()
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC).isoformat()
    return value.isoformat()


def _document_out(document: Document, proposed: list[ProfileFact]) -> DocumentOut:
    extraction = document.extraction or {}

    return DocumentOut(
        id=document.id,
        filename=document.filename,
        mime_type=document.mime_type,
        size_bytes=document.size_bytes,
        category=document.category,
        status=document.status,
        proposed_facts=[_fact_out(fact) for fact in proposed],
        extraction=ExtractionOut(
            proposed_fact_ids=list(extraction.get("proposedFactIds", [])),
            unread_sections=list(extraction.get("unreadSections", [])),
            method=str(extraction.get("method", "none")),
            completed_at=extraction.get("completedAt"),
        ),
        consent_to_use=document.consent_to_use,
        created_at=_iso(document.created_at),
        updated_at=_iso(document.updated_at),
        error_message=document.error_message,
        download_url=document.download_url,
    )


def _fact_out(fact: ProfileFact) -> ProposedFactOut:
    return ProposedFactOut(
        id=fact.id,
        key=fact.key,
        label=fact.label,
        value=fact.value,
        numeric_value=fact.numeric_value,
        code=fact.code,
        status=fact.status,
        excluded=fact.excluded,
        corrected=fact.corrected,
        conflicting=fact.conflicting,
        source=(
            FactSourceOut(
                document_id=fact.source_document_id or "",
                document_name=fact.source_document_name or "",
                excerpt=fact.source_excerpt or "",
                page_reference=fact.source_page,
                section=fact.source_section,
            )
            if fact.source_document_id and fact.source_document_name
            else None
        ),
        section=fact.section,
        used_for=fact.used_for or None,
        confidence=fact.confidence,
        conflict=None,
        created_at=iso_utc(fact.created_at) or "",
        updated_at=iso_utc(fact.updated_at),
    )


async def _owned(session: AsyncSession, user: CurrentUser, document_id: str) -> Document:
    """A document, if it is the caller's."""
    result = await session.execute(
        select(Document).where(Document.id == document_id, Document.owner_id == user.id)
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise not_found("That document")
    return document


async def _proposed_facts(session: AsyncSession, document: Document) -> list[ProfileFact]:
    """The facts the model proposed from this document."""
    result = await session.execute(
        select(ProfileFact).where(ProfileFact.source_document_id == document.id)
    )
    return list(result.scalars().all())


# --------------------------------------------------------------------- #
# The routes                                                           #
# --------------------------------------------------------------------- #


@router.get("", response_model=DocumentListOut)
@router.get("/", response_model=DocumentListOut, include_in_schema=False)
async def list_documents(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> DocumentListOut:
    """The caller's documents."""
    result = await session.execute(
        select(Document)
        .where(Document.owner_id == user.id, Document.status != "deleted")
        .order_by(Document.created_at.desc())
    )
    documents = list(result.scalars().all())

    return DocumentListOut(
        documents=[
            _document_out(document, await _proposed_facts(session, document))
            for document in documents
        ]
    )


@router.post("", response_model=DocumentOut, status_code=201)
@router.post("/", response_model=DocumentOut, status_code=201, include_in_schema=False)
async def upload_document(
    request: Request,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    key: str | None = Depends(idempotency_key),
) -> DocumentOut:
    """Uploads a document.

    The file is read here, on our own machine. Only the text of the pages we
    could read is ever sent to a model provider, and the pages we could not
    read are named.
    """
    scope = "documents.upload"
    stored = await replay_if_seen(session, owner_id=user.id, scope=scope, key=key)
    if stored is not None:
        return DocumentOut.model_validate(stored)

    settings = get_settings()

    content = await request.body()
    if not content:
        raise validation(
            "The file was empty.",
            {"file": ["Nothing arrived."]},
        )
    if len(content) > settings.document_max_bytes:
        raise validation(
            "That file is too large.",
            {"file": ["The limit is 10 MB."]},
        )

    filename = _filename_from(request)
    mime_type = request.headers.get("content-type", "application/octet-stream").split(";")[0]

    document = Document(
        owner_id=user.id,
        filename=filename,
        mime_type=mime_type,
        size_bytes=len(content),
        category="other",
        status="processing",
        consent_to_use=False,
        extraction={"proposedFactIds": [], "unreadSections": [], "method": "none"},
    )
    session.add(document)
    await session.flush()

    storage = DocumentStorage(settings)
    document.storage_key = document_storage_key(user.id, document.id, content)
    await storage.put(document.storage_key, content, content_type=mime_type)

    extraction = build_document_extractor(settings).read(
        content, filename=filename, mime_type=mime_type
    )

    document.extraction = {
        "proposedFactIds": [],
        "unreadSections": list(extraction.unread_sections),
        "method": extraction.method,
        "completedAt": datetime.now(UTC).isoformat(),
    }
    if not extraction.pages:
        document.status = "failed"
        document.error_message = "We could not read this file." + (
            f" {extraction.unread_sections[0]}." if extraction.unread_sections else ""
        )
    else:
        document.status = "needs_review"

    session.add(
        AuditLog(
            owner_id=user.id,
            actor=user.id,
            event="document.uploaded",
            detail={
                "filename": filename,
                "pagesRead": len(extraction.pages),
                "pagesUnread": len(extraction.unread_sections),
                "method": extraction.method,
            },
        )
    )
    await session.commit()

    out = _document_out(document, await _proposed_facts(session, document))
    await remember(
        session, owner_id=user.id, scope=scope, key=key, body=out.model_dump(by_alias=True)
    )
    return out


@router.get("/{id}", response_model=DocumentOut)
async def read_document(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> DocumentOut:
    """One document."""
    document = await _owned(session, user, id)
    return _document_out(document, await _proposed_facts(session, document))


@router.get("/{id}/content")
async def download_document(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Downloads the caller's private document bytes."""
    document = await _owned(session, user, id)
    if document.status == "deleted" or not document.storage_key:
        raise not_found("That document")

    try:
        content = await DocumentStorage(get_settings()).get(document.storage_key)
    except FileNotFoundError:
        raise not_found("That document") from None

    return Response(
        content=content,
        media_type=document.mime_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{document.filename.replace(chr(34), "")}"'
            )
        },
    )


@router.patch("/{id}", response_model=DocumentOut)
async def update_document(
    id: str,
    body: UpdateDocumentRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> DocumentOut:
    """Changes the consent, or the category.

    The consent is the student's decision about whether this document may be
    used as AI context, and it is revocable at any time.
    """
    document = await _owned(session, user, id)

    if body.consent_to_use is not None:
        document.consent_to_use = body.consent_to_use
    if body.category is not None:
        document.category = body.category

    document.updated_at = datetime.now(UTC)
    session.add(
        AuditLog(
            owner_id=user.id,
            actor=user.id,
            event="document.consent_changed",
            detail={"consentToUse": document.consent_to_use},
        )
    )
    await session.commit()

    return _document_out(document, await _proposed_facts(session, document))


@router.delete("/{id}", status_code=204)
async def delete_document(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Deletes a document.

    The facts extracted from it are withdrawn, unless the student confirmed
    them separately.
    """
    document = await _owned(session, user, id)
    storage = DocumentStorage(get_settings())
    if document.storage_key:
        await storage.delete(document.storage_key)

    result = await session.execute(
        select(ProfileFact).where(ProfileFact.source_document_id == document.id)
    )
    for fact in result.scalars().all():
        if fact.status != "confirmed":
            await session.delete(fact)

    document.status = "deleted"
    document.updated_at = datetime.now(UTC)
    document.consent_to_use = False

    session.add(
        AuditLog(
            owner_id=user.id,
            actor=user.id,
            event="document.deleted",
            detail={"filename": document.filename},
        )
    )
    await session.commit()

    return Response(status_code=204)


def _filename_from(request: Request) -> str:
    """The file's name, from the disposition header.

    The client sends it the way every HTTP upload does: RFC 5987 for a
    non-ASCII name, with a plain ASCII fallback.
    """
    import re
    from urllib.parse import unquote

    disposition = request.headers.get("content-disposition", "")

    encoded = re.search(r"filename\*=UTF-8''([^;]+)", disposition, re.IGNORECASE)
    if encoded:
        return unquote(encoded.group(1))[:255]

    plain = re.search(r'filename="([^"]*)"', disposition, re.IGNORECASE)
    if plain:
        return plain.group(1)[:255]

    return "document"
