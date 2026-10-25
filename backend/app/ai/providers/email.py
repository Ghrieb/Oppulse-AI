"""HTTP email provider adapter."""

from __future__ import annotations

import httpx

from ...config import Settings
from .base import ProviderError


class HttpEmailProvider:
    """Sends email through a configured provider endpoint."""

    name = "http"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def send(self, *, to: str, subject: str, body: str, idempotency_key: str) -> str:
        if not self._settings.email_provider_url or not self._settings.email_provider_key:
            raise ProviderError(
                "No email provider is configured.",
                code="PROVIDER_UNAVAILABLE",
                retryable=False,
            )

        headers = {
            "Authorization": f"Bearer {self._settings.email_provider_key}",
            "Idempotency-Key": idempotency_key,
        }
        payload = {
            "from": self._settings.email_from_address,
            "to": to,
            "subject": subject,
            "text": body,
        }
        try:
            async with httpx.AsyncClient(timeout=self._settings.fetch_timeout_seconds) as client:
                response = await client.post(
                    self._settings.email_provider_url,
                    json=payload,
                    headers=headers,
                )
        except httpx.HTTPError as error:
            raise ProviderError(
                "The email provider could not be reached.",
                code="PROVIDER_UNAVAILABLE",
                retryable=True,
            ) from error

        if response.status_code >= 400:
            raise ProviderError(
                "The email provider refused the message.",
                code="PROVIDER_UNAVAILABLE",
                retryable=response.status_code >= 500,
            )
        message_id = response.headers.get("x-message-id")
        return message_id or idempotency_key
