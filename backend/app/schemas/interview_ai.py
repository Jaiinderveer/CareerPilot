"""Structured contracts shared by interview orchestration and AI services."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator


class InterviewAIModel(BaseModel):
    """Strict base model for provider-generated interview data."""

    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class QuestionEvaluationSchema(InterviewAIModel):
    """Normalized evaluation of one candidate answer.

    Scores use the API contract's normalized 0-1 scale.
    """

    clarity: float | None = Field(ge=0, le=1)
    technical_accuracy: float | None = Field(ge=0, le=1)
    communication: float | None = Field(ge=0, le=1)
    overall_score: float | None = Field(ge=0, le=1)
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    feedback: str = Field(min_length=1, max_length=500)


class FollowUpGenerationSchema(InterviewAIModel):
    """Provider recommendation for an optional follow-up question."""

    reasoning: str = Field(min_length=1, max_length=500)
    should_ask_followup: bool
    follow_up_question: str = Field(max_length=500)
    target_competency: str = Field(max_length=200)

    @model_validator(mode='after')
    def validate_recommendation(self) -> 'FollowUpGenerationSchema':
        if self.should_ask_followup:
            if not self.follow_up_question or not self.target_competency:
                raise ValueError('A recommended follow-up requires a question and competency')
        elif self.follow_up_question or self.target_competency:
            raise ValueError('No follow-up requires empty question and competency strings')
        return self


class InterviewTurnInput(InterviewAIModel):
    """Provider-neutral context for evaluating one interview turn."""

    question: str = Field(min_length=1)
    candidate_transcript: str = Field(min_length=1)
    rubric_criteria: list[
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    ] = Field(min_length=1)
    role_context: str = Field(min_length=1)
