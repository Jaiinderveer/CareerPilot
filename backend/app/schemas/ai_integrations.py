"""Provisional P4 contracts for AI and provider integration services.

These models are service-layer DTOs. They intentionally do not define database
columns; P3 remains responsible for mapping validated results to persistence and
for all interview lifecycle decisions.
"""

from __future__ import annotations

from enum import Enum, IntEnum
from typing import Annotated, Optional
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator


def _non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError('must not be blank')
    return value.strip()


NonBlankStr = Annotated[str, AfterValidator(_non_blank)]


class StrictContract(BaseModel):
    """Shared validation policy for provider-facing contracts."""

    model_config = ConfigDict(
        extra='forbid',
        str_strip_whitespace=True,
        validate_assignment=True,
        allow_inf_nan=False,
        use_enum_values=True,
    )


class DifficultyLevel(IntEnum):
    """Question difficulty aligned with the provisional question-bank contract."""

    BASIC = 1
    FOUNDATIONAL = 2
    INTERMEDIATE = 3
    ADVANCED = 4
    EXPERT = 5


class QuestionCategory(str, Enum):
    FUNDAMENTALS = 'fundamentals'
    TECHNICAL = 'technical'
    PROBLEM_SOLVING = 'problem_solving'
    SYSTEM_DESIGN = 'system_design'
    PROJECT = 'project'
    BEHAVIORAL = 'behavioral'
    SITUATIONAL = 'situational'


class CriterionStatus(str, Enum):
    """Values agreed in the provisional P3 API and database contracts."""

    DEMONSTRATED = 'demonstrated'
    PARTIALLY_DEMONSTRATED = 'partially_demonstrated'
    NOT_DEMONSTRATED = 'not_demonstrated'
    CONTRADICTED = 'contradicted'
    UNCERTAIN = 'uncertain'


class CriterionImportance(str, Enum):
    CRITICAL = 'critical'
    REQUIRED = 'required'
    OPTIONAL = 'optional'


class EvaluationCriterion(StrictContract):
    """Rubric criterion supplied by P3 from the turn's immutable snapshot."""

    criterion_id: NonBlankStr = Field(max_length=100)
    name: NonBlankStr = Field(max_length=160)
    description: NonBlankStr = Field(max_length=1000)
    max_score: int = Field(default=4, ge=1, le=10)
    importance: CriterionImportance = CriterionImportance.REQUIRED
    weight: float = Field(default=1.0, gt=0, le=1)
    accepted_alternatives: list[NonBlankStr] = Field(default_factory=list, max_length=20)
    common_misconceptions: list[NonBlankStr] = Field(default_factory=list, max_length=20)


class QuestionSchema(StrictContract):
    """Question proposed by AI or referencing P3's curated question bank."""

    question_id: Optional[UUID] = Field(
        default=None,
        description='Provisional reference to a curated question; not a database definition.',
    )
    question_text: NonBlankStr = Field(min_length=5, max_length=2000)
    category: QuestionCategory
    topic: NonBlankStr = Field(max_length=160)
    difficulty: DifficultyLevel
    estimated_minutes: int = Field(ge=1, le=20)
    evaluation_criteria: list[EvaluationCriterion] = Field(
        default_factory=list,
        max_length=10,
        description='Optional for planning; P3 supplies the authoritative rubric snapshot.',
    )


class InterviewPlanningRequest(StrictContract):
    role: NonBlankStr = Field(max_length=200)
    duration_minutes: int = Field(ge=10, le=60)
    difficulty: DifficultyLevel = DifficultyLevel.INTERMEDIATE
    interview_round: Optional[NonBlankStr] = Field(default=None, max_length=100)
    job_description: Optional[NonBlankStr] = Field(default=None, max_length=12_000)
    focus_topics: list[NonBlankStr] = Field(default_factory=list, max_length=20)
    candidate_experience_summary: Optional[NonBlankStr] = Field(default=None, max_length=4000)
    available_questions: list[QuestionSchema] = Field(
        default_factory=list,
        max_length=100,
        description='Optional P3-curated candidates; P3 validates any returned question IDs.',
    )


class InterviewPlanningResponse(StrictContract):
    plan_summary: NonBlankStr = Field(max_length=2000)
    questions: list[QuestionSchema] = Field(min_length=1, max_length=30)
    estimated_duration_minutes: int = Field(ge=1, le=60)
    category_distribution: dict[QuestionCategory, int] = Field(default_factory=dict)
    planning_notes: list[NonBlankStr] = Field(default_factory=list, max_length=20)

    @model_validator(mode='after')
    def validate_duration_budget(self) -> 'InterviewPlanningResponse':
        estimated = sum(question.estimated_minutes for question in self.questions)
        if estimated > self.estimated_duration_minutes:
            raise ValueError('question estimates exceed estimated_duration_minutes')
        return self


class AnswerEvaluationRequest(StrictContract):
    question: QuestionSchema
    candidate_answer: NonBlankStr = Field(max_length=30_000)
    criteria: list[EvaluationCriterion] = Field(min_length=1, max_length=20)
    transcript_is_complete: bool = True
    language: NonBlankStr = Field(default='en', max_length=35)

    @model_validator(mode='after')
    def validate_unique_criterion_ids(self) -> 'AnswerEvaluationRequest':
        ids = [criterion.criterion_id for criterion in self.criteria]
        if len(ids) != len(set(ids)):
            raise ValueError('criteria must have unique criterion_id values')
        return self


