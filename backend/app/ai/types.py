"""What the model may produce.

Every type in this module is a **proposal** or a **candidate**: something
the model suggests, which a deterministic service then validates, narrows
or rejects. Nothing here is a decision.

The decision types live in ``app.ai.decisions``, and the AI stages may not
import that module. The boundary is not a comment — it is checked by a test
that walks the stages' imports and their type hints.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, TypeAdapter

from ..wire import WireModel

#: The kinds of opportunity the agent understands.
OpportunityType = Literal[
    "research_internship",
    "fellowship",
    "scholarship",
    "summer_school",
    "research_program",
    "grant",
    "course",
    "conference",
    "other",
]

#: How a requirement was classified.
RequirementKind = Literal[
    "nationality",
    "degree",
    "field",
    "language",
    "document",
    "age",
    "availability",
    "other",
]

#: How a source is trusted.
SourceQuality = Literal["official", "primary", "secondary", "aggregator", "unknown"]

#: Whether the rule behind a requirement has been confirmed.
Verification = Literal["verified", "needs_verification", "conflicting"]


class Proposal(BaseModel):
    """The base of everything the model produces.

    A proposal is a suggestion with its reasoning attached, so a
    deterministic service can check it.
    """


class Candidate(Proposal):
    """A single extracted item: a requirement, a claim, a criterion."""


class MissionCriteriaProposal(Proposal):
    """The agent's reading of what the student is looking for.

    Every criterion records where it came from: the student's own words, or
    a confirmed profile fact. A criterion the student never gave and a
    confirmed fact does not support is not allowed to appear.
    """

    title: str
    objective: str
    opportunity_types: list[OpportunityType] = Field(default_factory=list)
    academic_interests: list[str] = Field(default_factory=list)
    destinations: list[str] = Field(default_factory=list)
    destination_countries: list[str] = Field(default_factory=list)
    education_level: str = "any"
    funding_preference: str = "any"
    start_period: str = ""
    use_profile: bool = True
    source_scope: list[str] = Field(default_factory=list)
    #: Which criteria came from the student and which from the profile.
    criterion_sources: dict[str, Literal["user", "profile_fact", "default"]] = Field(
        default_factory=dict
    )
    #: The criteria the student did not author and the profile does not
    #: support. They are dropped rather than silently used.
    dropped: list[str] = Field(default_factory=list)


class RequirementCandidate(Candidate):
    """A requirement the agent read out of a source.

    The passage is kept, because a requirement without its source is an
    assertion, and an assertion is not evidence.
    """

    label: str
    kind: RequirementKind
    clause: str | None = None
    source_id: str
    passage: str
    verification: Verification = "needs_verification"
    blocking: bool = True
    profile_fact_key: str | None = None
    #: The rule, when the requirement is decided by a check.
    check: dict[str, object] | None = None
    age_rule: dict[str, object] | None = None


class RetrievedSource(BaseModel):
    """A source that was reached — or that was not.

    A source that could not be reached is recorded as a failure, never as
    an absence: "we found nothing" and "we could not look" are different
    answers.

    ``media`` is what the fetcher saw in the page's own metadata — there is
    no media discovery; a page that was not opened contributes nothing.
    """

    id: str
    url: str
    title: str
    domain: str
    excerpt: str = ""
    quality: SourceQuality = "unknown"
    status: Literal["retrieved", "unavailable"] = "retrieved"
    content_hash: str | None = None
    retrieved_at: str | None = None
    page_reference: str | None = None
    media: list[MediaContext] = Field(default_factory=list)


class Claim(Candidate):
    """One statement, and the source it rests on."""

    text: str
    source_id: str
    requirement_id: str | None = None
    #: True when the statement is the agent's own inference rather than
    #: something the source says.
    inference: bool = False


class Explanation(Proposal):
    """The agent's account of what it found.

    Every claim carries a source id. A claim without one is dropped before
    this leaves the stage — an unsupported sentence is worse than a missing
    one.
    """

    claims: list[Claim] = Field(default_factory=list)
    summary: str = ""
    #: The claims that were dropped for want of a source.
    unsupported: list[str] = Field(default_factory=list)


class DraftProposal(Proposal):
    """A drafted document.

    It is a proposal: it never touches the student's document until they
    accept it, and it says which claims could not be grounded.
    """

    content: str
    summary: str = ""
    #: The claims the agent could not ground in a confirmed fact.
    unsupported_claims: list[str] = Field(default_factory=list)
    #: The confirmed facts the draft was written from.
    grounded_fact_ids: list[str] = Field(default_factory=list)


class InstitutionProposal(Proposal):
    """The model's reading of an institution's official pages.

    Only the prose is the model's. What a prospective applicant would want
    to know and the sources do not state goes into ``unverified``, named
    rather than estimated — competitiveness and acceptance rates are never
    invented.
    """

    description: str
    unverified: list[str] = Field(default_factory=list)


class ModelRequest(BaseModel):
    """A request to a model provider.

    The context is the *minimum* the stage needs. The privacy rule is
    enforced by the stage that builds this, not by the provider.
    """

    stage: str
    instruction: str
    context: dict[str, object] = Field(default_factory=dict)
    #: The schema the answer must satisfy.
    response_schema: str = ""


class ExtractedPage(BaseModel):
    """One page we could read."""

    number: int
    text: str
    #: True when the page was read by the OCR engine rather than its text layer.
    ocr: bool = False


class DocumentExtractionResult(BaseModel):
    """What reading a document produced.

    The pages we read, and the pages we did not. A page that could not be
    read is named, never guessed at.
    """

    pages: list[ExtractedPage] = Field(default_factory=list)
    #: The pages that could not be read, and why.
    unread_sections: list[str] = Field(default_factory=list)
    #: How the text was obtained.
    method: Literal["text_layer", "ocr", "none"] = "none"
    #: The page numbers that had no text layer.
    scanned_pages: list[int] = Field(default_factory=list)


# --------------------------------------------------------------------- #
# The answer blocks                                                      #
# --------------------------------------------------------------------- #


class MediaContext(WireModel):
    """Media, as secondary context.

    It never proves eligibility, funding, a deadline or an admission
    likelihood. The publisher and the date travel with it so the student can
    judge it, and the label in the interface says what it is.
    """

    kind: Literal["image", "video"]
    url: str
    title: str
    publisher: str
    published_at: str | None = None
    source_type: Literal["official", "verified_provider", "secondary"] = "secondary"
    attribution: str | None = None
    summary: str | None = None
    status: Literal["available", "unavailable", "removed", "not_reviewed"] = "not_reviewed"


class TextBlock(WireModel):
    """The answer itself."""

    kind: Literal["text"] = "text"
    text: str


class EvidenceSource(WireModel):
    title: str
    url: str
    quote: str
    quality: SourceQuality = "unknown"


class EvidenceBlock(WireModel):
    """What the source says, and where it says it."""

    kind: Literal["evidence"] = "evidence"
    title: str
    summary: str
    sources: list[EvidenceSource] = Field(default_factory=list)
    requirement_id: str | None = None


class ChecklistItem(WireModel):
    label: str
    status: Literal["missing", "ready", "needs_attention", "done"] = "needs_attention"
    detail: str | None = None
    route: str | None = None


class ChecklistBlock(WireModel):
    """What the call requires, and what is still open."""

    kind: Literal["checklist"] = "checklist"
    title: str
    items: list[ChecklistItem] = Field(default_factory=list)


class DraftActionBlock(WireModel):
    """A document the student could start."""

    kind: Literal["draft_action"] = "draft_action"
    title: str
    description: str
    draft_type: str
    application_id: str | None = None
    effect: Literal["prepares", "would_send"] = "prepares"


class RunBlock(WireModel):
    """A research run, and where it stands."""

    kind: Literal["run"] = "run"
    run_id: str
    status: str
    message: str


class InstitutionEvidence(WireModel):
    title: str
    url: str
    quote: str
    source_type: Literal["official", "verified_provider", "secondary"] = "secondary"


class InstitutionBlock(WireModel):
    """The answer to a question about an institution.

    It separates what the official source states from what could not be
    verified, and the media it carries is labelled as secondary.
    """

    kind: Literal["institution"] = "institution"
    description: str
    location: str
    country: str
    institution_type: str | None = None
    programme_context: str | None = None
    evidence: list[InstitutionEvidence] = Field(default_factory=list)
    media: list[MediaContext] = Field(default_factory=list)
    unverified: list[str] = Field(default_factory=list)
    action: str | None = None


class MediaContextBlock(WireModel):
    """Media, on its own, as secondary context."""

    kind: Literal["media_context"] = "media_context"
    subject: str
    media: list[MediaContext] = Field(default_factory=list)


class OpportunityReferenceBlock(WireModel):
    """A reference to an opportunity.

    It is how the chat opens the detail panel without repeating the
    opportunity's whole content in the message.
    """

    kind: Literal["opportunity_reference"] = "opportunity_reference"
    opportunity_id: str
    title: str
    institution: str
    country: str
    reason: str


class UnknownOrConflictBlock(WireModel):
    """What could not be verified.

    The honest edge of an answer: what was checked, what remains unknown,
    and the most useful next step. It is never replaced with a confident
    guess.
    """

    kind: Literal["unknown_or_conflict"] = "unknown_or_conflict"
    question: str
    checked: list[str] = Field(default_factory=list)
    next_action: str | None = None
    conflict: bool = False


class ActionBlock(WireModel):
    """An action the student may take, and what it would do."""

    kind: Literal["action"] = "action"
    label: str
    description: str | None = None
    action: str
    payload: dict[str, Any] = Field(default_factory=dict)
    effect: Literal["prepares", "would_send"] = "prepares"


#: Every answer block, in one union.
AssistantBlock = Annotated[
    TextBlock
    | EvidenceBlock
    | ChecklistBlock
    | DraftActionBlock
    | RunBlock
    | InstitutionBlock
    | MediaContextBlock
    | OpportunityReferenceBlock
    | UnknownOrConflictBlock
    | ActionBlock,
    Field(discriminator="kind"),
]

#: The adapter that checks a block against the union.
AssistantBlockAdapter = TypeAdapter(AssistantBlock)


class ModelResponse(BaseModel):
    """A model's answer, already validated against its schema."""

    content: str
    parsed: dict[str, object] = Field(default_factory=dict)
    model: str = "replay"
    prompt_tokens: int = 0
    completion_tokens: int = 0


AnnotatedModelRequest = Annotated[ModelRequest, "the request a stage makes"]
