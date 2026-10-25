"""Structured logging, with redaction.

The rule is the same one the frontend keeps: a log line may carry
identifiers, event types, timings and stable error codes — and never a CV,
an extracted document, a prompt, a token or a private URL.
"""

from __future__ import annotations

import json
import logging
import re
import sys
from typing import Any

#: Keys whose values must never reach a log line.
SENSITIVE_KEY = re.compile(
    r"(token|secret|password|passphrase|api[-_]?key|authorization|cookie|session|"
    r"prompt|excerpt|document_text|body|content|resume|transcript)",
    re.IGNORECASE,
)

#: Anything that looks like a bearer token or a key, wherever it appears.
SECRET_VALUE = re.compile(
    r"(Bearer\s+[A-Za-z0-9._\-]+|sk-[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9._\-]{20,})",
)

REDACTED = "[redacted]"


def redact(value: Any) -> Any:
    """Replaces anything sensitive in a log payload.

    Cycles are tolerated, so a redacted log can never throw.
    """
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return SECRET_VALUE.sub(REDACTED, value)
    if isinstance(value, dict):
        return {
            key: (REDACTED if SENSITIVE_KEY.search(str(key)) else redact(entry))
            for key, entry in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [redact(entry) for entry in value]
    return str(value)


class JsonFormatter(logging.Formatter):
    """One JSON object per line.

    Structured logs are what makes a request traceable without reading
    anyone's data: a request id, a route, a status and a duration.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
        }

        context = getattr(record, "context", None)
        if isinstance(context, dict):
            payload.update(redact(context))

        if record.exc_info:
            # The exception type and code, never the traceback's contents:
            # a traceback can carry a prompt or a document.
            payload["error"] = record.exc_info[0].__name__ if record.exc_info[0] else "Error"

        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO") -> None:
    """Sets up the root logger."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())

    # Uvicorn keeps its own handlers; make them use ours.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        logger.handlers = []
        logger.propagate = True


def get_logger(name: str) -> logging.Logger:
    """A logger that carries a structured context."""
    logger = logging.getLogger(name)
    return logger
