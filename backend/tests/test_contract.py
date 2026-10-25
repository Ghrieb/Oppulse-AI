"""The contract check, as a test.

The frontend's contract is the contract of record: the service must serve
exactly those routes, every route must carry a caller or a deferred marker,
the committed OpenAPI document must be the service's own, and the shared
rule cases must still produce the same answers on both sides.
"""

from __future__ import annotations

import json
from pathlib import Path

from scripts.check_contract import contract_routes, coverage_errors, served_routes
from scripts.export_openapi import build_document

ROOT = Path(__file__).resolve().parents[2]


def test_the_service_serves_nothing_the_contract_does_not_list() -> None:
    extra = served_routes() - contract_routes()

    assert not extra, f"the service serves routes the contract does not list: {sorted(extra)}"


def test_the_contract_file_is_the_one_the_frontend_generates() -> None:
    contract = json.loads((ROOT / "contracts" / "paths.json").read_text(encoding="utf-8"))

    assert contract["version"] == 1
    assert len(contract["routes"]) > 50
    # Every route is under the versioned prefix, and the prefix is the
    # service's, not the handler's.
    assert all(route["path"].startswith("/api/v1/") for route in contract["routes"])


def test_every_contract_route_is_covered_or_deferred() -> None:
    errors = coverage_errors()

    assert not errors, "\n".join(errors)


def test_the_committed_openapi_document_is_the_service_s_document() -> None:
    committed = json.loads((ROOT / "contracts" / "openapi.json").read_text(encoding="utf-8"))

    assert build_document() == committed, (
        "contracts/openapi.json is stale — run `python scripts/export_openapi.py` "
        "and review the diff."
    )


def test_the_authentication_routes_are_served() -> None:
    served = served_routes()

    for method, path in (
        ("GET", "/api/v1/auth/session"),
        ("POST", "/api/v1/auth/sign-in"),
        ("POST", "/api/v1/auth/sign-up"),
        ("POST", "/api/v1/auth/sign-out"),
        ("GET", "/api/v1/capabilities"),
    ):
        assert (method, path) in served
