"""Pydantic contracts for interview orchestration APIs."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.evaluation import CriterionResult, EvaluationResponse


InterviewStatus = Literal[
    'planned',
    'active',
    'paused',
    'finalizing',
    'completed',
    'abandoned',
]
NextAction = Literal['probe', 'select_question', 'clarify', 'finish']


class InterviewCreate(BaseModel):
    """Configuration used to create an interview."""

    model_config = ConfigDict(extra='forbid')

    company_id: UUID | None = None
    role: str | None = None
    round: str | None = None
    duration_minutes: int = Field(..., ge=10, le=60)
    job_description: str | None = None
    resume_url: str | None = None


class InterviewResponse(BaseModel):
    """Interview session summary."""

    model_config = ConfigDict(extra='ignore')

    id: UUID
    candidate_id: UUID
    company_id: UUID | None = None
    role: str | None = None
    round: str | None = None
    duration_minutes: int
    status: InterviewStatus
    job_description: str | None = None
    resume_url: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class TurnResponse(BaseModel):
    """Question turn exposed while conducting an interview."""

    model_config = ConfigDict(extra='ignore')

    id: UUID
    sequence_num: int
    question_text: str
    is_follow_up: bool
    parent_turn_id: UUID | None = None
    target_criterion_id: str | None = None
    asked_at: datetime


class AnswerSubmit(BaseModel):
    """Final transcript submitted for one turn."""

    model_config = ConfigDict(extra='forbid')

    transcript_text: str = Field(..., min_length=1)
    audio_duration_seconds: int | None = Field(default=None, ge=0)


class TurnAnswerSummary(BaseModel):
    """Answer data nested in a turn detail response."""

    model_config = ConfigDict(extra='ignore')

    id: UUID
    transcript_text: str
    audio_duration_seconds: int | None = None
    submitted_at: datetime


class TurnDetailResponse(TurnResponse):
    """Turn with its persisted answer and evaluation, when available."""

    interview_id: UUID
    question_id: UUID | None = None
    answer: TurnAnswerSummary | None = None
    evaluation: EvaluationResponse | None = None


class InterviewDetailResponse(InterviewResponse):
    """Interview summary plus its current turn and counters."""

    company: dict | None = None
    current_turn: TurnResponse | None = None
    total_turns: int = 0
    total_main_questions: int = 0
    total_follow_ups: int = 0


class InterviewStartResponse(BaseModel):
    interview_id: UUID
    status: Literal['active']
    started_at: datetime
    first_turn: TurnResponse
    tts_audio_url: str | None = None


class AnswerResponse(BaseModel):
    answer_id: UUID
    evaluation: EvaluationResponse
    next_action: NextAction
    next_turn: TurnResponse | None = None
    tts_audio_url: str | None = None


class TopicResult(BaseModel):
    questions_asked: int
    average_score: float | None = None
    demonstrated_criteria: list[str] = Field(default_factory=list)
    missing_criteria: list[str] = Field(default_factory=list)


class InterviewReportResponse(BaseModel):
    model_config = ConfigDict(extra='ignore')

    id: UUID
    interview_id: UUID
    overall_summary: str
    overall_score: float | None = Field(default=None, ge=0, le=1)
    topic_results: dict[str, TopicResult]
    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[str]
    generated_at: datetime


class InterviewFinishResponse(BaseModel):
    interview_id: UUID
    status: Literal['completed']
    ended_at: datetime
    report: InterviewReportResponse


class SkillStateResponse(BaseModel):
    model_config = ConfigDict(extra='ignore')

    skill_id: UUID
    skill_name: str
    current_difficulty: int = Field(ge=1, le=5)
    main_question_attempts: int = Field(ge=0)
    demonstrated_count: int = Field(ge=0)
    not_demonstrated_count: int = Field(ge=0)
    last_updated: datetime


class STTTokenResponse(BaseModel):
    token: str
    expires_at: datetime
    websocket_url: str
