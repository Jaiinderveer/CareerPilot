"""Unit tests for the deterministic P3 adaptive controller."""

from app.core.adaptive import choose_next_action
from app.schemas.evaluation import CriterionResult


def criterion(status: str, criterion_id: str = 'critical') -> CriterionResult:
    return CriterionResult(criterion_id=criterion_id, status=status, score=None)


def test_short_transcript_is_clarified_before_evaluation():
    decision = choose_next_action(
        transcript_text='ok',
        criterion_results=[criterion('uncertain')],
    )
    assert decision.action == 'clarify'


def test_missing_critical_evidence_requests_probe():
    decision = choose_next_action(
        transcript_text='A detailed candidate answer.',
        criterion_results=[criterion('not_demonstrated')],
    )
    assert decision.action == 'probe'
    assert decision.target_criterion_id == 'critical'


def test_follow_up_limit_allows_next_main_question():
    decision = choose_next_action(
        transcript_text='A detailed candidate answer.',
        criterion_results=[criterion('partially_demonstrated')],
        follow_ups_for_parent=1,
    )
    assert decision.action == 'select_question'


def test_follow_up_limit_also_bounds_clarification():
    decision = choose_next_action(
        transcript_text='ok',
        criterion_results=[criterion('uncertain')],
        follow_ups_for_parent=1,
    )
    assert decision.action == 'select_question'


def test_bounded_clarification_finishes_when_no_main_questions_remain():
    decision = choose_next_action(
        transcript_text='ok',
        criterion_results=[],
        follow_ups_for_parent=1,
        remaining_main_questions=False,
    )
    assert decision.action == 'finish'


def test_no_remaining_questions_finishes():
    decision = choose_next_action(
        transcript_text='A detailed candidate answer.',
        criterion_results=[criterion('demonstrated')],
        remaining_main_questions=False,
    )
    assert decision.action == 'finish'
