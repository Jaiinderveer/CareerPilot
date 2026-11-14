"""Deterministic adaptive interview controller owned by P3."""

from dataclasses import dataclass
from typing import Any, Literal

from app.schemas.evaluation import CriterionResult


@dataclass(frozen=True)
class NextAction:
    """Controller decision returned to the orchestration layer."""

    action: Literal['probe', 'select_question', 'clarify', 'finish']
    target_criterion_id: str | None = None


@dataclass(frozen=True)
class AdaptivePolicy:
    """MVP policy thresholds kept independent from provider implementations."""

    max_follow_ups_per_main_question: int = 1
    minimum_transcript_characters: int = 3
    minimum_criteria_for_evaluation: int = 1


def _criterion_needs_probe(result: CriterionResult) -> bool:
    return result.status in {'not_demonstrated', 'partially_demonstrated', 'uncertain'}


def choose_next_action(
    *,
    transcript_text: str,
    criterion_results: list[CriterionResult],
    follow_ups_for_parent: int = 0,
    remaining_main_questions: bool = True,
    policy: AdaptivePolicy | None = None,
) -> NextAction:
    """Choose the next deterministic interview action.

    AI services supply evidence only. This function owns the state-independent
    decision policy and never performs persistence or provider calls.
    """

    policy = policy or AdaptivePolicy()
    if len(transcript_text.strip()) < policy.minimum_transcript_characters:
        return NextAction(action='clarify')
    if len(criterion_results) < policy.minimum_criteria_for_evaluation:
        return NextAction(action='clarify')

    if follow_ups_for_parent < policy.max_follow_ups_per_main_question:
        for result in criterion_results:
            if _criterion_needs_probe(result):
                return NextAction(action='probe', target_criterion_id=result.criterion_id)

    if remaining_main_questions:
        return NextAction(action='select_question')
    return NextAction(action='finish')


def rubric_snapshot_from_row(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize a question/rubric join into the immutable turn snapshot."""

    rubric = row.get('rubric') or row.get('question_rubrics') or {}
    criteria = row.get('criteria') or row.get('rubric_criteria') or []
    return {
        'rubric_id': rubric.get('id'),
        'version': rubric.get('version', row.get('rubric_version', 1)),
        'expected_concepts': rubric.get('expected_concepts', {}),
        'skill_id': row.get('skill_id'),
        'criteria': [
            {
                'criterion_id': item.get('criterion_id'),
                'description': item.get('description'),
                'importance': item.get('importance'),
                'weight': item.get('weight'),
                'skill_id': item.get('skill_id'),
            }
            for item in criteria
        ],
    }
