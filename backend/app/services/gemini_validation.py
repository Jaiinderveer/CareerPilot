"""Provider-neutral validation helpers for Gemini structured responses.

Phase 1 deliberately keeps provider calls out of this module. P3/P4 can use the
same parser after a `google-genai` response and mock it without network access.
"""

from __future__ import annotations

import json
from typing import TypeVar

from pydantic import BaseModel, ValidationError


ResponseModel = TypeVar('ResponseModel', bound=BaseModel)


class StructuredResponseError(Exception):
    """Base error for an unusable provider structured response."""


class MalformedStructuredResponseError(StructuredResponseError):
    """Raised when the provider returns no JSON or syntactically invalid JSON."""


class StructuredResponseValidationError(StructuredResponseError):
    """Raised when valid JSON does not satisfy the expected Pydantic model."""


def validate_structured_response(raw_text: str, model: type[ResponseModel]) -> ResponseModel:
    """Parse JSON text and enforce the full Pydantic response contract.

    Gemini schema-constrained generation reduces malformed output but is not a
    substitute for application validation. This function intentionally rejects
    Markdown fences and prose around JSON rather than attempting lossy repair.
    """

    if not raw_text or not raw_text.strip():
        raise MalformedStructuredResponseError('Provider returned an empty response')

    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise MalformedStructuredResponseError('Provider returned malformed JSON') from exc

    try:
        return model.model_validate(payload)
    except ValidationError as exc:
        raise StructuredResponseValidationError('Provider JSON failed schema validation') from exc
