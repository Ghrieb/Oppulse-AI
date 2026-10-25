"""Private document storage adapters."""

from __future__ import annotations

import hashlib
from pathlib import Path
from urllib.parse import quote

import httpx

from .config import Settings
from .errors import provider_unavailable


class DocumentStorage:
    """Stores document bytes durably for the configured environment."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def put(self, key: str, content: bytes, *, content_type: str) -> str:
        if self.settings.is_local:
            path = self._local_path(key)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            return key

        if not self.settings.supabase_url or not self.settings.supabase_service_role_key:
            raise provider_unavailable("Private document storage is not configured.")

        url = self._supabase_url(key)
        headers = {
            "Authorization": f"Bearer {self.settings.supabase_service_role_key}",
            "apikey": self.settings.supabase_service_role_key,
            "Content-Type": content_type,
            "x-upsert": "false",
        }
        async with httpx.AsyncClient(timeout=self.settings.fetch_timeout_seconds) as client:
            response = await client.post(url, content=content, headers=headers)
        if response.is_error:
            raise provider_unavailable("Private document storage could not save the file.")
        return key

    async def get(self, key: str) -> bytes:
        if self.settings.is_local:
            path = self._local_path(key)
            if not path.is_file():
                raise FileNotFoundError(key)
            return path.read_bytes()

        if not self.settings.supabase_url or not self.settings.supabase_service_role_key:
            raise provider_unavailable("Private document storage is not configured.")

        headers = {
            "Authorization": f"Bearer {self.settings.supabase_service_role_key}",
            "apikey": self.settings.supabase_service_role_key,
        }
        async with httpx.AsyncClient(timeout=self.settings.fetch_timeout_seconds) as client:
            response = await client.get(self._supabase_url(key), headers=headers)
        if response.status_code == 404:
            raise FileNotFoundError(key)
        if response.is_error:
            raise provider_unavailable("Private document storage could not read the file.")
        return response.content

    async def delete(self, key: str) -> None:
        if self.settings.is_local:
            self._local_path(key).unlink(missing_ok=True)
            return

        if not self.settings.supabase_url or not self.settings.supabase_service_role_key:
            raise provider_unavailable("Private document storage is not configured.")

        headers = {
            "Authorization": f"Bearer {self.settings.supabase_service_role_key}",
            "apikey": self.settings.supabase_service_role_key,
        }
        async with httpx.AsyncClient(timeout=self.settings.fetch_timeout_seconds) as client:
            response = await client.delete(self._supabase_url(key), headers=headers)
        if response.is_error and response.status_code != 404:
            raise provider_unavailable("Private document storage could not delete the file.")

    def _local_path(self, key: str) -> Path:
        root = Path(self.settings.storage_root).resolve()
        path = (root / key).resolve()
        if root not in path.parents:
            raise ValueError("Invalid document storage key.")
        return path

    def _supabase_url(self, key: str) -> str:
        if self.settings.supabase_url is None:
            raise provider_unavailable("Private document storage is not configured.")
        return (
            f"{self.settings.supabase_url.rstrip('/')}/storage/v1/object/"
            f"{quote(self.settings.storage_bucket, safe='')}/{quote(key, safe='/')}"
        )


def document_storage_key(owner_id: str, document_id: str, content: bytes) -> str:
    digest = hashlib.sha256(content).hexdigest()
    return f"{owner_id}/{document_id}-{digest}"
