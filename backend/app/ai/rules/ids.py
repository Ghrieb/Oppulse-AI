"""Deterministic identifiers.

A derived record — a next action, a transient run marker — needs a stable
identifier that is a valid UUID, so the same input always produces the same
id. This is the port of the frontend's ``lib/ids.ts``, and it produces the
same values: the FNV-1a hash, over UTF-16 code units, exactly as the
JavaScript does.
"""

from __future__ import annotations

import struct

_FNV_OFFSET = 0x811C9DC5
_FNV_PRIME = 0x01000193
_MASK = 0xFFFFFFFF


def _code_units(seed: str) -> tuple[int, ...]:
    """The seed's UTF-16 code units.

    ``charCodeAt`` yields one unit per character, and a character outside the
    basic plane is two units. Encoding to UTF-16 and reading it back as
    16-bit words reproduces exactly that.
    """
    data = seed.encode("utf-16-le", errors="surrogatepass")
    return struct.unpack(f"<{len(data) // 2}H", data)


def _hash_step(seed: str, salt: int) -> int:
    """One FNV-1a step over the seed's UTF-16 code units."""
    value = (_FNV_OFFSET ^ salt) & _MASK

    for unit in _code_units(seed):
        value ^= unit
        value = (value * _FNV_PRIME) & _MASK

    return value


def deterministic_uuid(seed: str) -> str:
    """A deterministic, RFC-4122-shaped UUID derived from a seed string."""
    parts: list[str] = []
    for index in range(4):
        parts.append(f"{_hash_step(seed, index):08x}")

    hex_digits = list("".join(parts)[:32])

    # Version 4 and the RFC 4122 variant, so the value is a well-formed UUID.
    hex_digits[12] = "4"
    hex_digits[16] = f"{(int(hex_digits[16], 16) & 0x3) | 0x8:x}"

    value = "".join(hex_digits)
    return "-".join(
        (
            value[0:8],
            value[8:12],
            value[12:16],
            value[16:20],
            value[20:32],
        )
    )
