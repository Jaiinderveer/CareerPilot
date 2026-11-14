"""Evaluation contracts shared by orchestration and AI services."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


CriterionStatus = Literal[
    'demonstrated',
    'partially_demonstrated',
    'not_demonstrated',
    'contradicted',
    'uncertain',
]


class CriterionResult(BaseModel):
    """One rubric criterion assessment."""

    model_config = ConfigDict(extra='ignore')

    criterion_id: str
    status: CriterionStatus
    score: int | None = Field(default=None, ge=0, le=4)
    evidence_quote: str | None = None
    explanation: str | None = None


class EvaluationResponse(BaseModel):
    """Persisted evaluation exposed to the client."""

    model_config = ConfigDict(extra='ignore')

    id: UUID
    overall_score: float | None = Field(default=None, ge=0, le=1)
    criterion_results: list[CriterionResult] = Field(default_factory=list)
