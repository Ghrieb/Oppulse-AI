"""The foundation: health, readiness, capabilities and the error envelope."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.errors import ErrorCode


async def test_health_says_alive_and_nothing_else(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_health_discloses_no_version_or_dependency(client: AsyncClient) -> None:
    response = await client.get("/health")

    body = response.text.lower()
    for leak in ("version", "python", "sqlite", "postgres", "key", "secret"):
        assert leak not in body


async def test_readiness_reports_each_dependency(client: AsyncClient) -> None:
    response = await client.get("/health/ready")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["checks"]["database"] is True


async def test_capabilities_lists_every_service(client: AsyncClient) -> None:
    response = await client.get("/api/v1/capabilities")

    assert response.status_code == 200
    body = response.json()

    keys = {capability["key"] for capability in body["capabilities"]}
    assert keys == {
        "data",
        "ai",
        "search",
        "extraction",
        "monitoring",
        "in_app",
        "email",
    }


async def test_capabilities_never_claims_email_is_live(client: AsyncClient) -> None:
    response = await client.get("/api/v1/capabilities")

    email = next(
        capability for capability in response.json()["capabilities"] if capability["key"] == "email"
    )
    assert email["mode"] == "unavailable"


async def test_capabilities_report_a_simulated_ai_in_the_offline_mode(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/v1/capabilities")

    body = response.json()
    ai = next(capability for capability in body["capabilities"] if capability["key"] == "ai")
    assert ai["mode"] == "mocked"
    assert body["isPrototype"] is True


async def test_an_unknown_route_answers_with_the_error_envelope(client: AsyncClient) -> None:
    response = await client.get("/api/v1/nothing-here")

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == ErrorCode.NOT_FOUND
    assert "request_id" in body["error"]


async def test_every_response_echoes_the_request_id(client: AsyncClient) -> None:
    response = await client.get("/health", headers={"X-Request-ID": "req_from_the_client"})

    assert response.headers["X-Request-ID"] == "req_from_the_client"


async def test_a_request_without_an_id_gets_one(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.headers["X-Request-ID"].startswith("req_")


@pytest.mark.parametrize(
    ("origin", "allowed"),
    [
        ("http://localhost:5173", True),
        ("https://evil.example.com", False),
    ],
)
async def test_cors_allows_the_configured_origins_and_nothing_else(
    client: AsyncClient, origin: str, allowed: bool
) -> None:
    response = await client.get("/api/v1/capabilities", headers={"Origin": origin})

    header = response.headers.get("access-control-allow-origin")
    if allowed:
        assert header == origin
    else:
        assert header is None