class CriterionResult(StrictContract):
    criterion_id: NonBlankStr = Field(max_length=100)
    criterion_name: NonBlankStr = Field(max_length=160)
    status: CriterionStatus
    score: Optional[int] = Field(default=None, ge=0)
    maximum_score: int = Field(ge=1, le=10)
    evidence: Optional[NonBlankStr] = Field(
        default=None,
        max_length=2000,
        description='Verbatim evidence from the candidate answer; null when absent or unclear.',
    )
    explanation: NonBlankStr = Field(max_length=3000)
    improvement_suggestions: list[NonBlankStr] = Field(default_factory=list, max_length=10)

    @model_validator(mode='after')
    def validate_score_and_evidence(self) -> 'CriterionResult':
        if self.score is not None and self.score > self.maximum_score:
            raise ValueError('score must not exceed maximum_score')
        if self.status == CriterionStatus.UNCERTAIN and self.score is not None:
            raise ValueError('uncertain criterion results must use a null score')
        if self.status in {CriterionStatus.NOT_DEMONSTRATED, CriterionStatus.UNCERTAIN} and self.evidence:
            raise ValueError('absent or uncertain evidence must be null')
        return self


class AnswerEvaluationResponse(StrictContract):
    criterion_results: list[CriterionResult] = Field(min_length=1, max_length=20)
    overall_score: Optional[float] = Field(default=None, ge=0, le=1)
    overall_feedback: NonBlankStr = Field(max_length=4000)
    strengths: list[NonBlankStr] = Field(default_factory=list, max_length=15)
    weaknesses: list[NonBlankStr] = Field(default_factory=list, max_length=15)
    needs_clarification: bool = False

    @model_validator(mode='after')
    def validate_unique_results(self) -> 'AnswerEvaluationResponse':
        ids = [result.criterion_id for result in self.criterion_results]
        if len(ids) != len(set(ids)):
            raise ValueError('criterion_results must have unique criterion_id values')
        return self

    def validate_against_request(self, request: AnswerEvaluationRequest) -> None:
        """Apply semantic checks that JSON Schema cannot express reliably."""

        expected = {criterion.criterion_id: criterion for criterion in request.criteria}
        actual = {result.criterion_id: result for result in self.criterion_results}
        if actual.keys() != expected.keys():
            missing = sorted(expected.keys() - actual.keys())
            unexpected = sorted(actual.keys() - expected.keys())
            raise ValueError(f'criterion result mismatch; missing={missing}, unexpected={unexpected}')

        answer = request.candidate_answer.casefold()
        for result in self.criterion_results:
            criterion = expected[result.criterion_id]
            if result.maximum_score != criterion.max_score:
                raise ValueError(f'maximum_score mismatch for {result.criterion_id}')
            if result.evidence and result.evidence.casefold() not in answer:
                raise ValueError(f'evidence for {result.criterion_id} is not a verbatim answer quote')


class FollowUpGenerationRequest(StrictContract):
    original_question: QuestionSchema
    candidate_answer: NonBlankStr = Field(max_length=30_000)
    evaluation: AnswerEvaluationResponse
    target_criterion_id: NonBlankStr = Field(max_length=100)
    previous_questions: list[NonBlankStr] = Field(default_factory=list, max_length=50)
    maximum_follow_ups: int = Field(default=1, ge=1, le=3)

    @model_validator(mode='after')
    def validate_target_criterion(self) -> 'FollowUpGenerationRequest':
        criterion_ids = {result.criterion_id for result in self.evaluation.criterion_results}
        if self.target_criterion_id not in criterion_ids:
            raise ValueError('target_criterion_id must exist in evaluation results')
        return self


class FollowUpGenerationResponse(StrictContract):
    questions: list[NonBlankStr] = Field(min_length=1, max_length=3)
    target_criterion_id: NonBlankStr = Field(max_length=100)
    rationale: NonBlankStr = Field(max_length=1500)


class InterviewTurnSummary(StrictContract):
    question: NonBlankStr = Field(max_length=2000)
    answer: NonBlankStr = Field(max_length=30_000)
    category: QuestionCategory
    topic: NonBlankStr = Field(max_length=160)
    evaluation: AnswerEvaluationResponse


class TopicResult(StrictContract):
    questions_asked: int = Field(ge=0)
    average_score: Optional[float] = Field(default=None, ge=0, le=1)
    demonstrated_criteria: list[NonBlankStr] = Field(default_factory=list)
    missing_criteria: list[NonBlankStr] = Field(default_factory=list)


class InterviewReportRequest(StrictContract):
    interview_id: Optional[UUID] = Field(
        default=None,
        description='P3 correlation ID only; the AI service does not load or persist the interview.',
    )
    role: NonBlankStr = Field(max_length=200)
    interview_round: Optional[NonBlankStr] = Field(default=None, max_length=100)
    turns: list[InterviewTurnSummary] = Field(min_length=1, max_length=100)
    computed_overall_score: Optional[float] = Field(default=None, ge=0, le=1)


class InterviewReportResponse(StrictContract):
    overall_summary: NonBlankStr = Field(max_length=6000)
    overall_score: Optional[float] = Field(default=None, ge=0, le=1)
    topic_results: dict[NonBlankStr, TopicResult] = Field(default_factory=dict)
    strengths: list[NonBlankStr] = Field(default_factory=list, max_length=20)
    weaknesses: list[NonBlankStr] = Field(default_factory=list, max_length=20)
    recommendations: list[NonBlankStr] = Field(default_factory=list, max_length=20)
    evidence_highlights: list[NonBlankStr] = Field(default_factory=list, max_length=30)
