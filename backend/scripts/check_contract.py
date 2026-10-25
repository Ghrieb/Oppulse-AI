"""The contract check.

The frontend's contract is the contract of record. This compares it with
the routes the service actually serves, and it distinguishes two very
different situations:

- a route the service serves that the contract does not list — a **mismatch**,
  and the build fails;
- a route the contract lists that the service does not serve yet — a **gap**,
  reported and counted, because the mirror is being built in stages.

Each route in the contract also carries its coverage: the frontend files
that call it, or a deferred marker with the reason nothing does. A route
with neither, or a stale marker that contradicts a live caller, fails the
check however the other two sets look.

Run it with ``--strict`` to turn the gaps into failures too.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = ROOT / "contracts" / "paths.json"
DEFERRED_PATH = ROOT / "contracts" / "deferred.json"

#: The frontend writes ``:id``; FastAPI writes ``{id}``.
PARAMETER = re.compile(r":([A-Za-z_][A-Za-z0-9_]*)")


def normalise(path: str) -> str:
    """The same path, in one notation."""
    return PARAMETER.sub(r"{\1}", path)


def load_contract() -> dict[str, Any]:
    """The contract, as the frontend's exporter wrote it."""
    contract: dict[str, Any] = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    return contract


def contract_routes() -> set[tuple[str, str]]:
    """The routes the frontend's handlers define."""
    contract = load_contract()
    return {(route["method"].upper(), normalise(route["path"])) for route in contract["routes"]}


def deferred_routes() -> list[dict[str, Any]]:
    """The routes that are knowingly not called from the frontend yet."""
    routes: list[dict[str, Any]] = json.loads(DEFERRED_PATH.read_text(encoding="utf-8"))["routes"]
    return routes


def coverage_errors() -> list[str]:
    """The contract's own gaps: routes nobody calls and nothing defers.

    The exporter refuses to write an uncovered route, so reaching this means
    ``paths.json`` and ``contracts/deferred.json`` have drifted apart — a
    stale marker, a lost caller, or a hand edit.
    """
    contract = load_contract()
    reasons = {
        (route["method"].upper(), route["path"]): route["reason"] for route in deferred_routes()
    }
    errors: list[str] = []
    route_keys: set[tuple[str, str]] = set()
    hooks: dict[tuple[str, str], list[str]] = {}
    marks: dict[tuple[str, str], str] = {}

    for route in contract["routes"]:
        key = (route["method"].upper(), route["path"])
        route_keys.add(key)
        coverage = route.get("coverage")
        kind = coverage.get("kind") if isinstance(coverage, dict) else None

        if kind == "hook":
            hooks[key] = coverage.get("callers") or []
        elif kind == "deferred":
            marks[key] = coverage.get("reason") or ""
        else:
            errors.append(f"{key[0]} {key[1]}: no coverage entry (found {kind!r})")

    for key, callers in hooks.items():
        if not callers:
            errors.append(f"{key[0]} {key[1]}: marked as covered with no callers")
        if key in reasons:
            errors.append(
                f"{key[0]} {key[1]}: called by {', '.join(callers)} and listed in deferred.json"
            )

    for key, reason in marks.items():
        if not reason.strip():
            errors.append(f"{key[0]} {key[1]}: deferred without a reason")
        if key not in reasons:
            errors.append(f"{key[0]} {key[1]}: deferred in paths.json but not in deferred.json")
        elif reason != reasons[key]:
            errors.append(f"{key[0]} {key[1]}: the reason differs from deferred.json — re-export")

    for key in reasons:
        if key not in route_keys:
            errors.append(f"{key[0]} {key[1]}: listed in deferred.json but not a contract route")
        elif key not in marks:
            errors.append(f"{key[0]} {key[1]}: listed in deferred.json but paths.json disagrees")

    return errors


def served_routes() -> set[tuple[str, str]]:
    """The routes this service serves.

    They are read from the OpenAPI document, which is the same description
    of the service that a client sees.
    """
    from app.main import create_app

    app = create_app()
    document = app.openapi()
    routes: set[tuple[str, str]] = set()

    for path, operations in document.get("paths", {}).items():
        if not path.startswith("/api/v1"):
            continue
        for method in operations:
            if method.upper() in {"HEAD", "OPTIONS"}:
                continue
            routes.add((method.upper(), normalise(path)))

    return routes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail on the routes the contract lists and the service does not serve.",
    )
    arguments = parser.parse_args()

    contract = contract_routes()
    served = served_routes()
    deferred = deferred_routes()

    extra = sorted(served - contract)
    missing = sorted(contract - served)
    errors = coverage_errors()

    print(f"contract routes: {len(contract)}")
    print(f"served routes:   {len(served)}")
    print(f"deferred routes: {len(deferred)}")

    if extra:
        print("\nroutes the service serves that the contract does not list:")
        for method, path in extra:
            print(f"  {method} {path}")

    if missing:
        print(f"\nroutes the contract lists that are not implemented yet ({len(missing)}):")
        for method, path in missing:
            print(f"  {method} {path}")

    if errors:
        print(f"\ncoverage problems ({len(errors)}):")
        for error in errors:
            print(f"  {error}")

    if extra:
        print("\nFAIL: the service and the contract disagree.")
        return 1

    if missing and arguments.strict:
        print("\nFAIL: the contract is not fully implemented.")
        return 1

    if errors:
        print("\nFAIL: the contract's coverage is not in order.")
        return 1

    print("\nOK: every served route is in the contract, and every route is covered.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
