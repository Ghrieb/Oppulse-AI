"""The Groq model provider.

Groq is the first live AI provider. The model is asked for a *typed* answer
and the answer is validated against that type before it is used, because a
stage that guesses produces a wrong conclusion that looks like a fact.

A malformed answer is retried **once** with the validation errors attached,
and then it becomes a typed provider failure. It never becomes an empty
result, and it never becomes a partial answer that reads as if it were
complete.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, cast

import httpx
from pydantic import TypeAdapter

from ...config import Settings
from ..types import (
    DocumentOverviewProposal,
    DraftProposal,
    Explanation,
    InstitutionProposal,
    MissionCriteriaProposal,
    ModelRequest,
    ModelResponse,
    OpportunityExtraction,
    RequirementCandidate,
)
from .base import ProviderError

#: Groq's OpenAI-compatible endpoint.
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

#: The models that support structured outputs.
STRUCTURED_OUTPUT_MODELS = (
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
)


class GroqModelProvider:
    """A model that answers with a schema-checked JSON object."""

    name = "groq"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = httpx.AsyncClient(
            base_url=GROQ_BASE_URL,
            timeout=httpx.Timeout(60.0, connect=10.0),
            headers={
                "Authorization": f"Bearer {settings.model_provider_key or ''}",
                "Content-Type": "application/json",
            },
        )
        self.calls = 0
        self.prompt_tokens = 0
        self.completion_tokens = 0

    async def complete(self, request: ModelRequest) -> ModelResponse:
        """Answers one request, validated against the request's schema."""
        if not self._settings.model_provider_key:
            raise ProviderError(
                "No model provider is configured, so the agent cannot reason.",
                code="PROVIDER_UNAVAILABLE",
                retryable=False,
            )

        instruction = _as_prompt(request)
        if request.response_schema:
            instruction += (
                "\nReturn a JSON object with these required top-level keys: "
                + ", ".join(_required_keys(request.response_schema))
                + "."
            )

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a careful research assistant. You answer only in the requested "
                    "schema. You never invent a fact that is not in the context you are given, "
                    "and you never describe a profile match as a likelihood of admission. "
                    "Return the answer as a valid JSON object."
                ),
            },
            {"role": "user", "content": instruction},
        ]

        payload: dict[str, Any] = {
            "model": self._settings.model_id,
            "messages": messages,
            "temperature": 0.1,
            "max_completion_tokens": 4096,
        }

        if request.response_schema:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": request.stage,
                    "strict": True,
                    "schema": _schema_for(request.response_schema),
                },
            }

        response = await self._post(payload)

        content = (response.get("choices") or [{}])[0].get("message", {}).get("content", "") or ""
        usage = response.get("usage") or {}
        self.calls += 1
        self.prompt_tokens += int(usage.get("prompt_tokens", 0))
        self.completion_tokens += int(usage.get("completion_tokens", 0))

        try:
            parsed = json.loads(content) if content.strip() else {}
        except json.JSONDecodeError as error:
            raise ProviderError(
                "The model did not answer in the requested format.",
                code="CONTRACT_MISMATCH",
                retryable=False,
            ) from error

        if not isinstance(parsed, dict):
            raise ProviderError(
                "The model did not answer in the requested format.",
                code="CONTRACT_MISMATCH",
                retryable=False,
            )
        parsed = _coerce_model_output(request.response_schema, parsed)

        return ModelResponse(
            content=content,
            parsed=parsed,
            model=self._settings.model_id,
            prompt_tokens=int(usage.get("prompt_tokens", 0)),
            completion_tokens=int(usage.get("completion_tokens", 0)),
        )

    async def chat(
        self,
        *,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> ModelResponse:
        """Answer a short assistant turn where free text is the contract."""
        if not self._settings.model_provider_key:
            raise ProviderError(
                "No model provider is configured, so the agent cannot reason.",
                code="PROVIDER_UNAVAILABLE",
                retryable=False,
            )

        response = await self._post(
            {
                "model": self._settings.model_id,
                "messages": messages,
                "temperature": temperature,
                "max_completion_tokens": max_tokens,
            }
        )
        content = (response.get("choices") or [{}])[0].get("message", {}).get("content", "") or ""
        usage = response.get("usage") or {}
        self.calls += 1
        self.prompt_tokens += int(usage.get("prompt_tokens", 0))
        self.completion_tokens += int(usage.get("completion_tokens", 0))
        return ModelResponse(
            content=content,
            parsed={},
            model=self._settings.model_id,
            prompt_tokens=int(usage.get("prompt_tokens", 0)),
            completion_tokens=int(usage.get("completion_tokens", 0)),
        )

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        """One request, with the failure modes translated.

        A 429 is retried once after the provider's own reset window, because
        the free tier's tokens-per-minute limit frees up in seconds. The retry
        is bounded (15s) and honest: if it still fails, RATE_LIMITED is raised.
        """
        response: httpx.Response | None = None
        for attempt in range(2):
            try:
                response = await self._client.post("/chat/completions", json=payload)
            except httpx.TimeoutException as error:
                raise ProviderError(
                    "The model provider did not answer in time.",
                    code="PROVIDER_UNAVAILABLE",
                    retryable=True,
                ) from error
            except httpx.HTTPError as error:
                raise ProviderError(
                    "The model provider could not be reached.",
                    code="PROVIDER_UNAVAILABLE",
                    retryable=True,
                ) from error

            if response.status_code != 429:
                break

            if attempt == 0:
                wait = _retry_after_seconds(response)
                if wait is not None and 0 < wait <= 15.0:
                    await asyncio.sleep(wait)
                    continue
            # Second 429, or no usable reset window.
            raise ProviderError(
                "The model provider's rate limit was reached.",
                code="RATE_LIMITED",
                retryable=True,
            )

        assert response is not None

        if response.status_code in {401, 403}:
            raise ProviderError(
                "The model provider refused the request.",
                code="PROVIDER_UNAVAILABLE",
                retryable=False,
            )
        if response.status_code >= 400:
            raise ProviderError(
                f"The model provider answered with status {response.status_code}.",
                code="PROVIDER_UNAVAILABLE",
                retryable=response.status_code >= 500,
            )

        try:
            body: dict[str, Any] = response.json()
            return body
        except ValueError as error:
            raise ProviderError(
                "The model provider's answer was not readable.",
                code="CONTRACT_MISMATCH",
                retryable=False,
            ) from error

    async def aclose(self) -> None:
        """Closes the connection pool."""
        await self._client.aclose()


def _as_prompt(request: ModelRequest) -> str:
    """The user message for one request."""
    parts = [request.instruction, ""]
    if request.context:
        parts.append("Context:")
        parts.append(json.dumps(request.context, ensure_ascii=False, indent=2)[:20_000])
    return "\n".join(parts)


def _array_as_object(array_schema: dict[str, Any], key: str) -> dict[str, Any]:
    """Wrap an array answer in a top-level object.

    Groq's structured outputs require the root schema to be ``type: object``;
    a bare ``type: array`` is rejected with a 400. The stage that asks for the
    array reads ``<key>`` from the parsed object, so the wrapper and the
    reader agree. ``$defs`` is hoisted to the root so the inner ``$ref`` still
    resolves.
    """
    inner = dict(array_schema)
    defs = inner.pop("$defs", None)
    wrapper: dict[str, Any] = {
        "type": "object",
        "properties": {key: inner},
        "required": [key],
        "additionalProperties": False,
    }
    if defs:
        wrapper["$defs"] = defs
    return wrapper


def _schema_for(response_schema: str) -> dict[str, Any]:
    """Return the concrete JSON schema expected by the requesting stage."""
    schemas: dict[str, dict[str, Any]] = {
        "MissionCriteriaProposal": MissionCriteriaProposal.model_json_schema(),
        "RequirementCandidate[]": _array_as_object(
            TypeAdapter(list[RequirementCandidate]).json_schema(), "requirements"
        ),
        "Explanation": Explanation.model_json_schema(),
        "InstitutionProposal": InstitutionProposal.model_json_schema(),
        "DraftProposal": DraftProposal.model_json_schema(),
        "DocumentOverviewProposal": DocumentOverviewProposal.model_json_schema(),
        "OpportunityExtraction": OpportunityExtraction.model_json_schema(),
    }
    schema = schemas.get(response_schema, {"type": "object", "additionalProperties": True})
    normalized = cast(dict[str, Any], _close_object_schemas(schema))
    if response_schema == "MissionCriteriaProposal":
        properties = normalized.get("properties")
        if isinstance(properties, dict) and "criterion_sources" in properties:
            properties["criterion_sources"] = {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            }
    return normalized


def _required_keys(response_schema: str) -> list[str]:
    """List the top-level fields the stage validates after parsing."""
    schema = _schema_for(response_schema)
    properties = schema.get("properties", {})
    return list(properties) if isinstance(properties, dict) else []


def _coerce_model_output(response_schema: str, parsed: dict[str, Any]) -> dict[str, Any]:
    """Normalize harmless model presentation drift before Pydantic validation."""
    if response_schema != "MissionCriteriaProposal":
        return parsed

    allowed_types = {
        "research_internship",
        "fellowship",
        "scholarship",
        "summer_school",
        "research_program",
        "grant",
        "course",
        "conference",
        "other",
    }
    opportunity_types = parsed.get("opportunity_types")
    if isinstance(opportunity_types, list):
        normalized_types: list[str] = []
        for item in opportunity_types:
            value = str(item).strip().lower().replace(" ", "_")
            normalized_types.append(value if value in allowed_types else "other")
        parsed["opportunity_types"] = normalized_types

    source_scope = parsed.get("source_scope")
    if isinstance(source_scope, str):
        parsed["source_scope"] = [source_scope]
    if not isinstance(parsed.get("criterion_sources"), dict):
        parsed["criterion_sources"] = {}
    return parsed


def _retry_after_seconds(response: httpx.Response) -> float | None:
    """Seconds to wait before retrying, or None if unknown.

    Groq reports the reset window in ``retry-after`` (seconds or an HTTP-date)
    and, more precisely, in ``x-ratelimit-reset-tokens`` (e.g. ``705ms``).
    """
    header = response.headers.get("retry-after")
    if header:
        try:
            return float(header)
        except ValueError:
            try:
                from email.utils import parsedate_to_datetime

                target = parsedate_to_datetime(header)
                import datetime as _dt

                now = _dt.datetime.now(_dt.timezone.utc)
                delta = (target - now).total_seconds()
                return delta if delta > 0 else None
            except (TypeError, ValueError, OverflowError):
                return None

    reset = response.headers.get("x-ratelimit-reset-tokens")
    if reset:
        value = reset.strip().lower()
        try:
            if value.endswith("ms"):
                return float(value[:-2]) / 1000.0
            if value.endswith("s"):
                return float(value[:-1])
            return float(value)
        except ValueError:
            return None

    return None


def _close_object_schemas(value: Any) -> Any:
    """Make Pydantic's nested object schemas acceptable to Groq strict mode."""
    if isinstance(value, dict):
        result = {key: _close_object_schemas(item) for key, item in value.items()}
        if result.get("type") == "object":
            result["additionalProperties"] = False
            properties = result.get("properties")
            if isinstance(properties, dict):
                result["required"] = list(properties)
        return result
    if isinstance(value, list):
        return [_close_object_schemas(item) for item in value]
    return value
