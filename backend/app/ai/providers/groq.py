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

import json
from typing import Any

import httpx

from ...config import Settings
from ..types import ModelRequest, ModelResponse
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

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a careful research assistant. You answer only in the requested "
                    "schema. You never invent a fact that is not in the context you are given, "
                    "and you never describe a profile match as a likelihood of admission."
                ),
            },
            {"role": "user", "content": _as_prompt(request)},
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
                    "schema": {"type": "object", "additionalProperties": True},
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

        return ModelResponse(
            content=content,
            parsed=parsed,
            model=self._settings.model_id,
            prompt_tokens=int(usage.get("prompt_tokens", 0)),
            completion_tokens=int(usage.get("completion_tokens", 0)),
        )

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        """One request, with the failure modes translated."""
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

        if response.status_code == 429:
            raise ProviderError(
                "The model provider's rate limit was reached.",
                code="RATE_LIMITED",
                retryable=True,
            )
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
